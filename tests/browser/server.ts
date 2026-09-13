import { roomMediaModules } from '../../apps/api/src/room-media.ts';
import { backgroundsModules } from '../../apps/api/src/backgrounds.ts';
import { rtcModules } from '../../apps/api/src/rtc.ts';
import { rtcBundle } from './rtc-bundle.ts';
import { productivityModules } from '../../apps/api/src/productivity.ts';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { browserTls } from './tls.ts';
import { createServer as createHttpsServer } from 'node:https';
import { request as httpRequest } from 'node:http';
import { Sessions, AppError } from '@study/core/server';
import { MemoryLimiter } from '../fixtures/memory.ts';
import {
  createPool,
  migrate,
  PostgresDatabase,
  PostgresSessionStore,
  PostgresSessionDirectory,
  sql,
} from '@study/adapters/postgres';
import { identityModule, identityAccounts } from '@study/identity/server';
import { roomsModule } from '@study/rooms/server';
import { socialDirectory } from '@study/friends/server';
import { socialComposition } from '../../apps/api/src/social.ts';
import { createRedis, RedisEphemeralStore } from '@study/adapters/redis';
import { applicationMigrationManifest } from '../../scripts/application-migrations.ts';
import { dummyModule, ids } from '../fixtures/dummy-module.ts';
import { createServer } from '../../apps/api/src/server.ts';
import { readConfig } from '../../apps/api/src/config.ts';

// Isolated loopback harness with fake providers and a dedicated test database only.
const { keyPath, certPath } = browserTls();
const rtcScript = await rtcBundle();
const probeScript = await rtcBundle('tests/browser/livekit-probe.ts');
const local = Object.fromEntries(
  readFileSync('.local/compose.env', 'utf8')
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
  throw new Error('Dedicated test databases required');
const pool = createPool(runtimeUrl),
  migrationPool = createPool(migrationUrl),
  db = new PostgresDatabase(pool);
await migrate(migrationPool, await applicationMigrationManifest());
await migrationPool.end();
await db.query(
  sql`INSERT INTO identity.users (id, display_name) VALUES (${ids.alice}, 'Foundation tester') ON CONFLICT DO NOTHING`,
);
const fail = (code: ConstructorParameters<typeof AppError>[0]): never => {
  throw new AppError(code);
};
const sessions = new Sessions(new PostgresSessionStore(db)),
  issued = await sessions.issue(ids.alice);
const redis = createRedis(`redis://:${local.REDIS_PASSWORD}@localhost:6380`);
redis.on('error', () => {});
await redis.connect();
const social = socialComposition(db, new RedisEphemeralStore(redis), new PostgresSessionStore(db));
const { app } = await createServer({
  sessions,
  limiter: new MemoryLimiter(),
  modules: [
    ...productivityModules(db),
    ...backgroundsModules(db),
    dummyModule().module,
    identityModule({
      db,
      directory: new PostgresSessionDirectory(db),
      fail,
      providers: (['google', 'discord'] as const).map((id) => ({
        id,
        // A fresh fake provider subject per login keeps browser scenarios independent.
        // Session restoration still reuses its original account; production limits are unchanged.
        authorizationUrl: (challenge) =>
          `https://localhost:8449/auth/callback/${id}?state=${challenge.state}&code=browser-${id}-${challenge.state}`,
        exchange: async (code) => ({
          provider: id,
          issuer: `https://${id}.test`,
          subject: code,
          displayName: `${id} test member`,
        }),
      })),
    }),
    roomsModule({
      db,
      accountExists: identityAccounts(db).exists,
      fail,
      social: socialDirectory(db),
    }),
    ...social.modules,
    ...roomMediaModules(db, social.occupancy),
    ...rtcModules(db, new PostgresSessionStore(db), {
      RTC_ENABLED: 'true',
      LIVEKIT_ROOM_PREFIX: 'test-study-',
      LIVEKIT_URL: 'wss://localhost:8449',
      LIVEKIT_SERVICE_URL: 'http://127.0.0.1:7880',
      LIVEKIT_API_KEY: local.LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET: local.LIVEKIT_API_SECRET,
    }),
  ],
  config: readConfig({
    NODE_ENV: 'test',
    APP_ORIGIN: 'https://localhost:8449',
    DATABASE_URL: 'postgresql://unused/unused',
    REDIS_URL: 'redis://unused',
    LOG_LEVEL: 'silent',
    // The whole browser suite shares one loopback IP and runs many users faster than real use.
    // Hostile-client/rate suites retain production defaults and test rejection independently.
    INGRESS_LIMIT: '10000',
  }),
});
await app.listen({ host: '127.0.0.1', port: 3009 });
// Keep the real disabled-feature browser regression alongside enabled SFU scenarios.
// This second isolated API uses the same genuine session store, with RTC disabled at composition.
const disabledRtc = await createServer({
  sessions,
  limiter: new MemoryLimiter(),
  modules: rtcModules(db, new PostgresSessionStore(db), {
    RTC_ENABLED: 'false',
    LIVEKIT_ROOM_PREFIX: 'disabled-test-study-',
    LIVEKIT_URL: 'wss://localhost:8449',
    LIVEKIT_SERVICE_URL: 'http://127.0.0.1:7880',
    LIVEKIT_API_KEY: local.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: local.LIVEKIT_API_SECRET,
  }),
  config: readConfig({
    NODE_ENV: 'test',
    APP_ORIGIN: 'https://localhost:8449',
    DATABASE_URL: 'postgresql://unused/unused',
    REDIS_URL: 'redis://unused',
    LOG_LEVEL: 'silent',
  }),
});
await disabledRtc.app.listen({ host: '127.0.0.1', port: 3010 });
const web = spawn(process.execPath, ['apps/web/.output/server/index.mjs'], {
  // Stage A is exercised only by the isolated test deployment; product default stays basic.
  env: { ...process.env, HOST: '127.0.0.1', PORT: '3008', NUXT_PUBLIC_RTC_QUALITY_STAGE: 'a' },
  stdio: 'inherit',
  windowsHide: true,
});
web.on('error', () => {
  process.exitCode = 1;
});
const proxy = createHttpsServer(
  { key: readFileSync(keyPath), cert: readFileSync(certPath) },
  (request, response) => {
    if (request.url === '/__test/probe') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<!doctype html><script type="module" src="/__test/probe.js"></script>');
      return;
    }
    if (request.url === '/__test/probe.js') {
      response.writeHead(200, { 'Content-Type': 'text/javascript' });
      response.end(probeScript);
      return;
    }
    if (request.url === '/__test/rtc') {
      response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      response.end(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/__test/rtc.css"></head><body><div id="app"></div><script type="module" src="/__test/rtc.js"></script></body></html>',
      );
      return;
    }
    if (request.url === '/__test/rtc.js') {
      response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
      response.end(rtcScript);
      return;
    }
    if (request.url === '/__test/rtc.css') {
      response.writeHead(200, { 'Content-Type': 'text/css' });
      response.end(
        (readFileSync('apps/web/app/app.vue', 'utf8').match(/<style>([\s\S]*?)<\/style>/)?.[1] ??
          '') + readFileSync('apps/web/app/room/room.css', 'utf8'),
      );
      return;
    }
    if (request.url === '/__test/session' && request.method === 'POST') {
      response.writeHead(204, {
        'Set-Cookie': sessions.cookie(issued),
        'Cache-Control': 'no-store',
      });
      response.end();
      return;
    }
    const disabledJoin = request.url === '/__test/rtc-disabled/join';
    const port = disabledJoin
      ? 3010
      : request.url?.startsWith('/rtc')
        ? 7880
        : request.url?.startsWith('/api/')
          ? 3009
          : 3008;
    const upstream = httpRequest(
      {
        hostname: '127.0.0.1',
        port,
        path: disabledJoin ? '/api/v1/rtc/join' : request.url,
        method: request.method,
        headers: request.headers,
      },
      (result) => {
        response.writeHead(result.statusCode ?? 502, result.headers);
        result.pipe(response);
      },
    );
    upstream.on('error', () => {
      response.writeHead(503);
      response.end();
    });
    request.pipe(upstream);
  },
);
proxy.listen(8449, '127.0.0.1');
proxy.on('upgrade', (request, socket, head) => {
  const upstream = httpRequest({
    hostname: '127.0.0.1',
    port: request.url?.startsWith('/rtc') ? 7880 : 3009,
    path: request.url,
    headers: request.headers,
  });
  upstream.on('upgrade', (response, peer, peerHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n${response.rawHeaders.reduce((text, value, index) => text + value + (index % 2 ? '\r\n' : ': '), '')}\r\n`,
    );
    if (peerHead.length) socket.write(peerHead);
    if (head.length) peer.write(head);
    socket.pipe(peer).pipe(socket);
    socket.on('error', () => peer.destroy());
    peer.on('error', () => socket.destroy());
  });
  upstream.on('error', () => socket.destroy());
  upstream.on('response', () => socket.destroy());
  upstream.end();
});
const close = () => {
  redis.destroy();
  web.kill();
  proxy.closeAllConnections();
  proxy.close();
  void app.close();
  void disabledRtc.app.close();
  void pool.end();
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
process.on('exit', () => {
  web.kill();
});
