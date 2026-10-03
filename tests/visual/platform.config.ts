import { defineConfig } from '@playwright/test';
import base from '../../playwright.config.ts';
if (!base.webServer) throw new Error('The platform suite requires the isolated browser harness.');
const servers = Array.isArray(base.webServer) ? base.webServer : [base.webServer];
// Optional, loopback-only Linux browser server; shares the isolated test harness.
export default defineConfig({
  ...base,
  testDir: '../browser',
  testMatch: ['accessibility-platform.spec.ts', 'nuxt-modules.spec.ts'],
  // Playwright otherwise resolves the inherited server command from this
  // configuration's directory instead of the repository root.
  webServer: servers.map((server) => ({ ...server, cwd: process.cwd() })),
  projects: ['chromium', 'firefox'].map((browserName) => ({
    name: `linux-${browserName}`,
    use: {
      browserName: browserName as 'chromium' | 'firefox',
      connectOptions: {
        wsEndpoint: 'ws://127.0.0.1:3007/',
        exposeNetwork: '<loopback>',
      },
    },
  })),
});
