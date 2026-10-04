import { readFile } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import WebSocket from 'ws';
import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';
import {
  createPool,
  migrate,
  PostgresDatabase,
  PostgresSessionStore,
  PostgresSessionDirectory,
  sql,
} from '@study/adapters/postgres';
import { Sessions, AppError, SESSION_COOKIE } from '@study/core/server';
import { identityModule, identityAccounts } from '@study/identity/server';
import { roomsModule, referralAttribution } from '@study/rooms/server';
import type { IdentityProvider } from '@study/feature-sdk';
import type { Provider, Room } from '@study/contracts';
import { createServer } from '../../apps/api/src/server.ts';
import { readConfig } from '../../apps/api/src/config.ts';
import { applicationMigrationManifest } from '../../scripts/application-migrations.ts';
import { MemoryLimiter } from '../fixtures/memory.ts';

const local = Object.fromEntries(
  (await readFile('.local/compose.env', 'utf8'))
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split('=')),
);
const migrationUrl =
  process.env.TEST_MIGRATION_DATABASE_URL ??
  `postgresql://study_migrator:${local.MIGRATION_PASSWORD}@localhost:5433/study_test`;
const runtimeUrl =
  process.env.TEST_DATABASE_URL ??
  `postgresql://study_runtime:${local.RUNTIME_PASSWORD}@localhost:5433/study_test`;
if (
  !new URL(migrationUrl).pathname.endsWith('_test') ||
  !new URL(runtimeUrl).pathname.endsWith('_test')
)
  throw new Error('Dedicated test databases required');
const pool = createPool(runtimeUrl),
  migrationPool = createPool(migrationUrl),
  db = new PostgresDatabase(pool),
  directory = new PostgresSessionDirectory(db),
  sessions = new Sessions(new PostgresSessionStore(db));
let server: Awaited<ReturnType<typeof createServer>>;
const host = 'localhost:8443',
  origin = 'https://localhost:8443';
const baseHeaders = { host, origin, 'x-study-auth': '1' };
const providers: IdentityProvider[] = (['google', 'microsoft', 'discord'] as const).map((id) => ({
  id,
  authorizationUrl: (challenge) => `https://provider.example/authorize?state=${challenge.state}`,
  exchange: async (code) => ({
    provider: id,
    issuer: `https://${id}.example`,
    subject: code,
    displayName: code === 'html' ? '<script>alert(1)</script>' : 'Study member',
  }),
}));
interface User {
  cookie: string;
  id: string;
  sessionId: string;
}
function cookie(response: { headers: Record<string, unknown> }, prefix: string) {
  const values = response.headers['set-cookie'];
  return (
    (Array.isArray(values) ? values : [values])
      .find((v): v is string => typeof v === 'string' && v.startsWith(prefix + '='))
      ?.split(';')[0] ?? ''
  );
}
async function csrf(user: User) {
  return (
    await server.app.inject({
      url: '/api/v1/session/csrf',
      headers: { ...baseHeaders, cookie: user.cookie },
    })
  ).json().csrfToken as string;
}
async function request(
  user: User | null,
  path: string,
  input?: unknown,
  extra: Record<string, string> = {},
) {
  return server.app.inject({
    method: input === undefined ? 'GET' : 'POST',
    url: `/api/v1/${path}`,
    headers: {
      ...baseHeaders,
      ...(user ? { cookie: user.cookie, 'x-csrf-token': (await csrf(user)) ?? '' } : {}),
      ...extra,
    },
    ...(input === undefined ? {} : { payload: input as object }),
  });
}
async function start(
  user: User | null,
  provider: Provider = 'google',
  mode: 'login' | 'link' | 'reauthenticate' = 'login',
  referralToken?: string,
) {
  const response = await request(user, 'account/start', {
    provider,
    mode,
    ...(referralToken ? { referralToken } : {}),
  });
  expect(response.statusCode, response.body).toBe(200);
  return {
    state: new URL(response.json().authorizationUrl).searchParams.get('state')!,
    flow: cookie(response, '__Host-study-flow'),
    provider,
  };
}
async function finish(user: User | null, flow: Awaited<ReturnType<typeof start>>, code: string) {
  return request(
    user,
    'account/finish',
    { provider: flow.provider, state: flow.state, code },
    { cookie: [user?.cookie, flow.flow].filter(Boolean).join('; ') },
  );
}
async function login(code: string, provider: Provider = 'google'): Promise<User> {
  const response = await finish(null, await start(null, provider), code);
  expect(response.statusCode, response.body).toBe(200);
  const value = cookie(response, SESSION_COOKIE);
  expect(value).not.toBe('');
  const session = await sessions.authenticate(value.split('=')[1]);
  return { cookie: value, id: session.subjectId, sessionId: session.id };
}
async function room(user: User, privacy: Room['privacy'] = 'private'): Promise<Room> {
  const response = await request(user, 'rooms/create', { name: 'Quiet room', privacy });
  expect(response.statusCode, response.body).toBe(200);
  return response.json();
}
beforeAll(async () => {
  await migrationPool.query('DROP SCHEMA IF EXISTS activities CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS room_media CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS backgrounds CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS pomodoro CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS tasks CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS chat CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS friends CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS rooms CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS identity CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS core CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS foundation CASCADE');
  const manifest = await applicationMigrationManifest();
  const added = new Set([
    '0005_invite_archive',
    '0003_referral_context',
    '0004_public_addresses_and_attribution',
    '0003_device_names',
    '0002_account_lifecycle',
    '0003_account_erasure',
    '0002_account_erasure',
  ]);
  await migrate(
    migrationPool,
    manifest.filter((m) => !added.has(m.id)),
  );
  const legacyId = randomUUID();
  await db.query(
    sql`INSERT INTO identity.users(id,display_name) VALUES(${legacyId},'Existing member')`,
  );
  const legacySession = await sessions.issue(legacyId);
  await migrate(migrationPool, manifest);
  const [legacy] = await db.query(
    sql`SELECT username,onboarding FROM identity.users WHERE id=${legacyId}`,
  );
  expect(legacy).toEqual({
    username: null,
    onboarding: { version: 1, identity: false, appearance: true, layout: true },
  });
  expect(
    (await directory.list({ subjectId: legacyId, sessionId: legacySession.session.id }))[0]
      ?.deviceName,
  ).toBe('');
});
beforeEach(async () => {
  await migrationPool.query(
    'TRUNCATE friends.relationships, friends.blocks, friends.privacy, rooms.invites, rooms.memberships, rooms.rooms, identity.oauth_flows, identity.identities, identity.users, core.sessions CASCADE',
  );
  const fail = (code: ConstructorParameters<typeof AppError>[0]): never => {
    throw new AppError(code);
  };
  server = await createServer({
    config: readConfig({
      NODE_ENV: 'test',
      APP_ORIGIN: origin,
      DATABASE_URL: runtimeUrl,
      REDIS_URL: 'redis://unused',
      LOG_LEVEL: 'silent',
    }),
    sessions,
    limiter: new MemoryLimiter(),
    modules: [
      identityModule({ referrals: referralAttribution(db), db, directory, providers, fail }),
      roomsModule({
        inviteKey: 'ab'.repeat(32),
        db,
        accountExists: identityAccounts(db).exists,
        fail,
      }),
    ],
  });
});
// Each test closes its runtime through the hook, including failing assertions.
import { afterEach } from 'vitest';
afterEach(async () => {
  await server.app.close();
});
afterAll(async () => {
  await Promise.all([pool.end(), migrationPool.end()]);
});

it('applies all migrations from zero, preserves history and runtime privileges', async () => {
  const manifest = await applicationMigrationManifest();
  await migrate(migrationPool, manifest);
  expect((await migrationPool.query('SELECT * FROM foundation.migrations')).rowCount).toBe(
    manifest.length,
  );
  await expect(
    migrate(
      migrationPool,
      manifest.map((m) => (m.owner === 'rooms' ? { ...m, sql: m.sql + '\n--drift' } : m)),
    ),
  ).rejects.toThrow('checksum');
  await expect(db.query(sql`CREATE TABLE rooms.denied(id int)`)).rejects.toThrow();
  await expect(db.query(sql`SELECT * FROM foundation.migrations`)).rejects.toThrow();
});
it.each(['google', 'microsoft', 'discord'] as const)(
  'creates/reuses a real account using %s and sets persistent HttpOnly cookies',
  async (provider) => {
    const a = await login('same-subject', provider),
      b = await login('same-subject', provider);
    expect(a.id).toBe(b.id);
    expect(a.sessionId).not.toBe(b.sessionId);
    const me = await request(a, 'account/me');
    expect(me.json().id).toBe(a.id);
    expect((await request(a, 'account/sessions')).json()).toHaveLength(2);
    expect((await db.query(sql`SELECT count(*)::int AS n FROM identity.users`))[0]?.n).toBe(1);
    expect(a.cookie).not.toContain(a.id);
  },
);
it.each(['google', 'discord'] as const)(
  'recreates a valid %s account after explicitly scoped test-fixture cleanup',
  async (provider) => {
    // This file is guarded above to *_test databases. There is no product cleanup endpoint.
    const original = await login('phase02-cleanup-fixture', provider),
      untouched = await login('keep-this-fixture', provider);
    const owned = await room(original),
      other = await room(untouched);
    const history = (
      await migrationPool.query('SELECT * FROM foundation.migrations ORDER BY owner,id')
    ).rows;
    await db.transaction(async (tx) => {
      await tx.query(sql`DELETE FROM rooms.invites WHERE room_id = ${owned.id}`);
      await tx.query(
        sql`DELETE FROM rooms.memberships WHERE room_id = ${owned.id} OR user_id = ${original.id}`,
      );
      await tx.query(
        sql`DELETE FROM rooms.rooms WHERE id = ${owned.id} AND owner_id = ${original.id}`,
      );
      await tx.query(sql`DELETE FROM identity.oauth_flows WHERE actor_id = ${original.id}`);
      await tx.query(sql`DELETE FROM core.sessions WHERE subject_id = ${original.id}`);
      await tx.query(sql`DELETE FROM identity.identities WHERE user_id = ${original.id}`);
      await tx.query(sql`DELETE FROM identity.users WHERE id = ${original.id}`);
    });
    const recreated = await login('phase02-cleanup-fixture', provider);
    expect(recreated.id).not.toBe(original.id);
    expect((await request(recreated, 'account/me')).json().id).toBe(recreated.id);
    expect((await request(untouched, `rooms/detail?roomId=${other.id}`)).statusCode).toBe(200);
    expect((await request(original, 'account/me')).statusCode).toBe(401);
    expect(
      (await migrationPool.query('SELECT * FROM foundation.migrations ORDER BY owner,id')).rows,
    ).toEqual(history);
  },
);
it('rejects wrong state, wrong browser, provider mixup, expiry and callback replay', async () => {
  const flow = await start(null);
  const body = { provider: flow.provider, state: flow.state, code: 'alice' };
  expect((await request(null, 'account/finish', body)).statusCode).toBe(401);
  expect(
    (
      await request(
        null,
        'account/finish',
        { ...body, state: randomBytes(32).toString('base64url') },
        { cookie: flow.flow },
      )
    ).statusCode,
  ).toBe(401);
  expect(
    (await request(null, 'account/finish', { ...body, provider: 'discord' }, { cookie: flow.flow }))
      .statusCode,
  ).toBe(401);
  expect((await finish(null, flow, 'alice')).statusCode).toBe(200);
  expect((await finish(null, flow, 'alice')).statusCode).toBe(401);
  const expired = await start(null);
  await db.query(
    sql`UPDATE identity.oauth_flows SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'`,
  );
  expect((await finish(null, expired, 'bob')).statusCode).toBe(401);
});
it('links explicitly, never merges matching names, and rejects identity takeover and session swapping', async () => {
  const alice = await login('alice'),
    bob = await login('bob', 'discord');
  expect(alice.id).not.toBe(bob.id);
  const flow = await start(alice, 'discord', 'link');
  expect((await finish(alice, flow, 'bob')).statusCode).toBe(409);
  const swapped = await start(alice, 'microsoft', 'link');
  expect((await finish(bob, swapped, 'alice-ms')).statusCode).toBe(401);
  const good = await start(alice, 'microsoft', 'link');
  expect((await finish(alice, good, 'alice-ms')).statusCode).toBe(200);
  expect((await login('alice-ms', 'microsoft')).id).toBe(alice.id);
  expect((await request(alice, 'account/identities')).json()).toHaveLength(2);
});
it('requires recent provider proof for linking and validates reauthentication identity', async () => {
  const alice = await login('alice');
  await db.query(
    sql`UPDATE core.sessions SET reauthenticated_at = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE id = ${alice.sessionId}`,
  );
  expect(
    (await request(alice, 'account/start', { provider: 'discord', mode: 'link' })).statusCode,
  ).toBe(403);
  expect(
    (await finish(alice, await start(alice, 'google', 'reauthenticate'), 'attacker')).statusCode,
  ).toBe(403);
  expect(
    (await finish(alice, await start(alice, 'google', 'reauthenticate'), 'alice')).statusCode,
  ).toBe(200);
  expect(
    (await request(alice, 'account/start', { provider: 'discord', mode: 'link' })).statusCode,
  ).toBe(200);
});
it('scopes session listings/revocation and supports logout/all other devices', async () => {
  const alice = await login('alice'),
    second = await login('alice'),
    bob = await login('bob');
  expect((await request(alice, 'account/revoke', { sessionId: bob.sessionId })).statusCode).toBe(
    403,
  );
  expect(
    (await request(alice, 'account/sessions')).json().map((s: { id: string }) => s.id),
  ).not.toContain(bob.sessionId);
  expect((await request(alice, 'account/revoke-others', {})).statusCode).toBe(200);
  expect((await request(second, 'account/me')).statusCode).toBe(401);
  expect((await request(bob, 'account/me')).statusCode).toBe(200);
  const logout = await request(alice, 'account/logout', {});
  expect(logout.statusCode).toBe(200);
  expect(String(logout.headers['set-cookie'])).toContain('Max-Age=0');
  expect((await request(alice, 'account/me')).statusCode).toBe(401);
});
it('renews through POST and leaves all GET/HEAD account and room state unchanged', async () => {
  const alice = await login('alice'),
    r = await room(alice);
  await db.query(
    sql`UPDATE core.sessions SET idle_expires_at = CURRENT_TIMESTAMP + INTERVAL '6 days' WHERE id = ${alice.sessionId}`,
  );
  const snapshot = async () =>
    Promise.all([
      db.query(sql`SELECT * FROM core.sessions ORDER BY id`),
      db.query(sql`SELECT * FROM rooms.memberships ORDER BY room_id, user_id`),
    ]);
  const before = await snapshot();
  for (const path of [
    'account/me',
    'account/sessions',
    'account/identities',
    'rooms/mine',
    'rooms/discover',
    `rooms/detail?roomId=${r.id}`,
    `rooms/invites?roomId=${r.id}`,
  ])
    expect((await request(alice, path)).statusCode).toBe(200);
  expect(await snapshot()).toEqual(before);
  const response = await request(alice, 'account/refresh', {});
  expect(response.statusCode).toBe(200);
  const replacement = cookie(response, SESSION_COOKIE);
  expect(replacement).not.toBe(alice.cookie);
  expect(String(response.headers['set-cookie'])).toMatch(
    /Secure; HttpOnly; SameSite=Lax; Max-Age=\d+/,
  );
  await expect(sessions.authenticate(alice.cookie.split('=')[1])).rejects.toThrow();
  expect((await sessions.authenticate(replacement.split('=')[1])).id).toBe(alice.sessionId);
});
it('resolves random public addresses without changing UUID authority and serializes slug claims', async () => {
  const alice = await login('address-alice'),
    bob = await login('address-bob'),
    a = await room(alice),
    b = await room(bob);
  expect(a.publicId).toMatch(/^[a-f0-9]{12}$/);
  expect(a.publicId).not.toBe(b.publicId);
  expect((await request(alice, `rooms/resolve?address=${a.publicId}`)).json().id).toBe(a.id);
  expect((await request(bob, `rooms/resolve?address=${a.publicId}`)).statusCode).toBe(403);
  expect((await request(bob, 'rooms/join', { roomId: a.publicId })).statusCode).toBe(400);
  for (const slug of ['new', 'admin', '012345abcdef', 'bad/slash', 'x'])
    expect(
      (await request(alice, 'rooms/slug', { roomId: a.id, version: a.version, slug })).statusCode,
    ).toBe(400);
  const claims = await Promise.all([
    request(alice, 'rooms/slug', { roomId: a.id, version: a.version, slug: ' Night-Study ' }),
    request(bob, 'rooms/slug', { roomId: b.id, version: b.version, slug: 'night-study' }),
  ]);
  expect(claims.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  const winner = claims.find((r) => r.statusCode === 200)!.json();
  expect(winner.slug).toBe('night-study');
  expect(winner.id).toBe(winner.ownerId === alice.id ? a.id : b.id);
  expect(
    (
      await request(winner.ownerId === alice.id ? alice : bob, `rooms/resolve?address=NIGHT-STUDY`)
    ).json().id,
  ).toBe(winner.id);
});
it('stores reusable invites as authenticated encrypted envelopes and separates signup attribution from access', async () => {
  const alice = await login('referrer'),
    r = await room(alice);
  const invite = (
    await request(alice, 'rooms/invite-create', { roomId: r.id, maxUses: 3, expiresInHours: 24 })
  ).json();
  const [stored] = await db.query(
    sql`SELECT token_hash,token_cipher FROM rooms.invites WHERE id=${invite.id}`,
  );
  expect(String(stored?.token_cipher)).not.toContain(invite.token);
  expect(String(stored?.token_hash)).not.toContain(invite.token);
  expect((await request(alice, `rooms/invites?roomId=${r.id}`)).json()[0].token).toBe(invite.token);
  const landingId = randomUUID();
  for (let n = 0; n < 2; n++)
    expect(
      (await request(null, 'rooms/referral-land', { token: invite.token, landingId })).statusCode,
    ).toBe(200);
  const flow = await start(null, 'google', 'login', invite.token),
    signup = await finish(null, flow, 'referred-user');
  const session = await sessions.authenticate(cookie(signup, SESSION_COOKIE).split('=')[1]);
  const newcomer = {
    cookie: cookie(signup, SESSION_COOKIE),
    id: session.subjectId,
    sessionId: session.id,
  };
  // Attribution has no membership side effect.
  expect((await request(newcomer, `rooms/detail?roomId=${r.id}`)).statusCode).toBe(403);
  const [link] = await db.query(sql`SELECT id FROM rooms.referral_links`);
  await referralAttribution(db).conversion(
    String(link!.id),
    newcomer.id,
    'supporter-event-fixture',
  );
  await referralAttribution(db).conversion(
    String(link!.id),
    newcomer.id,
    'supporter-event-fixture',
  );
  const kinds = await db.query(
    sql`SELECT kind,count(*)::int AS n FROM rooms.referral_events GROUP BY kind ORDER BY kind`,
  );
  expect(kinds).toEqual([
    { kind: 'free-signup', n: 1 },
    { kind: 'future-conversion', n: 1 },
    { kind: 'landing', n: 1 },
  ]);
  expect((await request(newcomer, 'rooms/invite-redeem', { token: invite.token })).statusCode).toBe(
    200,
  );
  const tracked = (await request(alice, `rooms/invites?roomId=${r.id}`)).json()[0];
  expect(tracked).toMatchObject({ joins: 1, signups: 1, uses: 1, status: 'active' });
  expect(tracked).not.toHaveProperty('subjectId');
  await request(alice, 'rooms/invite-revoke', { roomId: r.id, inviteId: invite.id });
  expect((await request(alice, `rooms/invites?roomId=${r.id}`)).json()[0]).toMatchObject({
    status: 'revoked',
    token: null,
  });
  const joins = await db.query(sql`SELECT * FROM rooms.invite_joins WHERE invite_id=${invite.id}`);
  const links = await db.query(sql`SELECT * FROM rooms.referral_links ORDER BY id`);
  const events = await db.query(sql`SELECT * FROM rooms.referral_events ORDER BY id`);
  expect(
    (await request(newcomer, 'rooms/invite-delete', { roomId: r.id, inviteId: invite.id }))
      .statusCode,
  ).toBe(403);
  const other = await room(alice);
  expect(
    (await request(alice, 'rooms/invite-delete', { roomId: other.id, inviteId: invite.id }))
      .statusCode,
  ).toBe(403);
  for (let n = 0; n < 2; n++)
    expect(
      (await request(alice, 'rooms/invite-delete', { roomId: r.id, inviteId: invite.id }))
        .statusCode,
    ).toBe(200);
  expect((await request(alice, `rooms/invites?roomId=${r.id}`)).json()).toEqual([]);
  const [tombstone] = await db.query(
    sql`SELECT revoked_at,archived_at,token_cipher,token_hash FROM rooms.invites WHERE id=${invite.id}`,
  );
  expect(tombstone).toMatchObject({
    revoked_at: expect.any(Date),
    archived_at: expect.any(Date),
    token_cipher: null,
    token_hash: stored!.token_hash,
  });
  expect((await request(newcomer, 'rooms/invite-redeem', { token: invite.token })).statusCode).toBe(
    403,
  );
  expect(
    await db.query(sql`SELECT * FROM rooms.invite_joins WHERE invite_id=${invite.id}`),
  ).toEqual(joins);
  expect(await db.query(sql`SELECT * FROM rooms.referral_links ORDER BY id`)).toEqual(links);
  expect(await db.query(sql`SELECT * FROM rooms.referral_events ORDER BY id`)).toEqual(events);
});
it('enforces room privacy, persistent ownership and public-only enumeration', async () => {
  const alice = await login('alice'),
    bob = await login('bob');
  const privateRoom = await room(alice),
    unlisted = await room(alice, 'unlisted'),
    publicRoom = await room(alice, 'public');
  const discovered = (await request(bob, 'rooms/discover')).json().rooms as Room[];
  expect(discovered.map((r) => r.id)).toEqual([publicRoom.id]);
  expect((await request(bob, 'rooms/mine')).json().rooms).toEqual([]);
  for (const roomId of [privateRoom.id, randomUUID()]) {
    const denied = await request(bob, `rooms/detail?roomId=${roomId}`);
    expect(denied.statusCode).toBe(403);
    expect(denied.body).not.toContain('Quiet room');
    expect((await request(bob, 'rooms/join', { roomId })).statusCode).toBe(403);
  }
  await request(alice, 'account/logout', {});
  for (const r of [publicRoom, unlisted])
    expect((await request(bob, 'rooms/join', { roomId: r.id })).statusCode).toBe(200);
  const ownerAgain = await login('alice');
  expect((await request(ownerAgain, `rooms/detail?roomId=${privateRoom.id}`)).statusCode).toBe(200);
});
it('rejects forged ownership/roles and cross-user or cross-room edits through direct HTTP', async () => {
  const alice = await login('alice'),
    bob = await login('bob'),
    r = await room(alice, 'public');
  for (const forged of [
    { ownerId: alice.id },
    { userId: alice.id },
    { role: 'owner' },
    { owner: true },
  ])
    expect(
      (await request(bob, 'rooms/create', { name: 'Forged', privacy: 'public', ...forged }))
        .statusCode,
    ).toBe(400);
  expect(
    (
      await request(bob, 'rooms/update', {
        roomId: r.id,
        version: r.version,
        name: 'Hijack',
        privacy: 'public',
      })
    ).statusCode,
  ).toBe(403);
  expect((await request(bob, 'rooms/join', { roomId: r.id, role: 'owner' })).statusCode).toBe(400);
  expect(
    (await request(bob, 'account/profile', { displayName: 'Hijack', userId: alice.id })).statusCode,
  ).toBe(400);
  expect(
    (
      await request(alice, 'rooms/update', {
        roomId: r.id,
        version: r.version + 1,
        name: 'Stale',
        privacy: 'public',
      })
    ).statusCode,
  ).toBe(409);
  const updated = await request(alice, 'rooms/update', {
    roomId: r.id,
    version: r.version,
    name: "'; DROP TABLE rooms.rooms; --",
    privacy: 'private',
  });
  expect(updated.statusCode).toBe(200);
  expect((await request(bob, `rooms/detail?roomId=${r.id}`)).statusCode).toBe(403);
});
it('restricts invite administration, hides token hashes, and enforces cross-room revocation', async () => {
  const alice = await login('alice'),
    bob = await login('bob'),
    r = await room(alice),
    other = await room(alice);
  expect(
    (await request(bob, 'rooms/invite-create', { roomId: r.id, maxUses: 1, expiresInHours: 1 }))
      .statusCode,
  ).toBe(403);
  const created = (
    await request(alice, 'rooms/invite-create', { roomId: r.id, maxUses: 1, expiresInHours: 1 })
  ).json();
  expect((await request(bob, `rooms/invites?roomId=${r.id}`)).statusCode).toBe(403);
  const listed = await request(alice, `rooms/invites?roomId=${r.id}`);
  expect(
    (await request(alice, 'rooms/invite-delete', { roomId: r.id, inviteId: created.id }))
      .statusCode,
  ).toBe(403);
  expect(listed.json()[0].token).toBe(created.token);
  expect(listed.body).not.toContain('token_hash');
  expect(listed.body).not.toContain('token_cipher');
  expect(
    (await request(alice, 'rooms/invite-revoke', { roomId: other.id, inviteId: created.id }))
      .statusCode,
  ).toBe(403);
  expect(
    (await request(bob, 'rooms/invite-redeem', { token: created.token, roomId: other.id }))
      .statusCode,
  ).toBe(400);
  expect(
    (await request(alice, 'rooms/invite-revoke', { roomId: r.id, inviteId: created.id }))
      .statusCode,
  ).toBe(200);
  expect((await request(bob, 'rooms/invite-redeem', { token: created.token })).statusCode).toBe(
    403,
  );
});
it('redeems a one-use invite exactly once under contention and denies expiry/forged tokens', async () => {
  const alice = await login('alice'),
    bob = await login('bob'),
    carol = await login('carol'),
    r = await room(alice);
  const created = (
    await request(alice, 'rooms/invite-create', { roomId: r.id, maxUses: 1, expiresInHours: 1 })
  ).json();
  const results = await Promise.all(
    [bob, carol].map((u) => request(u, 'rooms/invite-redeem', { token: created.token })),
  );
  expect(results.map((r) => r.statusCode).sort()).toEqual([200, 403]);
  expect(
    (await db.query(sql`SELECT uses FROM rooms.invites WHERE id = ${created.id}`))[0]?.uses,
  ).toBe(1);
  expect(
    (await request(bob, 'rooms/invite-redeem', { token: randomBytes(32).toString('base64url') }))
      .statusCode,
  ).toBe(403);
  const expiring = (
    await request(alice, 'rooms/invite-create', { roomId: r.id, maxUses: 10, expiresInHours: 1 })
  ).json();
  await migrationPool.query(
    "UPDATE rooms.invites SET created_at = CURRENT_TIMESTAMP - INTERVAL '2 hours', expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE id = $1",
    [expiring.id],
  );
  expect((await request(bob, 'rooms/invite-redeem', { token: expiring.token })).statusCode).toBe(
    403,
  );
});
it('keeps every new ordinary command behind session, Origin and CSRF checks', async () => {
  const alice = await login('alice');
  for (const path of [
    'rooms/create',
    'rooms/update',
    'rooms/join',
    'rooms/invite-create',
    'rooms/invite-revoke',
    'rooms/invite-redeem',
    'account/profile',
    'account/revoke',
    'account/revoke-others',
  ]) {
    expect((await request(null, path, {})).statusCode).toBe(401);
    expect((await request(alice, path, {}, { 'x-csrf-token': '' })).statusCode).toBe(403);
    expect((await request(alice, path, {}, { origin: 'https://evil.example' })).statusCode).toBe(
      403,
    );
    expect((await request(alice, path)).statusCode).toBe(404);
  }
});

it('emits membership facts once and does not promote stored moderators to owners', async () => {
  const alice = await login('alice'),
    bob = await login('bob');
  const r = await room(alice, 'public');
  const facts: unknown[] = [];
  server.runtime.events.subscribe('rooms.member-joined', async (value) => {
    facts.push(value);
  });
  await request(bob, 'rooms/join', { roomId: r.id });
  await request(bob, 'rooms/join', { roomId: r.id });
  expect(facts).toEqual([{ roomId: r.id }]);
  await db.query(
    sql`UPDATE rooms.memberships SET role = 'moderator' WHERE room_id = ${r.id} AND user_id = ${bob.id}`,
  );
  expect(
    (
      await request(bob, 'rooms/update', {
        roomId: r.id,
        version: 1,
        name: 'Denied',
        privacy: 'private',
      })
    ).statusCode,
  ).toBe(403);
});

it('revoke-all invalidates persistent credentials and connected WebSocket commands', async () => {
  const alice = await login('alice'),
    another = await login('alice');
  await server.app.listen({ host: '127.0.0.1', port: 0 });
  const address = server.app.server.address();
  if (!address || typeof address === 'string') throw new Error('Listener unavailable');
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/v1/realtime`, {
    headers: { host, origin, cookie: another.cookie },
  });
  try {
    await once(socket, 'open');
    expect((await request(alice, 'account/revoke-all', {})).statusCode).toBe(200);
    const closed = once(socket, 'close');
    const message = once(socket, 'message');
    socket.send(
      JSON.stringify({
        version: 1,
        requestId: randomUUID(),
        command: 'identity.start',
        payload: {},
      }),
    );
    expect(JSON.parse(String((await message)[0])).error.code).toBe('UNAUTHENTICATED');
    expect((await closed)[0]).toBe(1008);
    await expect(sessions.authenticate(alice.cookie.split('=')[1])).rejects.toThrow();
    await expect(sessions.authenticate(another.cookie.split('=')[1])).rejects.toThrow();
  } finally {
    socket.terminate();
  }
});

it('does not finish linking after its initiating session is revoked', async () => {
  const alice = await login('alice');
  const flow = await start(alice, 'discord', 'link');
  await directory.revokeOwned({ subjectId: alice.id, sessionId: alice.sessionId }, alice.sessionId);
  expect((await finish(alice, flow, 'attacker')).statusCode).toBe(401);
  expect(
    await db.query(sql`SELECT * FROM identity.identities WHERE user_id = ${alice.id}`),
  ).toHaveLength(1);
});

it('normalizes usernames, rejects reserved/invalid handles and serializes concurrent claims', async () => {
  const a = await login('claim-a'),
    b = await login('claim-b');
  for (const username of ['ab', 'admin', 'StudySpace_support', 'bad-name', 'a'.repeat(25), 'аdmin'])
    expect((await request(a, 'account/username', { username })).statusCode).toBe(400);
  const responses = await Promise.all([
    request(a, 'account/username', { username: '  Alice_1  ' }),
    request(b, 'account/username', { username: 'ALICE_1' }),
  ]);
  expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  const winner = responses[0]!.statusCode === 200 ? a : b,
    loser = winner === a ? b : a;
  const profile = (await request(winner, 'account/me')).json();
  expect(profile.username).toBe('alice_1');
  expect(profile.id).toBe(winner.id);
  expect(profile.onboarding).toEqual({
    version: 1,
    identity: true,
    appearance: false,
    layout: false,
  });
  expect((await request(loser, 'account/username-available?username=Alice_1')).json()).toEqual({
    available: false,
  });
  expect((await request(winner, 'account/username', { username: 'different' })).statusCode).toBe(
    429,
  );
  await db.query(
    sql`UPDATE identity.users SET username_changed_at=CURRENT_TIMESTAMP-INTERVAL '8 days' WHERE id=${winner.id}`,
  );
  expect(
    (await request(winner, 'account/username', { username: 'Different' })).json().username,
  ).toBe('different');
  expect((await request(loser, 'account/username-available?username=alice_1')).json()).toEqual({
    available: true,
  });
});
it('persists onboarding milestones across sessions and gives existing users identity-only setup', async () => {
  const user = await login('onboarding');
  expect((await request(user, 'account/onboarding', { step: 'layout' })).statusCode).toBe(409);
  await request(user, 'account/username', { username: 'onboarded' });
  await request(user, 'account/onboarding', { step: 'appearance' });
  const restored = await login('onboarding');
  expect((await request(restored, 'account/me')).json().onboarding).toEqual({
    version: 1,
    identity: true,
    appearance: true,
    layout: false,
  });
  expect(
    (await request(restored, 'account/onboarding', { step: 'layout' })).json().onboarding.layout,
  ).toBe(true);
  await db.query(
    sql`UPDATE identity.users SET username=NULL, username_changed_at=NULL, onboarding='{"version":1,"identity":false,"appearance":true,"layout":true}'::jsonb WHERE id=${user.id}`,
  );
  const legacy = await request(restored, 'account/username', { username: 'legacy_name' });
  expect(legacy.json().onboarding).toEqual({
    version: 1,
    identity: true,
    appearance: true,
    layout: true,
  });
});
it('binds validated return destinations to the OAuth flow and rejects open redirects', async () => {
  for (const returnTo of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/home?next=https://evil.test',
    '/%2f%2fevil.test',
    '/auth/callback/google',
  ])
    expect(
      (await request(null, 'account/start', { provider: 'google', mode: 'login', returnTo }))
        .statusCode,
    ).toBe(400);
  const token = randomBytes(32).toString('base64url');
  for (const returnTo of ['/home', `/rooms/${randomUUID()}`, `/invite#${token}`]) {
    const response = await request(null, 'account/start', {
      provider: 'google',
      mode: 'login',
      returnTo,
    });
    const flow = {
      provider: 'google' as const,
      state: new URL(response.json().authorizationUrl).searchParams.get('state')!,
      flow: cookie(response, '__Host-study-flow'),
    };
    const result = await finish(null, flow, randomUUID());
    expect(result.json()).toEqual({ ok: true, returnTo });
    const c = cookie(result, SESSION_COOKIE);
    const auth = await sessions.authenticate(c.split('=')[1]);
    expect(
      (await request({ cookie: c, id: auth.subjectId, sessionId: auth.id }, 'account/me')).json()
        .onboardingReturnTo,
    ).toBe(returnTo);
  }
});
it('keeps device names cosmetic and prevents cross-account renames and unlink lockout', async () => {
  const a = await login('devices'),
    b = await login('other');
  expect(
    (await request(a, 'account/rename-session', { sessionId: b.sessionId, name: 'My laptop' }))
      .statusCode,
  ).toBe(403);
  expect(
    (
      await request(a, 'account/rename-session', {
        sessionId: a.sessionId,
        name: 'My laptop',
        subjectId: b.id,
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (await request(a, 'account/rename-session', { sessionId: a.sessionId, name: 'My laptop' }))
      .statusCode,
  ).toBe(200);
  const [device] = (await request(a, 'account/sessions')).json();
  expect(device.deviceName).toBe('My laptop');
  expect(device.id).toBe(a.sessionId);
  expect(device.deviceLabel).not.toBe('My laptop');
  expect((await request(a, 'account/unlink', { provider: 'google' })).statusCode).toBe(409);
  expect((await finish(a, await start(a, 'discord', 'link'), 'linked-discord')).statusCode).toBe(
    200,
  );
  const result = await Promise.all([
    request(a, 'account/unlink', { provider: 'google' }),
    request(a, 'account/unlink', { provider: 'discord' }),
  ]);
  expect(result.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  expect((await request(a, 'account/identities')).json()).toHaveLength(1);
});
async function deletionProof(user: User, code: string) {
  const response = await request(user, 'account/start', {
    provider: 'google',
    mode: 'reauthenticate',
    returnTo: '/account#delete',
  });
  expect(response.statusCode).toBe(200);
  return finish(
    user,
    {
      provider: 'google',
      state: new URL(response.json().authorizationUrl).searchParams.get('state')!,
      flow: cookie(response, '__Host-study-flow'),
    },
    code,
  );
}
it('requires a dedicated same-session unexpired OAuth proof and exact destructive confirmation', async () => {
  const a = await login('delete-proof'),
    otherSession = await login('delete-proof');
  expect((await request(a, 'account/delete-account', { confirmation: 'DELETE' })).statusCode).toBe(
    403,
  );
  await finish(a, await start(a, 'google', 'reauthenticate'), 'delete-proof');
  expect((await request(a, 'account/delete-account', { confirmation: 'DELETE' })).statusCode).toBe(
    403,
  );
  expect((await deletionProof(a, 'wrong-account')).statusCode).toBe(403);
  expect((await deletionProof(a, 'delete-proof')).statusCode).toBe(200);
  expect(
    (await request(otherSession, 'account/delete-account', { confirmation: 'DELETE' })).statusCode,
  ).toBe(403);
  expect((await request(a, 'account/delete-account', { confirmation: 'delete' })).statusCode).toBe(
    400,
  );
  expect(
    (
      await request(
        a,
        'account/delete-account',
        { confirmation: 'DELETE' },
        { 'x-csrf-token': 'invalid' },
      )
    ).statusCode,
  ).toBe(403);
  await db.query(
    sql`UPDATE identity.deletion_proofs SET expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE user_id=${a.id}`,
  );
  expect((await request(a, 'account/delete-account', { confirmation: 'DELETE' })).statusCode).toBe(
    403,
  );
});
it('erases owned data and all sessions while preserving other members rooms and contributions', async () => {
  const a = await login('erase-me'),
    second = await login('erase-me'),
    b = await login('keep-me');
  const owned = await room(a),
    shared = await room(b, 'public');
  await request(a, 'rooms/join', { roomId: shared.id });
  await request(a, 'rooms/invite-create', { roomId: owned.id, expiresInHours: 1, maxUses: 2 });
  await db.query(
    sql`INSERT INTO friends.relationships(low_id,high_id,sender_id,state) VALUES(${[a.id, b.id].sort()[0]},${[a.id, b.id].sort()[1]},${a.id},'accepted')`,
  );
  for (const [author, roomId] of [
    [a.id, shared.id],
    [b.id, shared.id],
    [b.id, owned.id],
  ]) {
    await db.query(
      sql`INSERT INTO chat.messages(id,room_id,author_id,request_id,text) VALUES(${randomUUID()},${roomId},${author},${randomUUID()},'message')`,
    );
    await db.query(
      sql`INSERT INTO tasks.shared_items(id,room_id,created_by,request_id,title,position) VALUES(${randomUUID()},${roomId},${author},${randomUUID()},'task',0)`,
    );
  }
  await db.query(
    sql`INSERT INTO tasks.personal_items(id,owner_id,created_by,request_id,title,position) VALUES(${randomUUID()},${a.id},${a.id},${randomUUID()},'private',0)`,
  );
  await db.query(
    sql`INSERT INTO pomodoro.personal_timers(user_id,state) VALUES(${a.id},'{"scope":"personal"}'::jsonb)`,
  );
  await db.query(
    sql`INSERT INTO room_media.baselines(room_id,baseline,settings) VALUES(${owned.id},'{}'::jsonb,'{}'::jsonb)`,
  );
  expect((await deletionProof(a, 'erase-me')).statusCode).toBe(200);
  const result = await request(a, 'account/delete-account', { confirmation: 'DELETE' });
  expect(result.statusCode, result.body).toBe(200);
  expect((await request(a, 'account/me')).statusCode).toBe(401);
  expect((await request(second, 'account/me')).statusCode).toBe(401);
  expect(
    (await request(null, 'account/providers', undefined, { cookie: a.cookie })).statusCode,
  ).toBe(200);
  for (const table of ['identity.users', 'identity.identities', 'core.sessions']) {
    const column =
      table === 'identity.users'
        ? 'id'
        : table === 'identity.identities'
          ? 'user_id'
          : 'subject_id';
    expect(
      (await migrationPool.query(`SELECT * FROM ${table} WHERE ${column}=$1`, [a.id])).rowCount,
    ).toBe(0);
  }
  expect(await db.query(sql`SELECT id FROM rooms.rooms WHERE id=${owned.id}`)).toHaveLength(0);
  expect(await db.query(sql`SELECT id FROM rooms.rooms WHERE id=${shared.id}`)).toHaveLength(1);
  expect(await db.query(sql`SELECT author_id FROM chat.messages`)).toEqual([{ author_id: b.id }]);
  expect(await db.query(sql`SELECT created_by FROM tasks.shared_items`)).toEqual([
    { created_by: b.id },
  ]);
  expect(await db.query(sql`SELECT id FROM tasks.personal_items`)).toHaveLength(0);
  expect(await db.query(sql`SELECT user_id FROM pomodoro.personal_timers`)).toHaveLength(0);
  expect(await db.query(sql`SELECT room_id FROM room_media.baselines`)).toHaveLength(0);
  expect(await db.query(sql`SELECT id FROM rooms.invites`)).toHaveLength(0);
  expect(await db.query(sql`SELECT low_id FROM friends.relationships`)).toHaveLength(0);
  expect((await request(b, 'account/me')).statusCode).toBe(200);
});

it('serializes account erasure with an already issuing login so no session survives', async () => {
  const user = await login('concurrent-erasure');
  expect((await deletionProof(user, 'concurrent-erasure')).statusCode).toBe(200);
  const flow = await start(null);
  let release!: () => void, reached!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const issuing = new Promise<void>((r) => {
    reached = r;
  });
  const issue = sessions.issue.bind(sessions);
  const spy = vi.spyOn(sessions, 'issue').mockImplementation(async (...args) => {
    const result = await issue(...args);
    reached();
    await gate;
    return result;
  });
  try {
    const loginResult = finish(null, flow, 'concurrent-erasure');
    await issuing;
    const deletion = request(user, 'account/delete-account', { confirmation: 'DELETE' });
    release();
    expect((await loginResult).statusCode).toBe(200);
    expect((await deletion).statusCode).toBe(200);
    expect(await db.query(sql`SELECT id FROM core.sessions WHERE subject_id=${user.id}`)).toEqual(
      [],
    );
    expect(await db.query(sql`SELECT id FROM identity.users WHERE id=${user.id}`)).toEqual([]);
  } finally {
    release();
    spy.mockRestore();
  }
});
