import { backgroundsModules } from '../../apps/api/src/backgrounds.ts';
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
import { socialModules } from '../../apps/api/src/social.ts';
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
      ...backgroundsModules(db),
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

it('owner changes persist; members cannot forge ownership, cross-room access, URLs or replay versions', async () => {
  const { a, b, r } = await pair();
  const privateRoom = await room(a);
  const initial = (await request(a, `backgrounds/snapshot?roomId=${r.id}`)).json();
  expect(initial).toMatchObject({
    canControl: true,
    state: { assetId: 'quiet-hours', version: 0 },
  });
  expect((await request(b, `backgrounds/snapshot?roomId=${r.id}`)).json().canControl).toBe(false);
  const change = { roomId: r.id, assetId: 'cedar-library', version: 0 };
  expect((await request(b, 'backgrounds/change', change)).statusCode).toBe(403);
  for (const extra of [{ ownerId: a.id }, { userId: a.id }, { role: 'owner' }])
    expect((await request(b, 'backgrounds/change', { ...change, ...extra })).statusCode).toBe(400);
  expect((await request(b, `backgrounds/snapshot?roomId=${privateRoom.id}`)).statusCode).toBe(403);
  for (const assetId of ['../quiet-hours', 'https://example.com/x', 'custom-private', '<svg/>'])
    expect((await request(a, 'backgrounds/change', { ...change, assetId })).statusCode).toBe(400);
  const results = await Promise.all([
    request(a, 'backgrounds/change', change),
    request(a, 'backgrounds/change', change),
  ]);
  expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  expect((await request(b, `backgrounds/snapshot?roomId=${r.id}`)).json().state).toMatchObject({
    assetId: 'cedar-library',
    version: 1,
  });
  expect(
    (await db.query(sql`SELECT asset_id FROM backgrounds.room_defaults WHERE room_id=${r.id}`))[0]
      ?.asset_id,
  ).toBe('cedar-library');
  expect((await request(a, 'backgrounds/change', change)).statusCode).toBe(409);
});
it('all protected background operations enforce authentication, CSRF, origin and current sessions', async () => {
  const { a, r } = await pair();
  const change = { roomId: r.id, assetId: 'alpine-lake', version: 0 };
  expect((await request(null, 'backgrounds/change', change)).statusCode).toBe(401);
  expect((await request(null, `backgrounds/snapshot?roomId=${r.id}`)).statusCode).toBe(401);
  expect((await request(a, 'backgrounds/change', change, { 'x-csrf-token': '' })).statusCode).toBe(
    403,
  );
  expect(
    (await request(a, 'backgrounds/change', change, { origin: 'https://hostile.test' })).statusCode,
  ).toBe(403);
  expect((await request(a, 'backgrounds/change')).statusCode).toBe(404);
  await sessions.revoke(a.sessionId);
  expect((await request(a, 'backgrounds/change', change)).statusCode).toBe(401);
  expect((await request(a, `backgrounds/snapshot?roomId=${r.id}`)).statusCode).toBe(401);
});
it('room snapshots synchronize over existing sockets and immediately recheck removed membership', async () => {
  const { a, b, r } = await pair();
  const client = await socketFor(b);
  try {
    expect(await client.send('backgrounds.snapshot', { roomId: r.id })).toHaveProperty('result');
    expect(
      await client.send('backgrounds.change', { roomId: r.id, assetId: 'alpine-lake', version: 0 }),
    ).toHaveProperty('error');
    expect(
      (
        await request(a, 'backgrounds/change', {
          roomId: r.id,
          assetId: 'rainy-window',
          version: 0,
        })
      ).statusCode,
    ).toBe(200);
    await expect
      .poll(
        () =>
          client.messages.some(
            (m) =>
              m.event === 'backgrounds.snapshot' &&
              (m.payload as { state: { assetId: string } }).state.assetId === 'rainy-window',
          ),
        { timeout: 8000 },
      )
      .toBe(true);
    await db.query(sql`DELETE FROM rooms.memberships WHERE room_id=${r.id} AND user_id=${b.id}`);
    expect((await request(b, `backgrounds/snapshot?roomId=${r.id}`)).statusCode).toBe(403);
    await expect.poll(() => client.socket.readyState, { timeout: 8000 }).toBe(WebSocket.CLOSED);
  } finally {
    client.socket.close();
  }
});
it('disabled background HTTP/socket actions fail even for owners; module has no upload endpoint', async () => {
  const { a, r } = await pair();
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
    modules: backgroundsModules(db, { BACKGROUNDS_ENABLED: 'false' }),
  });
  expect((await request(a, `backgrounds/snapshot?roomId=${r.id}`)).statusCode).toBe(404);
  expect(
    (await request(a, 'backgrounds/change', { roomId: r.id, assetId: 'alpine-lake', version: 0 }))
      .statusCode,
  ).toBe(404);
  expect(
    (
      await request(a, 'backgrounds/upload', {
        ownerId: a.id,
        filename: '../x.svg',
        data: '<svg/>',
      })
    ).statusCode,
  ).toBe(404);
  const client = await socketFor(a);
  try {
    expect(await client.send('backgrounds.snapshot', { roomId: r.id })).toHaveProperty('error');
  } finally {
    client.socket.close();
  }
});
