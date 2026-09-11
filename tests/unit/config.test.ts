import { expect, it } from 'vitest';
import { readConfig } from '../../apps/api/src/config.ts';

it('requires HTTPS and complete server configuration without echoing secret values', () => {
  const base = {
    APP_ORIGIN: 'https://localhost:8443',
    DATABASE_URL: 'postgresql://unused/unused',
    REDIS_URL: 'redis://unused',
  };
  expect(readConfig(base).API_PORT).toBe(3001);
  for (const change of [
    { APP_ORIGIN: 'http://localhost:8443' },
    { APP_ORIGIN: 'https://localhost/path' },
    { API_PORT: '0' },
    { DATABASE_URL: undefined },
    { REDIS_URL: 'https://secret:password@example.test' },
  ])
    expect(() => readConfig({ ...base, ...change })).toThrow('Invalid configuration fields');
  try {
    readConfig({ ...base, DATABASE_URL: 'sensitive-password' });
  } catch (error) {
    expect(String(error)).not.toContain('sensitive-password');
  }
});
