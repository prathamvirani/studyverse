import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createServer as createHttpsServer } from 'node:https';
import { request as httpRequest } from 'node:http';
import { Sessions } from '@study/core/server';
import { MemoryLimiter, MemorySessions } from '../fixtures/memory.ts';
import { dummyModule, ids } from '../fixtures/dummy-module.ts';
import { createServer } from '../../apps/api/src/server.ts';
import { readConfig } from '../../apps/api/src/config.ts';

// Isolated loopback test harness. No production import, database or real account exists here.
mkdirSync('.local/browser-tls', { recursive: true });
const keyPath = '.local/browser-tls/key.pem',
  certPath = '.local/browser-tls/cert.pem';
if (!existsSync(keyPath) || !existsSync(certPath)) {
  const openssl =
    process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl';
  execFileSync(
    openssl,
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '2',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost',
    ],
    { stdio: 'ignore' },
  );
}
const sessions = new Sessions(new MemorySessions()),
  issued = await sessions.issue(ids.alice);
const { app } = await createServer({
  sessions,
  limiter: new MemoryLimiter(),
  modules: [dummyModule().module],
  config: readConfig({
    NODE_ENV: 'test',
    APP_ORIGIN: 'https://localhost:8449',
    DATABASE_URL: 'postgresql://unused/unused',
    REDIS_URL: 'redis://unused',
    LOG_LEVEL: 'silent',
  }),
});
await app.listen({ host: '127.0.0.1', port: 3009 });
const web = spawn(process.execPath, ['apps/web/.output/server/index.mjs'], {
  env: { ...process.env, HOST: '127.0.0.1', PORT: '3008' },
  stdio: 'inherit',
  windowsHide: true,
});
web.on('error', () => {
  process.exitCode = 1;
});
const proxy = createHttpsServer(
  { key: readFileSync(keyPath), cert: readFileSync(certPath) },
  (request, response) => {
    if (request.url === '/__test/session' && request.method === 'POST') {
      response.writeHead(204, {
        'Set-Cookie': sessions.cookie(issued),
        'Cache-Control': 'no-store',
      });
      response.end();
      return;
    }
    const port = request.url?.startsWith('/api/') ? 3009 : 3008;
    const upstream = httpRequest(
      {
        hostname: '127.0.0.1',
        port,
        path: request.url,
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
const close = () => {
  web.kill();
  proxy.closeAllConnections();
  proxy.close();
  void app.close();
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
process.on('exit', () => {
  web.kill();
});
