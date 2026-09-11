import { createPool, migrate } from '@study/adapters/postgres';
import { applicationMigrationManifest } from './application-migrations.ts';

const url = process.env.MIGRATION_DATABASE_URL;
if (!url || !['postgres:', 'postgresql:'].includes(new URL(url).protocol))
  throw new Error('MIGRATION_DATABASE_URL is required');
const pool = createPool(url);
try {
  await migrate(pool, await applicationMigrationManifest());
  console.log('Migrations complete.');
} catch {
  console.error(
    'Migration failed. Inspect migration identity, database privileges and schema history.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
