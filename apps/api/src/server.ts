import { randomUUID } from 'node:crypto';
import Fastify, { LogController } from 'fastify';
import type { FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { commandEnvelopeSchema, emptySchema, healthSchema } from '@study/contracts';
import type {
  BrowserAuthentication,
  FeatureModule,
  Observer,
  RateLimiter,
  SessionRecord,
} from '@study/feature-sdk';
import {
  AppError,
  ModuleRuntime,
  SESSION_COOKIE,
  Sessions,
  errorStatus,
  safeError,
  verifyRequestBoundary,
} from '@study/core/server';
import type { ApiConfig } from './config.ts';
import { foundationModule } from './foundation.ts';
import { createLogger, createObserver } from './observer.ts';
import {
  createReadinessProbe,
  isReadinessRequest,
  verifyReadinessBoundary,
  READINESS_PATH,
  READINESS_OPERATION,
} from './readiness.ts';

export interface ServerDependencies {
  readonly config: ApiConfig;
  readonly sessions: Sessions;
  readonly limiter: RateLimiter;
  readonly modules?: readonly FeatureModule[];
  readonly observer?: Observer;
  readonly ready?: (signal: AbortSignal) => Promise<boolean>;
}
export async function createServer(dependencies: ServerDependencies) {
  const { config, sessions, limiter } = dependencies;
  const logger = createLogger(config.LOG_LEVEL),
    observer = dependencies.observer ?? createObserver(logger);
  const runtime = new ModuleRuntime(limiter, config.NODE_ENV, observer);
  const readiness = createReadinessProbe(dependencies.ready ?? (async () => false));
  await runtime.start([
    foundationModule(runtime, sessions, readiness),
    ...(dependencies.modules ?? []),
  ]);
  const app = Fastify({
    loggerInstance: logger,
    logController: new LogController({ disableRequestLogging: true }),
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    trustProxy: false,
    bodyLimit: 16_384,
    requestTimeout: 10_000,
    connectionTimeout: 15_000,
  });
  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });
  await app.register(websocket, { options: { maxPayload: 16_384, perMessageDeflate: false } });
  const starts = new WeakMap<FastifyRequest, number>();
  function boundary(request: FastifyRequest, mutation: boolean): void {
    verifyRequestBoundary(
      {
        host: request.headers.host,
        origin: request.headers.origin,
        fetchSite:
          typeof request.headers['sec-fetch-site'] === 'string'
            ? request.headers['sec-fetch-site']
            : undefined,
      },
      config.APP_ORIGIN,
      mutation,
    );
  }
  async function sessionFor(
    request: FastifyRequest,
    required: boolean,
  ): Promise<SessionRecord | null> {
    const cookieHeader = request.headers.cookie ?? '';
    if (
      cookieHeader.split(';').filter((item) => item.trim().startsWith(`${SESSION_COOKIE}=`))
        .length > 1
    )
      throw new AppError('UNAUTHENTICATED');
    const token = request.cookies[SESSION_COOKIE];
    if (!required && token === undefined) return null;
    return sessions.authenticate(token);
  }
  app.addHook('onRequest', async (request, reply) => {
    starts.set(request, performance.now());
    reply.header('Cache-Control', 'no-store').header('X-Request-ID', request.id);
    if (isReadinessRequest(request)) {
      verifyReadinessBoundary(request, config);
      if (
        (request.headers['content-length'] !== undefined &&
          request.headers['content-length'] !== '0') ||
        request.headers['transfer-encoding'] !== undefined
      )
        throw new AppError('INVALID_REQUEST');
      return; // Infrastructure probes never consume application rate counters.
    }
    boundary(request, false);
    // Ignore caller-supplied X-Forwarded-For. Deployment may introduce only an explicitly trusted proxy.
    if (
      !(await limiter.consume(`ingress:${request.ip}`, {
        limit: config.INGRESS_LIMIT,
        windowMs: 60_000,
      }))
    )
      throw new AppError('RATE_LIMITED');
  });
  app.setErrorHandler((error, request, reply) => {
    const known =
      error instanceof AppError
        ? error
        : error !== null &&
            typeof error === 'object' &&
            'statusCode' in error &&
            typeof error.statusCode === 'number' &&
            error.statusCode >= 400 &&
            error.statusCode < 500
          ? new AppError('INVALID_REQUEST')
          : safeError(error);
    observer.record('http.rejected', { requestId: request.id, code: known.code });
    void reply.status(errorStatus[known.code]).send({
      version: 1,
      error: { code: known.code, message: known.message, requestId: request.id },
    });
  });
  app.setNotFoundHandler((_request, _reply) => {
    throw new AppError('NOT_FOUND');
  });
  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url ?? 'unmatched';
    observer.measure(
      'http.duration_ms',
      performance.now() - (starts.get(request) ?? performance.now()),
      { route, method: request.method, status: String(reply.statusCode) },
    );
  });
  for (const binding of runtime.http.values()) {
    const infrastructure =
      binding.method === 'GET' &&
      binding.path === READINESS_PATH &&
      binding.operation === READINESS_OPERATION;
    app.route({
      method: binding.method,
      url: binding.path,
      ...(infrastructure ? { exposeHeadRoute: false } : {}),
      handler: async (request, reply) => {
        if (infrastructure) {
          verifyReadinessBoundary(request, config);
          if (!emptySchema.safeParse(request.query).success) throw new AppError('INVALID_REQUEST');
          // The exact allowlisted registration uses only the bounded dependency probe.
          // No cookies, session store, permissions, domain handlers or counters are touched.
          const result = healthSchema.parse(await readiness());
          return reply.code(result.status === 'ok' ? 200 : 503).send(result);
        }
        const operation = runtime.operations.get(binding.operation);
        if (!operation) throw new AppError('NOT_FOUND');
        const mutation = !['GET', 'HEAD'].includes(request.method);
        const authentication = operation.kind === 'authentication';
        let session: SessionRecord | null;
        try {
          session = await sessionFor(
            request,
            (!authentication && mutation) || !('public' in operation.access),
          );
        } catch (error) {
          if (
            (!authentication && mutation) ||
            !('public' in operation.access) ||
            !(error instanceof AppError) ||
            error.code !== 'UNAUTHENTICATED'
          )
            throw error;
          // A stale cookie must not prevent public reads or starting a fresh login.
          session = null;
        }
        boundary(request, mutation);
        if (mutation) {
          if (!session && !authentication) throw new AppError('UNAUTHENTICATED');
          if (session) sessions.verifyCsrf(session, request.headers['x-csrf-token']);
          // Pre-session authentication is an explicit POST-only contract. Exact Origin,
          // JSON and a custom header prevent browser CSRF before a session exists.
          if (authentication && request.headers['x-study-auth'] !== '1')
            throw new AppError('CSRF_REJECTED');
          if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? ''))
            throw new AppError('INVALID_REQUEST');
        }
        const parts = { params: request.params, query: request.query, body: request.body ?? {} };
        // Undeclared query parameters must not become a hidden side channel.
        if (
          binding.input !== 'query' &&
          binding.input !== 'parts' &&
          Object.keys(request.query as object).length
        )
          throw new AppError('INVALID_REQUEST');
        const input = binding.input === 'parts' ? parts : parts[binding.input];
        const controller = new AbortController();
        const cookies: string[] = [];
        const flowCookie = '__Host-study-flow';
        const browser: BrowserAuthentication | undefined = authentication
          ? {
              flowToken: request.cookies[flowCookie],
              deviceLabel: (request.headers['user-agent'] ?? 'Browser')
                .replace(/[^\x20-\x7e]/g, '')
                .slice(0, 120),
              setFlowToken(token) {
                if (token !== null && !/^[A-Za-z0-9_-]{43}$/.test(token))
                  throw new AppError('INTERNAL');
                cookies.push(
                  `${flowCookie}=${token ?? ''}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${token ? 600 : 0}`,
                );
              },
              async issueSession(subjectId) {
                const issued = await sessions.issue(subjectId);
                cookies.push(sessions.cookie(issued));
                return issued.session.id;
              },
              async refreshSession() {
                if (!session) throw new AppError('UNAUTHENTICATED');
                cookies.push(
                  sessions.cookie(await sessions.refresh(request.cookies[SESSION_COOKIE]!)),
                );
              },
              clearSession() {
                cookies.push(sessions.clearCookie());
              },
            }
          : undefined;
        try {
          const result = await runtime.operations.execute(binding.operation, input, {
            actor: session ? sessions.actor(session) : null,
            requestId: request.id,
            signal: controller.signal,
            ...(browser ? { browser } : {}),
          });
          if (cookies.length) reply.header('Set-Cookie', cookies);
          return result;
        } finally {
          controller.abort();
        }
      },
    });
  }
  const connections = new Map<string, number>();
  app.get(
    '/api/v1/realtime',
    {
      websocket: true,
      preValidation: async (request) => {
        boundary(request, true);
        if (request.raw.url?.includes('?')) throw new AppError('INVALID_REQUEST');
        const session = await sessionFor(request, true);
        if (!session) throw new AppError('UNAUTHENTICATED');
        if ((connections.get(session.id) ?? 0) >= 4) throw new AppError('RATE_LIMITED');
      },
    },
    (socket, request) => {
      const connectionId = randomUUID();
      const snapshots = new Map<
        string,
        { operation: string; payload: unknown; event: string; last: string }
      >();
      let delivering = false;
      const deliveryTimer = setInterval(() => {
        if (closed || delivering || !snapshots.size) return;
        delivering = true;
        void (async () => {
          try {
            for (const [key, item] of snapshots) {
              const session = await sessions.authenticate(token);
              const result = await runtime.operations.execute(item.operation, item.payload, {
                actor: sessions.actor(session),
                requestId: randomUUID(),
                signal: AbortSignal.timeout(2000),
                connectionId,
              });
              const encoded = JSON.stringify(result);
              if (!closed && socket.readyState === 1 && encoded !== item.last) {
                if (socket.bufferedAmount > 65_536) {
                  socket.close(1008, 'Slow connection');
                  return;
                }
                socket.send(
                  JSON.stringify({
                    version: 1,
                    eventId: randomUUID(),
                    event: item.event,
                    occurredAt: new Date().toISOString(),
                    payload: result,
                  }),
                );
                if (snapshots.get(key) === item) item.last = encoded;
              }
            }
          } catch {
            // Never retain a previously authorized subscription after any failed check.
            snapshots.clear();
            socket.close(1008, 'Subscription unavailable');
          } finally {
            delivering = false;
          }
        })();
      }, 2000);
      deliveryTimer.unref();
      // Attach listeners synchronously; async message work is queued with a hard bound.
      let pending = 0,
        chain = Promise.resolve(),
        closed = false,
        trackedSession: string | undefined;
      const token = request.cookies[SESSION_COOKIE];
      const initialization = sessions
        .authenticate(token)
        .then((session) => {
          if (closed) return;
          if ((connections.get(session.id) ?? 0) >= 4) {
            socket.close(1008, 'Connection limit');
            return;
          }
          trackedSession = session.id;
          connections.set(session.id, (connections.get(session.id) ?? 0) + 1);
        })
        .catch(() => {
          socket.close(1008, 'Session unavailable');
        });
      const timer = setInterval(() => {
        void sessions.authenticate(token).catch(() => {
          socket.close(1008, 'Session unavailable');
        });
      }, config.WS_REVALIDATE_MS);
      timer.unref();
      socket.on('close', () => {
        closed = true;
        clearInterval(deliveryTimer);
        snapshots.clear();
        void chain.finally(() => runtime.connectionClosed(connectionId));
        clearInterval(timer);
        if (trackedSession) {
          const count = (connections.get(trackedSession) ?? 1) - 1;
          if (count) connections.set(trackedSession, count);
          else connections.delete(trackedSession);
        }
      });
      socket.on('error', () => {
        observer.record('realtime.transport.failed', { requestId: request.id });
      });
      socket.on('message', (data, isBinary) => {
        if (closed) return;
        if (isBinary || pending >= 16 || socket.bufferedAmount > 65_536) {
          socket.close(1008, 'Message rejected');
          return;
        }
        pending++;
        chain = chain
          .then(async () => {
            let requestId: string = randomUUID();
            try {
              await initialization;
              if (closed || !trackedSession) return;
              const session = await sessions.authenticate(token);
              if (
                !(await limiter.consume(`socket:${session.subjectId}`, {
                  limit: 120,
                  windowMs: 60_000,
                }))
              )
                throw new AppError('RATE_LIMITED');
              let raw: unknown;
              try {
                raw = JSON.parse(data.toString());
              } catch {
                throw new AppError('INVALID_REQUEST');
              }
              const parsed = commandEnvelopeSchema.safeParse(raw);
              if (!parsed.success) throw new AppError('INVALID_REQUEST');
              requestId = parsed.data.requestId;
              const binding = runtime.realtime.get(parsed.data.command),
                operation = binding && runtime.operations.get(binding.operation);
              if (!binding || !operation) throw new AppError('NOT_FOUND');
              if (operation.kind === 'command') sessions.verifyCsrf(session, parsed.data.csrf);
              const controller = new AbortController();
              try {
                const result = await runtime.operations.execute(
                  binding.operation,
                  parsed.data.payload,
                  {
                    actor: sessions.actor(session),
                    requestId,
                    signal: controller.signal,
                    connectionId,
                  },
                );
                if (binding.snapshotEvent && !closed)
                  snapshots.set(binding.command, {
                    operation: binding.operation,
                    payload: parsed.data.payload,
                    event: binding.snapshotEvent,
                    last: JSON.stringify(result),
                  });
                if (!closed && socket.readyState === 1)
                  socket.send(JSON.stringify({ version: 1, requestId, result }));
                observer.record('realtime.completed', { command: binding.command, requestId });
              } finally {
                controller.abort();
              }
            } catch (error) {
              const safe = safeError(error);
              observer.record('realtime.rejected', { code: safe.code, requestId });
              if (!closed && socket.readyState === 1)
                socket.send(
                  JSON.stringify({
                    version: 1,
                    error: { code: safe.code, message: safe.message, requestId },
                  }),
                );
              if (safe.code === 'UNAUTHENTICATED' || safe.code === 'UNAVAILABLE')
                socket.close(1008, 'Session unavailable');
            } finally {
              pending--;
            }
          })
          .catch(() => {
            socket.close(1011, 'Service unavailable');
          });
      });
    },
  );
  app.addHook('onClose', async () => {
    await runtime.stop();
  });
  return { app, runtime };
}
