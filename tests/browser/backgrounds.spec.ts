import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('background selector, responsive room, secure local imports, persistence and reduced motion', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  const fullAssets: string[] = [];
  page.on('request', (r) => {
    if (/\/backgrounds\/[^/]+\.webp$/.test(r.url()) && !r.url().includes('-thumb'))
      fullAssets.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL('/account');
  const room = await page.evaluate(async () => {
    const { csrfToken } = await fetch('/api/v1/session/csrf').then((r) => r.json());
    return fetch('/api/v1/rooms/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ name: 'Quiet environments', privacy: 'public' }),
    }).then((r) => r.json());
  });
  await page.goto(`/rooms/${room.id}`);
  await page.getByRole('button', { name: 'Enter room', exact: true }).click();
  const surface = page.locator('.environment-surface');
  await page.getByRole('button', { name: 'Background', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Backgrounds' });
  await expect(
    dialog.getByRole('button', { name: 'Select Cedar library', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: '.local/validation/phase05-selector-desktop.png' });
  expect(fullAssets.every((url) => url.endsWith('/quiet-hours.webp'))).toBe(true);
  await dialog.getByRole('button', { name: 'Favorite Cedar library', exact: true }).click();
  await dialog.getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect(dialog.locator('.background-card')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'All', exact: true }).click();
  for (const [title, id] of [
    ['Morning studio', 'morning-studio'],
    ['Cedar library', 'cedar-library'],
    ['After midnight', 'night-observatory'],
    ['Rain at the window', 'rainy-window'],
  ]) {
    await dialog.getByRole('button', { name: 'Select ' + title, exact: true }).click();
    await expect(surface).toHaveAttribute('data-background', id!);
    await dialog.getByRole('button', { name: 'Close backgrounds' }).click();
    await expect(page.getByRole('button', { name: 'Background', exact: true })).toBeFocused();
    await page.screenshot({ path: `.local/validation/phase05-${id}-desktop.png` });
    await page.getByRole('button', { name: 'Background', exact: true }).click();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(surface).toHaveAttribute('data-motion', 'frozen');
  await expect(surface.locator('.environment-effect')).toHaveCount(0);
  await page.screenshot({ path: '.local/validation/phase05-reduced-motion.png' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(surface).toHaveAttribute('data-motion', 'playing');
  const transform = await surface
    .locator('.environment-effect')
    .evaluate((e) => getComputedStyle(e).transform);
  await expect
    .poll(() =>
      surface.locator('.environment-effect').evaluate((e) => getComputedStyle(e).transform),
    )
    .not.toBe(transform);
  await dialog.getByRole('button', { name: 'Pause motion', exact: true }).click();
  await expect(surface).toHaveAttribute('data-motion', 'frozen');
  await dialog.getByRole('button', { name: 'Resume motion', exact: true }).click();
  await dialog.getByLabel('Upload custom background').setInputFiles({
    name: 'innocent.png',
    mimeType: 'image/png',
    buffer: Buffer.from('<svg onload="alert(1)"/>'),
  });
  await expect(dialog.getByRole('alert')).toContainText('Unsupported');
  await dialog.getByLabel('Upload custom background').setInputFiles({
    name: 'large.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(dialog.getByRole('alert')).toContainText('5 MB');
  const malformed = Buffer.from(await readFile('tests/fixtures/background.png'));
  const idat = malformed.indexOf(Buffer.from('IDAT'));
  malformed.fill(0, idat + 4, idat + 12);
  await dialog
    .getByLabel('Upload custom background')
    .setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: malformed });
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Select custom image', exact: true }),
  ).toHaveCount(0);
  await dialog.getByLabel('Upload custom background').setInputFiles({
    name: '../../<script>.png',
    mimeType: 'application/octet-stream',
    buffer: await readFile('tests/fixtures/background.png'),
  });
  await expect(dialog.getByLabel('Upload custom background')).toBeEnabled();
  await expect(surface).toHaveAttribute('data-background', /^custom-/);
  await expect(
    dialog.getByRole('button', { name: 'Select custom image', exact: true }),
  ).toHaveCount(1);
  await dialog
    .getByLabel('Upload custom background')
    .setInputFiles('tests/fixtures/background.png');
  await expect(dialog.getByLabel('Upload custom background')).toBeEnabled();
  await expect(
    dialog.getByRole('button', { name: 'Select custom image', exact: true }),
  ).toHaveCount(1);
  await dialog
    .getByLabel('Upload custom background')
    .setInputFiles('tests/fixtures/background.gif');
  await expect(
    dialog.getByRole('button', { name: 'Select custom image', exact: true }),
  ).toHaveCount(2);
  await expect(dialog.getByText('Private · Animated')).toBeVisible();
  await expect(dialog.getByLabel('Upload custom background')).toBeEnabled();
  const frame = await surface.locator('img').getAttribute('src');
  await expect.poll(() => surface.locator('img').getAttribute('src')).not.toBe(frame);
  await dialog.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.screenshot({ path: '.local/validation/phase05-custom-desktop.png' });
  const selected = await surface.getAttribute('data-background');
  await dialog.getByRole('button', { name: 'Close backgrounds' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Enter room', exact: true }).click();
  await expect(surface).toHaveAttribute('data-background', selected!);
  await page.getByRole('button', { name: 'Background', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Favorite Cedar library', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByLabel('Background scope').selectOption('room');
  await dialog.getByRole('button', { name: 'Select Alpine stillness', exact: true }).click();
  await expect(surface).toHaveAttribute('data-background', 'alpine-lake');
  await dialog.getByLabel('Background scope').selectOption('personal');
  for (const [label, width, height] of [
    ['tablet', 768, 1024],
    ['mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    const filterWidth = await dialog
      .getByRole('button', { name: 'All', exact: true })
      .evaluate((e) => e.getBoundingClientRect().width);
    expect(filterWidth).toBeLessThan(100);
    expect(
      await dialog
        .locator('.background-star')
        .first()
        .evaluate((e) => e.getBoundingClientRect().width),
    ).toBeLessThan(70);
    await page.screenshot({ path: `.local/validation/phase05-selector-${label}.png` });
    await dialog.getByRole('button', { name: 'Close backgrounds' }).click();
    await page.screenshot({ path: `.local/validation/phase05-room-${label}.png` });
    if (label === 'mobile')
      await page.getByRole('button', { name: 'Hide panels →', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Background', exact: true }).click();
    for (const [title, id] of [
      ['Morning studio', 'morning-studio'],
      ['Cedar library', 'cedar-library'],
      ['After midnight', 'night-observatory'],
      ['Rain at the window', 'rainy-window'],
    ]) {
      await dialog.getByRole('button', { name: 'Select ' + title, exact: true }).click();
      await expect(surface).toHaveAttribute('data-background', id!);
      await dialog.getByRole('button', { name: 'Close backgrounds' }).click();
      await page.screenshot({ path: `.local/validation/phase05-${id}-${label}.png` });
      await page.getByRole('button', { name: 'Background', exact: true }).click();
    }
  }
  await dialog.getByRole('button', { name: 'Select custom image', exact: true }).last().click();
  await expect(surface).toHaveAttribute('data-background', /^custom-/);
  await dialog.getByRole('button', { name: 'Remove custom image', exact: true }).last().click();
  await expect(surface).toHaveAttribute('data-background', 'alpine-lake');
  await dialog.getByRole('button', { name: 'Close backgrounds' }).click();
  await page.getByRole('button', { name: 'Background', exact: true }).click();
  await dialog.getByRole('button', { name: 'Select custom image', exact: true }).click();
  await expect(surface).toHaveAttribute('data-background', /^custom-/);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('study-local-visuals');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['assets', 'metadata'], 'readwrite');
      tx.objectStore('assets').clear();
      tx.objectStore('metadata').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page.getByRole('button', { name: 'Enter room', exact: true }).click();
  await expect(surface).toHaveAttribute('data-background', 'alpine-lake');
  expect(await page.locator('audio,video').count()).toBe(0);
  expect(errors).toEqual([]);
});
