import { productivityModules } from '../../apps/api/src/productivity.ts';
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
let upgradeEvidence: {
  before: unknown;
  after: unknown;
  historyBefore: unknown;
  historyAfter: unknown;
};
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
  const manifest = await applicationMigrationManifest();
  const original = manifest.filter(
    (m) => !['0002_personal_timers', '0002_separate_scopes'].includes(m.id),
  );
  await migrate(migrationPool, original);
  const userId = randomUUID(),
    roomId = randomUUID();
  await db.query(
    sql`INSERT INTO identity.users(id,display_name) VALUES(${userId},'Migration fixture')`,
  );
  await db.query(
    sql`INSERT INTO rooms.rooms(id,owner_id,name,privacy) VALUES(${roomId},${userId},'Migration room','private')`,
  );
  await db.query(
    sql`INSERT INTO tasks.items(id,owner_id,created_by,request_id,title,position,version,completed) VALUES(${randomUUID()},${userId},${userId},${randomUUID()},'Private preserved',7,3,true)`,
  );
  await db.query(
    sql`INSERT INTO tasks.items(id,room_id,created_by,request_id,title,position,version,deleted) VALUES(${randomUUID()},${roomId},${userId},${randomUUID()},'Deleted task',4,5,true)`,
  );
  const before = await db.query(sql`SELECT * FROM tasks.items ORDER BY id`);
  const historyBefore = (
    await migrationPool.query(
      'SELECT owner,id,checksum FROM foundation.migrations ORDER BY owner,id',
    )
  ).rows;
  await migrate(migrationPool, manifest);
  const after = await db.query(
    sql`SELECT * FROM tasks.personal_items UNION ALL SELECT * FROM tasks.shared_items ORDER BY id`,
  );
  const historyAfter = (
    await migrationPool.query(
      "SELECT owner,id,checksum FROM foundation.migrations WHERE id NOT IN ('0002_personal_timers','0002_separate_scopes') ORDER BY owner,id",
    )
  ).rows;
  upgradeEvidence = { before, after, historyBefore, historyAfter };
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
      ...productivityModules(db),
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
it('personal tasks stay private across rooms, reject forged ownership and stale writes', async () => {
  const { a, b, r } = await pair(),
    scope = { scope: 'personal' },
    requestId = randomUUID();
  expect(
    (await request(a, 'tasks/create', { scope, title: 'Private plan', requestId })).statusCode,
  ).toBe(200);
  expect((await request(a, 'tasks/create', { scope, title: 'Replay', requestId })).statusCode).toBe(
    200,
  );
  const list = (await request(a, 'tasks/snapshot?scope=personal')).json();
  expect(list.tasks).toHaveLength(1);
  const t = list.tasks[0];
  expect((await request(b, 'tasks/snapshot?scope=personal')).json().tasks).toEqual([]);
  expect((await request(b, `tasks/snapshot?scope=personal&userId=${a.id}`)).statusCode).toBe(400);
  for (const extra of [{ ownerId: b.id }, { userId: b.id }, { role: 'owner' }])
    expect(
      (
        await request(a, 'tasks/create', {
          scope,
          title: 'forged',
          requestId: randomUUID(),
          ...extra,
        })
      ).statusCode,
    ).toBe(400);
  for (const user of [b])
    for (const op of ['update', 'delete', 'move'])
      expect(
        (
          await request(user, 'tasks/' + op, {
            scope,
            id: t.id,
            version: t.version,
            ...(op === 'update'
              ? { title: 'Stolen', completed: true, position: 0 }
              : op === 'move'
                ? { direction: 'up' }
                : {}),
          })
        ).statusCode,
      ).toBe(403);
  expect(
    (
      await request(a, 'tasks/update', {
        scope,
        id: t.id,
        version: t.version,
        title: 'Done',
        completed: true,
        position: 5,
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (await request(a, 'tasks/delete', { scope, id: t.id, version: t.version })).statusCode,
  ).toBe(409);
  expect((await request(a, `tasks/snapshot?scope=shared&roomId=${r.id}`)).json().tasks).toEqual([]);
  expect((await request(a, 'tasks/delete', { scope, id: t.id, version: 2 })).statusCode).toBe(200);
  await request(a, 'tasks/create', { scope, title: 'Replay after delete', requestId });
  expect((await request(a, 'tasks/snapshot?scope=personal')).json().tasks).toEqual([]);
});
it('shared tasks authorize creator and owner, recheck membership and reject cross-room IDs', async () => {
  const { a, b, r } = await pair(),
    c = await login('outsider'),
    other = await room(a),
    scope = { scope: 'shared', roomId: r.id };
  await request(b, 'tasks/create', { scope, title: 'Shared study', requestId: randomUUID() });
  const t = (await request(a, `tasks/snapshot?scope=shared&roomId=${r.id}`)).json().tasks[0];
  expect(t).toBeTruthy();
  const payload = {
    scope,
    id: t.id,
    version: t.version,
    title: 'Updated',
    completed: true,
    position: 0,
  };
  expect((await request(c, 'tasks/update', payload)).statusCode).toBe(403);
  expect(
    (await request(a, 'tasks/update', { ...payload, scope: { scope: 'shared', roomId: other.id } }))
      .statusCode,
  ).toBe(403);
  await request(c, 'rooms/join', { roomId: r.id });
  expect((await request(c, 'tasks/update', payload)).statusCode).toBe(403);
  expect((await request(c, 'tasks/delete', { scope, id: t.id, version: 1 })).statusCode).toBe(403);
  expect((await request(a, 'tasks/update', payload)).statusCode).toBe(200);
  await db.query(sql`DELETE FROM rooms.memberships WHERE room_id=${r.id} AND user_id=${b.id}`);
  expect((await request(b, 'tasks/delete', { scope, id: t.id, version: 2 })).statusCode).toBe(403);
});
it('task ordering moves past ties and rejects stale reorder replay', async () => {
  const a = await login('order'),
    scope = { scope: 'personal' };
  for (const title of ['First', 'Second', 'Third'])
    await request(a, 'tasks/create', { scope, title, requestId: randomUUID() });
  const t = (await request(a, 'tasks/snapshot?scope=personal')).json().tasks[1];
  const move = { scope, id: t.id, version: t.version, direction: 'up' };
  expect((await request(a, 'tasks/move', move)).statusCode).toBe(200);
  expect(
    (await request(a, 'tasks/snapshot?scope=personal'))
      .json()
      .tasks.map((x: { title: string }) => x.title),
  ).toEqual(['Second', 'First', 'Third']);
  expect((await request(a, 'tasks/move', move)).statusCode).toBe(409);
});
it('timer synchronizes commands, clock, persistence and simultaneous versions without client timestamps', async () => {
  const { a, b, r } = await pair();
  const first = (await request(a, `pomodoro/snapshot?roomId=${r.id}`)).json();
  expect(first.canControl).toBe(true);
  const payload = { roomId: r.id, version: 0, action: 'start' };
  expect((await request(b, 'pomodoro/control', payload)).statusCode).toBe(403);
  for (const extra of [{ anchorAt: 0 }, { running: true }, { owner: true }, { role: 'owner' }])
    expect((await request(a, 'pomodoro/control', { ...payload, ...extra })).statusCode).toBe(400);
  const results = await Promise.all([
    request(a, 'pomodoro/control', payload),
    request(a, 'pomodoro/control', payload),
  ]);
  expect(results.map((x) => x.statusCode).sort()).toEqual([200, 409]);
  expect((await request(b, `pomodoro/snapshot?roomId=${r.id}`)).json()).toMatchObject({
    canControl: false,
    state: { running: true, version: 1 },
  });
  const one = (
    await request(a, 'pomodoro/control', { roomId: r.id, version: 1, action: 'pause' })
  ).json().state;
  expect(one.running).toBe(false);
  expect(one.remainingMs).toBeLessThanOrEqual(1500000);
  expect(
    (await request(a, 'pomodoro/control', { roomId: r.id, version: 2, action: 'resume' })).json()
      .state.running,
  ).toBe(true);
  expect(
    (await request(a, 'pomodoro/control', { roomId: r.id, version: 3, action: 'skip' })).json()
      .state.phase,
  ).toBe('shortBreak');
  expect(
    (await request(a, 'pomodoro/control', { roomId: r.id, version: 4, action: 'reset' })).json()
      .state,
  ).toMatchObject({ running: false, phase: 'focus', cycle: 1 });
  const clock = (await request(a, 'pomodoro/clock')).json().serverNow;
  expect(Math.abs(Date.now() - clock)).toBeLessThan(1000);
  expect(
    (await db.query(sql`SELECT state FROM pomodoro.timers WHERE room_id=${r.id}`))[0]!.state,
  ).toMatchObject({ version: 5 });
});
it('chat plain text, block filtering, moderation, IDOR and replay are server authoritative', async () => {
  const { a, b, r } = await pair(),
    c = await login('charlie'),
    other = await room(a),
    text = '<img src=x onerror=alert(1)><script>alert(1)</script> 🌱 https://example.com',
    requestId = randomUUID();
  const payload = { roomId: r.id, text, requestId };
  expect((await request(c, 'chat/send', payload)).statusCode).toBe(403);
  expect((await request(b, 'chat/send', { ...payload, userId: a.id })).statusCode).toBe(400);
  expect((await request(b, 'chat/send', { ...payload, roomId: other.id })).statusCode).toBe(403);
  expect((await request(b, 'chat/send', payload)).statusCode).toBe(200);
  expect((await request(b, 'chat/send', payload)).statusCode).toBe(200);
  const messages = (await request(a, `chat/history?roomId=${r.id}`)).json().messages;
  expect(messages).toHaveLength(1);
  expect(messages[0].text).toBe(text);
  expect(
    (await request(a, 'chat/delete', { roomId: other.id, id: messages[0].id })).statusCode,
  ).toBe(403);
  await request(c, 'rooms/join', { roomId: r.id });
  expect((await request(c, 'chat/delete', { roomId: r.id, id: messages[0].id })).statusCode).toBe(
    403,
  );
  await request(c, 'friends/block', { targetId: b.id });
  expect((await request(c, `chat/history?roomId=${r.id}`)).json().messages).toHaveLength(0);
  expect((await request(a, 'chat/delete', { roomId: r.id, id: messages[0].id })).statusCode).toBe(
    200,
  );
  expect((await request(a, `chat/history?roomId=${r.id}`)).json().messages[0]).toMatchObject({
    deleted: true,
    text: '',
  });
});
it('chat rate limiting uses real Redis and oversized, empty and malformed messages fail', async () => {
  const { a, r } = await pair();
  for (const text of ['', ' '.repeat(5), 'x'.repeat(2001)])
    expect(
      (await request(a, 'chat/send', { roomId: r.id, text, requestId: randomUUID() })).statusCode,
    ).toBe(400);
  let status = 0;
  for (let n = 0; n < 21; n++)
    status = (
      await request(a, 'chat/send', { roomId: r.id, text: 'hello', requestId: randomUUID() })
    ).statusCode;
  expect(status).toBe(429);
});
it('bounded chat history pages have stable sequence order and a cursor even for filtered pages', async () => {
  const { a, b, r } = await pair();
  for (let n = 0; n < 105; n++)
    await db.query(
      sql`INSERT INTO chat.messages(id,room_id,author_id,request_id,text) VALUES(${randomUUID()},${r.id},${b.id},${randomUUID()},${String(n)})`,
    );
  const first = (await request(a, `chat/history?roomId=${r.id}`)).json();
  expect(first.messages).toHaveLength(100);
  expect(first.hasMore).toBe(true);
  const second = (
    await request(a, `chat/history?roomId=${r.id}&before=${first.nextBefore}`)
  ).json();
  expect(second.messages).toHaveLength(5);
  expect(second.hasMore).toBe(false);
  expect(BigInt(second.messages.at(-1).sequence) < BigInt(first.messages[0].sequence)).toBe(true);
});
it('every mutation rejects no session, no CSRF, wrong origin and mutating GET', async () => {
  const { a, r } = await pair();
  const scope = { scope: 'personal' };
  const actions: [string, object][] = [
    ['pomodoro/control', { roomId: r.id, version: 0, action: 'start' }],
    ['tasks/create', { scope, title: 'x', requestId: randomUUID() }],
    [
      'tasks/update',
      { scope, id: randomUUID(), version: 1, title: 'x', completed: false, position: 0 },
    ],
    ['tasks/delete', { scope, id: randomUUID(), version: 1 }],
    ['tasks/move', { scope, id: randomUUID(), version: 1, direction: 'up' }],
    ['chat/send', { roomId: r.id, requestId: randomUUID(), text: 'x' }],
    ['chat/delete', { roomId: r.id, id: randomUUID() }],
  ];
  for (const [path, input] of actions) {
    expect((await request(null, path, input)).statusCode).toBe(401);
    expect((await request(a, path, input, { 'x-csrf-token': '' })).statusCode).toBe(403);
    expect((await request(a, path, input, { origin: 'https://evil.example' })).statusCode).toBe(
      403,
    );
    expect((await request(a, path)).statusCode).toBe(404);
  }
});
it('multi-client realtime snapshots and reconnect resync include real timer, shared tasks and chat', async () => {
  const { a, b, r } = await pair(),
    one = await socketFor(a),
    two = await socketFor(b);
  try {
    for (const s of [one, two]) {
      expect(await s.send('pomodoro.snapshot', { roomId: r.id })).toHaveProperty('result');
      await s.send('tasks.snapshot', { scope: 'shared', roomId: r.id });
      await s.send('chat.history', { roomId: r.id });
    }
    expect(
      await two.send('pomodoro.control', { roomId: r.id, version: 0, action: 'start' }),
    ).toHaveProperty('error');
    await one.send('pomodoro.control', { roomId: r.id, version: 0, action: 'start' });
    await one.send('tasks.create', {
      scope: { scope: 'shared', roomId: r.id },
      title: 'Realtime task',
      requestId: randomUUID(),
    });
    await two.send('chat.send', { roomId: r.id, text: 'Realtime hello', requestId: randomUUID() });
    await expect
      .poll(() => JSON.stringify(two.messages.filter((x) => x.event === 'tasks.snapshot')), {
        timeout: 6000,
      })
      .toContain('Realtime task');
    await expect
      .poll(() => JSON.stringify(one.messages.filter((x) => x.event === 'chat.history')), {
        timeout: 6000,
      })
      .toContain('Realtime hello');
    await expect
      .poll(() => JSON.stringify(two.messages.filter((x) => x.event === 'pomodoro.snapshot')), {
        timeout: 6000,
      })
      .toContain('true');
    two.socket.terminate();
    const again = await socketFor(b);
    try {
      expect(
        JSON.stringify(await again.send('tasks.snapshot', { scope: 'shared', roomId: r.id })),
      ).toContain('Realtime task');
      expect(JSON.stringify(await again.send('chat.history', { roomId: r.id }))).toContain(
        'Realtime hello',
      );
      expect(JSON.stringify(await again.send('pomodoro.snapshot', { roomId: r.id }))).toContain(
        'true',
      );
    } finally {
      again.socket.terminate();
    }
  } finally {
    one.socket.terminate();
    two.socket.terminate();
  }
});
it('connected clients lose every room mutation after membership removal and session revocation', async () => {
  const { a, b, r } = await pair(),
    ws = await socketFor(b);
  try {
    await db.query(sql`DELETE FROM rooms.memberships WHERE room_id=${r.id} AND user_id=${b.id}`);
    for (const [command, payload] of [
      ['chat.send', { roomId: r.id, text: 'Denied', requestId: randomUUID() }],
      [
        'tasks.create',
        { scope: { scope: 'shared', roomId: r.id }, title: 'Denied', requestId: randomUUID() },
      ],
      ['pomodoro.control', { roomId: r.id, version: 0, action: 'start' }],
    ] as const)
      expect(await ws.send(command, payload)).toHaveProperty('error');
  } finally {
    ws.socket.terminate();
  }
  const owner = await socketFor(a);
  try {
    await sessions.revokeSubject(a.id);
    owner.socket.send(
      JSON.stringify({
        version: 1,
        requestId: randomUUID(),
        command: 'pomodoro.control',
        payload: { roomId: r.id, version: 0, action: 'start' },
      }),
    );
    await expect.poll(() => owner.socket.readyState, { timeout: 5000 }).toBe(WebSocket.CLOSED);
  } finally {
    owner.socket.terminate();
  }
});
it('feature flags reject direct HTTP and socket bypasses while unrelated account access survives', async () => {
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
    modules: productivityModules(db, {
      POMODORO_ENABLED: 'false',
      TASKS_ENABLED: 'false',
      CHAT_ENABLED: 'false',
    }),
  });
  const actions: [string, object][] = [
    ['pomodoro/control', { roomId: r.id, version: 0, action: 'start' }],
    ['tasks/create', { scope: { scope: 'personal' }, title: 'Denied', requestId: randomUUID() }],
    ['chat/send', { roomId: r.id, text: 'Denied', requestId: randomUUID() }],
  ];
  const ws = await socketFor(a);
  try {
    for (const [path, payload] of actions) {
      expect((await request(a, path, payload)).statusCode).toBe(404);
      expect(await ws.send(path.replace('/', '.'), payload)).toMatchObject({
        error: { code: 'NOT_FOUND' },
      });
    }
  } finally {
    ws.socket.terminate();
  }
  expect((await request(a, 'session/csrf')).statusCode).toBe(200);
});
it('timer configuration and reset survive a new module instance and empty-room time continues', async () => {
  const { a, r } = await pair(),
    config = { focusSeconds: 60, shortBreakSeconds: 60, longBreakSeconds: 120, cycles: 2 };
  expect(
    (
      await request(a, 'pomodoro/control', {
        roomId: r.id,
        version: 0,
        action: 'configure',
        config,
      })
    ).json().state.config,
  ).toEqual(config);
  expect(
    (await request(a, 'pomodoro/control', { roomId: r.id, version: 1, action: 'start' }))
      .statusCode,
  ).toBe(200);
  expect(
    (
      await request(a, 'pomodoro/control', {
        roomId: r.id,
        version: 2,
        action: 'configure',
        config,
      })
    ).statusCode,
  ).toBe(409);
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
    modules: productivityModules(db),
  });
  expect((await request(a, `pomodoro/snapshot?roomId=${r.id}`)).json().state).toMatchObject({
    version: 2,
    running: true,
    config,
  });
});
it('existing room subscriptions close after owner block and do not leak later content', async () => {
  const { a, b, r } = await pair(),
    ws = await socketFor(b);
  try {
    await ws.send('chat.history', { roomId: r.id });
    await ws.send('tasks.snapshot', { scope: 'shared', roomId: r.id });
    await request(a, 'friends/block', { targetId: b.id });
    await expect.poll(() => ws.socket.readyState, { timeout: 5000 }).toBe(WebSocket.CLOSED);
    for (const path of [
      `chat/history?roomId=${r.id}`,
      `tasks/snapshot?scope=shared&roomId=${r.id}`,
      `pomodoro/snapshot?roomId=${r.id}`,
    ])
      expect((await request(b, path)).statusCode).toBe(403);
  } finally {
    ws.socket.terminate();
  }
});
it('active task limits remain bounded and deleted private text is erased', async () => {
  const a = await login('limits'),
    scope = { scope: 'personal' };
  for (let n = 0; n < 200; n++)
    await db.query(
      sql`INSERT INTO tasks.personal_items(id,owner_id,created_by,request_id,title,position) VALUES(${randomUUID()},${a.id},${a.id},${randomUUID()},${'private ' + n},${n})`,
    );
  expect(
    (await request(a, 'tasks/create', { scope, title: 'Overflow', requestId: randomUUID() }))
      .statusCode,
  ).toBe(409);
  const t = (await request(a, 'tasks/snapshot?scope=personal')).json().tasks[0];
  await request(a, 'tasks/delete', { scope, id: t.id, version: 1 });
  expect(
    (await db.query(sql`SELECT title FROM tasks.personal_items WHERE id=${t.id}`))[0]!.title,
  ).toBe('Deleted task');
  expect(
    (await request(a, 'tasks/create', { scope, title: 'Available slot', requestId: randomUUID() }))
      .statusCode,
  ).toBe(200);
});
it('amendment migration preserves task records, tombstones, versions and original checksums', () => {
  expect(upgradeEvidence.after).toEqual(upgradeEvidence.before);
  expect(upgradeEvidence.historyAfter).toEqual(upgradeEvidence.historyBefore);
});
it('personal timer is account private, separately persisted and rejects all forged owner/state fields', async () => {
  const { a, b, r } = await pair();
  expect((await request(a, 'pomodoro/personal-snapshot')).json().state).toMatchObject({
    scope: 'personal',
    version: 0,
    running: false,
  });
  const payload = {
    version: 0,
    action: 'configure',
    config: { focusSeconds: 2220, shortBreakSeconds: 60, longBreakSeconds: 120, cycles: 2 },
  };
  for (const field of ['userId', 'ownerId', 'roomId', 'role', 'anchorAt', 'running', 'scope'])
    expect(
      (
        await request(a, 'pomodoro/personal-control', {
          ...payload,
          [field]: field === 'roomId' ? r.id : b.id,
        })
      ).statusCode,
    ).toBe(400);
  expect((await request(a, 'pomodoro/personal-control', payload)).statusCode).toBe(200);
  for (const key of ['userId', 'ownerId', 'roomId'])
    expect((await request(b, `pomodoro/personal-snapshot?${key}=${a.id}`)).statusCode).toBe(400);
  expect((await request(b, 'pomodoro/personal-snapshot')).json().state).toMatchObject({
    scope: 'personal',
    version: 0,
    config: { focusSeconds: 1500 },
  });
  expect((await request(a, `pomodoro/snapshot?roomId=${r.id}`)).json().state).toMatchObject({
    version: 0,
    config: { focusSeconds: 1500 },
  });
  expect(
    (await db.query(sql`SELECT state FROM pomodoro.personal_timers WHERE user_id=${a.id}`))[0]!
      .state,
  ).not.toHaveProperty('roomId');
  expect(
    await db.query(sql`SELECT * FROM pomodoro.personal_timers WHERE user_id=${b.id}`),
  ).toHaveLength(0);
});
it('personal timer controls serialize per account, survive room changes and use server timestamps', async () => {
  const { a, b, r } = await pair(),
    other = await room(a);
  const start = { version: 0, action: 'start' };
  const results = await Promise.all([
    request(a, 'pomodoro/personal-control', start),
    request(a, 'pomodoro/personal-control', start),
  ]);
  expect(results.map((x) => x.statusCode).sort()).toEqual([200, 409]);
  const started = (await request(a, 'pomodoro/personal-snapshot')).json().state;
  expect(started.anchorAt).toBeGreaterThan(Date.now() - 5000);
  expect(started.running).toBe(true);
  await request(a, 'rooms/join', { roomId: other.id });
  expect((await request(a, 'pomodoro/personal-snapshot')).json().state).toEqual(started);
  expect(
    (await request(a, 'pomodoro/personal-control', { version: 1, action: 'pause' })).json().state
      .running,
  ).toBe(false);
  expect(
    (await request(a, 'pomodoro/personal-control', { version: 2, action: 'skip' })).json().state
      .phase,
  ).toBe('shortBreak');
  expect(
    (await request(a, 'pomodoro/personal-control', { version: 3, action: 'resume' })).json().state
      .running,
  ).toBe(true);
  expect(
    (await request(a, 'pomodoro/personal-control', { version: 4, action: 'reset' })).json().state,
  ).toMatchObject({ phase: 'focus', cycle: 1, running: false, version: 5 });
  await db.query(sql`DELETE FROM rooms.memberships WHERE room_id=${r.id} AND user_id=${b.id}`);
  expect((await request(b, 'pomodoro/personal-control', start)).statusCode).toBe(200);
  expect((await request(b, `pomodoro/snapshot?roomId=${other.id}`)).statusCode).toBe(403);
});
it('personal snapshot syncs only the same account across sockets and never appears in room subscriptions', async () => {
  const { a, b, r } = await pair(),
    one = await socketFor(a),
    two = await socketFor(a),
    viewer = await socketFor(b);
  try {
    await one.send('pomodoro.personal-snapshot', {});
    await two.send('pomodoro.personal-snapshot', {});
    await viewer.send('pomodoro.snapshot', { roomId: r.id });
    await viewer.send('pomodoro.personal-snapshot', {});
    expect(
      await viewer.send('pomodoro.personal-control', {
        version: 0,
        action: 'start',
        ownerId: a.id,
      }),
    ).toHaveProperty('error');
    const result = await one.send('pomodoro.personal-control', {
      version: 0,
      action: 'configure',
      config: { focusSeconds: 2220, shortBreakSeconds: 60, longBreakSeconds: 120, cycles: 2 },
    });
    expect(result).toHaveProperty('result');
    await expect
      .poll(
        () => JSON.stringify(two.messages.filter((m) => m.event === 'pomodoro.personal-snapshot')),
        { timeout: 6000 },
      )
      .toContain('2220');
    expect(JSON.stringify(viewer.messages)).not.toContain('2220');
    two.socket.terminate();
    const again = await socketFor(a);
    try {
      expect(JSON.stringify(await again.send('pomodoro.personal-snapshot', {}))).toContain('2220');
    } finally {
      again.socket.terminate();
    }
  } finally {
    one.socket.terminate();
    two.socket.terminate();
    viewer.socket.terminate();
  }
});
it('personal timer rejects missing/expired/revoked credentials, CSRF, origin and feature-flag bypasses', async () => {
  const { a } = await pair(),
    payload = { version: 0, action: 'start' };
  expect((await request(null, 'pomodoro/personal-snapshot')).statusCode).toBe(401);
  expect((await request(null, 'pomodoro/personal-control', payload)).statusCode).toBe(401);
  expect(
    (await request(a, 'pomodoro/personal-control', payload, { 'x-csrf-token': '' })).statusCode,
  ).toBe(403);
  expect(
    (await request(a, 'pomodoro/personal-control', payload, { origin: 'https://evil.example' }))
      .statusCode,
  ).toBe(403);
  expect((await request(a, 'pomodoro/personal-control')).statusCode).toBe(404);
  const ws = await socketFor(a);
  try {
    await ws.send('pomodoro.personal-snapshot', {});
    await sessions.revokeSubject(a.id);
    ws.socket.send(
      JSON.stringify({
        version: 1,
        requestId: randomUUID(),
        command: 'pomodoro.personal-control',
        payload,
      }),
    );
    await expect.poll(() => ws.socket.readyState, { timeout: 5000 }).toBe(WebSocket.CLOSED);
    expect((await request(a, 'pomodoro/personal-control', payload)).statusCode).toBe(401);
  } finally {
    ws.socket.terminate();
  }
  const expired = await login('expired-personal');
  await db.query(
    sql`UPDATE core.sessions SET created_at=now()-interval '2 days', expires_at=now()-interval '1 day', idle_expires_at=now()-interval '1 day' WHERE subject_id=${expired.id}`,
  );
  expect((await request(expired, 'pomodoro/personal-snapshot')).statusCode).toBe(401);
  const valid = await login('disabled-personal');
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
    modules: productivityModules(db, { POMODORO_ENABLED: 'false' }),
  });
  expect((await request(valid, 'pomodoro/personal-snapshot')).statusCode).toBe(404);
  expect((await request(valid, 'pomodoro/personal-control', payload)).statusCode).toBe(404);
  const denied = await socketFor(valid);
  try {
    expect(await denied.send('pomodoro.personal-control', payload)).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
  } finally {
    denied.socket.terminate();
  }
});
it('personal timer survives a new server/module instance without acquiring a room dependency', async () => {
  const a = await login('personal-restart');
  await request(a, 'pomodoro/personal-control', { version: 0, action: 'start' });
  const saved = (await request(a, 'pomodoro/personal-snapshot')).json().state;
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
    modules: productivityModules(db),
  });
  expect((await request(a, 'pomodoro/personal-snapshot')).json().state).toEqual(saved);
});
it('task tables enforce distinct scope constraints and preserve global replay isolation', async () => {
  const { a, r } = await pair(),
    requestId = randomUUID();
  expect(
    (
      await request(a, 'tasks/create', {
        scope: { scope: 'personal' },
        title: 'Private record',
        requestId,
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await request(a, 'tasks/create', {
        scope: { scope: 'shared', roomId: r.id },
        title: 'Scope replay',
        requestId,
      })
    ).statusCode,
  ).toBe(409);
  expect(
    await db.query(sql`SELECT * FROM tasks.personal_items WHERE owner_id=${a.id}`),
  ).toHaveLength(1);
  expect(await db.query(sql`SELECT * FROM tasks.shared_items WHERE room_id=${r.id}`)).toHaveLength(
    0,
  );
  await expect(
    db.query(
      sql`INSERT INTO tasks.personal_items(id,room_id,created_by,request_id,title,position) VALUES(${randomUUID()},${r.id},${a.id},${randomUUID()},'Wrong scope',0)`,
    ),
  ).rejects.toThrow();
  await expect(
    db.query(
      sql`INSERT INTO tasks.shared_items(id,owner_id,created_by,request_id,title,position) VALUES(${randomUUID()},${a.id},${a.id},${randomUUID()},'Wrong scope',0)`,
    ),
  ).rejects.toThrow();
});
