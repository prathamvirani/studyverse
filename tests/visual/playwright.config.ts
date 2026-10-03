import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import baseline from '../../playwright.config.ts';

// Opt-in audit captures; reuse the guarded test database, fake OAuth and local HTTPS harness.
if (!baseline.webServer || Array.isArray(baseline.webServer))
  throw new Error('Expected the existing single isolated browser harness');
export default defineConfig({
  ...baseline,
  testDir: '.',
  testMatch: 'design-refresh-baseline.spec.ts',
  timeout: 120_000,
  webServer: {
    ...baseline.webServer,
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
  },
});
