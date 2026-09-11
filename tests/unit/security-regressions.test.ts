import { expect, it } from 'vitest';
import { Sessions } from '@study/core/server';
import { MemorySessions } from '../fixtures/memory.ts';
import { createLogger } from '../../apps/api/src/observer.ts';
import { createRedis, RedisRateLimiter } from '@study/adapters/redis';
import { migrate } from '@study/adapters/postgres';
import type pg from 'pg';
import { migrationManifest } from '../../scripts/migration-manifest.ts';

it('revocation by logical session ID remains effective across rotation', async () => {
  const sessions = new Sessions(new MemorySessions());
  const issued = await sessions.issue('b62aa8f0-b12c-4e6d-b964-fd2c8576e8bb');
  const rotated = await sessions.rotate(issued.token);
  expect(rotated.session.id).toBe(issued.session.id);
  await sessions.revoke(issued.session.id);
  await expect(sessions.authenticate(rotated.token)).rejects.toThrow();
});
it('concurrent revoke and rotation cannot leave a live replacement credential', async () => {
  const sessions = new Sessions(new MemorySessions());
  const issued = await sessions.issue('b62aa8f0-b12c-4e6d-b964-fd2c8576e8bb');
  const [rotated] = await Promise.allSettled([
    sessions.rotate(issued.token),
    sessions.revoke(issued.session.id),
  ]);
  if (rotated?.status === 'fulfilled')
    await expect(sessions.authenticate(rotated.value.token)).rejects.toThrow();
  await expect(sessions.authenticate(issued.token)).rejects.toThrow();
});
it('redacts root and nested credentials and transport headers', () => {
  const lines: string[] = [],
    marker = 'sensitive-test-value';
  const logger = createLogger('info', {
    write: (message: string) => {
      lines.push(message);
    },
  });
  logger.info({
    token: marker,
    csrfToken: marker,
    databaseUrl: marker,
    nested: { password: marker },
    req: { headers: { cookie: marker, authorization: marker, 'x-csrf-token': marker } },
    res: { headers: { 'set-cookie': marker } },
  });
  expect(lines.join('')).not.toContain(marker);
  expect(lines.join('')).toContain('[REDACTED]');
});
it('rate limiting fails closed without an available Redis connection', async () => {
  const client = createRedis('redis://127.0.0.1:1');
  await expect(
    new RedisRateLimiter(client).consume('test', { limit: 1, windowMs: 1000 }),
  ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
});
it('migration execution preserves declared dependency order instead of alphabetical owners', async () => {
  const statements: string[] = [];
  const client = {
    query: async (statement: string) => {
      statements.push(statement);
      return { rows: [] };
    },
    release() {},
  };
  const pool = { connect: async () => client } as unknown as pg.Pool;
  await migrate(pool, [
    { owner: 'core', id: '0001_base', sql: '-- core first' },
    { owner: 'aaa', id: '0001_dependency', sql: '-- feature second' },
  ]);
  expect(statements.indexOf('-- core first')).toBeLessThan(statements.indexOf('-- feature second'));
});
it('rejects newly declared migrations out of order before opening a database connection', async () => {
  const pool = {
    connect: async () => {
      throw new Error('Must not connect');
    },
  } as unknown as pg.Pool;
  await expect(
    migrate(pool, [
      { owner: 'core', id: '0002_later', sql: '-- later' },
      { owner: 'core', id: '0001_earlier', sql: '-- earlier' },
    ]),
  ).rejects.toThrow('Out-of-order migration manifest');
});
it('collects feature migrations by dependency order regardless of runtime flags', async () => {
  const feature = {
    id: 'fixture',
    version: '1.0.0',
    migrations: [{ owner: 'fixture', id: '0001_base', sql: '-- fixture' }],
  };
  const dependent = {
    id: 'dependent',
    version: '1.0.0',
    dependencies: [{ id: 'fixture', major: 1 }],
    migrations: [{ owner: 'dependent', id: '0001_base', sql: '-- dependent' }],
  };
  expect(
    (await migrationManifest([dependent, feature])).map((migration) => migration.owner),
  ).toEqual(['core', 'core', 'fixture', 'dependent']);
  await expect(migrationManifest([{ ...feature, id: 'impostor' }])).rejects.toThrow('ownership');
});
