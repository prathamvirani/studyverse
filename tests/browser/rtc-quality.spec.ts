import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { syntheticMedia } from './synthetic-media.ts';

async function api(page: Page, path: string, input?: unknown) {
  return page.evaluate(
    async ({ path, input }) => {
      const csrf = await fetch('/api/v1/session/csrf').then((r) => r.json());
      const r = await fetch(
        `/api/v1/${path}`,
        input === undefined
          ? {}
          : {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-csrf-token': csrf.csrfToken,
                'x-study-auth': '1',
              },
              body: JSON.stringify(input),
            },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    { path, input },
  );
}
async function login(page: Page, provider: string) {
  await syntheticMedia(page, { width: 1920, height: 1080, fps: 60 });
  await page.addInitScript(() => {
    const state = { peers: [] as RTCPeerConnection[], captures: 0, pickers: 0 };
    Object.assign(window, { qualityTest: state });
    window.RTCPeerConnection = new Proxy(window.RTCPeerConnection, {
      construct(target, args) {
        const pc = new target(...args);
        state.peers.push(pc);
        return pc;
      },
    });
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (...args) => {
      state.captures++;
      return capture(...args);
    };
    navigator.mediaDevices.getDisplayMedia = async () => {
      state.pickers++;
      return capture({ video: true });
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: `Continue with ${provider}` }).click();
  await expect(page).toHaveURL('/account');
}
async function stats(page: Page) {
  return page.evaluate(async () => {
    const state = (
      window as unknown as {
        qualityTest: { peers: RTCPeerConnection[]; captures: number; pickers: number };
      }
    ).qualityTest;
    const result: Record<string, unknown>[] = [];
    for (const pc of state.peers)
      (await pc.getStats()).forEach((s) => {
        if (['inbound-rtp', 'outbound-rtp', 'remote-inbound-rtp'].includes(s.type))
          result.push(
            Object.fromEntries(
              [
                'type',
                'kind',
                'frameWidth',
                'frameHeight',
                'framesPerSecond',
                'bytesSent',
                'bytesReceived',
                'packetsLost',
                'jitter',
                'roundTripTime',
                'totalEncodeTime',
                'totalDecodeTime',
                'framesDecoded',
                'framesDropped',
                'qualityLimitationReason',
                'timestamp',
              ]
                .filter((k) => s[k] !== undefined)
                .map((k) => [k, s[k]]),
            ),
          );
      });
    return { captures: state.captures, pickers: state.pickers, rtp: result };
  });
}
test('advanced Stage A quality forwards through real SFU, persists safely and remains secondary on mobile', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const a = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  const b = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  const alice = await a.newPage(),
    bob = await b.newPage();
  try {
    await login(alice, 'Google');
    await login(bob, 'Discord');
    const user = await api(alice, 'account/me');
    const room = await api(alice, 'rooms/create', {
      name: 'Advanced RTC validation',
      privacy: 'public',
    });
    await alice.goto(`/rooms/${room.id}`);
    await bob.goto(`/rooms/${room.id}`);
    await alice.getByRole('button', { name: 'Enter room', exact: true }).click();
    await bob.getByRole('button', { name: 'Join room', exact: true }).click();
    await alice.getByRole('button', { name: 'More', exact: true }).click();
    await alice.getByRole('button', { name: 'High', exact: true }).click();
    await alice.getByRole('button', { name: 'Apply media preferences', exact: true }).click();
    await expect(
      alice.getByRole('status').filter({ hasText: 'Preferences applied' }),
    ).toBeVisible();
    await alice.getByLabel('Profile name', { exact: true }).fill('Home Fibre');
    await alice.getByRole('button', { name: 'Save applied profile', exact: true }).click();
    await expect(alice.getByRole('button', { name: 'Load Home Fibre', exact: true })).toBeVisible();
    await alice.getByLabel('Camera send width', { exact: true }).scrollIntoViewIfNeeded();
    await alice.screenshot({ path: '.local/validation/phase07-advanced-desktop.png' });
    await alice.setViewportSize({ width: 390, height: 844 });
    await alice.getByLabel('Quality mode', { exact: true }).scrollIntoViewIfNeeded();
    await alice.screenshot({ path: '.local/validation/phase07-advanced-mobile.png' });
    await alice.getByLabel('Camera send width', { exact: true }).scrollIntoViewIfNeeded();
    await alice.screenshot({ path: '.local/validation/phase07-mobile-controls.png' });
    expect(await alice.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await alice.setViewportSize({ width: 1440, height: 900 });
    await alice.keyboard.press('Escape');
    await alice.getByRole('button', { name: 'Camera off', exact: true }).click();
    const remote = bob.locator(`[data-camera-renderer="${user.id}"]`);
    await expect(remote).toHaveCount(1, { timeout: 20000 });
    await expect
      .poll(() => remote.evaluate((v: HTMLVideoElement) => v.videoWidth))
      .toBeGreaterThan(0);
    expect(await remote.evaluate((v: HTMLVideoElement) => v.videoHeight)).toBeLessThanOrEqual(480);
    await bob.getByRole('button', { name: 'More', exact: true }).click();
    await bob.getByRole('button', { name: 'High', exact: true }).click();
    await bob.getByRole('button', { name: 'Apply media preferences', exact: true }).click();
    await bob.keyboard.press('Escape');
    await bob.locator(`#participant-${user.id}`).click();
    await bob.getByRole('button', { name: 'Expand camera', exact: true }).click();
    await bob.keyboard.press('Escape');
    await bob.getByRole('button', { name: 'Fullscreen tile', exact: true }).click();
    await expect
      .poll(() => remote.evaluate((v: HTMLVideoElement) => v.videoHeight), { timeout: 20000 })
      .toBeGreaterThan(480);
    const cdp = await a.newCDPSession(alice);
    await cdp.send('Performance.enable');
    const before = {
      alice: await stats(alice),
      bob: await stats(bob),
      cpu: await cdp.send('Performance.getMetrics'),
    };
    await alice.getByRole('button', { name: 'More', exact: true }).click();
    await alice.getByText('Live diagnostics · requested vs actual', { exact: true }).click();
    await expect(alice.getByText(/Actual RTP: 1920/)).toBeVisible({ timeout: 15000 });
    await expect(alice.getByText(/Actual RTP:.*\d\.\d{2} Mbps/)).toBeVisible({ timeout: 15000 });
    await alice.screenshot({ path: '.local/validation/phase07-diagnostics.png' });
    const after = {
      alice: await stats(alice),
      bob: await stats(bob),
      cpu: await cdp.send('Performance.getMetrics'),
    };
    const sfu = execFileSync(
      'docker',
      ['stats', '--no-stream', '--format', '{{json .}}', 'study-phase00-livekit-1'],
      { encoding: 'utf8', windowsHide: true },
    );
    writeFileSync(
      '.local/validation/phase07-sfu-measurements.json',
      JSON.stringify(
        {
          source: 'synthetic 1920x1080 canvas at requested 60 FPS; real LiveKit transport',
          before,
          after,
          sfu,
        },
        null,
        2,
      ),
    );
    // Processing changes and presets must not request the camera again.
    const captures = (await stats(alice)).captures;
    await alice.getByRole('button', { name: 'Data Saver', exact: true }).click();
    await alice.getByRole('button', { name: 'Apply media preferences', exact: true }).click();
    await expect(
      alice.getByRole('status').filter({ hasText: 'Preferences applied' }),
    ).toBeVisible();
    expect((await stats(alice)).captures).toBe(captures);
    await alice.getByRole('button', { name: 'Load Home Fibre', exact: true }).click();
    await expect(alice.getByLabel('Camera send width', { exact: true })).toHaveValue('1920');
    await alice.getByLabel('Voice preset', { exact: true }).selectOption('studio');
    await alice.getByRole('button', { name: 'Apply media preferences', exact: true }).click();
    await expect(
      alice.getByRole('button', { name: 'Apply media preferences', exact: true }),
    ).toBeEnabled();
    await expect(
      alice.getByRole('button', { name: 'Apply media preferences', exact: true }),
    ).toBeFocused();
    await alice.keyboard.press('Escape');
    await expect(alice.getByRole('button', { name: 'More', exact: true })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await alice.getByRole('button', { name: 'Microphone off', exact: true }).click();
    await expect(bob.locator('audio')).toHaveCount(1, { timeout: 15000 });
    await alice.getByRole('button', { name: 'Screen Share off', exact: true }).click();
    await expect(bob.locator('video[aria-label="Screen share"]')).toHaveCount(1, {
      timeout: 15000,
    });
    await expect
      .poll(() =>
        bob
          .locator('video[aria-label="Screen share"]')
          .evaluate((v: HTMLVideoElement) => v.videoWidth),
      )
      .toBeGreaterThan(0);
    await alice.getByRole('button', { name: 'More', exact: true }).click();
    await alice.getByText('Screen send', { exact: true }).click();
    await alice.getByLabel('Screen send FPS preset', { exact: true }).selectOption('30');
    await alice.getByRole('button', { name: 'Apply media preferences', exact: true }).click();
    await expect(
      alice.getByRole('status').filter({ hasText: 'Preferences applied' }),
    ).toBeVisible();
    expect((await stats(alice)).pickers).toBe(1);
    await expect(bob.locator('video[aria-label="Screen share"]')).toHaveCount(1, {
      timeout: 15000,
    });
    await expect
      .poll(async () =>
        (await stats(bob)).rtp
          .filter((s) => s.kind === 'audio' && s.type === 'inbound-rtp')
          .reduce((sum, s) => sum + Number(s.bytesReceived ?? 0), 0),
      )
      .toBeGreaterThan(0);
    writeFileSync(
      '.local/validation/phase07-screen-voice.json',
      JSON.stringify({ alice: await stats(alice), bob: await stats(bob) }, null, 2),
    );
    await alice.reload();
    await alice.getByRole('button', { name: 'Enter room', exact: true }).click();
    await expect(alice.getByRole('button', { name: 'Camera off', exact: true })).toBeVisible();
    await expect(alice.locator('video,audio')).toHaveCount(0);
    await alice.getByRole('button', { name: 'More', exact: true }).click();
    await expect(alice.getByLabel('Quality mode', { exact: true })).toHaveValue('advanced');
    await expect(alice.getByRole('button', { name: 'Load Home Fibre', exact: true })).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});
