import { readFile } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import WebSocket from 'ws';
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
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
import { roomsModule } from '@study/rooms/server';
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
) {
  const response = await request(user, 'account/start', { provider, mode });
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
  await migrationPool.query('DROP SCHEMA IF EXISTS backgrounds CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS pomodoro CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS tasks CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS chat CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS friends CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS rooms CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS identity CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS core CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS foundation CASCADE');
  await migrate(migrationPool, await applicationMigrationManifest());
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
      identityModule({ db, directory, providers, fail }),
      roomsModule({ db, accountExists: identityAccounts(db).exists, fail }),
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
  expect(listed.body).not.toContain(created.token);
  expect(listed.body).not.toContain('token_hash');
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
