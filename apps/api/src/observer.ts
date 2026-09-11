import pino from 'pino';
import type { Observer } from '@study/feature-sdk';

export function createLogger(level: string, destination?: pino.DestinationStream) {
  return pino(
    {
      level,
      redact: {
        paths: [
          'token',
          'tokenHash',
          'csrfToken',
          'csrf',
          'password',
          'databaseUrl',
          'redisUrl',
          'req.headers.cookie',
          'req.headers.authorization',
          'req.headers["x-csrf-token"]',
          'res.headers["set-cookie"]',
          '*.token',
          '*.tokenHash',
          '*.csrfToken',
          '*.csrf',
          '*.password',
          '*.databaseUrl',
          '*.redisUrl',
        ],
        censor: '[REDACTED]',
      },
    },
    destination,
  );
}
export function createObserver(logger: pino.Logger): Observer {
  return {
    record(name, fields = {}) {
      logger.info({ event: name, ...fields });
    },
    measure(name, value, labels = {}) {
      logger.debug({ metric: name, value, labels });
    },
  };
}
