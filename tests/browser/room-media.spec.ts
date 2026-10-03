import { providerMock } from './media-provider.ts';
import { finishOnboarding } from './onboarding.ts';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
  await page.goto('/account');
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
  await page.goto('/rooms/' + roomId + '/configure');
  await page.getByRole('button', { name: /^(Enter|Join) room$/ }).click();
  await expect(page.getByRole('button', { name: 'Media', exact: true })).toBeVisible();
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
    const surface = owner.locator('.media-compact');
    await surface.getByLabel('YouTube URL').fill('https://music.youtube.com/watch?v=M7lc1UVf-VE');
    await surface.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(owner.locator('.youtube-host iframe')).toHaveCount(1);
    await owner.getByRole('button', { name: 'Media', exact: true }).click();
    await expect(surface.locator('.media-queue')).toContainText('YouTube Developers Live');
    await expect(surface.locator('.media-queue')).not.toContainText('M7lc1UVf-VE');
    await expect(surface.getByRole('button', { name: 'Pause room', exact: true })).toBeVisible();
    await owner.getByRole('button', { name: 'Media settings', exact: true }).click();
    const panel = owner.getByRole('dialog', { name: 'Media settings' });
    await expect(panel.getByText('You can control room playback.', { exact: false })).toBeVisible();
    await panel.getByText('Playback diagnostics', { exact: true }).click();
    await panel.getByLabel('Seek seconds').fill('90');
    await panel.getByRole('button', { name: 'Apply seek' }).click();
    await expect.poll(async () => (await snapshot(owner, room.id)).state.position).toBe(90);
    await owner.screenshot({ path: '.local/validation/phase08-media-desktop.png' });
    await panel.getByRole('button', { name: 'Close media settings', exact: true }).click();
    await expect(owner.locator('.youtube-host iframe')).toHaveCount(1);
    await login(member);
    await enter(member, room.id);
    await member.getByRole('button', { name: 'Media', exact: true }).click();
    const memberPanel = member.locator('.media-compact');
    await expect(memberPanel.getByRole('button', { name: 'Suggest Pause room' })).toBeVisible();
    await memberPanel.getByRole('button', { name: 'Show video' }).click();
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
    await memberPanel
      .getByRole('radiogroup', { name: 'Media scope' })
      .getByRole('radio', { name: 'Personal', exact: true })
      .click();
    const before = await snapshot(member, room.id);
    await memberPanel.getByLabel('My room music level').fill('0.2');
    await memberPanel.getByLabel('Mute room media locally').check();
    await memberPanel.getByRole('combobox', { name: 'Ambience source' }).click();
    await member.getByRole('option', { name: 'Personal ambience', exact: true }).click();
    await memberPanel.getByRole('button', { name: 'Add ambience', exact: true }).click();
    await memberPanel.getByRole('button', { name: /Brown noise Low/ }).click();
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
    await expect(member.locator('.room-dock')).toBeVisible();
    await member.getByRole('button', { name: 'Media', exact: true }).click();
    await memberPanel
      .getByRole('radiogroup', { name: 'Media scope' })
      .getByRole('radio', { name: 'Personal', exact: true })
      .click();
    await expect(memberPanel.getByLabel('Mute room media locally')).toBeChecked();
    await expect(memberPanel.getByRole('combobox', { name: 'Ambience source' })).toContainText(
      'Personal ambience',
    );
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
  browser,
}) => {
  test.setTimeout(140000);
  const providerErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') providerErrors.push(message.text().slice(0, 300));
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('youtube')) providerErrors.push(r.failure()?.errorText ?? 'failed');
  });
  await login(page);
  const room = (
    await post(page, 'rooms/create', { name: 'Provider availability probe', privacy: 'public' })
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
  await expect(page.locator('.media-queue')).toContainText('YouTube Developers Live');
  await expect(page.getByRole('button', { name: 'Pause room', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show video' }).click();
  await expect(page.getByRole('button', { name: 'Connecting…', exact: true })).toHaveCount(0, {
    timeout: 35000,
  });
  const tile = page.locator('.room-video');
  await expect(tile).not.toContainText('Add a room video');
  // A second real embed uses the same application authority; provider failures
  // are recorded as limitations rather than substituted with a mock player.
  const remoteContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const remote = await remoteContext.newPage();
  await login(remote);
  await enter(remote, room.id);
  await remote.getByRole('button', { name: 'Media', exact: true }).click();
  await remote.getByRole('button', { name: 'Show video', exact: true }).click();
  await expect(remote.getByRole('button', { name: 'Connecting…', exact: true })).toHaveCount(0, {
    timeout: 35000,
  });
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
  let minimizedAdvanced: boolean | null = null;
  const originalFrame = await page.locator('.youtube-host iframe').elementHandle();
  if ((await tile.getAttribute('data-player-state')) === 'playing') {
    const before = Number(await tile.getAttribute('data-player-position'));
    await page
      .locator('.workspace-tile')
      .filter({ has: tile })
      .getByRole('button', { name: 'Minimize tile' })
      .click();
    minimizedAdvanced = await page
      .waitForFunction(
        (position) =>
          Number(document.querySelector('.room-video')?.getAttribute('data-player-position')) >
          position + 5,
        before,
        { timeout: 15000 },
      )
      .then(
        () => true,
        () => false,
      );
    await page
      .locator('.workspace-tile')
      .filter({ has: tile })
      .getByRole('button', { name: 'Open player', exact: true })
      .click();
  }
  const sameIframe =
    !!originalFrame &&
    (await originalFrame.evaluate((el) => el === document.querySelector('.youtube-host iframe')));
  expect(sameIframe).toBe(true);
  const outcome = {
    providerErrors,
    minimizedAdvanced,
    sameIframe,
    state: await tile.getAttribute('data-player-state'),
    position: await tile.getAttribute('data-player-position'),
    message: await tile.innerText(),
    remote: {
      state: await remote.locator('.room-video').getAttribute('data-player-state'),
      position: await remote.locator('.room-video').getAttribute('data-player-position'),
      message: await remote.locator('.room-video').innerText(),
      iframeCount: await remote.locator('.youtube-host iframe').count(),
    },
  };
  const { writeFile } = await import('node:fs/promises');
  await writeFile('.local/validation/phase08-real-youtube.json', JSON.stringify(outcome, null, 2));
  await page.screenshot({ path: '.local/validation/phase08-real-youtube.png' });
  await expect(page.getByRole('button', { name: 'Media', exact: true })).toBeVisible();
  await remoteContext.close();
});
