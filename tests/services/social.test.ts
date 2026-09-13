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
import { socialModules } from '../../apps/api/src/social.ts';
import { socialDirectory } from '@study/friends/server';
import { createRedis, RedisEphemeralStore } from '@study/adapters/redis';
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
      roomsModule({
        db,
        accountExists: identityAccounts(db).exists,
        fail,
        social: socialDirectory(db),
      }),
      ...socialModules(db, new RedisEphemeralStore(redis), new PostgresSessionStore(db)),
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
it('every social HTTP action rejects missing authentication, CSRF and hostile origins', async () => {
  const { a, b, r } = await pair();
  const actions: [string, object][] = [
    ...['request', 'accept', 'decline', 'remove', 'block', 'unblock'].map(
      (name) => [`friends/${name}`, { targetId: b.id }] as [string, object],
    ),
    ['friends/privacy', { online: true, room: false, study: true, join: false, invites: true }],
    ['rooms/friend-invite', { targetId: b.id, roomId: r.id }],
    ['rooms/friend-invite-accept', { inviteId: randomUUID() }],
    ['rooms/friend-invite-decline', { inviteId: randomUUID() }],
  ];
  for (const [path, input] of actions) {
    expect((await request(null, path, input)).statusCode, path).toBe(401);
    expect((await request(a, path, input, { 'x-csrf-token': '' })).statusCode, path).toBe(403);
    expect(
      (await request(a, path, input, { origin: 'https://attacker.example' })).statusCode,
      path,
    ).toBe(403);
    expect((await request(a, path)).statusCode, path).toBe(404);
  }
  for (const path of ['friends/snapshot', 'rooms/friend-invitations'])
    expect((await request(null, path)).statusCode).toBe(401);
});
it('current-room and study privacy are enforced inside the room rail as well as friend activity', async () => {
  const { a, b, r } = await pair();
  await befriend(a, b);
  const ws = await socketFor(a),
    viewer = await socketFor(b);
  try {
    await ws.send('presence.heartbeat', { roomId: r.id, status: 'break', active: true });
    expect(JSON.stringify(await viewer.send('presence.room', { roomId: r.id }))).not.toContain(
      a.id,
    );
    await request(a, 'friends/privacy', {
      online: true,
      room: true,
      study: false,
      join: false,
      invites: true,
    });
    await expect
      .poll(
        () => JSON.stringify(viewer.messages.filter((m) => m.event === 'presence.snapshot').at(-1)),
        { timeout: 5000 },
      )
      .toContain(a.id);
    const snapshot = (await request(b, 'friends/snapshot')).json();
    expect(snapshot.friends[0]).toMatchObject({
      status: 'online',
      room: { id: r.id, joinable: false },
    });
    expect(JSON.stringify(snapshot)).not.toContain('break');
    await request(a, 'friends/privacy', {
      online: true,
      room: false,
      study: false,
      join: false,
      invites: true,
    });
    await expect
      .poll(() => viewer.messages.filter((m) => m.event === 'presence.snapshot').at(-1)?.payload, {
        timeout: 5000,
      })
      .toEqual({ participants: [] });
  } finally {
    ws.socket.terminate();
    viewer.socket.terminate();
  }
});
it('blocking permanently revokes pending friend invites; decline, expiry and privacy edits reject replay', async () => {
  const { a, b, r } = await pair();
  await befriend(a, b);
  await request(a, 'rooms/friend-invite', { targetId: b.id, roomId: r.id });
  const [old] = (await request(b, 'rooms/friend-invitations')).json();
  await request(a, 'friends/block', { targetId: b.id });
  await request(a, 'friends/unblock', { targetId: b.id });
  await befriend(a, b);
  expect((await request(b, 'rooms/friend-invite-accept', { inviteId: old.id })).statusCode).toBe(
    403,
  );
  await request(a, 'rooms/friend-invite', { targetId: b.id, roomId: r.id });
  const [decline] = (await request(b, 'rooms/friend-invitations')).json();
  expect(
    (await request(b, 'rooms/friend-invite-decline', { inviteId: decline.id })).statusCode,
  ).toBe(200);
  expect(
    (await request(b, 'rooms/friend-invite-accept', { inviteId: decline.id })).statusCode,
  ).toBe(403);
  await request(a, 'rooms/friend-invite', { targetId: b.id, roomId: r.id });
  const [expired] = (await request(b, 'rooms/friend-invitations')).json();
  await db.query(
    sql`UPDATE rooms.invites SET created_at=CURRENT_TIMESTAMP-INTERVAL '2 days',expires_at=CURRENT_TIMESTAMP-INTERVAL '1 day' WHERE id=${expired.id}`,
  );
  expect(
    (await request(b, 'rooms/friend-invite-accept', { inviteId: expired.id })).statusCode,
  ).toBe(403);
  await request(a, 'rooms/friend-invite', { targetId: b.id, roomId: r.id });
  const [changed] = (await request(b, 'rooms/friend-invitations')).json();
  await request(a, 'rooms/update', {
    roomId: r.id,
    version: r.version,
    name: r.name,
    privacy: 'private',
  });
  expect(
    (await request(b, 'rooms/friend-invite-accept', { inviteId: changed.id })).statusCode,
  ).toBe(403);
});
async function befriend(a: User, b: User) {
  expect((await request(a, 'friends/request', { targetId: b.id })).statusCode).toBe(200);
  expect((await request(b, 'friends/accept', { targetId: a.id })).statusCode).toBe(200);
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
it('friend requests accept/decline/remove use only session identity and reject replay', async () => {
  const { a, b } = await pair();
  const c = await login('charlie');
  for (const input of [
    { targetId: b.id, senderId: c.id },
    { targetId: b.id, recipientId: c.id },
    { targetId: b.id, userId: c.id },
  ])
    expect((await request(a, 'friends/request', input)).statusCode).toBe(400);
  expect((await request(a, 'friends/request', { targetId: a.id })).statusCode).toBe(403);
  expect((await request(a, 'friends/request', { targetId: b.id })).statusCode).toBe(200);
  expect((await request(a, 'friends/request', { targetId: b.id })).statusCode).toBe(409);
  expect((await request(a, 'friends/accept', { targetId: b.id })).statusCode).toBe(403);
  expect((await request(c, 'friends/accept', { targetId: a.id })).statusCode).toBe(403);
  expect((await request(b, 'friends/accept', { targetId: a.id })).statusCode).toBe(200);
  expect((await request(b, 'friends/accept', { targetId: a.id })).statusCode).toBe(403);
  expect((await request(a, 'friends/snapshot')).json().friends).toHaveLength(1);
  expect((await request(a, 'friends/remove', { targetId: b.id })).statusCode).toBe(200);
  expect((await request(a, 'friends/snapshot')).json().friends).toHaveLength(0);
  expect((await request(a, 'friends/request', { targetId: b.id })).statusCode).toBe(200);
  expect((await request(b, 'friends/decline', { targetId: a.id })).statusCode).toBe(200);
});
it('concurrent opposite requests produce one durable request', async () => {
  const { a, b } = await pair();
  const result = await Promise.all([
    request(a, 'friends/request', { targetId: b.id }),
    request(b, 'friends/request', { targetId: a.id }),
  ]);
  expect(result.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  expect(await db.query(sql`SELECT * FROM friends.relationships`)).toHaveLength(1);
});
it('unknown and unrelated IDs cannot enumerate accounts; spam is limited', async () => {
  const { a } = await pair(),
    c = await login('stranger');
  expect((await request(a, 'friends/request', { targetId: c.id })).statusCode).toBe(403);
  expect((await request(a, 'friends/request', { targetId: randomUUID() })).statusCode).toBe(403);
  let status = 0;
  for (let n = 0; n < 12; n++)
    status = (await request(a, 'friends/request', { targetId: randomUUID() })).statusCode;
  expect(status).toBe(429);
});
it('block/unblock cannot act for another account, removes social links and denies invite bypasses', async () => {
  const { a, b, r } = await pair();
  await befriend(a, b);
  const link = (
    await request(a, 'rooms/invite-create', { roomId: r.id, maxUses: 1, expiresInHours: 1 })
  ).json();
  expect((await request(a, 'friends/block', { targetId: b.id, actorId: b.id })).statusCode).toBe(
    400,
  );
  expect((await request(a, 'friends/block', { targetId: b.id })).statusCode).toBe(200);
  expect((await request(b, 'friends/unblock', { targetId: a.id, actorId: a.id })).statusCode).toBe(
    400,
  );
  expect((await request(b, 'friends/unblock', { targetId: a.id })).statusCode).toBe(200);
  expect((await request(b, 'friends/request', { targetId: a.id })).statusCode).toBe(403);
  expect(
    (await request(a, 'rooms/friend-invite', { targetId: b.id, roomId: r.id })).statusCode,
  ).toBe(403);
  expect((await request(b, 'rooms/invite-redeem', { token: link.token })).statusCode).toBe(403);
  expect((await request(b, 'rooms/join', { roomId: r.id })).statusCode).toBe(403);
  expect((await request(b, 'rooms/discover')).json().rooms).toHaveLength(0);
  expect((await request(a, 'friends/unblock', { targetId: b.id })).statusCode).toBe(200);
  expect((await request(a, 'friends/snapshot')).json().friends).toHaveLength(0);
});
it('targeted invites reuse secure room infrastructure and enforce recipient, owner, block and privacy', async () => {
  const { a, b } = await pair(),
    c = await login('charlie');
  await befriend(a, b);
  const r = await room(a);
  expect(
    (await request(b, 'rooms/friend-invite', { targetId: a.id, roomId: r.id })).statusCode,
  ).toBe(403);
  expect(
    (await request(a, 'rooms/friend-invite', { targetId: b.id, roomId: r.id })).statusCode,
  ).toBe(200);
  expect(
    (await request(a, 'rooms/friend-invite', { targetId: b.id, roomId: r.id })).statusCode,
  ).toBe(409);
  const [inv] = (await request(b, 'rooms/friend-invitations')).json();
  expect(inv.roomName).toBe(r.name);
  expect((await request(c, 'rooms/friend-invitations')).json()).toEqual([]);
  expect((await request(c, 'rooms/friend-invite-accept', { inviteId: inv.id })).statusCode).toBe(
    403,
  );
  expect((await request(b, 'rooms/friend-invite-accept', { inviteId: inv.id })).statusCode).toBe(
    200,
  );
  expect((await request(b, 'rooms/friend-invite-accept', { inviteId: inv.id })).statusCode).toBe(
    403,
  );
  expect((await request(b, `rooms/detail?roomId=${r.id}`)).statusCode).toBe(200);
  const privatePrefs = { online: true, room: false, study: true, join: false, invites: false };
  expect((await request(b, 'friends/privacy', privatePrefs)).statusCode).toBe(200);
  expect(
    (await request(a, 'rooms/friend-invite', { targetId: b.id, roomId: r.id })).statusCode,
  ).toBe(403);
});
it('privacy cannot be modified or read for another user', async () => {
  const { a, b } = await pair();
  const prefs = { online: false, room: false, study: false, join: false, invites: false };
  expect((await request(a, 'friends/privacy', { ...prefs, userId: b.id })).statusCode).toBe(400);
  expect((await request(a, `friends/snapshot?userId=${b.id}`)).statusCode).toBe(400);
  expect((await request(null, 'friends/privacy', prefs)).statusCode).toBe(401);
  expect((await request(a, 'friends/privacy', prefs, { 'x-csrf-token': '' })).statusCode).toBe(403);
});
it('HTTP and realtime snapshots omit hidden rooms and private-room details', async () => {
  const { a, b } = await pair();
  await befriend(a, b);
  const secret = await room(a);
  const ws = await socketFor(a);
  try {
    expect(
      await ws.send('presence.heartbeat', { roomId: secret.id, status: 'focusing', active: true }),
    ).toHaveProperty('result');
    const snapshot = (await request(b, 'friends/snapshot')).json();
    expect(snapshot.friends[0]).toMatchObject({ status: 'focusing', room: null });
    expect(JSON.stringify(snapshot)).not.toContain(secret.id);
    await request(a, 'friends/privacy', {
      online: true,
      room: true,
      study: true,
      join: true,
      invites: true,
    });
    expect((await request(b, 'friends/snapshot')).json().friends[0].room).toBeNull();
    await request(a, 'friends/privacy', {
      online: false,
      room: true,
      study: true,
      join: true,
      invites: true,
    });
    expect((await request(b, 'friends/snapshot')).json().friends[0]).toMatchObject({
      status: null,
      room: null,
    });
    expect(
      await ws.send('presence.heartbeat', {
        roomId: secret.id,
        status: 'focusing',
        active: true,
        userId: b.id,
      }),
    ).toHaveProperty('error');
  } finally {
    ws.socket.terminate();
  }
});
it('multiple realtime connections, block/reconnect, membership changes and revoked actions are enforced', async () => {
  const { a, b, r } = await pair();
  await befriend(a, b);
  await request(a, 'friends/privacy', {
    online: true,
    room: true,
    study: true,
    join: false,
    invites: true,
  });
  const one = await socketFor(a),
    two = await socketFor(a),
    viewer = await socketFor(b);
  try {
    await one.send('presence.heartbeat', { roomId: r.id, status: 'online', active: true });
    await two.send('presence.heartbeat', { roomId: r.id, status: 'focusing', active: true });
    const first = await viewer.send('presence.room', { roomId: r.id });
    expect(JSON.stringify(first)).toContain(a.id);
    one.socket.terminate();
    await expect
      .poll(async () => (await request(b, 'friends/snapshot')).json().friends[0].status)
      .toBe('focusing');
    await request(b, 'friends/block', { targetId: a.id });
    await expect.poll(() => viewer.socket.readyState, { timeout: 5000 }).toBe(WebSocket.CLOSED);
    const reopened = await socketFor(b);
    try {
      expect(await reopened.send('presence.room', { roomId: r.id })).toHaveProperty('error');
    } finally {
      reopened.socket.terminate();
    }
    await request(b, 'friends/unblock', { targetId: a.id });
    await db.query(sql`DELETE FROM rooms.memberships WHERE room_id=${r.id} AND user_id=${b.id}`);
    const removed = await socketFor(b);
    try {
      expect(
        await removed.send('presence.heartbeat', { roomId: r.id, status: 'online', active: true }),
      ).toHaveProperty('error');
    } finally {
      removed.socket.terminate();
    }
    await sessions.revokeSubject(a.id);
    two.socket.send(
      JSON.stringify({
        version: 1,
        requestId: randomUUID(),
        command: 'presence.heartbeat',
        payload: { roomId: r.id, status: 'online', active: true },
      }),
    );
    await expect.poll(() => two.socket.readyState, { timeout: 5000 }).toBe(WebSocket.CLOSED);
  } finally {
    one.socket.terminate();
    two.socket.terminate();
    viewer.socket.terminate();
  }
});
it('friend request notifications and privacy changes reach reauthorized socket snapshots', async () => {
  const { a, b } = await pair();
  const ws = await socketFor(b);
  try {
    await ws.send('friends.snapshot', {});
    await request(a, 'friends/request', { targetId: b.id });
    await expect
      .poll(
        () => JSON.stringify(ws.messages.filter((m) => m.event === 'friends.snapshot').at(-1)),
        { timeout: 5000 },
      )
      .toContain(a.id);
    await request(b, 'friends/accept', { targetId: a.id });
    await request(a, 'friends/privacy', {
      online: false,
      room: false,
      study: false,
      join: false,
      invites: false,
    });
    await expect
      .poll(
        () =>
          (
            ws.messages.filter((m) => m.event === 'friends.snapshot').at(-1)?.payload as
              { friends: unknown[] } | undefined
          )?.friends,
        { timeout: 5000 },
      )
      .toEqual([{ id: a.id, name: 'Study member', status: null, room: null }]);
  } finally {
    ws.socket.terminate();
  }
});
