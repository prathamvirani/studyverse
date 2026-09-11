import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import {
  createPool,
  migrate,
  PostgresDatabase,
  PostgresSessionStore,
  sql,
} from '@study/adapters/postgres';
import { createRedis, RedisEphemeralStore, RedisRateLimiter } from '@study/adapters/redis';
import { Sessions } from '@study/core/server';
import { migrationManifest } from '../../scripts/migration-manifest.ts';

async function localEnv(): Promise<Record<string, string>> {
  try {
    return Object.fromEntries(
      (await readFile('.local/compose.env', 'utf8'))
        .trim()
        .split(/\r?\n/)
        .map((line) => line.split('=')),
    );
  } catch {
    return {};
  }
}
const local = await localEnv();
const migrationUrl =
  process.env.TEST_MIGRATION_DATABASE_URL ??
  `postgresql://study_migrator:${local.MIGRATION_PASSWORD ?? 'missing'}@localhost:5433/study_test`;
const runtimeUrl =
  process.env.TEST_DATABASE_URL ??
  `postgresql://study_runtime:${local.RUNTIME_PASSWORD ?? 'missing'}@localhost:5433/study_test`;
// This suite deliberately resets only an explicitly test-named database.
if (
  !new URL(migrationUrl).pathname.endsWith('_test') ||
  !new URL(runtimeUrl).pathname.endsWith('_test')
)
  throw new Error('Service tests require a dedicated *_test database');
const migrationPool = createPool(migrationUrl),
  runtimePool = createPool(runtimeUrl),
  db = new PostgresDatabase(runtimePool);
const redis = createRedis(
  process.env.TEST_REDIS_URL ?? `redis://:${local.REDIS_PASSWORD ?? 'missing'}@localhost:6380`,
);
redis.on('error', () => {});
const manifest = await migrationManifest();
beforeAll(async () => {
  await migrationPool.query('DROP SCHEMA IF EXISTS backgrounds CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS pomodoro CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS tasks CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS chat CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS friends CASCADE');
  // Failure is a failing prerequisite, never a silently skipped integration test.
  await migrationPool.query('DROP SCHEMA IF EXISTS rooms CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS identity CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS core CASCADE');
  await migrationPool.query('DROP SCHEMA IF EXISTS foundation CASCADE');
  await migrate(migrationPool, manifest);
  await redis.connect();
});
afterAll(async () => {
  if (redis.isOpen) redis.destroy();
  await Promise.all([migrationPool.end(), runtimePool.end()]);
});
describe('real PostgreSQL', () => {
  it('migrates from zero, reruns idempotently and detects drift/missing history', async () => {
    await migrate(migrationPool, manifest);
    expect((await migrationPool.query('SELECT * FROM foundation.migrations')).rowCount).toBe(
      manifest.length,
    );
    await expect(
      migrate(
        migrationPool,
        manifest.map((entry, index) =>
          index === 0 ? { ...entry, sql: entry.sql + '\n-- changed' } : entry,
        ),
      ),
    ).rejects.toThrow('checksum');
    await expect(migrate(migrationPool, [])).rejects.toThrow('missing');
  });
  it('rolls back failed migrations atomically', async () => {
    await expect(
      migrate(migrationPool, [
        ...manifest,
        {
          owner: 'core',
          id: '0002_bad',
          sql: 'CREATE TABLE core.should_rollback(id int); SELECT missing_function();',
        },
      ]),
    ).rejects.toThrow();
    expect(
      (await migrationPool.query("SELECT to_regclass('core.should_rollback') AS name")).rows[0]
        .name,
    ).toBeNull();
  });
  it('uses least-privilege runtime credentials and treats injection as data', async () => {
    await expect(db.query(sql`CREATE TABLE core.forbidden(id int)`)).rejects.toThrow();
    await expect(db.query(sql`SELECT * FROM foundation.migrations`)).rejects.toThrow();
    const hostile = "'; DROP TABLE core.sessions; --";
    expect(await db.query(sql`SELECT ${hostile}::text AS value`)).toEqual([{ value: hostile }]);
    expect(await db.query(sql`SELECT count(*) FROM core.sessions`)).toHaveLength(1);
  });
  it('stores, rotates and revokes sessions with one winner under concurrent rotation', async () => {
    const sessions = new Sessions(new PostgresSessionStore(db)),
      issued = await sessions.issue('756668b8-10e5-461d-8809-759e080e1baf');
    expect((await sessions.authenticate(issued.token)).subjectId).toBe(issued.session.subjectId);
    const results = await Promise.allSettled([
      sessions.rotate(issued.token),
      sessions.rotate(issued.token),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    await expect(sessions.authenticate(issued.token)).rejects.toThrow();
    await sessions.revokeSubject(issued.session.subjectId);
    for (const result of results)
      if (result.status === 'fulfilled')
        await expect(sessions.authenticate(result.value.token)).rejects.toThrow();
  });
});
describe('real Redis', () => {
  it('isolates namespaces, expires state and supports delete', async () => {
    const store = new RedisEphemeralStore(redis);
    await store.set('fixture.a', 'key', 'value', 100);
    expect(await store.get('fixture.a', 'key')).toBe('value');
    expect(await store.get('fixture.b', 'key')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(await store.get('fixture.a', 'key')).toBeNull();
    await store.set('fixture.a', 'key', 'again', 1000);
    await store.delete('fixture.a', 'key');
    expect(await store.get('fixture.a', 'key')).toBeNull();
  });
  it('enforces atomic limits under concurrent requests and fails closed if Redis is lost', async () => {
    const limiter = new RedisRateLimiter(redis),
      key = `test-${Date.now()}`;
    expect(
      (
        await Promise.all(
          Array.from({ length: 20 }, () => limiter.consume(key, { limit: 5, windowMs: 1000 })),
        )
      ).filter(Boolean),
    ).toHaveLength(5);
    const disconnected = createRedis('redis://127.0.0.1:1');
    await expect(
      new RedisRateLimiter(disconnected).consume('failure', { limit: 1, windowMs: 1000 }),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});
