import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { format } from 'prettier';
import { refreshLogin, refreshRoom, refreshCapture } from './refresh-helpers.ts';
import { roomSettings } from './room-settings.ts';
const evidence = process.env.STUDY_PLATFORM_EVIDENCE_DIR ?? 'docs/references/mid07';
test('capabilities, focus, accessibility preferences and responsive settings retain the room', async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(90000);
  const platform = test.info().project.name || 'windows-chromium';
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await refreshLogin(page);
  await refreshRoom(page, 'Accessible study space');
  await expect(page.getByRole('timer')).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).qaRoom = document.querySelector('.room-shell');
    (window as unknown as Record<string, unknown>).qaTimer =
      document.querySelector('.pomodoro-timer');
  });
  const clock = page.locator('[data-card-type="clock.panel"]');
  const tasks = page.locator('[data-card-type="tasks.panel"]');
  await tasks.getByRole('button', { name: 'Move Tasks', exact: true }).focus();
  await clock.getByRole('button', { name: 'Clock settings', exact: true }).focus();
  expect(await clock.evaluate((el) => Number(getComputedStyle(el).zIndex))).toBeGreaterThan(
    await tasks.evaluate((el) => Number(getComputedStyle(el).zIndex)),
  );
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Clock settings', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(clock.getByRole('button', { name: 'Clock settings', exact: true })).toBeFocused();
  const sheet = await roomSettings(page, 'Diagnostics');
  const panel = sheet.getByRole('region', { name: 'Platform capabilities', exact: true });
  await expect(panel).toHaveAttribute('aria-busy', 'false');
  await expect(panel.locator('[data-capability="video.systemEffects"]')).toContainText(
    'System-managed',
  );
  await expect(panel.locator('[data-capability="system.widgets"]')).toContainText(
    'Requires native',
  );
  await expect(panel.getByRole('button')).toHaveCount(0);
  const runtime = await page.evaluate(() => ({
    secure: isSecureContext,
    passkeys: !!window.PublicKeyCredential && !!navigator.credentials,
    pip: document.pictureInPictureEnabled === true,
    sharing: typeof navigator.share === 'function',
    fonts: [
      document.fonts.check('16px Inter Variable'),
      document.fonts.check('16px Instrument Serif'),
    ],
    ua: navigator.userAgent,
  }));
  await expect(panel.locator('[data-capability="auth.passkeys"] strong')).toHaveText(
    runtime.secure && runtime.passkeys ? 'Supported' : 'Unavailable',
  );
  await expect(panel.locator('[data-capability="video.pictureInPicture"] strong')).toHaveText(
    runtime.pip ? 'Supported' : 'Unavailable',
  );
  await expect(panel.locator('[data-capability="share.nativeShare"] strong')).toHaveText(
    runtime.secure && runtime.sharing ? 'Supported' : 'Unavailable',
  );
  await refreshCapture(page, `${evidence}/${platform}-diagnostics.png`);
  await page.keyboard.press('Escape');
  await page.emulateMedia({ colorScheme: 'dark', contrast: 'more' });
  expect(
    await page
      .locator('.room-shell')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--glass-blur').trim()),
  ).toBe('0px');
  await page.emulateMedia({ contrast: 'no-preference', forcedColors: 'active' });
  expect(await clock.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe('none');
  await refreshCapture(page, `${evidence}/${platform}-forced-colors.png`);
  await page.emulateMedia({ forcedColors: 'none' });
  if (browserName === 'chromium') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-reduced-transparency', value: 'reduce' },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ],
    });
    expect(
      await page
        .locator('.room-shell')
        .evaluate((el) => getComputedStyle(el).getPropertyValue('--glass-blur').trim()),
    ).toBe('0px');
    await cdp.detach();
  }
  for (const width of [2560, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width > 1000 ? 1440 : 900 });
    const appearance = await roomSettings(page, 'Appearance');
    await expect(appearance).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    expect(await appearance.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.keyboard.press('Escape');
  }
  await refreshCapture(page, `${evidence}/${platform}-narrow.png`);
  expect(
    await page.evaluate(() => {
      const state = window as unknown as Record<string, unknown>;
      return (
        state.qaRoom === document.querySelector('.room-shell') &&
        state.qaTimer === document.querySelector('.pomodoro-timer')
      );
    }),
  ).toBe(true);
  const unnamed = await page
    .locator('button:visible')
    .evaluateAll((buttons) =>
      buttons
        .filter(
          (button) =>
            !button.textContent?.trim() &&
            !button.getAttribute('aria-label') &&
            !button.getAttribute('aria-labelledby'),
        )
        .map((button) => button.outerHTML),
    );
  expect(unnamed).toEqual([]);
  expect(errors).toEqual([]);
  writeFileSync(
    `${evidence}/${platform}.json`,
    await format(
      JSON.stringify(
        { platform, runtime, widths: [1440, 2560, 768, 390, 320], errors, unnamed },
        null,
        2,
      ),
      { parser: 'json' },
    ),
  );
});
test('touch layouts give clock and workspace controls 44 pixel targets', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName === 'firefox', 'Playwright Firefox does not support hasTouch emulation.');
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    baseURL: 'https://localhost:8449',
  });
  try {
    const page = await context.newPage();
    await refreshLogin(page);
    await refreshRoom(page, 'Touch study space');
    await page.getByRole('button', { name: 'Restore Clock', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Clock settings', exact: true })).toBeVisible();
    for (const name of ['Clock settings', 'Minimize tile', 'Pop out Clock']) {
      const button = page
        .locator('[data-card-type="clock.panel"]')
        .getByRole('button', { name, exact: true });
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Restore Tasks', exact: true }).click();
    const input = page.getByLabel('New task', { exact: true });
    await input.fill('Touch-accessible task');
    await input.press('Enter');
    const actions = page.locator('.task-list .productivity-actions');
    await expect(actions).toHaveCSS('opacity', '1');
    for (const button of await actions.getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  } finally {
    await context.close();
  }
});
