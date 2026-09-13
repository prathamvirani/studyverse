import { expect, it } from 'vitest';
import { emptySchema, okSchema } from '@study/contracts';
import { defineOperation } from '@study/feature-sdk';
import { Sessions } from '@study/core/server';
import { createServer } from '../../apps/api/src/server.ts';
import { readConfig } from '../../apps/api/src/config.ts';
import { MemorySessions, MemoryLimiter } from '../fixtures/memory.ts';

it.each(['deleted', 'expired', 'revoked'] as const)(
  'allows public sign-in options with a %s session cookie',
  async (scenario) => {
    const store = new MemorySessions();
    const sessions = new Sessions(store);
    const issued = await sessions.issue('00000000-0000-4000-8000-000000000001');
    if (scenario === 'deleted') store.rows.clear();
    if (scenario === 'revoked') await sessions.revoke(issued.session.id);
    if (scenario === 'expired')
      store.rows.set(issued.session.id, { ...issued.session, expiresAt: 0 });
    const { app } = await createServer({
      config: readConfig({
        APP_ORIGIN: 'https://localhost:8443',
        DATABASE_URL: 'postgresql://unused/x',
        REDIS_URL: 'redis://unused',
        LOG_LEVEL: 'silent',
      }),
      sessions,
      limiter: new MemoryLimiter(),
      modules: [
        {
          id: 'publicfixture',
          version: '1.0.0',
          required: true,
          operations: [
            defineOperation({
              id: 'publicfixture.options',
              kind: 'query',
              input: emptySchema,
              output: okSchema,
              access: { public: true },
              rate: { limit: 20, windowMs: 60_000 },
              handle: async (_input, context) => {
                expect(context.actor).toBeNull();
                return { ok: true };
              },
            }),
          ],
          http: [
            {
              method: 'GET',
              path: '/api/v1/publicfixture/options',
              operation: 'publicfixture.options',
              input: 'query',
            },
          ],
        },
      ],
    });
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/publicfixture/options',
        headers: { host: 'localhost:8443', cookie: `__Host-study-session=${issued.token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    } finally {
      await app.close();
    }
  },
);

it('isolates pre-session POSTs from ordinary commands and rejects browser CSRF', async () => {
  let calls = 0;
  const { app, runtime } = await createServer({
    config: readConfig({
      APP_ORIGIN: 'https://localhost:8443',
      DATABASE_URL: 'postgresql://unused/x',
      REDIS_URL: 'redis://unused',
      LOG_LEVEL: 'silent',
    }),
    sessions: new Sessions(new MemorySessions()),
    limiter: new MemoryLimiter(),
    modules: [
      {
        id: 'authfixture',
        version: '1.0.0',
        required: true,
        operations: [
          defineOperation({
            id: 'authfixture.start',
            kind: 'authentication',
            input: emptySchema,
            output: okSchema,
            access: { public: true },
            rate: { limit: 20, windowMs: 60_000 },
            handle: async () => {
              calls++;
              return { ok: true };
            },
          }),
        ],
        http: [
          {
            method: 'POST',
            path: '/api/v1/authfixture/start',
            operation: 'authfixture.start',
            input: 'body',
          },
        ],
      },
    ],
  });
  try {
    const headers = {
      host: 'localhost:8443',
      origin: 'https://localhost:8443',
      'x-study-auth': '1',
    };
    for (const invalid of [
      { ...headers, origin: '' },
      { ...headers, origin: 'https://evil.example' },
      { ...headers, 'x-study-auth': '' },
    ]) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/authfixture/start',
            headers: invalid,
            payload: {},
          })
        ).statusCode,
      ).toBe(403);
    }
    for (const method of ['GET', 'HEAD'] as const)
      expect(
        (await app.inject({ method, url: '/api/v1/authfixture/start', headers })).statusCode,
      ).toBe(404);
    expect(calls).toBe(0);
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/authfixture/start', headers, payload: {} }))
        .statusCode,
    ).toBe(200);
    expect(() =>
      runtime.realtime.register('authfixture.start', {
        command: 'authfixture.start',
        operation: 'authfixture.start',
      }),
    ).toThrow();
    await expect(
      runtime.operations.execute(
        'authfixture.start',
        {},
        { actor: null, requestId: 'test', signal: new AbortController().signal },
      ),
    ).rejects.toThrow();
  } finally {
    await app.close();
  }
});
