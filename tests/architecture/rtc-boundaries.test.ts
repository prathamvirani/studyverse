import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { importViolations, browserGraphViolations } from '../../scripts/check-boundaries.ts';
it('SFU SDKs stay inside adapters, and server credentials cannot enter a browser graph', () => {
  expect(
    importViolations('apps/web/app/components/room/RoomShell.vue', 'livekit-client'),
  ).not.toEqual([]);
  expect(importViolations('packages/features/rtc/src/browser.ts', 'livekit-client')).not.toEqual(
    [],
  );
  expect(importViolations('packages/adapters/src/livekit/browser.ts', 'livekit-client')).toEqual(
    [],
  );
  expect(
    importViolations('apps/web/app/room/rtc.ts', '@study/adapters/livekit/server'),
  ).not.toEqual([]);
  expect(
    browserGraphViolations(
      new Map([
        ['apps/web/app/leak.ts', ['@study/adapters/livekit/server']],
        ['packages/adapters/src/livekit/server.ts', ['livekit-server-sdk']],
      ]),
    ),
  ).not.toEqual([]);
});
it('RoomShell remains provider-neutral and the adapter has no text-chat data channel', async () => {
  const shell = await readFile('apps/web/app/components/room/RoomShell.vue', 'utf8');
  expect(shell).not.toMatch(/livekit|@study\/rtc|screen-share/i);
  const browser = await readFile('packages/adapters/src/livekit/browser.ts', 'utf8');
  expect(browser).not.toMatch(
    /publishData|createDataChannel|localStorage|sessionStorage|indexedDB/,
  );
  const server = await readFile('packages/adapters/src/livekit/server.ts', 'utf8');
  expect(server).toContain('canPublishData: false');
});
