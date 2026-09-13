import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL('/account');
}
async function post(page: Page, path: string, body: object) {
  return page.evaluate(
    async ({ path, body }) => {
      const { csrfToken } = await fetch('/api/v1/session/csrf').then((r) => r.json());
      const response = await fetch('/api/v1/' + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, body },
  );
}
async function snapshot(page: Page, roomId: string) {
  return page.evaluate(
    (id) => fetch('/api/v1/room-media/snapshot?roomId=' + id).then((r) => r.json()),
    roomId,
  );
}
async function enter(page: Page, roomId: string) {
  await page.goto('/rooms/' + roomId);
  await page.getByRole('button', { name: /^(Enter|Join) room$/ }).click();
  await expect(page.getByRole('button', { name: 'Media', exact: true })).toBeVisible();
}
async function providerMock(page: Page) {
  // Explicit deterministic provider mock. This tests application synchronization, not YouTube playback.
  await page.route('https://www.youtube.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Deterministic provider fixture</title>',
    }),
  );
  await page.addInitScript(() => {
    const w = window as unknown as {
      YT: unknown;
      mediaTest: { position: () => number; volume: () => number; destroyed: boolean }[];
    };
    w.mediaTest = [];
    w.YT = {
      Player: class {
        p = 0;
        t = Date.now();
        running = false;
        speed = 1;
        v = 100;
        destroyed = false;
        constructor(_element: HTMLElement, options: { events: { onReady: () => void } }) {
          w.mediaTest.push({
            position: () => this.getCurrentTime(),
            volume: () => this.v,
            get destroyed() {
              return false;
            },
          });
          setTimeout(() => options.events.onReady(), 10);
        }
        cueVideoById(_id: string, start: number) {
          this.p = start;
          this.t = Date.now();
          this.running = false;
        }
        playVideo() {
          if (!this.running) {
            this.t = Date.now();
            this.running = true;
          }
        }
        pauseVideo() {
          this.p = this.getCurrentTime();
          this.running = false;
        }
        seekTo(value: number) {
          this.p = value;
          this.t = Date.now();
        }
        setPlaybackRate(value: number) {
          this.p = this.getCurrentTime();
          this.t = Date.now();
          this.speed = value;
        }
        getAvailablePlaybackRates() {
          return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
        }
        setVolume(value: number) {
          this.v = value;
        }
        getCurrentTime() {
          return this.p + (this.running ? ((Date.now() - this.t) / 1000) * this.speed : 0);
        }
        getPlayerState() {
          return this.running ? 1 : 2;
        }
        destroy() {
          this.destroyed = true;
          this.pauseVideo();
        }
      },
    };
  });
}
test('room media: real control plane, deterministic provider sync, local mixing, queue and responsive workspace', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const a = await browser.newContext({ ignoreHTTPSErrors: true }),
    b = await browser.newContext({ ignoreHTTPSErrors: true });
  const owner = await a.newPage(),
    member = await b.newPage();
  const errors: string[] = [];
  owner.on('pageerror', (e) => errors.push(e.message));
  member.on('pageerror', (e) => errors.push(e.message));
  await providerMock(owner);
  await providerMock(member);
  try {
    await login(owner);
    const room = (await post(owner, 'rooms/create', { name: 'Shared quiet', privacy: 'public' }))
      .body;
    await enter(owner, room.id);
    await owner.getByRole('button', { name: 'Media', exact: true }).click();
    const panel = owner.getByRole('dialog', { name: 'Room media' });
    await expect(panel.getByText('You can control room playback.', { exact: false })).toBeVisible();
    await panel
      .getByLabel('YouTube video or Music link')
      .fill('https://music.youtube.com/watch?v=M7lc1UVf-VE');
    await panel.getByRole('button', { name: 'Add to room', exact: true }).click();
    await expect(panel.locator('.media-queue')).toContainText('M7lc1UVf-VE');
    await panel.getByRole('button', { name: 'Play room', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Pause room', exact: true })).toBeVisible();
    await panel.getByLabel('Seek seconds').fill('90');
    await panel.getByRole('button', { name: 'Apply seek' }).click();
    await expect.poll(async () => (await snapshot(owner, room.id)).state.position).toBe(90);
    await owner.screenshot({ path: '.local/validation/phase08-media-desktop.png' });
    await panel.getByRole('button', { name: 'Open YouTube tile' }).click();
    await owner.getByRole('button', { name: 'Enable YouTube', exact: true }).click();
    await expect(owner.locator('.youtube-host iframe')).toHaveCount(1);
    await login(member);
    await enter(member, room.id);
    await member.getByRole('button', { name: 'Media', exact: true }).click();
    const memberPanel = member.getByRole('dialog', { name: 'Room media' });
    await expect(memberPanel.getByRole('button', { name: 'Suggest Pause room' })).toBeVisible();
    await memberPanel.getByRole('button', { name: 'Open YouTube tile' }).click();
    await member.getByRole('button', { name: 'Enable YouTube', exact: true }).click();
    const position = (page: Page) =>
      page.evaluate(() => {
        const w = window as unknown as { mediaTest: { position: () => number }[] };
        return w.mediaTest.at(-1)?.position() ?? 0;
      });
    await expect
      .poll(async () => Math.abs((await position(owner)) - (await position(member))), {
        timeout: 10000,
      })
      .toBeLessThan(2);
    expect(await position(member)).toBeGreaterThanOrEqual(90);
    await member.getByRole('button', { name: 'Media', exact: true }).click();
    const before = await snapshot(member, room.id);
    await memberPanel.getByLabel('My room music level').fill('0.2');
    await memberPanel.getByLabel('Mute room media locally').check();
    await memberPanel.getByRole('button', { name: 'Enable ambience' }).click();
    await memberPanel.getByLabel('Ambience source').selectOption('personal');
    await memberPanel.getByLabel('My Brown noise', { exact: true }).fill('0.4');
    const after = await snapshot(member, room.id);
    expect(after.version).toBe(before.version);
    expect(after.state.mix).toEqual(before.state.mix);
    await member.setViewportSize({ width: 320, height: 740 });
    await member.screenshot({ path: '.local/validation/phase08-media-mobile.png' });
    expect(await memberPanel.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    await member.keyboard.press('Escape');
    await expect(member.getByRole('button', { name: 'Media', exact: true })).toBeFocused();
    await member.reload();
    await member.getByRole('button', { name: 'Enter room', exact: true }).click();
    await member.getByRole('button', { name: 'Media', exact: true }).click();
    await expect(memberPanel.getByLabel('Mute room media locally')).toBeChecked();
    await expect(memberPanel.getByLabel('Ambience source')).toHaveValue('personal');
    await expect(memberPanel.getByLabel('My Brown noise', { exact: true })).toHaveValue('0.4');
    await expect(memberPanel.getByRole('button', { name: 'Suggest Pause room' })).toBeVisible();
    await member.setViewportSize({ width: 820, height: 1180 });
    await member.screenshot({ path: '.local/validation/phase08-media-tablet.png' });
    const html = await owner.locator('.youtube-host iframe').evaluate((e: HTMLIFrameElement) => ({
      src: e.src,
      referrer: e.referrerPolicy,
      sandbox: e.sandbox.value,
      credentialless: e.hasAttribute('credentialless'),
    }));
    expect(new URL(html.src).hostname).toBe('www.youtube.com');
    expect(html.referrer).toBe('strict-origin-when-cross-origin');
    expect(html.sandbox).toContain('allow-scripts');
    expect(html.credentialless).toBe(true);
    const response = await owner.request.get('/');
    const csp = response.headers()['content-security-policy']!;
    expect(csp).toContain('frame-src https://www.youtube.com');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(response.headers()['cross-origin-embedder-policy']).toBe('require-corp');
    expect(errors).toEqual([]);
  } finally {
    await Promise.all([owner.goto('/account'), member.goto('/account')]);
    await a.close();
    await b.close();
  }
});

test('real YouTube embed probe records provider outcome without fabricating playback', async ({
  page,
}) => {
  test.setTimeout(60000);
  const providerErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') providerErrors.push(message.text().slice(0, 300));
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('youtube')) providerErrors.push(r.failure()?.errorText ?? 'failed');
  });
  await login(page);
  const room = (
    await post(page, 'rooms/create', { name: 'Provider availability probe', privacy: 'private' })
  ).body;
  await enter(page, room.id);
  let v = await snapshot(page, room.id);
  let result = await post(page, 'room-media/control', {
    roomId: room.id,
    epoch: v.epoch,
    version: v.version,
    action: { type: 'enqueue', videoId: 'M7lc1UVf-VE' },
  });
  expect(result.status).toBe(200);
  v = result.body;
  result = await post(page, 'room-media/control', {
    roomId: room.id,
    epoch: v.epoch,
    version: v.version,
    action: { type: 'play' },
  });
  expect(result.status).toBe(200);
  await page.getByRole('button', { name: 'Media', exact: true }).click();
  await expect(page.locator('.media-queue')).toContainText('M7lc1UVf-VE');
  await expect(page.getByRole('button', { name: 'Pause room', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open YouTube tile' }).click();
  await page.getByRole('button', { name: 'Enable YouTube', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Connecting…', exact: true })).toHaveCount(0, {
    timeout: 35000,
  });
  const tile = page.locator('.room-video');
  await expect(tile).not.toContainText('Add a room video');
  // Give the real player a bounded chance to advance; timeout is recorded as a limitation.
  await page
    .waitForFunction(
      () => document.querySelector('.room-video')?.getAttribute('data-player-state') === 'playing',
      {},
      { timeout: 20000 },
    )
    .catch(() => {});
  // A provider failure is a measured limitation, never a successful-playback assertion.
  await expect(tile).toBeVisible();
  const outcome = {
    providerErrors,
    state: await tile.getAttribute('data-player-state'),
    position: await tile.getAttribute('data-player-position'),
    message: await tile.innerText(),
  };
  const { writeFile } = await import('node:fs/promises');
  await writeFile('.local/validation/phase08-real-youtube.json', JSON.stringify(outcome, null, 2));
  await page.screenshot({ path: '.local/validation/phase08-real-youtube.png' });
  await expect(page.getByRole('button', { name: 'Media', exact: true })).toBeVisible();
});
