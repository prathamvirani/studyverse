import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import WebSocket from 'ws';
import { beforeAll, afterAll, expect, it } from 'vitest';
import {
  createPool,
  migrate,
  PostgresDatabase,
  PostgresSessionStore,
  sql,
} from '@study/adapters/postgres';
import { createRedis, RedisRateLimiter, RedisEphemeralStore } from '@study/adapters/redis';
import { Sessions } from '@study/core/server';
import { createServer } from '../../apps/api/src/server.ts';
import { readConfig } from '../../apps/api/src/config.ts';
import { identityModules } from '../../apps/api/src/identity.ts';
import { socialComposition } from '../../apps/api/src/social.ts';
import { activityModules } from '../../apps/api/src/activities.ts';
import { productivityModules } from '../../apps/api/src/productivity.ts';
import { applicationMigrationManifest } from '../../scripts/application-migrations.ts';
import type { ActivityView } from '@study/contracts';
const local = Object.fromEntries(
  (await readFile('.local/compose.env', 'utf8'))
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split('=')),
);
const runtimeUrl =
  process.env.TEST_DATABASE_URL ??
  `postgresql://study_runtime:${local.RUNTIME_PASSWORD}@localhost:5433/study_test`;
const migrationUrl =
  process.env.TEST_MIGRATION_DATABASE_URL ??
  `postgresql://study_migrator:${local.MIGRATION_PASSWORD}@localhost:5433/study_test`;
if (
  !new URL(runtimeUrl).pathname.endsWith('_test') ||
  !new URL(migrationUrl).pathname.endsWith('_test')
)
  throw new Error('Dedicated test database required');
const pool = createPool(runtimeUrl),
  migrationPool = createPool(migrationUrl),
  db = new PostgresDatabase(pool),
  sessions = new Sessions(new PostgresSessionStore(db));
const redis = createRedis(`redis://:${local.REDIS_PASSWORD}@localhost:6380`);
redis.on('error', () => {});
const members = new Map<string, string[]>();
let server: Awaited<ReturnType<typeof createServer>>,
  disabled: Awaited<ReturnType<typeof createServer>>,
  socketPort = 0;
type User = { id: string; cookie: string; csrf: string; sessionId: string };
async function user(): Promise<User> {
  const id = randomUUID();
  await db.query(sql`INSERT INTO identity.users(id,display_name) VALUES(${id},'Activity tester')`);
  const issued = await sessions.issue(id);
  return {
    id,
    cookie: sessions.cookie(issued).split(';')[0]!,
    csrf: issued.session.csrfToken,
    sessionId: issued.session.id,
  };
}
const headers = (u?: User) => ({
  host: 'localhost:8443',
  origin: 'https://localhost:8443',
  ...(u ? { cookie: u.cookie, 'x-csrf-token': u.csrf } : {}),
});
const request = (u: User | undefined, path: string, input?: unknown, target = server) =>
  target.app.inject({
    method: input === undefined ? 'GET' : 'POST',
    url: '/api/v1/' + path,
    headers: headers(u),
    ...(input === undefined ? {} : { payload: input as object }),
  });
async function fixture() {
  const owner = await user(),
    member = await user(),
    spectator = await user(),
    outsider = await user();
  const response = await request(owner, 'rooms/create', {
    name: 'Activity test',
    privacy: 'public',
  });
  expect(response.statusCode, response.body).toBe(200);
  const roomId = response.json().id as string;
  for (const u of [member, spectator])
    expect((await request(u, 'rooms/join', { roomId })).statusCode).toBe(200);
  members.set(roomId, [owner.id, member.id, spectator.id]);
  return { owner, member, spectator, outsider, roomId };
}
const revision = (v: ActivityView) => ({
  roomId: v.roomId,
  activityId: v.activity!.id,
  version: v.activity!.version,
  round: v.activity!.round,
  requestId: randomUUID(),
});
async function start(owner: User, roomId: string, kind = 'letter-lantern') {
  const response = await request(owner, 'activities/start', {
    roomId,
    kind,
    requestId: randomUUID(),
    options: { rounds: 1, seconds: 30, friendsOnly: false },
  });
  expect(response.statusCode, response.body).toBe(200);
  return response.json() as ActivityView;
}
async function memberAction(u: User, v: ActivityView, action: string) {
  const response = await request(u, 'activities/member', { ...revision(v), action });
  expect(response.statusCode, response.body).toBe(200);
  return response.json() as ActivityView;
}
async function connect(u: User) {
  const ws = new WebSocket(`ws://127.0.0.1:${socketPort}/api/v1/realtime`, { headers: headers(u) });
  await once(ws, 'open');
  return {
    ws,
    async send(command: string, payload: unknown) {
      const requestId = randomUUID();
      const reply = new Promise<{ result: ActivityView; error: { code: string } }>(
        (resolve, reject) => {
          const timer = setTimeout(() => {
            ws.off('message', receive);
            reject(new Error('Socket response timed out'));
          }, 6000);
          function receive(raw: WebSocket.RawData) {
            const value = JSON.parse(raw.toString());
            if (value.requestId === requestId || value.error?.requestId === requestId) {
              clearTimeout(timer);
              ws.off('message', receive);
              resolve(value);
            }
          }
          ws.on('message', receive);
        },
      );
      ws.send(JSON.stringify({ version: 1, requestId, command, payload, csrf: u.csrf }));
      return reply;
    },
  };
}
beforeAll(async () => {
  await redis.connect();
  await migrate(migrationPool, await applicationMigrationManifest());
  const social = socialComposition(
    db,
    new RedisEphemeralStore(redis),
    new PostgresSessionStore(db),
    true,
  );
  const config = readConfig({
    NODE_ENV: 'test',
    APP_ORIGIN: 'https://localhost:8443',
    DATABASE_URL: runtimeUrl,
    REDIS_URL: 'redis://unused',
    LOG_LEVEL: 'silent',
    INGRESS_LIMIT: '10000',
  });
  server = await createServer({
    config,
    sessions,
    limiter: new RedisRateLimiter(redis),
    modules: [
      ...identityModules(db, {}, 'https://localhost:8443'),
      ...social.modules,
      ...productivityModules(db),
      ...activityModules(db, { members: async (room) => members.get(room) ?? [] }),
    ],
  });
  disabled = await createServer({
    config,
    sessions,
    limiter: new RedisRateLimiter(redis),
    modules: [
      ...identityModules(db, {}, 'https://localhost:8443'),
      ...activityModules(db, { members: async () => [] }, { ACTIVITIES_ENABLED: 'false' }),
      ...productivityModules(db),
    ],
  });
  await server.app.listen({ host: '127.0.0.1', port: 0 });
  socketPort = (server.app.server.address() as { port: number }).port;
});
afterAll(async () => {
  await server?.app.close();
  await disabled?.app.close();
  if (redis.isOpen) redis.destroy();
  await pool.end();
  await migrationPool.end();
});
it('real room authorization denies hostile HTTP starts and forged object/actor/authority fields', async () => {
  const f = await fixture(),
    body = {
      roomId: f.roomId,
      kind: 'letter-lantern',
      requestId: randomUUID(),
      options: { rounds: 1, seconds: 30, friendsOnly: false },
    };
  expect((await request(f.member, 'activities/start', body)).statusCode).toBe(403);
  expect((await request(f.outsider, `activities/snapshot?roomId=${f.roomId}`)).statusCode).toBe(
    403,
  );
  expect((await request(undefined, 'activities/start', body)).statusCode).toBe(401);
  for (const field of ['role', 'userId', 'actorId', 'score', 'winner', 'drawer', 'turn', 'owner'])
    expect(
      (
        await request(f.owner, 'activities/start', {
          ...body,
          [field]: field === 'role' ? 'owner' : f.owner.id,
        })
      ).statusCode,
    ).toBe(400);
  expect(
    (await request(f.owner, 'activities/start', { ...body, kind: 'unknown-game' })).statusCode,
  ).toBe(400);
  expect(
    (await request(f.owner, 'activities/start', { ...body, roomId: randomUUID() })).statusCode,
  ).toBe(403);
  const noCsrf = await server.app.inject({
    method: 'POST',
    url: '/api/v1/activities/start',
    headers: { host: 'localhost:8443', origin: 'https://localhost:8443', cookie: f.owner.cookie },
    payload: body,
  });
  expect(noCsrf.statusCode).toBe(403);
  expect(
    (
      await server.app.inject({
        method: 'POST',
        url: '/api/v1/activities/start',
        headers: { ...headers(f.owner), origin: 'https://evil.example' },
        payload: body,
      })
    ).statusCode,
  ).toBe(403);
  expect((await request(f.owner, 'activities/start')).statusCode).toBe(404);
});
it('manual hostile WebSocket commands reject spectator actions, replay, stale round and cross-room changes', async () => {
  const f = await fixture();
  let v = await start(f.owner, f.roomId);
  v = await memberAction(f.member, v, 'join');
  v = await memberAction(f.spectator, v, 'spectate');
  v = await memberAction(f.owner, v, 'begin');
  const client = await connect(f.member),
    spectator = await connect(f.spectator);
  try {
    const snap = await client.send('activities.snapshot', { roomId: f.roomId });
    expect(snap.result.activity!.data).not.toHaveProperty('reveal');
    const input = { ...revision(v), action: { type: 'guess', guess: 'ZZZZZ' } };
    expect((await spectator.send('activities.play', input)).error.code).toBe('FORBIDDEN');
    expect(
      (await client.send('activities.play', { ...input, role: 'owner', score: 999 })).error.code,
    ).toBe('INVALID_REQUEST');
    expect((await client.send('activities.play', { ...input, round: 50 })).error.code).toBe(
      'CONFLICT',
    );
    expect(
      (await client.send('activities.play', { ...input, roomId: randomUUID() })).error.code,
    ).toBe('FORBIDDEN');
    const played = await client.send('activities.play', input);
    const data = played.result.activity!.data;
    expect(data.type === 'word' && data.guesses[0]!.evaluation).toEqual(Array(5).fill('absent'));
    expect((await client.send('activities.play', input)).error.code).toBe('CONFLICT');
    const recovered = await request(f.member, `activities/snapshot?roomId=${f.roomId}`);
    expect(recovered.json().activity.data.guesses).toHaveLength(1);
    await db.query(
      sql`DELETE FROM rooms.memberships WHERE room_id=${f.roomId} AND user_id=${f.member.id}`,
    );
    expect(
      (
        await client.send('activities.play', {
          ...revision(played.result),
          action: { type: 'guess', guess: 'APPLE' },
        })
      ).error.code,
    ).toBe('FORBIDDEN');
  } finally {
    client.ws.close();
    spectator.ws.close();
  }
});
it('real transports bound drawings and guesses, preserve secret projection and reject non-drawers', async () => {
  const f = await fixture();
  let v = await start(f.owner, f.roomId, 'sketch-circle');
  v = await memberAction(f.member, v, 'join');
  v = await memberAction(f.spectator, v, 'spectate');
  v = await memberAction(f.owner, v, 'begin');
  const action = {
    type: 'stroke',
    strokes: [
      {
        color: 'ink',
        width: 3,
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.9, y: 0.8 },
        ],
      },
    ],
  };
  expect((await request(f.member, 'activities/play', { ...revision(v), action })).statusCode).toBe(
    403,
  );
  expect(
    (await request(f.spectator, 'activities/play', { ...revision(v), action })).statusCode,
  ).toBe(403);
  const safe = (await request(f.member, `activities/snapshot?roomId=${f.roomId}`)).json();
  expect(safe.activity.data).not.toHaveProperty('prompt');
  for (const points of [[{ x: -1, y: 0 }], Array(65).fill({ x: 0, y: 0 }), [{ x: 1, y: 999 }]])
    expect(
      (
        await request(f.owner, 'activities/play', {
          ...revision(v),
          action: { ...action, strokes: [{ ...action.strokes[0], points }] },
        })
      ).statusCode,
    ).toBe(400);
  expect(
    (
      await request(f.owner, 'activities/play', {
        ...revision(v),
        action: { type: 'guess', guess: 'x'.repeat(20000) },
      })
    ).statusCode,
  ).toBe(400);
  const accepted = await request(f.owner, 'activities/play', { ...revision(v), action });
  expect(accepted.statusCode, accepted.body).toBe(200);
  v = accepted.json();
  expect(
    (await request(f.member, `activities/snapshot?roomId=${f.roomId}`)).json().activity.data
      .strokes,
  ).toHaveLength(1);
  const guessed = await request(f.member, 'activities/play', {
    ...revision(v),
    action: {
      type: 'guess',
      guess: v.activity!.data.type === 'drawing' ? v.activity!.data.prompt : '',
    },
  });
  expect(guessed.statusCode, guessed.body).toBe(200);
  expect(
    guessed.json().activity.members.find((m: { id: string }) => m.id === f.member.id).score,
  ).toBe(100);
});
it('owner settings persist and disabled activities leave room, Pomodoro, Tasks and Chat operational', async () => {
  const f = await fixture();
  expect(
    (
      await request(f.member, 'activities/configure', {
        roomId: f.roomId,
        settings: { start: 'everyone', ownerAbsent: 'everyone' },
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await request(f.owner, 'activities/configure', {
        roomId: f.roomId,
        settings: { start: 'everyone', ownerAbsent: 'preserve' },
      })
    ).statusCode,
  ).toBe(200);
  expect((await request(f.member, `activities/snapshot?roomId=${f.roomId}`)).json().canStart).toBe(
    true,
  );
  expect(
    (await request(f.owner, `activities/snapshot?roomId=${f.roomId}`, undefined, disabled))
      .statusCode,
  ).toBe(404);
  for (const path of [
    `rooms/detail?roomId=${f.roomId}`,
    `pomodoro/snapshot?roomId=${f.roomId}`,
    `tasks/snapshot?scope=shared&roomId=${f.roomId}`,
    `chat/history?roomId=${f.roomId}`,
  ])
    expect((await request(f.owner, path, undefined, disabled)).statusCode, path).toBe(200);
  const migrated = await db.query(
    sql`SELECT settings FROM activities.settings WHERE room_id=${f.roomId}`,
  );
  expect(migrated[0]?.settings).toEqual({ start: 'everyone', ownerAbsent: 'preserve' });
});
