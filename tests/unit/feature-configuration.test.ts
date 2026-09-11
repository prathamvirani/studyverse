import { expect, it } from 'vitest';
import { featureEnabled } from '../../apps/api/src/module-support.ts';
import { identityModules } from '../../apps/api/src/identity.ts';
import type { Database } from '@study/feature-sdk';

it.each([
  ['IDENTITY_ROOMS_ENABLED', 'PHASE01_ENABLED'],
  ['SOCIAL_ENABLED', 'PHASE03_ENABLED'],
])('preserves fail-closed deployment compatibility for %s', (name, legacy) => {
  expect(featureEnabled({}, name)).toBe(true);
  for (const environment of [
    { [name]: 'false' },
    { [legacy]: 'false' },
    { [name]: 'true', [legacy]: 'false' },
    { [name]: 'false', [legacy]: 'true' },
  ])
    expect(featureEnabled(environment, name)).toBe(false);
  for (const environment of [
    { [name]: 'invalid' },
    { [legacy]: '' },
    { [name]: 'false', [legacy]: 'invalid' },
  ])
    expect(() => featureEnabled(environment, name)).toThrow();
  expect(featureEnabled({}, 'RTC_ENABLED', false)).toBe(false);
});

it('gates identity/room and friend-invitation operations through semantic configuration', () => {
  const db: Database = { query: async () => [], transaction: async (f) => f(db) };
  const modules = identityModules(
    db,
    { IDENTITY_ROOMS_ENABLED: 'false', SOCIAL_ENABLED: 'false' },
    'https://localhost:8443',
  );
  for (const module of modules) {
    expect(
      module.operations
        ?.filter((operation) => operation.id !== 'identity.providers')
        .every((operation) => operation.flag),
    ).toBe(true);
    expect(module.flags?.every((flag) => flag.rule.mode === 'disabled')).toBe(true);
  }
});
