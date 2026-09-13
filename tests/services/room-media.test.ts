import { roomMediaModules } from '../../apps/api/src/room-media.ts';
import { mediaViewSchema } from '@study/contracts';
import type { MediaView, MediaAction } from '@study/contracts';
import { RedisRateLimiter } from '@study/adapters/redis';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
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
import { socialComposition } from '../../apps/api/src/social.ts';
import { socialDirectory } from '@study/friends/server';
import { createRedis, RedisEphemeralStore } from '@study/adapters/redis';

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
const redis = createRedis(`redis://:${local.REDIS_PASSWORD}@localhost:6380`);
redis.on('error', () => {});
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
  await redis.connect();
  await migrate(migrationPool, await applicationMigrationManifest());
});
beforeEach(async () => {
  await migrationPool.query(
    'TRUNCATE friends.relationships, friends.blocks, friends.privacy, rooms.invites, rooms.memberships, rooms.rooms, identity.oauth_flows, identity.identities, identity.users, core.sessions CASCADE',
  );
  const fail = (code: ConstructorParameters<typeof AppError>[0]): never => {
    throw new AppError(code);
  };
  const redisLimiter = new RedisRateLimiter(redis),
    rateNamespace = randomUUID();
  const social = socialComposition(
    db,
    new RedisEphemeralStore(redis),
    new PostgresSessionStore(db),
  );
  server = await createServer({
    config: readConfig({
      NODE_ENV: 'test',
      APP_ORIGIN: origin,
      DATABASE_URL: runtimeUrl,
      REDIS_URL: 'redis://unused',
      LOG_LEVEL: 'silent',
    }),
    sessions,
    limiter: { consume: (key, policy) => redisLimiter.consume(rateNamespace + ':' + key, policy) },
    modules: [
      ...roomMediaModules(db, social.occupancy),
      identityModule({ db, directory, providers, fail }),
      roomsModule({
        db,
        accountExists: identityAccounts(db).exists,
        fail,
        social: socialDirectory(db),
      }),
      ...social.modules,
    ],
  });
});
// Each test closes its runtime through the hook, including failing assertions.
import { afterEach } from 'vitest';
afterEach(async () => {
  await server.app.close();
});
afterAll(async () => {
  redis.destroy();
  await Promise.all([pool.end(), migrationPool.end()]);
});

async function pair() {
  const a = await login('alice'),
    b = await login('bob'),
    r = await room(a, 'public');
  expect((await request(b, 'rooms/join', { roomId: r.id })).statusCode).toBe(200);
  return { a, b, r };
}
async function socketFor(user: User) {
  if (!server.app.server.listening) await server.app.listen({ host: '127.0.0.1', port: 0 });
  const address = server.app.server.address();
  if (!address || typeof address === 'string') throw new Error();
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/v1/realtime`, {
    headers: { host, origin, cookie: user.cookie },
  });
  await once(socket, 'open');
  const token = await csrf(user),
    messages: Record<string, unknown>[] = [];
  socket.on('message', (data) => messages.push(JSON.parse(data.toString())));
  async function send(command: string, payload: unknown) {
    const requestId = randomUUID();
    socket.send(JSON.stringify({ version: 1, requestId, command, payload, csrf: token }));
    await expect
      .poll(() =>
        messages.find(
          (m) =>
            m.requestId === requestId ||
            (m.error as { requestId: string } | undefined)?.requestId === requestId,
        ),
      )
      .toBeTruthy();
    return messages.find(
      (m) =>
        m.requestId === requestId ||
        (m.error as { requestId: string } | undefined)?.requestId === requestId,
    )!;
  }
  return { socket, send, messages };
}

async function snapshot(user: User, roomId: string) {
  const r = await request(user, `room-media/snapshot?roomId=${roomId}`);
  expect(r.statusCode, r.body).toBe(200);
  return mediaViewSchema.parse(r.json());
}
function revision(v: MediaView) {
  return { roomId: v.roomId, epoch: v.epoch, version: v.version };
}
async function control(user: User, v: MediaView, action: MediaAction) {
  const r = await request(user, 'room-media/control', { ...revision(v), action });
  expect(r.statusCode, r.body).toBe(200);
  return mediaViewSchema.parse(r.json());
}
it('durable baseline, version races, pause/play/seek and restart epoch reject stale state', async () => {
  const { a, b, r } = await pair();
  let v = await snapshot(a, r.id);
  v = await control(a, v, { type: 'enqueue', videoId: 'M7lc1UVf-VE' });
  const stale = revision(v);
  v = await control(a, v, { type: 'play' });
  v = await control(a, v, { type: 'seek', position: 120 });
  v = await control(a, v, { type: 'pause' });
  expect(v.state.position).toBeGreaterThanOrEqual(120);
  expect(v.ownerBaseline).toEqual(v.state);
  expect(
    (await request(a, 'room-media/control', { ...stale, action: { type: 'pause' } })).statusCode,
  ).toBe(409);
  expect(
    (
      await request(a, 'room-media/control', {
        ...revision(v),
        epoch: randomUUID(),
        action: { type: 'pause' },
      })
    ).statusCode,
  ).toBe(409);
  const races = await Promise.all([
    request(a, 'room-media/control', { ...revision(v), action: { type: 'seek', position: 12 } }),
    request(a, 'room-media/control', { ...revision(v), action: { type: 'seek', position: 24 } }),
  ]);
  expect(races.map((x) => x.statusCode).sort()).toEqual([200, 409]);
  const latest = await snapshot(b, r.id);
  expect(latest.state.position).toBeOneOf([12, 24]);
  const stored = await db.query(
    sql`SELECT baseline FROM room_media.baselines WHERE room_id=${r.id}`,
  );
  expect(stored[0]?.baseline).toEqual(latest.ownerBaseline);
  // A fresh module instance loads durable state and issues a new epoch.
  const fresh = roomMediaModules(db, { members: async () => [] })[0]!;
  const op = fresh.operations!.find((o) => o.id === 'room-media.snapshot')!;
  const recovered = mediaViewSchema.parse(
    await op.handle(
      { roomId: r.id },
      {
        actor: { subjectId: a.id, sessionId: a.sessionId },
        requestId: randomUUID(),
        signal: AbortSignal.timeout(2000),
        resource: null,
      },
    ),
  );
  expect(recovered.ownerBaseline).toEqual(latest.ownerBaseline);
  expect(recovered.epoch).not.toBe(latest.epoch);
});
it('every protected operation rejects unauthenticated, revoked, cross-room and forged authority requests', async () => {
  const { a, b, r } = await pair(),
    privateRoom = await room(a);
  const v = await snapshot(a, r.id),
    base = revision(v);
  const actions: Record<string, object> = {
    control: { action: { type: 'pause' } },
    configure: { settings: { controls: 'everyone', ownerAbsent: 'ffa' } },
    reconcile: { decision: 'keep' },
    suggest: { action: { type: 'pause' } },
    'suggestion-decide': { suggestionId: randomUUID(), accept: true },
  };
  for (const [name, fields] of Object.entries(actions)) {
    expect((await request(null, 'room-media/' + name, { ...base, ...fields })).statusCode).toBe(
      401,
    );
    expect(
      (await request(b, 'room-media/' + name, { ...base, ...fields, roomId: privateRoom.id }))
        .statusCode,
    ).toBe(403);
    expect(
      (await request(a, 'room-media/' + name, { ...base, ...fields }, { 'x-csrf-token': '' }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          a,
          'room-media/' + name,
          { ...base, ...fields },
          { origin: 'https://hostile.test' },
        )
      ).statusCode,
    ).toBe(403);
    expect((await request(a, 'room-media/' + name)).statusCode).toBe(404);
    for (const extra of [
      { role: 'owner' },
      { ownerId: a.id },
      { controller: a.id },
      { userId: a.id },
    ])
      expect(
        (await request(b, 'room-media/' + name, { ...base, ...fields, ...extra })).statusCode,
      ).toBe(400);
  }
  for (const name of ['snapshot', 'clock']) {
    expect((await request(null, `room-media/${name}?roomId=${r.id}`)).statusCode).toBe(401);
    expect((await request(b, `room-media/${name}?roomId=${privateRoom.id}`)).statusCode).toBe(403);
  }
  for (const name of ['control', 'configure', 'reconcile'])
    expect((await request(b, 'room-media/' + name, { ...base, ...actions[name] })).statusCode).toBe(
      403,
    );
  for (const videoId of [
    '<img src=x>',
    '../anything',
    'https://www.youtube.com/watch?v=M7lc1UVf-VE',
  ])
    expect(
      (await request(a, 'room-media/control', { ...base, action: { type: 'enqueue', videoId } }))
        .statusCode,
    ).toBe(400);
  await sessions.revoke(a.sessionId);
  for (const [name, fields] of Object.entries(actions))
    expect((await request(a, 'room-media/' + name, { ...base, ...fields })).statusCode).toBe(401);
});
it('owner absent FFA, hidden presence, owner return keep/restore and empty-room reset use real leases', async () => {
  const { a, b, r } = await pair();
  const owner = await socketFor(a),
    member = await socketFor(b);
  const heartbeat = { roomId: r.id, status: 'online', active: true };
  try {
    await owner.send('presence.heartbeat', heartbeat);
    await member.send('presence.heartbeat', heartbeat);
    // Server-only occupancy cannot be tricked by private public presence.
    const privacyChange = await request(a, 'friends/privacy', {
      online: false,
      room: false,
      study: false,
      join: false,
      invites: false,
    });
    expect(privacyChange.statusCode).toBe(200);
    let v = await snapshot(a, r.id);
    expect(v.ownerPresent).toBe(true);
    v = await control(a, v, { type: 'enqueue', videoId: 'M7lc1UVf-VE' });
    v = mediaViewSchema.parse(
      (
        await request(a, 'room-media/configure', {
          ...revision(v),
          settings: { controls: 'owner', ownerAbsent: 'ffa' },
        })
      ).json(),
    );
    expect((await snapshot(b, r.id)).canControl).toBe(false);
    await owner.send('presence.heartbeat', { ...heartbeat, roomId: null });
    await expect.poll(async () => (await snapshot(b, r.id)).ownerPresent).toBe(false);
    // Occupancy transitions carry a new version; wait for its lifecycle reconciliation.
    await new Promise((resolve) => setTimeout(resolve, 2100));
    v = await control(b, await snapshot(b, r.id), { type: 'seek', position: 77 });
    expect(v.temporary).toBe(true);
    expect(v.ownerBaseline.position).toBe(0);
    expect(
      (
        await request(b, 'room-media/configure', {
          ...revision(v),
          settings: { controls: 'everyone', ownerAbsent: 'ffa' },
        })
      ).statusCode,
    ).toBe(403);
    await owner.send('presence.heartbeat', heartbeat);
    await new Promise((resolve) => setTimeout(resolve, 2100));
    v = await snapshot(a, r.id);
    expect(v.ownerPresent).toBe(true);
    expect(v.changedBy.map((x) => x.id)).toContain(b.id);
    v = mediaViewSchema.parse(
      (await request(a, 'room-media/reconcile', { ...revision(v), decision: 'keep' })).json(),
    );
    expect(v.ownerBaseline.position).toBe(77);
    expect(v.temporary).toBe(false);
    await owner.send('presence.heartbeat', { ...heartbeat, roomId: null });
    await new Promise((resolve) => setTimeout(resolve, 2100));
    v = await control(b, await snapshot(b, r.id), { type: 'seek', position: 99 });
    await owner.send('presence.heartbeat', heartbeat);
    await new Promise((resolve) => setTimeout(resolve, 2100));
    v = mediaViewSchema.parse(
      (
        await request(a, 'room-media/reconcile', {
          ...revision(await snapshot(a, r.id)),
          decision: 'restore',
        })
      ).json(),
    );
    expect(v.state.position).toBe(77);
    await owner.send('presence.heartbeat', { ...heartbeat, roomId: null });
    await new Promise((resolve) => setTimeout(resolve, 2100));
    await control(b, await snapshot(b, r.id), { type: 'seek', position: 123 });
    await member.send('presence.heartbeat', { ...heartbeat, roomId: null });
    expect((await snapshot(b, r.id)).state.position).toBe(77);
    await member.send('presence.heartbeat', heartbeat);
    expect((await snapshot(b, r.id)).state.position).toBe(77);
    await expect
      .poll(async () => (await snapshot(b, r.id)).state.position, { timeout: 8000 })
      .toBe(77);
    expect((await snapshot(a, r.id)).temporary).toBe(false);
  } finally {
    owner.socket.close();
    member.socket.close();
  }
}, 30000);
it('suggestions are bounded, reviewed and hidden/denied across blocks; removal revokes sockets', async () => {
  const { a, b, r } = await pair();
  const client = await socketFor(b);
  await client.send('presence.heartbeat', { roomId: r.id, status: 'online', active: true });
  let v = await snapshot(b, r.id);
  v = mediaViewSchema.parse(
    (
      await request(b, 'room-media/suggest', {
        ...revision(v),
        action: { type: 'enqueue', videoId: 'M7lc1UVf-VE' },
      })
    ).json(),
  );
  expect(v.state.queue).toEqual([]);
  expect(v.suggestions).toHaveLength(1);
  const decision = { ...revision(v), suggestionId: v.suggestions[0]!.id, accept: true };
  expect((await request(b, 'room-media/suggestion-decide', decision)).statusCode).toBe(403);
  v = mediaViewSchema.parse((await request(a, 'room-media/suggestion-decide', decision)).json());
  expect(v.ownerBaseline.queue).toEqual(['M7lc1UVf-VE']);
  try {
    expect(await client.send('room-media.snapshot', { roomId: r.id })).toHaveProperty('result');
    expect(
      await client.send('room-media.control', { ...revision(v), action: { type: 'pause' } }),
    ).toHaveProperty('error');
    await db.query(sql`DELETE FROM rooms.memberships WHERE room_id=${r.id} AND user_id=${b.id}`);
    expect((await request(b, `room-media/snapshot?roomId=${r.id}`)).statusCode).toBe(403);
    expect(
      (await request(b, 'room-media/suggest', { ...revision(v), action: { type: 'pause' } }))
        .statusCode,
    ).toBe(403);
    await expect.poll(() => client.socket.readyState, { timeout: 8000 }).toBe(WebSocket.CLOSED);
  } finally {
    client.socket.close();
  }
  await request(b, 'rooms/join', { roomId: r.id });
  await db.query(sql`INSERT INTO friends.blocks(actor_id,target_id) VALUES(${a.id},${b.id})`);
  expect((await request(b, `room-media/snapshot?roomId=${r.id}`)).statusCode).toBe(403);
  expect(
    (await request(b, 'room-media/control', { ...revision(v), action: { type: 'pause' } }))
      .statusCode,
  ).toBe(403);
});

it('moderator controls, suggestion quotas, participant blocks and disabled operations are enforced by the server', async () => {
  const { a, b, r } = await pair(),
    c = await login('carol');
  await request(c, 'rooms/join', { roomId: r.id });
  const active = await socketFor(b);
  await active.send('presence.heartbeat', { roomId: r.id, status: 'online', active: true });
  await db.query(
    sql`UPDATE rooms.memberships SET role='moderator' WHERE room_id=${r.id} AND user_id=${b.id}`,
  );
  let v = await snapshot(a, r.id);
  mediaViewSchema.parse(
    (
      await request(a, 'room-media/configure', {
        ...revision(v),
        settings: { controls: 'moderators', ownerAbsent: 'preserve' },
      })
    ).json(),
  );
  expect((await snapshot(b, r.id)).canControl).toBe(true);
  expect((await snapshot(c, r.id)).canControl).toBe(false);
  v = await control(b, await snapshot(b, r.id), { type: 'enqueue', videoId: 'M7lc1UVf-VE' });
  expect(v.ownerBaseline.queue).toEqual([]);
  for (let i = 0; i < 5; i++) {
    v = mediaViewSchema.parse(
      (
        await request(c, 'room-media/suggest', { ...revision(v), action: { type: 'pause' } })
      ).json(),
    );
  }
  expect(
    (await request(c, 'room-media/suggest', { ...revision(v), action: { type: 'pause' } }))
      .statusCode,
  ).toBe(429);
  const suggestionId = v.suggestions[0]!.id;
  await db.query(sql`INSERT INTO friends.blocks(actor_id,target_id) VALUES(${b.id},${c.id})`);
  expect((await snapshot(b, r.id)).suggestions).toEqual([]);
  expect(
    (
      await request(b, 'room-media/suggestion-decide', {
        ...revision(v),
        suggestionId,
        accept: true,
      })
    ).statusCode,
  ).toBe(403);
  await server.app.close();
  server = await createServer({
    config: readConfig({
      NODE_ENV: 'test',
      APP_ORIGIN: origin,
      DATABASE_URL: runtimeUrl,
      REDIS_URL: 'redis://unused',
      LOG_LEVEL: 'silent',
    }),
    sessions,
    limiter: new RedisRateLimiter(redis),
    modules: [
      ...socialComposition(
        db,
        new RedisEphemeralStore(redis),
        new PostgresSessionStore(db),
      ).modules.filter((module) => module.id === 'presence'),
      ...roomMediaModules(db, { members: async () => [] }, { ROOM_MEDIA_ENABLED: 'false' }),
    ],
  });
  expect((await request(a, `room-media/snapshot?roomId=${r.id}`)).statusCode).toBe(404);
  for (const [name, fields] of Object.entries({
    control: { action: { type: 'pause' } },
    suggest: { action: { type: 'pause' } },
    configure: { settings: { controls: 'everyone', ownerAbsent: 'ffa' } },
    reconcile: { decision: 'keep' },
    'suggestion-decide': { suggestionId, accept: true },
  }))
    expect((await request(a, 'room-media/' + name, { ...revision(v), ...fields })).statusCode).toBe(
      404,
    );
});
