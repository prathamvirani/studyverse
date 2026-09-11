import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  use: { baseURL: 'https://localhost:8449', ignoreHTTPSErrors: true, browserName: 'chromium' },
  webServer: {
    command: 'node --import tsx tests/browser/server.ts',
    url: 'https://localhost:8449',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
