import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { providerMock } from './media-provider.ts';
import { refreshLogin, refreshRoom, refreshApi, refreshCapture } from './refresh-helpers.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { syntheticMedia } from './synthetic-media.ts';

async function personalPanel(page: Page) {
  const panel = page.locator('.media-compact');
  if (!(await panel.isVisible()))
    await page.getByRole('button', { name: 'Media', exact: true }).click();
  await panel.getByRole('radio', { name: 'Study Player', exact: true }).click();
  return panel;
}
const tile = (page: Page) => page.locator('.workspace-tile[aria-label="Personal Study Player"]');
async function localData(page: Page) {
  return page.evaluate(
    async () =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const opening = indexedDB.open('study-preferences-v1');
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const db = opening.result,
            tx = db.transaction('preferences'),
            store = tx.objectStore('preferences');
          const values = store.getAll(),
            keys = store.getAllKeys();
          tx.oncomplete = () => {
            const result = keys.result.flatMap((key, index) =>
              String(key).startsWith('personal-media.player.') ? [values.result[index].value] : [],
            );
            db.close();
            resolve(result);
          };
        };
      }),
  );
}
async function volume(page: Page, index: number) {
  return page.evaluate(
    (i) => (window as unknown as { mediaTest: { volume(): number }[] }).mediaTest[i]?.volume(),
    index,
  );
}
test('private local resume, one renderer, two-user privacy and independent ducking/promotion', async ({
  browser,
}) => {
  test.setTimeout(150000);
  mkdirSync('docs/references/phase09', { recursive: true });
  const a = await browser.newContext({ ignoreHTTPSErrors: true }),
    b = await browser.newContext({ ignoreHTTPSErrors: true });
  const owner = await a.newPage(),
    member = await b.newPage(),
    errors: string[] = [],
    outbound: string[] = [];
  owner.on('pageerror', (e) => errors.push(e.message));
  member.on('pageerror', (e) => errors.push(e.message));
  owner.on('request', (r) => {
    if (r.url().includes('/api/v1/')) outbound.push(r.url() + ' ' + (r.postData() ?? ''));
  });
  owner.on('websocket', (socket) =>
    socket.on('framesent', (frame) => outbound.push(String(frame.payload))),
  );
  await providerMock(owner);
  await providerMock(member);
  try {
    await refreshLogin(owner);
    const room = await refreshRoom(owner, 'Personal study room');
    await owner.getByRole('button', { name: 'Media', exact: true }).click();
    const shared = owner.locator('.media-compact');
    await shared.getByLabel('YouTube URL').fill('https://youtu.be/M7lc1UVf-VE');
    await shared.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(owner.locator('.youtube-host iframe')).toHaveCount(1);
    await expect.poll(() => volume(owner, 0)).toBe(60);
    await refreshLogin(member);
    await member.goto(`/rooms/${room.publicId}`);
    await expect(member.getByRole('button', { name: 'Media', exact: true })).toBeVisible();
    const before = await refreshApi(owner, `room-media/snapshot?roomId=${room.id}`);
    let panel = await personalPanel(owner);
    await panel
      .getByLabel('Personal media URL')
      .fill('https://youtu.be/abcdefghijk?token=private-token&utm_source=private');
    await panel.getByRole('button', { name: 'Open privately' }).click();
    await expect(tile(owner).locator('iframe[title="Personal YouTube player"]')).toHaveCount(1);
    await expect(
      tile(owner).getByRole('button', { name: 'Play personal', exact: true }),
    ).toBeEnabled();
    const identity = await tile(owner).locator('iframe').elementHandle();
    await tile(owner).getByRole('button', { name: 'Play personal', exact: true }).click();
    await expect.poll(() => volume(owner, 0)).toBeLessThan(15);
    await expect.poll(() => volume(owner, 1)).toBe(70);
    await tile(owner).getByRole('slider', { name: 'Personal playback position' }).fill('43');
    await tile(owner).getByRole('slider', { name: 'Personal volume' }).fill('0.4');
    await tile(owner).getByRole('button', { name: 'Pause personal', exact: true }).click();
    await expect.poll(() => volume(owner, 0)).toBe(60);
    const unchanged = await refreshApi(member, `room-media/snapshot?roomId=${room.id}`);
    expect(unchanged.version).toBe(before.version);
    expect(unchanged.state).toEqual(before.state);
    expect(outbound.join('\n')).not.toContain('abcdefghijk');
    expect(outbound.join('\n')).not.toContain('private-token');
    expect(await localData(member)).toEqual([]);
    await expect.poll(async () => JSON.stringify(await localData(owner))).toContain('abcdefghijk');
    const saved = JSON.stringify(await localData(owner));
    expect(saved).not.toContain('private-token');
    expect(saved).not.toContain('utm_source');
    const peers = await member.evaluate(async () => {
      const paths = [
        '/api/v1/personal-media/history',
        '/api/v1/personal-media/progress',
        '/api/v1/personal-media/preferences',
      ];
      return Promise.all(paths.map(async (path) => ({ status: (await fetch(path)).status })));
    });
    expect(peers.map((p) => p.status)).toEqual([404, 404, 404]);
    await refreshApi(owner, 'tasks/create', {
      scope: { scope: 'personal' },
      title: 'Unrelated task',
      requestId: crypto.randomUUID(),
    });
    await expect.poll(() => identity!.evaluate((node) => node.isConnected)).toBe(true);
    await tile(owner).getByRole('button', { name: 'Minimize tile', exact: true }).click();
    await expect.poll(() => identity!.evaluate((node) => node.isConnected)).toBe(true);
    await owner.getByRole('button', { name: 'Restore Personal Study Player', exact: true }).click();
    panel = await personalPanel(owner);
    await panel.getByRole('button', { name: 'Close personal player' }).click();
    await expect(tile(owner)).toHaveCount(0);
    await panel.getByRole('button', { name: 'Show personal video' }).click();
    await expect(tile(owner).locator('iframe')).toHaveCount(1);
    await expect
      .poll(async () =>
        Number(await tile(owner).locator('.personal-video').getAttribute('data-personal-position')),
      )
      .toBeGreaterThanOrEqual(43);
    await expect(owner.locator('iframe')).toHaveCount(2);
    panel = await personalPanel(owner);
    await panel.getByRole('combobox', { name: 'Personal speed', exact: true }).click();
    await owner.getByRole('option', { name: '1.5×', exact: true }).click();
    const frame = await tile(owner).locator('iframe').elementHandle();
    await tile(owner)
      .getByRole('button', { name: 'Move Personal Study Player', exact: true })
      .focus();
    await owner.keyboard.press('ArrowRight');
    await tile(owner).getByRole('button', { name: 'Resize tile', exact: true }).focus();
    await owner.keyboard.press('ArrowRight');
    await expect.poll(async () => JSON.stringify(await localData(owner))).toContain('"tile"');
    await panel.evaluate((node) => {
      node.scrollTop = 0;
    });
    await refreshCapture(owner, 'docs/references/phase09/personal-desktop.png');
    await owner.reload();
    panel = await personalPanel(owner);
    await expect(panel.getByRole('region', { name: 'Recent personal media' })).toContainText(
      'YouTube study video',
    );
    await panel.getByRole('button', { name: 'Show personal video' }).click();
    await expect(tile(owner).locator('iframe')).toHaveCount(1);
    await expect
      .poll(async () =>
        Number(await tile(owner).locator('.personal-video').getAttribute('data-personal-position')),
      )
      .toBeGreaterThanOrEqual(43);
    expect(await frame!.evaluate((node) => node.isConnected).catch(() => false)).toBe(false);
    panel = await personalPanel(owner);
    await panel.getByRole('button', { name: 'Play for room', exact: true }).click();
    await expect
      .poll(
        async () => (await refreshApi(member, `room-media/snapshot?roomId=${room.id}`)).state.queue,
      )
      .toEqual(['M7lc1UVf-VE', 'abcdefghijk']);
    const promoted = await refreshApi(member, `room-media/snapshot?roomId=${room.id}`);
    expect(promoted.state.position).toBe(0);
    expect(promoted.state.rate).toBe(1);
    expect(JSON.stringify(promoted)).not.toContain('canonicalUrl');
    expect(JSON.stringify(promoted)).not.toContain('private-token');
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});

test('personal panel responsive recovery, safe failures and companion controls share the same player', async ({
  page,
}) => {
  test.setTimeout(100000);
  await providerMock(page);
  await refreshLogin(page);
  await refreshRoom(page, 'Private player surfaces');
  let panel = await personalPanel(page);
  await panel.getByLabel('Personal media URL').fill('https://private.example/portal?token=secret');
  await panel.getByRole('button', { name: 'Open privately' }).click();
  await expect(panel.getByRole('status')).toContainText('Private or signed');
  await expect(page.locator('iframe')).toHaveCount(0);
  await panel.getByLabel('Personal media URL').fill('https://youtu.be/abcdefghijk');
  await panel.getByRole('button', { name: 'Open privately' }).click();
  await expect(tile(page).locator('iframe')).toHaveCount(1);
  const iframe = await tile(page).locator('iframe').elementHandle();
  const popupWait = page.waitForEvent('popup');
  await tile(page)
    .getByRole('button', { name: 'Pop out Personal Study Player', exact: true })
    .click();
  const popup = await popupWait;
  await expect(popup.locator('iframe')).toHaveCount(0);
  await expect(popup.getByRole('button', { name: 'Play personal', exact: true })).toBeVisible();
  await popup.getByRole('button', { name: 'Play personal', exact: true }).click();
  await expect(tile(page).locator('.personal-video')).toHaveAttribute(
    'data-personal-playing',
    'true',
  );
  await expect.poll(() => iframe!.evaluate((node) => node.isConnected)).toBe(true);
  // The existing about:blank companion's fonts.ready does not settle in headless Chromium.
  // Capture its actual rendered framebuffer; preserve every ownership/control assertion.
  const capture = await page.context().newCDPSession(popup);
  try {
    const { data } = await capture.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('docs/references/phase09/personal-companion.png', Buffer.from(data, 'base64'));
  } finally {
    await capture.detach();
  }
  await popup.close();
  for (const width of [2560, 1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(tile(page).getByRole('button', { name: /^(Pause|Play) personal$/ })).toBeVisible();
    const box = await tile(page).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x).toBeLessThan(width);
    await expect(tile(page).getByRole('slider', { name: 'Personal volume' })).toBeVisible();
  }
  mkdirSync('docs/references/phase09', { recursive: true });
  await tile(page).getByRole('button', { name: 'Fullscreen tile', exact: true }).click();
  await tile(page).getByRole('slider', { name: 'Personal volume' }).click();
  await refreshCapture(page, 'docs/references/phase09/personal-narrow.png');
  await page.keyboard.press('Escape');
  panel = await personalPanel(page);
  await panel.getByRole('button', { name: 'Listening settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Personal listening' });
  await expect(settings).toContainText('No extra microphone');
  await refreshCapture(page, 'docs/references/phase09/personal-listening.png');
  await settings.getByRole('button', { name: 'Clear local personal media' }).click();
  await expect.poll(async () => await localData(page)).toEqual([]);
  await expect(tile(page)).toHaveCount(0);
});

test('public Vimeo adapter uses one private renderer, conservative speed and local resume', async ({
  page,
}) => {
  const policy = (await page.request.get('/')).headers()['permissions-policy'];
  expect(policy).toContain(
    'encrypted-media=(self "https://www.youtube.com" "https://player.vimeo.com")',
  );
  await page.route('https://player.vimeo.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Deterministic Vimeo fixture</title>',
    }),
  );
  await page.addInitScript(() => {
    (window as unknown as { Vimeo: unknown }).Vimeo = {
      Player: class {
        p = 0;
        v = 1;
        handlers = new Map<string, (data: unknown) => void>();
        ready() {
          return Promise.resolve();
        }
        getDuration() {
          return Promise.resolve(300);
        }
        getVideoTitle() {
          return Promise.resolve('Public Vimeo lecture');
        }
        play() {
          this.handlers.get('play')?.({});
          return Promise.resolve();
        }
        pause() {
          this.handlers.get('pause')?.({});
          return Promise.resolve();
        }
        setCurrentTime(value: number) {
          this.p = value;
          this.handlers.get('timeupdate')?.({ seconds: value, duration: 300 });
          return Promise.resolve(value);
        }
        setVolume(value: number) {
          this.v = value;
          return Promise.resolve(value);
        }
        on(name: string, fn: (data: unknown) => void) {
          this.handlers.set(name, fn);
        }
        off(name: string) {
          this.handlers.delete(name);
        }
        destroy() {
          this.handlers.clear();
          return Promise.resolve();
        }
      },
    };
  });
  await refreshLogin(page);
  await refreshRoom(page, 'Personal Vimeo');
  let panel = await personalPanel(page);
  await panel.getByLabel('Personal media URL').fill('https://vimeo.com/76979871?utm_source=study');
  await panel.getByRole('button', { name: 'Open privately' }).click();
  await expect(tile(page).locator('iframe[title="Personal Vimeo player"]')).toHaveCount(1);
  await expect(
    tile(page).getByRole('slider', { name: 'Personal playback position' }),
  ).toBeVisible();
  await tile(page).getByRole('slider', { name: 'Personal playback position' }).fill('37');
  panel = await personalPanel(page);
  await expect(panel).toContainText('Public Vimeo lecture');
  await expect(panel.getByLabel('Personal speed')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Play for room' })).toBeDisabled();
  await panel.getByRole('button', { name: 'Close personal player' }).click();
  await panel.getByRole('button', { name: 'Show personal video' }).click();
  await expect
    .poll(async () =>
      Number(await tile(page).locator('.personal-video').getAttribute('data-personal-position')),
    )
    .toBe(37);
  await expect(page.locator('iframe')).toHaveCount(1);
});

test('native direct WebM plays actual decoded test media without an audio graph or arbitrary URL proxy', async ({
  page,
}) => {
  test.setTimeout(80000);
  await refreshLogin(page);
  await refreshRoom(page, 'Native personal media');
  // A browser-generated fixture, not a downloaded or shipped provider asset.
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 200;
    const context = canvas.getContext('2d')!,
      stream = canvas.captureStream(12),
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' }),
      chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start(100);
    let frame = 0;
    const draw = setInterval(() => {
      context.fillStyle = frame++ % 2 ? '#2d4055' : '#3a5960';
      context.fillRect(0, 0, 320, 200);
    }, 80);
    await new Promise((resolve) => setTimeout(resolve, 4500));
    recorder.stop();
    await stopped;
    clearInterval(draw);
    stream.getTracks().forEach((t) => t.stop());
    return Array.from(new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()));
  });
  await page.route('**/__test/personal-sample.webm', (route) =>
    route.fulfill({ contentType: 'video/webm', body: Buffer.from(bytes) }),
  );
  const panel = await personalPanel(page),
    url = new URL('/__test/personal-sample.webm', page.url()).href;
  await panel.getByLabel('Personal media URL').fill(url);
  await panel.getByRole('button', { name: 'Open privately' }).click();
  const video = tile(page).locator('video');
  await expect(video).toHaveCount(1);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);
  await tile(page).getByRole('button', { name: 'Play personal' }).click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0.5);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBe(320);
  await tile(page).getByRole('button', { name: 'Pause personal' }).click();
  await expect
    .poll(async () => JSON.stringify(await localData(page)))
    .toContain('personal-sample.webm');
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('authorized existing RTC activity ducks personal playback without another microphone capture', async ({
  page,
}) => {
  test.setTimeout(90000);
  await syntheticMedia(page);
  await page.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    (window as unknown as { personalCaptureCount: number }).personalCaptureCount = 0;
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      (window as unknown as { personalCaptureCount: number }).personalCaptureCount++;
      return capture(constraints);
    };
  });
  await providerMock(page);
  await refreshLogin(page);
  await refreshRoom(page, 'Private player voice activity');
  await page.getByRole('button', { name: 'Microphone off', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Microphone on', exact: true })).toBeVisible({
    timeout: 20000,
  });
  const captureCount = () =>
    page.evaluate(
      () => (window as unknown as { personalCaptureCount: number }).personalCaptureCount,
    );
  const before = await captureCount();
  expect(before).toBeGreaterThan(0);
  let panel = await personalPanel(page);
  await panel.getByLabel('Personal media URL').fill('https://youtu.be/M7lc1UVf-VE');
  await panel.getByRole('button', { name: 'Open privately' }).click();
  await expect(tile(page).locator('iframe')).toHaveCount(1);
  await tile(page).getByRole('button', { name: 'Play personal', exact: true }).click();
  await expect.poll(() => volume(page, 0)).toBe(70);
  panel = await personalPanel(page);
  await panel.getByRole('button', { name: 'Listening settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Personal listening' });
  await expect(settings).toContainText('Existing room voice activity is available.', {
    timeout: 20000,
  });
  await settings
    .getByRole('combobox', { name: 'Lower personal media when people speak', exact: true })
    .click();
  await page.getByRole('option', { name: 'On', exact: true }).click();
  await expect.poll(() => volume(page, 0), { timeout: 20000 }).toBeLessThan(25);
  expect(await captureCount()).toBe(before);
  await settings.getByRole('button', { name: 'Close personal listening', exact: true }).click();
  await page.getByRole('button', { name: 'Microphone on', exact: true }).click();
  await expect.poll(() => volume(page, 0)).toBe(70);
  expect(await captureCount()).toBe(before);
  await expect(tile(page).locator('iframe')).toHaveCount(1);
});
