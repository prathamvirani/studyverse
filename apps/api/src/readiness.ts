import type { FastifyRequest } from 'fastify';
import { healthSchema } from '@study/contracts';
import type { z } from '@study/contracts';
import { AppError, bounded, verifyRequestBoundary } from '@study/core/server';
import type { ApiConfig } from './config.ts';

export const READINESS_PATH = '/api/v1/ready' as const;
export const READINESS_OPERATION = 'foundation.ready';
export const READINESS_TIMEOUT_MS = 2_000;
export type ReadinessResult = z.infer<typeof healthSchema>;

/** Only this registered GET route has infrastructure-probe semantics. */
export function isReadinessRequest(request: FastifyRequest): boolean {
  return (
    request.method === 'GET' &&
    request.routeOptions.url === READINESS_PATH &&
    request.raw.url?.split('?')[0] === READINESS_PATH
  );
}

export function verifyReadinessBoundary(request: FastifyRequest, config: ApiConfig): void {
  if (!isReadinessRequest(request)) throw new AppError('ORIGIN_REJECTED');
  const host = request.headers.host?.toLowerCase();
  const port = request.raw.socket.localPort ?? config.API_PORT;
  const localHosts = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
  const loopbackPeer = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
    request.raw.socket.remoteAddress ?? '',
  );
  const localProbe =
    loopbackPeer &&
    host !== undefined &&
    localHosts.includes(host) &&
    request.headers.origin === undefined;
  // Never interpret forwarded headers as evidence of a local infrastructure caller.
  // A supplied Origin must still match the public origin and public Host policy.
  if (!localProbe)
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
      false,
    );
  if (request.headers['sec-fetch-site'] === 'cross-site') throw new AppError('ORIGIN_REJECTED');
}

/** A stalled dependency produces a bounded answer; concurrent probes share one check. */
export function createReadinessProbe(check: (signal: AbortSignal) => Promise<boolean>) {
  let inFlight: Promise<ReadinessResult> | undefined;
  return (): Promise<ReadinessResult> => {
    if (inFlight) return inFlight;
    inFlight = bounded((signal) => {
      const work = Promise.resolve().then(() => check(signal));
      const finished = () => {
        inFlight = undefined;
      };
      // Keep the timed-out result while non-cooperating work is still outstanding.
      // Repeated probes must not build an unbounded database/Redis queue.
      void work.then(finished, finished);
      return work;
    }, READINESS_TIMEOUT_MS).then(
      (ready) => ({ status: ready === true ? 'ok' : 'unavailable' }),
      () => ({ status: 'unavailable' }),
    );
    return inFlight;
  };
}
