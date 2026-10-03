import { finishOnboarding } from './onboarding.ts';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { rtcBundle } from './rtc-bundle.ts';

const evidence = '.local/validation/mid01-quiet-glass';
async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Appearance & layout', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'Appearance & layout' })).toBeVisible();
}
async function closeSettings(page: Page) {
  await page.getByRole('button', { name: 'Close appearance & layout' }).click();
}
async function settle(page: Page) {
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.route-veil')).toHaveCount(0);
}

test('appearance persists before hydration, System follows OS, and overlay restores keyboard focus', async ({
  page,
  context,
  browser,
}) => {
  const cspErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Content Security Policy'))
      cspErrors.push(message.text());
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
  await openSettings(page);
  expect(
    await page
      .getByRole('radiogroup', { name: 'Appearance' })
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
  ).toBe(3);
  expect(cspErrors).toEqual([]);
  const system = page.getByRole('radio', { name: 'System', exact: true });
  await expect(system).toHaveAttribute('aria-checked', 'true');
  await system.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
  await page.getByRole('combobox', { name: 'Page width' }).click();
  await page.getByRole('option', { name: 'Compressed', exact: true }).click();
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ animations: 'disabled', path: `${evidence}/settings-dark.png` });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Profile and settings' })).toBeFocused();
  await expect
    .poll(async () => (await context.cookies()).find((c) => c.name === 'study-appearance')?.value)
    .toContain('dark');
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    ignoreHTTPSErrors: true,
    colorScheme: 'light',
    storageState: await context.storageState(),
  });
  const firstPaint = await noJs.newPage();
  const response = await firstPaint.goto('/');
  expect(await response!.text()).toContain('data-appearance="dark"');
  await expect(firstPaint.locator('html')).toHaveAttribute('data-layout-width', 'compressed');
  await expect(firstPaint.locator('html')).toHaveCSS('background-color', 'rgb(17, 21, 29)');
  await noJs.close();
  await openSettings(page);
  await page.getByRole('radio', { name: 'System', exact: true }).click();
  await closeSettings(page);
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(243, 245, 248)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(17, 21, 29)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(243, 245, 248)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ contrast: 'more' });
  expect(
    await page.locator('.app-navigation').evaluate((el) => getComputedStyle(el).backdropFilter),
  ).toBe('blur(0px)');
  await page.emulateMedia({ contrast: 'no-preference' });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-transparency', value: 'reduce' },
      { name: 'prefers-color-scheme', value: 'dark' },
    ],
  });
  await expect(page.locator('.app-navigation')).toHaveCSS('background-color', 'rgb(27, 34, 45)');
  await cdp.detach();
});

test('desktop, ultrawide width modes, tablet and mobile reflow with bundled fonts and safe footer', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await mkdir(evidence, { recursive: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
  await page.goto('/account');
  await settle(page);
  await page.goto('/rooms/new');
  await page.getByLabel('Room name').fill('Visual foundation room');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await page.getByRole('link', { name: 'My Rooms', exact: true }).first().click();
  await settle(page);
  const measurements: object[] = [];
  for (const [label, w, ht, mode, theme] of [
    ['desktop-light', 1440, 900, 'Auto', 'Light'],
    ['ultrawide-auto', 3440, 1440, 'Auto', 'Light'],
    ['ultrawide-compressed', 3440, 1440, 'Compressed', 'Light'],
    ['ultrawide-full', 3440, 1440, 'Full-width', 'Dark'],
    ['tablet-dark', 820, 1180, 'Auto', 'Dark'],
    ['tablet-bottom', 700, 1024, 'Auto', 'Light'],
    ['mobile-light', 390, 844, 'Auto', 'Light'],
    ['mobile-dark', 320, 780, 'Auto', 'Dark'],
  ] as const) {
    await page.setViewportSize({ width: w, height: ht });
    await openSettings(page);
    await page.getByRole('radio', { name: theme, exact: true }).click();
    await page.getByRole('combobox', { name: 'Page width' }).click();
    await page.getByRole('option', { name: mode, exact: true }).click();
    await closeSettings(page);
    await page.evaluate(() => document.fonts.ready);
    const data = await page.evaluate(() => {
      const main = document.querySelector('main')!.getBoundingClientRect(),
        nav = document.querySelector('.app-navigation')!.getBoundingClientRect(),
        footer = document.querySelector('footer')!.getBoundingClientRect();
      return {
        mainWidth: main.width,
        navHeight: nav.height,
        navWidth: nav.width,
        footerBottom: footer.bottom,
        documentWidth: document.documentElement.scrollWidth,
        font: getComputedStyle(document.body).fontFamily,
        columns: getComputedStyle(document.querySelector('.room-grid')!).gridTemplateColumns.split(
          ' ',
        ).length,
      };
    });
    expect(data.documentWidth).toBeLessThanOrEqual(w);
    expect(data.font).toContain('Inter Variable');
    if (w > 760) {
      expect(data.navHeight).toBeGreaterThan(data.navWidth);
      expect(data.footerBottom).toBeGreaterThanOrEqual(ht - 1);
    } else {
      expect(data.navWidth).toBeGreaterThan(data.navHeight);
      // Browse controls can make the mobile document taller than the viewport.
      // At the end of the page the footer must remain above the floating navigation.
      await page.locator('footer').scrollIntoViewIfNeeded();
      await expect(page.locator('footer')).toBeInViewport();
      const end = await page.evaluate(() => ({
        footer: document.querySelector('footer')!.getBoundingClientRect().bottom,
        navigation: document.querySelector('.app-navigation')!.getBoundingClientRect().top,
      }));
      expect(end.footer).toBeLessThanOrEqual(end.navigation);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    if (w === 3440) {
      expect(data.columns).toBeGreaterThanOrEqual(4);
      expect(data.mainWidth).toBeGreaterThan(mode === 'Compressed' ? 1400 : 3000);
    }
    measurements.push({ label, w, ht, mode, theme, ...data });
    await page.screenshot({
      animations: 'disabled',
      path: `${evidence}/${label}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 500 });
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out', exact: true }).scrollIntoViewIfNeeded();
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expect(page.locator('footer')).toBeInViewport();
  await writeFile(`${evidence}/layout-matrix.json`, JSON.stringify(measurements, null, 2));
});

test('route motion follows real loading, supports cancellation and excludes immersive navigation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
  await page.goto('/account');
  await settle(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route('**/api/v1/rooms/browse?scope=discover*', async (route) => {
    await gate;
    await route.continue();
  });
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Discover' })
    .click();
  await expect(page.locator('.route-veil')).toBeVisible();
  await expect(page.locator('.route-veil').getByRole('status')).toBeVisible();
  await expect(page.locator('main')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('.route-veil')).toHaveCSS('opacity', '1');
  await expect(page.locator('.route-veil')).toHaveCSS('clip-path', 'none');
  await expect(page.locator('main')).toHaveCSS('transform', 'none');
  await expect(page.locator('.route-veil button, .route-brand')).toHaveCount(0);
  const spinner = await page.locator('.route-veil .ui-loader-ring').boundingBox();
  const viewport = page.viewportSize()!;
  expect(Math.abs(spinner!.x + spinner!.width / 2 - viewport.width / 2)).toBeLessThan(1);
  expect(Math.abs(spinner!.y + spinner!.height / 2 - viewport.height / 2)).toBeLessThan(1);
  await expect(page.locator('.route-veil')).toHaveCSS('background-color', 'rgb(243, 245, 248)');
  await page.keyboard.press('Escape');
  await settle(page);
  release();
  await page.unrouteAll({ behavior: 'wait' });
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'My Rooms' })
    .click();
  await settle(page);
  await expect(page.getByRole('heading', { name: 'My Rooms', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Create a room' }).click();
  await page.getByLabel('Room name').fill('Immersive foundation');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await page.getByRole('button', { name: 'Enter room', exact: true }).click();
  await expect(page.locator('.app-navigation')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Room controls' })).toBeVisible();
  await expect(page.locator('.room-shell')).toHaveCount(1);
  await settle(page);
  await expect(page.getByRole('timer')).toHaveText('25:00');
  await expect(page.locator('.room-scene img').first()).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: `${evidence}/immersive-room.png` });
  // Leave while actually immersive, so route disposal is exercised too.
  await page.goBack();
  await settle(page);
  await expect(page.locator('.room-shell')).toHaveCount(0);
  await expect(page.locator('.app-navigation')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Home', exact: true })
    .click();
  await settle(page);
  expect(
    await page
      .locator('html')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--motion-expressive').trim()),
  ).toMatch(/^0(?:ms|s)$/);
  expect(errors).toEqual([]);
});

test('shared controls cover select typeahead, disabled options, search states and native dialog focus', async ({
  page,
}) => {
  const script = await rtcBundle('tests/fixtures/ui-primitives.ts');
  const tokens = (await readFile('packages/ui/src/styles/tokens.css', 'utf8')).replace(
    /@import[^;]+;/g,
    '',
  );
  const css = await readFile('packages/ui/src/styles/primitives.css', 'utf8');
  await page.route('**/__test/ui.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: script }),
  );
  await page.route('**/__test/ui', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html data-appearance="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${tokens}\n${css}\n*{box-sizing:border-box}body{font-family:var(--font-ui);background:var(--canvas);color:var(--text-primary)}button,input{font:inherit}</style></head><body><div id="fixture"></div><script type="module" src="/__test/ui.js"></script></body></html>`,
    }),
  );
  await page.goto('/__test/ui');
  const choice = page.getByRole('combobox', { name: 'Test choice' });
  await choice.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Beta' })).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  await expect(choice).toContainText('Gamma');
  await choice.press('d');
  await choice.press('Enter');
  await expect(choice).toContainText('Delta');
  await choice.press('Home');
  await choice.press('Enter');
  await expect(choice).toContainText('Alpha');
  await choice.press('End');
  await choice.press('Escape');
  await expect(choice).toContainText('Alpha');
  await expect(choice).toBeFocused();
  await choice.click();
  await page.getByRole('option', { name: 'Beta' }).click({ force: true });
  await expect(choice).toContainText('Alpha');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.getByRole('radio', { name: 'Alpha' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Gamma' })).toHaveAttribute('aria-checked', 'true');
  const first = page.getByRole('searchbox', { name: 'Search first' }),
    second = page.getByRole('searchbox', { name: 'Search second' });
  expect(await first.getAttribute('id')).not.toBe(await second.getAttribute('id'));
  await first.fill('library');
  await first.press('Enter');
  await expect(page.getByLabel('Submitted query')).toHaveText('library');
  await page.getByRole('button', { name: 'Clear search first' }).click();
  await expect(first).toHaveValue('');
  await expect(first).toBeFocused();
  await page.getByRole('button', { name: 'Toggle busy' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Searching…' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Toggle error' }).click();
  await expect(first).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator(`#${await first.getAttribute('aria-describedby')}`)).toHaveText(
    'Try another query.',
  );
  await page.getByRole('button', { name: 'Toggle disabled' }).click();
  await expect(first).toBeDisabled();
  await expect(choice).toBeDisabled();
  const opener = page.getByRole('button', { name: 'Open settings' });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Last action' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close test settings' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByRole('button', { name: 'Toggle disabled' }).click();
  await choice.click();
  await page.getByRole('option', { name: 'Gamma' }).click();
  await expect(choice).toContainText('Gamma');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test.describe('touch surface', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('opens profile, selects width and dismisses settings by touch', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await finishOnboarding(page);
    await page.getByRole('button', { name: 'Profile and settings' }).tap();
    await page.getByRole('button', { name: 'Appearance & layout', exact: true }).tap();
    await page.getByRole('combobox', { name: 'Page width' }).tap();
    await page.getByRole('option', { name: 'Full-width', exact: true }).tap();
    await expect(page.getByRole('combobox', { name: 'Page width' })).toContainText('Full-width');
    await page.screenshot({ animations: 'disabled', path: `${evidence}/settings-touch.png` });
    await page.getByRole('button', { name: 'Close appearance & layout' }).tap();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Discover' })
      .tap();
    await settle(page);
    await expect(page.getByRole('heading', { name: 'Discover' })).toBeVisible();
  });
});

test('glass previews live, survives first paint, respects accessibility and all width choices reload', async ({
  page,
  context,
  browser,
}) => {
  const cspErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && m.text().includes('Content Security Policy'))
      cspErrors.push(m.text());
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('link', { name: 'Home', exact: true }).focus();
  for (const name of ['My Rooms', 'Friends', 'Discover']) {
    await page.keyboard.press('Tab');
    await expect(nav.getByRole('link', { name, exact: true })).toBeFocused();
  }
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Profile and settings' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Account & devices' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.setViewportSize({ width: 1280, height: 900 });
  const automatic = page.getByRole('button', { name: 'Auto Recommended' });
  const slider = page.getByRole('slider', { name: 'Manual fill' });
  await expect(automatic).toHaveAttribute('aria-pressed', 'true');
  await slider.focus();
  await slider.press('End');
  await expect(slider).toHaveValue('100');
  await expect(automatic).toHaveAttribute('aria-pressed', 'false');
  await expect(nav).toHaveCSS('background-color', 'rgb(250, 252, 255)');
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await slider.press('Home');
  await expect(nav).toHaveCSS('background-color', 'rgba(250, 252, 255, 0)');
  await slider.press('ArrowRight');
  await expect(slider).toHaveValue('5');
  await slider.press('End');
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ animations: 'disabled', path: `${evidence}/glass-manual-light.png` });
  await closeSettings(page);
  await page.reload();
  await openSettings(page);
  await expect(slider).toHaveValue('100');
  await expect(automatic).toHaveAttribute('aria-pressed', 'false');
  for (const [label, value] of [
    ['Auto', 'auto'],
    ['Compressed', 'compressed'],
    ['Full-width', 'full'],
  ] as const) {
    await page.getByRole('combobox', { name: 'Page width' }).click();
    await page.getByRole('option', { name: label, exact: true }).click();
    await closeSettings(page);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-layout-width', value);
    await openSettings(page);
    await expect(page.getByRole('combobox', { name: 'Page width' })).toHaveText(label);
  }
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    ignoreHTTPSErrors: true,
    colorScheme: 'light',
    storageState: await context.storageState(),
  });
  const firstPaint = await noJs.newPage();
  await firstPaint.goto('/');
  await expect(firstPaint.locator('html')).toHaveAttribute('data-glass-transparency', '0');
  // MID-02 hides navigation until session resolution. Probe the same server-rendered
  // material CSS without enabling application JavaScript or inferring auth from cookies.
  await firstPaint.locator('main').evaluate((el) => {
    const probe = document.createElement('div');
    probe.className = 'ui-glass';
    probe.id = 'first-paint-material';
    el.append(probe);
  });
  await expect(firstPaint.locator('#first-paint-material')).toHaveCSS(
    'background-color',
    'rgb(250, 252, 255)',
  );
  await noJs.close();
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await page.getByRole('radio', { name: 'Dark', exact: true }).hover();
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  await expect(nav).toHaveCSS('background-color', 'rgb(29, 37, 50)');
  await page.screenshot({ animations: 'disabled', path: `${evidence}/glass-manual-dark.png` });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  });
  await expect(nav).toHaveCSS('background-color', 'rgb(27, 34, 45)');
  await expect(nav).toHaveCSS('backdrop-filter', 'blur(0px)');
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });
  await cdp.detach();
  await automatic.click();
  await closeSettings(page);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-glass-transparency', 'auto');
  expect(cspErrors).toEqual([]);
});

test('opaque cover hides data and image assembly and survives rapid navigation and errors', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
  await page.goto('/account');
  await settle(page);
  await openSettings(page);
  await page.getByRole('slider', { name: 'Manual fill' }).press('End');
  await closeSettings(page);
  // Cancel synchronously when the opaque cover is committed, before the router's next frame.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const observer = new MutationObserver(() => {
          const cover = document.querySelector('.route-veil:not(.route-veil-pending)');
          if (!cover) return;
          observer.disconnect();
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
          resolve();
        });
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['class'],
        });
        document.querySelector<HTMLAnchorElement>('.app-navigation a[href="/discover"]')!.click();
      }),
  );
  await settle(page);
  await expect(page).toHaveURL('/account');
  // Inject a first-frame image in the test only; no product fixture route or media changes.
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      const main = document.querySelector('main');
      if (
        main?.querySelector('h1')?.textContent === 'Discover' &&
        !main.querySelector('[data-critical-test]')
      ) {
        const image = document.createElement('img');
        image.setAttribute('data-critical-test', '');
        image.width = 96;
        image.height = 96;
        image.alt = 'Critical test image';
        image.src = '/__test/first-frame.svg';
        main.prepend(image);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  let releaseImage = () => {};
  const imageGate = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  await page.route('**/__test/first-frame.svg', async (route) => {
    await imageGate;
    await route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="blue"/></svg>',
    });
  });
  await page.getByRole('navigation').getByRole('link', { name: 'Discover' }).click();
  await expect(page.locator('main img[data-critical-test]')).toHaveCount(1);
  await expect(page.locator('main')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await expect(page.locator('.route-veil')).toHaveCSS('background-color', 'rgb(243, 245, 248)');
  await expect(page.locator('.route-veil')).toHaveCSS('opacity', '1');
  await page.screenshot({ animations: 'disabled', path: `${evidence}/opaque-image-loading.png` });
  const releasedAt = Date.now();
  releaseImage();
  await settle(page);
  await writeFile(
    `${evidence}/ready-reveal.json`,
    JSON.stringify({ releasedImageToRevealMs: Date.now() - releasedAt }, null, 2),
  );
  await expect(page.getByAltText('Critical test image')).toBeVisible();
  await expect(page.locator('main')).toBeFocused();
  await page.unrouteAll({ behavior: 'wait' });
  // Different clicks across frames overlap outgoing guards; only the last attempt owns reveal.
  await page.evaluate(async () => {
    for (const href of ['/my-rooms', '/friends', '/discover', '/my-rooms']) {
      document.querySelector<HTMLAnchorElement>(`.app-navigation a[href="${href}"]`)!.click();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  });
  await expect(page).toHaveURL('/my-rooms');
  await settle(page);
  await expect(page.getByRole('heading', { name: 'My Rooms', exact: true })).toBeVisible();
  await page.route('**/api/v1/rooms/browse?scope=discover*', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await page.getByRole('navigation').getByRole('link', { name: 'Discover' }).click();
  await settle(page);
  await expect(page.getByRole('alert')).toContainText('Rooms could not load');
});

test('glass alpha visibly spans solid, balanced and transparent on shared surfaces in both themes', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
  await mkdir(evidence, { recursive: true });
  // A diagnostic backdrop makes transmission comparable on the real shell consumers.
  // Only the page background changes in this test; materials, blur and text stay untouched.
  await page.evaluate(() => {
    document.body.style.background =
      'repeating-linear-gradient(135deg, #7b90b8 0px 90px, #ba936e 90px 180px, #628e85 180px 270px)';
  });
  const measurements = [];
  for (const theme of ['light', 'dark'] as const) {
    await openSettings(page);
    await page
      .getByRole('radio', { name: theme === 'light' ? 'Light' : 'Dark', exact: true })
      .click();
    const slider = page.getByRole('slider', { name: 'Manual fill' });
    for (const [level, base, elevated] of [
      [0, 0, 0],
      [25, 0.25, 0.25],
      [50, 0.5, 0.5],
      [75, 0.75, 0.75],
      [100, 1, 1],
    ] as const) {
      await slider.fill(String(level));
      await expect(page.locator('html')).toHaveAttribute(
        'data-glass-transparency',
        String(100 - level),
      );
      const alpha = async (selector: string) =>
        page.locator(selector).evaluate((el) => {
          const color = getComputedStyle(el).backgroundColor;
          return color.startsWith('rgba') ? Number(color.match(/, ([\d.]+)\)$/)?.[1] ?? 1) : 1;
        });
      expect(await alpha('.app-navigation')).toBeCloseTo(base, 2);
      expect(await alpha('.ui-settings-sheet[open]')).toBeCloseTo(elevated, 2);
      await page.screenshot({
        animations: 'disabled',
        path: `${evidence}/glass-${theme}-${level}-sheet.png`,
      });
      await closeSettings(page);
      await page.getByRole('button', { name: 'Profile and settings' }).click();
      expect(await alpha('.profile-popover')).toBeCloseTo(elevated, 2);
      await page.screenshot({
        animations: 'disabled',
        path: `${evidence}/glass-${theme}-${level}-profile.png`,
      });
      measurements.push({
        theme,
        level,
        base: await alpha('.app-navigation'),
        elevated: await alpha('.profile-popover'),
      });
      await page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('button', { name: 'Appearance & layout', exact: true })
        .click();
    }
    await page.getByRole('button', { name: 'Auto Recommended' }).click();
    await expect(page.locator('.app-navigation')).toHaveCSS(
      'background-color',
      theme === 'light' ? 'rgba(250, 252, 255, 0.84)' : 'rgba(29, 37, 50, 0.82)',
    );
    await expect(page.locator('.ui-settings-sheet[open]')).toHaveCSS(
      'background-color',
      theme === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(37, 47, 63, 0.9)',
    );
    await closeSettings(page);
  }
  await writeFile(`${evidence}/glass-alpha.json`, JSON.stringify(measurements, null, 2));
});

test('ordinary route fades only, keeps loading opaque in both themes, and reduces motion', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
  await page.goto('/account');
  await settle(page);
  const samples = [];
  for (const theme of ['light', 'dark'] as const) {
    await openSettings(page);
    await page
      .getByRole('radio', { name: theme === 'light' ? 'Light' : 'Dark', exact: true })
      .click();
    await page.getByRole('slider', { name: 'Manual fill' }).press('End');
    await closeSettings(page);
    for (const reduced of [false, true]) {
      await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
      let release = () => {};
      const gate = new Promise<void>((r) => {
        release = r;
      });
      await page.route('**/api/v1/rooms/browse?scope=discover*', async (route) => {
        await gate;
        await route.continue();
      });
      await page.evaluate(() => {
        const frames: Record<string, unknown>[] = [];
        (window as unknown as { routeFrames: typeof frames }).routeFrames = frames;
        const sample = () => {
          const cover = document.querySelector('.route-veil');
          const main = document.querySelector('main')!;
          if (cover) {
            const c = getComputedStyle(cover),
              m = getComputedStyle(main);
            frames.push({
              opacity: Number(c.opacity),
              clip: c.clipPath,
              transform: c.transform,
              mainTransform: m.transform,
              leaving: cover.classList.contains('route-veil-leave-active'),
              pending: cover.classList.contains('route-veil-pending'),
              busy: main.getAttribute('aria-busy'),
              visibility: m.visibility,
              transition: c.transitionProperty,
              duration: c.transitionDuration,
            });
          }
          if (frames.length === 0 || cover) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await page.getByRole('navigation').getByRole('link', { name: 'Discover' }).click();
      await expect(page.locator('main')).toHaveCSS('visibility', 'hidden');
      await expect(page.locator('.route-veil')).toHaveCSS('opacity', '1');
      await expect(page.locator('.route-veil')).toHaveCSS(
        'background-color',
        theme === 'light' ? 'rgb(243, 245, 248)' : 'rgb(17, 21, 29)',
      );
      if (reduced)
        await expect(page.locator('.route-veil .ui-loader-ring')).toHaveCSS(
          'animation-name',
          'none',
        );
      release();
      await settle(page);
      const frames = await page.evaluate(
        () =>
          (
            window as unknown as {
              routeFrames: {
                opacity: number;
                clip: string;
                transform: string;
                mainTransform: string;
                leaving: boolean;
                pending: boolean;
                busy: string;
                visibility: string;
                transition: string;
                duration: string;
              }[];
            }
          ).routeFrames,
      );
      expect(frames.length).toBeGreaterThan(0);
      for (const frame of frames) {
        expect(frame.clip).toBe('none');
        expect(frame.transform).toBe('none');
        expect(frame.mainTransform).toBe('none');
        if (frame.busy === 'true' && !frame.pending) {
          expect(frame.opacity).toBe(1);
          expect(frame.visibility).toBe('hidden');
        }
      }
      if (!reduced) {
        expect(frames.some((f) => f.pending && f.opacity > 0 && f.opacity < 1)).toBe(true);
        expect(
          frames.some(
            (f) =>
              f.leaving &&
              f.opacity > 0 &&
              f.opacity < 1 &&
              f.duration === '0.2s' &&
              f.transition === 'opacity',
          ),
        ).toBe(true);
      } else expect(frames.every((f) => f.opacity === 1)).toBe(true);
      samples.push({ theme, reduced, frames });
      await page.unrouteAll({ behavior: 'wait' });
      await page.getByRole('navigation').getByRole('link', { name: 'Home', exact: true }).click();
      await settle(page);
    }
  }
  await writeFile(`${evidence}/route-fade-frames.json`, JSON.stringify(samples, null, 2));
});
