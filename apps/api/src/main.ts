import { createPool, PostgresDatabase, PostgresSessionStore, sql } from '@study/adapters/postgres';
import { createRedis, RedisRateLimiter } from '@study/adapters/redis';
import { Sessions } from '@study/core/server';
import { readConfig } from './config.ts';
import { createLogger, createObserver } from './observer.ts';
import { createServer } from './server.ts';

const config = readConfig(process.env),
  logger = createLogger(config.LOG_LEVEL),
  observer = createObserver(logger);
const pool = createPool(config.DATABASE_URL),
  db = new PostgresDatabase(pool),
  redis = createRedis(config.REDIS_URL);
pool.on('error', () => observer.record('dependency.postgres.failed'));
redis.on('error', () => observer.record('dependency.redis.failed'));
try {
  await db.query(sql`SELECT 1`);
  await redis.connect();
  const { app } = await createServer({
    config,
    sessions: new Sessions(new PostgresSessionStore(db), observer),
    limiter: new RedisRateLimiter(redis),
    observer,
    ready: async (signal) => {
      try {
        await db.query(sql`SELECT 1 FROM core.sessions LIMIT 0`);
        signal.throwIfAborted();
        await redis.withAbortSignal(signal).ping();
        return true;
      } catch {
        return false;
      }
    },
  });
  app.addHook('onClose', async () => {
    redis.destroy();
    await pool.end();
  });
  const shutdown = () => {
    void app.close().catch(() => {
      process.exitCode = 1;
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch {
  observer.record('server.start.failed');
  if (redis.isOpen) redis.destroy();
  await pool.end();
  process.exitCode = 1;
}
