import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FeatureModule, Migration } from '@study/feature-sdk';
import { orderModules } from '@study/core';

/** Composition-time migration manifest, independent of runtime feature enablement. */
export async function migrationManifest(
  modules: readonly FeatureModule[] = [],
): Promise<Migration[]> {
  const featureMigrations = orderModules(modules).flatMap((module) => {
    if ((module.migrations ?? []).some((migration) => migration.owner !== module.id))
      throw new Error('Migration ownership mismatch');
    return module.migrations ?? [];
  });
  return [
    {
      owner: 'core',
      id: '0001_sessions',
      sql: await readFile(resolve('packages/core/migrations/0001_sessions.sql'), 'utf8'),
    },
    {
      owner: 'core',
      id: '0002_session_devices',
      sql: await readFile(resolve('packages/core/migrations/0002_session_devices.sql'), 'utf8'),
    },
    ...featureMigrations,
  ];
}
