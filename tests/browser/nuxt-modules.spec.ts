import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { format } from 'prettier';
import { refreshLogin, refreshRoom, refreshCapture, refreshApi } from './refresh-helpers.ts';
import { providerMock } from './media-provider.ts';

test('Nuxt 4 asset modules preserve SSR, local fonts, bundled icons and public thumbnails', async ({
  page,
}) => {
  test.setTimeout(90000);
  const evidence = process.env.STUDY_MODULE_EVIDENCE_DIR
    ? `${process.env.STUDY_MODULE_EVIDENCE_DIR}/${test.info().project.name}`
    : 'docs/references/mid08';
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => {
    if (/Content Security Policy|Hydration.*mismatch/i.test(e.text())) errors.push(e.text());
  });
  page.on('request', (request) => requests.push(request.url()));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await providerMock(page);
  const response = await page.goto('/');
  const html = await response!.text();
  expect(html).toContain('data-appearance="system"');
  expect(html).toContain('data-ssr="true"');
  await expect(
    page.getByRole('button', { name: 'Continue with Google', exact: true }),
  ).toBeVisible();
  const signedOutResources = await page.evaluate(async () => {
    await document.fonts.ready;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const scripts = resources.filter((entry) => /\.(m?js)(\?|$)/.test(entry.name));
    const fonts = resources.filter((entry) => /\.(woff2?|ttf)(\?|$)/.test(entry.name));
    return {
      scriptCount: scripts.length,
      scriptEncodedBytes: scripts.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
      fontCount: fonts.length,
      fontEncodedBytes: fonts.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
    };
  });
  const fonts = await page.evaluate(async () => {
    await document.fonts.load('600 16px "Inter Variable"');
    await document.fonts.load('400 20px "Instrument Serif"');
    await document.fonts.load('italic 400 20px "Instrument Serif"');
    return [...document.fonts]
      .filter((font) => font.status === 'loaded')
      .map((font) => ({ family: font.family, weight: font.weight, style: font.style }));
  });
  expect(
    fonts.some((font) => font.family.includes('Inter Variable') && font.weight === '100 900'),
  ).toBe(true);
  expect(
    fonts.some((font) => font.family.includes('Instrument Serif') && font.style === 'italic'),
  ).toBe(true);
  await refreshLogin(page);
  const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  await expect(navigation.locator('.app-nav-link > svg.iconify')).toHaveCount(4);
  for (const icon of await navigation.locator('.app-nav-link > svg.iconify').all()) {
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    const box = await icon.boundingBox();
    expect(box!.width).toBe(22);
    expect(box!.height).toBe(22);
  }
  const room = await refreshRoom(page, 'Nuxt asset delivery');
  await page.getByRole('button', { name: 'Background', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Backgrounds', exact: true });
  const thumbnail = dialog
    .getByRole('button', { name: 'Select Cedar library', exact: true })
    .locator('img');
  await expect
    .poll(() => thumbnail.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  const image = await thumbnail.evaluate((node) => {
    const img = node as HTMLImageElement;
    return {
      src: img.currentSrc,
      srcset: img.srcset,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  });
  expect(image.src).toContain('/_ipx/');
  expect(image.srcset).toContain('2x');
  const optimized = await page.request.get(image.src);
  const original = await page.request.get('/backgrounds/cedar-library-thumb.webp');
  expect(optimized.ok()).toBe(true);
  expect(optimized.headers()['content-type']).toContain('image/webp');
  const optimizedBytes = (await optimized.body()).length;
  const originalBytes = (await original.body()).length;
  expect(optimizedBytes).toBeLessThan(originalBytes);
  const denied = await page.request.get('/_ipx/w_88/https://example.com/private.jpg');
  expect(denied.ok()).toBe(false);
  const star = dialog.getByRole('button', { name: 'Favorite Cedar library', exact: true });
  await expect(star.locator('svg.iconify')).toBeVisible();
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Close backgrounds', exact: true }).click();
  await page.getByRole('button', { name: 'Media', exact: true }).click();
  const main = page.locator('.media-compact');
  await main.getByLabel('YouTube URL', { exact: true }).fill('M7lc1UVf-VE');
  await main.getByRole('button', { name: 'Play', exact: true }).click();
  const embeddingSupported = await page.evaluate(
    () => !crossOriginIsolated || 'credentialless' in document.createElement('iframe'),
  );
  if (embeddingSupported) await expect(page.locator('.youtube-host iframe')).toHaveCount(1);
  else {
    // Preserve the accepted isolation boundary rather than faking browser support.
    await expect(page.locator('.room-video').getByRole('status')).toContainText(
      'This browser cannot isolate the YouTube embed.',
    );
    await expect(page.locator('.youtube-host iframe')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Media', exact: true }).click();
  const metadata = main.locator('.media-track img');
  await expect(metadata).toHaveAttribute('src', /\/_ipx\/.*i\.ytimg\.com/);
  await expect
    .poll(() => metadata.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  if (embeddingSupported) {
    await page.evaluate(() =>
      Object.assign(window, { modulePlayer: document.querySelector('.youtube-host iframe') }),
    );
    const beforeVisibility = await refreshApi(page, `room-media/snapshot?roomId=${room.id}`);
    for (const visibility of ['hidden', 'visible']) {
      await page.evaluate((value) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value });
        document.dispatchEvent(new Event('visibilitychange'));
      }, visibility);
      await expect(page.locator('.room-video')).toHaveAttribute(
        'data-player-state',
        visibility === 'hidden' ? 'paused' : 'playing',
      );
    }
    const afterVisibility = await refreshApi(page, `room-media/snapshot?roomId=${room.id}`);
    expect(afterVisibility.version).toBe(beforeVisibility.version);
    expect(afterVisibility.state.playing).toBe(true);
    await page
      .getByRole('article', { name: 'Room YouTube', exact: true })
      .getByRole('button', { name: 'Minimize tile', exact: true })
      .click();
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { modulePlayer: Element }).modulePlayer ===
          document.querySelector('.youtube-host iframe'),
      ),
    ).toBe(true);
  } else {
    const shared = await refreshApi(page, `room-media/snapshot?roomId=${room.id}`);
    expect(shared.state.playing).toBe(true);
  }
  expect(requests.filter((url) => /fonts\.(googleapis|gstatic)|api\.iconify/.test(url))).toEqual(
    [],
  );
  expect(errors).toEqual([]);
  mkdirSync(evidence, { recursive: true });
  writeFileSync(
    `${evidence}/modules.json`,
    await format(
      JSON.stringify({
        fonts,
        signedOutResources,
        image,
        optimizedBytes,
        originalBytes,
        embeddingSupported,
        errors,
        remoteFontOrIconRequests: [],
      }),
      { parser: 'json' },
    ),
  );
  await refreshCapture(page, `${evidence}/modules-desktop.png`);
});
