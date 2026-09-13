import { roomMediaModules } from './room-media.ts';
import { backgroundsModules } from './backgrounds.ts';
import { productivityModules } from './productivity.ts';
import { createPool, PostgresDatabase, PostgresSessionStore, sql } from '@study/adapters/postgres';
import { createRedis, RedisRateLimiter, RedisEphemeralStore } from '@study/adapters/redis';
import { socialComposition } from './social.ts';
import { socialDirectory } from '@study/friends/server';
import { Sessions } from '@study/core/server';
import { readConfig } from './config.ts';
import { createLogger, createObserver } from './observer.ts';
import { createServer } from './server.ts';
import { identityModules } from './identity.ts';
import { rtcModules } from './rtc.ts';
import { featureEnabled } from './module-support.ts';

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
  const social = socialComposition(
    db,
    new RedisEphemeralStore(redis),
    new PostgresSessionStore(db),
    featureEnabled(process.env, 'SOCIAL_ENABLED'),
  );
  const { app } = await createServer({
    config,
    sessions: new Sessions(new PostgresSessionStore(db), observer),
    limiter: new RedisRateLimiter(redis),
    observer,
    modules: [
      ...rtcModules(db, new PostgresSessionStore(db), process.env),
      ...productivityModules(db, process.env),
      ...backgroundsModules(db, process.env),
      ...identityModules(db, process.env, config.APP_ORIGIN, socialDirectory(db)),
      ...social.modules,
      ...roomMediaModules(db, social.occupancy, process.env),
    ],
    ready: async (signal) => {
      try {
        await db.query(sql`SELECT 1 FROM core.sessions LIMIT 0`);
        await db.query(sql`SELECT 1 FROM identity.users LIMIT 0`);
        await db.query(sql`SELECT 1 FROM rooms.rooms LIMIT 0`);
        await db.query(sql`SELECT 1 FROM friends.relationships LIMIT 0`);
        await db.query(sql`SELECT 1 FROM backgrounds.room_defaults LIMIT 0`);
        await db.query(sql`SELECT 1 FROM room_media.baselines LIMIT 0`);
        await db.query(sql`SELECT 1 FROM pomodoro.timers LIMIT 0`);
        await db.query(sql`SELECT 1 FROM tasks.personal_items LIMIT 0`);
        await db.query(sql`SELECT 1 FROM tasks.shared_items LIMIT 0`);
        await db.query(sql`SELECT 1 FROM pomodoro.personal_timers LIMIT 0`);
        await db.query(sql`SELECT 1 FROM chat.messages LIMIT 0`);
        signal.throwIfAborted();
        await redis.withAbortSignal(signal).ping();
        if (process.env.RTC_ENABLED === 'true') {
          const response = await fetch(process.env.LIVEKIT_SERVICE_URL!, {
            signal,
            redirect: 'error',
          });
          if (!response.ok) return false;
        }
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
