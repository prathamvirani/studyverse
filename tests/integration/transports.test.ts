import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { Sessions, SESSION_COOKIE } from '@study/core/server';
import type { IssuedSession } from '@study/core/server';
import { createServer } from '../../apps/api/src/server.ts';
import { readConfig } from '../../apps/api/src/config.ts';
import { dummyModule, ids } from '../fixtures/dummy-module.ts';
import { MemoryLimiter, MemorySessions } from '../fixtures/memory.ts';

const origin = 'https://localhost:8443',
  host = 'localhost:8443';
const config = readConfig({
  NODE_ENV: 'test',
  APP_ORIGIN: origin,
  DATABASE_URL: 'postgresql://unused/unused',
  REDIS_URL: 'redis://unused',
  LOG_LEVEL: 'silent',
  WS_REVALIDATE_MS: '100',
});
const ownUrl = `/api/v1/fixture/${ids.scopeA}/${ids.objectA}`;
let fixture: ReturnType<typeof dummyModule>,
  sessions: Sessions,
  sessionStore: MemorySessions,
  issued: IssuedSession,
  other: IssuedSession;
let server: Awaited<ReturnType<typeof createServer>>;
const sockets: WebSocket[] = [];
const headers = () => ({
  host,
  origin,
  cookie: `${SESSION_COOKIE}=${issued.token}`,
  'x-csrf-token': issued.session.csrfToken,
});
beforeEach(async () => {
  fixture = dummyModule();
  sessionStore = new MemorySessions();
  sessions = new Sessions(sessionStore);
  issued = await sessions.issue(ids.alice);
  other = await sessions.issue(ids.bob);
  server = await createServer({
    config,
    sessions,
    limiter: new MemoryLimiter(),
    modules: [fixture.module],
  });
});
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  await server.app.close();
});
describe('HTTP hostile-client behavior', () => {
  it('allows only a current authorized operation and publishes a validated event', async () => {
    const response = await server.app.inject({
      method: 'POST',
      url: ownUrl,
      headers: headers(),
      payload: { value: 'changed' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ value: 'changed' });
    expect(fixture.observed).toEqual([{ id: ids.objectA, value: 'changed' }]);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
  });
  it.each(['absent', 'forged', 'expired', 'revoked'] as const)(
    'denies %s credentials',
    async (scenario) => {
      let cookieValue: string | undefined = `${SESSION_COOKIE}=${issued.token}`;
      if (scenario === 'absent') cookieValue = '';
      if (scenario === 'forged') cookieValue = `${SESSION_COOKIE}=${'a'.repeat(43)}`;
      if (scenario === 'expired') {
        const expiring = new Sessions(sessionStore, undefined, () => 0, 1000, 1000);
        const old = await expiring.issue(ids.alice);
        cookieValue = `${SESSION_COOKIE}=${old.token}`;
      }
      if (scenario === 'revoked') await sessions.revoke(issued.session.id);
      for (const method of ['GET', 'POST'] as const) {
        const response = await server.app.inject({
          method,
          url: ownUrl,
          headers: { ...headers(), cookie: cookieValue },
          ...(method === 'POST' ? { payload: { value: 'bad' } } : {}),
        });
        expect(response.statusCode).toBe(401);
      }
      expect(fixture.objects.get(ids.objectA)?.value).toBe('initial');
    },
  );
  it.each(['missing', 'wrong', 'cross-session'] as const)('rejects %s CSRF', async (scenario) => {
    const csrf =
      scenario === 'missing' ? '' : scenario === 'wrong' ? 'x'.repeat(43) : other.session.csrfToken;
    const response = await server.app.inject({
      method: 'POST',
      url: ownUrl,
      headers: { ...headers(), 'x-csrf-token': csrf },
      payload: { value: 'bad' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('CSRF_REJECTED');
  });
  it.each([
    { origin: '' },
    { origin: 'https://evil.test' },
    { host: 'evil.test' },
    { 'sec-fetch-site': 'cross-site' },
  ])('rejects hostile origin/host metadata %j', async (change) => {
    const response = await server.app.inject({
      method: 'POST',
      url: ownUrl,
      headers: { ...headers(), ...change },
      payload: { value: 'bad' },
    });
    expect(response.statusCode).toBe(403);
  });
  it.each([
    { role: 'owner' },
    { userId: ids.bob },
    { ownerId: ids.alice },
    { scopeId: ids.scopeB },
  ])('rejects forged identity fields %j', async (change) => {
    const response = await server.app.inject({
      method: 'POST',
      url: ownUrl,
      headers: headers(),
      payload: { value: 'bad', ...change },
    });
    expect(response.statusCode).toBe(400);
  });
  it('denies cross-user, cross-scope and missing-object enumeration identically', async () => {
    const urls = [
      `/api/v1/fixture/${ids.scopeB}/${ids.objectB}`,
      `/api/v1/fixture/${ids.scopeB}/${ids.objectA}`,
      `/api/v1/fixture/${ids.scopeA}/${randomUUID()}`,
    ];
    for (const url of urls) {
      const response = await server.app.inject({ method: 'GET', url, headers: headers() });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
    }
  });
  it('keeps GET/HEAD read-only and rejects invalid types and oversized bodies', async () => {
    for (const method of ['GET', 'HEAD'] as const)
      expect(
        (await server.app.inject({ method, url: ownUrl, headers: headers() })).statusCode,
      ).toBe(200);
    expect(fixture.observed).toHaveLength(0);
    for (const payload of ['not JSON', 'x'.repeat(17_000)])
      expect(
        (
          await server.app.inject({
            method: 'POST',
            url: ownUrl,
            headers: { ...headers(), 'content-type': 'application/json' },
            payload,
          })
        ).statusCode,
      ).toBe(400);
    expect(
      (
        await server.app.inject({
          method: 'POST',
          url: ownUrl,
          headers: { ...headers(), 'content-type': 'text/plain' },
          payload: '{}',
        })
      ).statusCode,
    ).toBe(400);
  });
  it('rate-limits authenticated commands even with forged forwarding headers', async () => {
    for (let index = 0; index < 3; index++)
      expect(
        (
          await server.app.inject({
            method: 'POST',
            url: ownUrl,
            headers: headers(),
            payload: { value: 'ok' },
          })
        ).statusCode,
      ).toBe(200);
    const response = await server.app.inject({
      method: 'POST',
      url: ownUrl,
      headers: { ...headers(), 'x-forwarded-for': '8.8.8.8' },
      payload: { value: 'flood' },
    });
    expect(response.statusCode).toBe(429);
  });
  it('exposes only the current session CSRF value and never mints a session', async () => {
    const response = await server.app.inject({
      method: 'GET',
      url: '/api/v1/session/csrf',
      headers: headers(),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ csrfToken: issued.session.csrfToken });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.body).not.toContain(issued.token);
    expect(
      (await server.app.inject({ method: 'GET', url: '/api/v1/session/csrf', headers: { host } }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await server.app.inject({
          method: 'POST',
          url: '/api/v1/session/issue',
          headers: headers(),
          payload: { userId: ids.alice },
        })
      ).statusCode,
    ).toBe(404);
  });
  it('rejects ambiguous duplicate session cookies', async () => {
    const response = await server.app.inject({
      url: ownUrl,
      headers: {
        ...headers(),
        cookie: `${SESSION_COOKIE}=${issued.token}; ${SESSION_COOKIE}=${other.token}`,
      },
    });
    expect(response.statusCode).toBe(401);
  });
});
async function connect(change: Record<string, string> = {}, query = ''): Promise<WebSocket> {
  if (!server.app.server.listening) await server.app.listen({ host: '127.0.0.1', port: 0 });
  const address = server.app.server.address();
  if (!address || typeof address === 'string') throw new Error('No test server');
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/v1/realtime${query}`, {
    headers: { ...headers(), ...change },
  });
  sockets.push(socket);
  await once(socket, 'open');
  return socket;
}
async function command(socket: WebSocket, changes: Record<string, unknown> = {}) {
  const response = once(socket, 'message');
  socket.send(
    JSON.stringify({
      version: 1,
      requestId: randomUUID(),
      command: 'fixture.write',
      csrf: issued.session.csrfToken,
      payload: {
        params: { scopeId: ids.scopeA, id: ids.objectA },
        query: {},
        body: { value: 'via socket' },
      },
      ...changes,
    }),
  );
  const [data] = await response;
  return JSON.parse(String(data)) as { result?: { value: string }; error?: { code: string } };
}
describe('real WebSocket hostile clients', () => {
  it('authenticates upgrades and rejects absent/forged cookies, origins and URL credentials', async () => {
    for (const change of [
      { cookie: '' },
      { cookie: `${SESSION_COOKIE}=forged` },
      { origin: 'https://evil.test' },
      { origin: '' },
    ])
      await expect(connect(change)).rejects.toThrow('Unexpected server response');
    await expect(connect({}, '?token=anything')).rejects.toThrow('Unexpected server response');
  });
  it('dispatches through the same authorized operation and event registries', async () => {
    const socket = await connect();
    expect(await command(socket)).toEqual(
      expect.objectContaining({ result: { value: 'via socket' } }),
    );
    expect(fixture.observed).toHaveLength(1);
  });
  it('checks membership on every message after a successful connection', async () => {
    const socket = await connect();
    expect((await command(socket)).result).toBeDefined();
    fixture.members.get(ids.scopeA)?.delete(ids.alice);
    expect((await command(socket)).error?.code).toBe('FORBIDDEN');
  });
  it('invalidates realtime access after session revocation', async () => {
    const socket = await connect();
    await sessions.revoke(issued.session.id);
    expect((await command(socket)).error?.code).toBe('UNAUTHENTICATED');
  });
  it('closes an idle socket after its session is revoked without waiting for a message', async () => {
    const socket = await connect();
    const closed = once(socket, 'close');
    await sessions.revoke(issued.session.id);
    expect((await closed)[0]).toBe(1008);
  });
  it('rejects malformed JSON and binary messages without dispatching an operation', async () => {
    const socket = await connect();
    const response = once(socket, 'message');
    socket.send('{');
    expect(JSON.parse(String((await response)[0])).error.code).toBe('INVALID_REQUEST');
    const closed = once(socket, 'close');
    socket.send(Buffer.from([1, 2, 3]));
    expect((await closed)[0]).toBe(1008);
    expect(fixture.observed).toHaveLength(0);
  });
  it('rejects wrong CSRF, altered object IDs, roles and protocol versions', async () => {
    const socket = await connect();
    expect((await command(socket, { csrf: other.session.csrfToken })).error?.code).toBe(
      'CSRF_REJECTED',
    );
    expect(
      (
        await command(socket, {
          payload: {
            params: { scopeId: ids.scopeB, id: ids.objectB },
            query: {},
            body: { value: 'bad' },
          },
        })
      ).error?.code,
    ).toBe('FORBIDDEN');
    expect((await command(socket, { role: 'owner' })).error?.code).toBe('INVALID_REQUEST');
    expect((await command(socket, { version: 2 })).error?.code).toBe('INVALID_REQUEST');
  });
  it('rejects oversized frames and rate-limits commands', async () => {
    const socket = await connect();
    for (let i = 0; i < 3; i++) expect((await command(socket)).result).toBeDefined();
    expect((await command(socket)).error?.code).toBe('RATE_LIMITED');
    const oversized = await connect(),
      closed = once(oversized, 'close');
    oversized.send('x'.repeat(17_000));
    expect((await closed)[0]).toBe(1009);
  });
});
