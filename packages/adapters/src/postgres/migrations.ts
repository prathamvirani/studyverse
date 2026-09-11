import { createHash } from 'node:crypto';
import type pg from 'pg';
import type { Migration } from '@study/feature-sdk';
import { identifier } from '@study/contracts';

export async function migrate(pool: pg.Pool, migrations: readonly Migration[]): Promise<void> {
  const keys = new Set<string>();
  const lastIdByOwner = new Map<string, string>();
  for (const migration of migrations) {
    const key = `${migration.owner}/${migration.id}`;
    if (
      !identifier.safeParse(migration.owner).success ||
      !/^\d{4}_[a-z0-9_]+$/.test(migration.id) ||
      keys.has(key)
    )
      throw new Error('Invalid migration identity');
    keys.add(key);
    if ((lastIdByOwner.get(migration.owner) ?? '') >= migration.id)
      throw new Error('Out-of-order migration manifest');
    lastIdByOwner.set(migration.owner, migration.id);
  }
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('study.migrations'))");
    await client.query('CREATE SCHEMA IF NOT EXISTS foundation');
    await client.query(
      'CREATE TABLE IF NOT EXISTS foundation.migrations (owner text NOT NULL, id text NOT NULL, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (owner, id))',
    );
    const history = await client.query<{ owner: string; id: string; checksum: string }>(
      'SELECT owner, id, checksum FROM foundation.migrations ORDER BY owner, id',
    );
    for (const row of history.rows)
      if (!keys.has(`${row.owner}/${row.id}`))
        throw new Error('Applied migration missing from manifest');
    // Composition order is dependency order; alphabetical owner order is unsafe.
    for (const migration of migrations) {
      const checksum = createHash('sha256')
        .update(migration.sql.replace(/\r\n/g, '\n'))
        .digest('hex');
      const existing = history.rows.find(
        (row) => row.owner === migration.owner && row.id === migration.id,
      );
      if (existing) {
        if (existing.checksum !== checksum) throw new Error('Applied migration checksum changed');
        continue;
      }
      if (history.rows.some((row) => row.owner === migration.owner && row.id > migration.id))
        throw new Error('Out-of-order migration');
      await client.query('BEGIN');
      try {
        // Only reviewed, source-controlled migration SQL is allowed here; never request input.
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO foundation.migrations (owner, id, checksum) VALUES ($1, $2, $3)',
          [migration.owner, migration.id, checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext('study.migrations'))");
    } finally {
      client.release();
    }
  }
}
