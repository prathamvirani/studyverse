import { afterEach, expect, it, vi } from 'vitest';
import { Sessions, SESSION_COOKIE } from '@study/core/server';
import { createServer } from '../../apps/api/src/server.ts';
import { readConfig } from '../../apps/api/src/config.ts';
import { dummyModule, ids } from '../fixtures/dummy-module.ts';
import { MemorySessions } from '../fixtures/memory.ts';

const origin = 'https://localhost:8443';
const path = '/api/v1/ready';
const applications: Awaited<ReturnType<typeof createServer>>[] = [];
async function setup(ready = vi.fn(async () => true)) {
  const store = new MemorySessions();
  const sessions = new Sessions(store);
  const issued = await sessions.issue(ids.alice);
  const fixture = dummyModule();
  const limiter = { consume: vi.fn(async () => true) };
  const server = await createServer({
    config: readConfig({
      NODE_ENV: 'test',
      APP_ORIGIN: origin,
      DATABASE_URL: 'postgresql://unused/unused',
      REDIS_URL: 'redis://unused',
      LOG_LEVEL: 'silent',
    }),
    sessions,
    limiter,
    ready,
    modules: [fixture.module],
  });
  applications.push(server);
  return { ...server, store, sessions, issued, fixture, limiter, ready };
}
afterEach(async () => {
  for (const server of applications.splice(0)) await server.app.close();
});

it('accepts a real originless loopback fetch with its natural Host header', async () => {
  const { app } = await setup();
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test address');
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});

it('reads readiness without session access, application mutations, rate-counter writes or secrets', async () => {
  const { app, sessions, store, issued, fixture, limiter } = await setup();
  const authenticate = vi.spyOn(sessions, 'authenticate');
  const before = structuredClone([...store.rows]);
  for (const host of ['localhost:8443', '127.0.0.1:3001', '[::1]:3001']) {
    const response = await app.inject({
      method: 'GET',
      url: path,
      remoteAddress: host.startsWith('[') ? '::1' : '127.0.0.1',
      headers: { host, cookie: `${SESSION_COOKIE}=forged` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).not.toContain(issued.token);
    expect(response.body).not.toContain(issued.session.subjectId);
  }
  expect(authenticate).not.toHaveBeenCalled();
  expect(limiter.consume).not.toHaveBeenCalled();
  expect([...store.rows]).toEqual(before);
  expect(fixture.observed).toEqual([]);
});

it('does not extend the infrastructure exception to application routes, methods or forged peer headers', async () => {
  const { app, issued, fixture, ready } = await setup();
  const applicationPath = `/api/v1/fixture/${ids.scopeA}/${ids.objectA}`;
  const credentials = {
    host: 'localhost:8443',
    cookie: `${SESSION_COOKIE}=${issued.token}`,
    'x-csrf-token': issued.session.csrfToken,
  };
  for (const requestOrigin of [undefined, 'https://evil.test']) {
    const response = await app.inject({
      method: 'POST',
      url: applicationPath,
      headers: {
        ...credentials,
        ...(requestOrigin === undefined ? {} : { origin: requestOrigin }),
      },
      payload: { value: 'forged' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ORIGIN_REJECTED');
  }
  for (const url of [applicationPath, '/api/v1/health', '/api/v1/capabilities', `${path}/extra`]) {
    const response = await app.inject({
      method: 'GET',
      url,
      remoteAddress: '127.0.0.1',
      headers: { host: '127.0.0.1:3001' },
    });
    expect(response.statusCode).toBe(403);
  }
  const forgedPeer = await app.inject({
    method: 'GET',
    url: path,
    remoteAddress: '203.0.113.9',
    headers: { host: '127.0.0.1:3001', 'x-forwarded-for': '127.0.0.1' },
  });
  expect(forgedPeer.statusCode).toBe(403);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const) {
    const response = await app.inject({ method, url: path, headers: { ...credentials, origin } });
    expect(response.statusCode).toBe(404);
  }
  expect(ready).not.toHaveBeenCalled();
  expect(fixture.observed).toEqual([]);
});

it('rejects hostile readiness origins, hosts, query fields and GET bodies before probing', async () => {
  const { app, ready } = await setup();
  for (const headers of [
    { host: 'localhost:8443', origin: 'https://evil.test' },
    { host: '127.0.0.1:3001', origin: 'https://evil.test' },
    { host: 'evil.test' },
    { host: '127.0.0.1:3001', 'sec-fetch-site': 'cross-site' },
  ])
    expect(
      (await app.inject({ method: 'GET', url: path, headers, remoteAddress: '127.0.0.1' }))
        .statusCode,
    ).toBe(403);
  expect(
    (
      await app.inject({
        method: 'GET',
        url: `${path}?sessionId=forged`,
        headers: { host: 'localhost:8443' },
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await app.inject({
        method: 'GET',
        url: path,
        headers: { host: 'localhost:8443' },
        payload: { mutate: true },
      })
    ).statusCode,
  ).toBe(400);
  expect(ready).not.toHaveBeenCalled();
});

it.each(['false', 'exception'] as const)(
  'returns only a safe 503 readiness result on dependency %s',
  async (failure) => {
    const ready = vi.fn(async () => {
      if (failure === 'exception') throw new Error('private-database-password');
      return false;
    });
    const { app } = await setup(ready);
    const response = await app.inject({
      method: 'GET',
      url: path,
      headers: { host: 'localhost:8443' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'unavailable' });
    expect(response.headers['set-cookie']).toBeUndefined();
  },
);
