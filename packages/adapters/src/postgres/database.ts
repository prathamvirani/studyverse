import pg from 'pg';
import type { Database, SqlStatement } from '@study/feature-sdk';

export { sql } from '@study/feature-sdk';
export class PostgresDatabase implements Database {
  constructor(
    private readonly executor: pg.Pool | pg.PoolClient,
    private readonly inTransaction = false,
  ) {}
  async query<T extends Record<string, unknown>>(statement: SqlStatement): Promise<T[]> {
    const result = await this.executor.query<T>(statement.text, [...statement.values]);
    return result.rows;
  }
  async transaction<T>(work: (database: Database) => Promise<T>): Promise<T> {
    if (this.inTransaction || 'release' in this.executor)
      throw new Error('Nested transactions require an explicit service contract');
    const client = await this.executor.connect();
    try {
      await client.query('BEGIN');
      const result = await work(new PostgresDatabase(client, true));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 5_000,
  });
}
