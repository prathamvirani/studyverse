import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

test('captures the accepted UI before the design refresh', async ({ page, browserName }) => {
  const directory = 'docs/references/mid00';
  await mkdir(directory, { recursive: true });
  const captures: object[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });

  async function capture(name: string, target: Page = page) {
    await target.evaluate(() => document.fonts.ready);
    await target.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
    captures.push({
      name,
      viewport: target.viewportSize(),
      route: new URL(target.url()).pathname.replace(/\/rooms\/[\da-f-]+$/, '/rooms/[fixture]'),
      ...(await target.evaluate(() => ({
        document: {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        },
        font: getComputedStyle(document.body).fontFamily,
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        nativeSelects: document.querySelectorAll('select').length,
        heroes: document.querySelectorAll('.hero').length,
      }))),
    });
  }

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await capture('auth-desktop');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL('/account');
  await expect(page.getByRole('button', { name: 'Reauthenticate with google' })).toBeVisible();
  await capture('account-desktop');
  await page.goto('/rooms/new');
  await expect(page.getByLabel('Room name')).toBeVisible();
  await page.getByLabel('Room name').fill('Quiet study baseline');
  await page.getByLabel('Description').fill('A shared space for reading and focused work.');
  await page.getByLabel('Tags').fill('reading, focus');
  await page.getByLabel('Privacy').selectOption('public');
  await capture('create-room-desktop');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Quiet study baseline', exact: true }),
  ).toBeVisible();
  const roomUrl = page.url();
  await capture('room-details-desktop');
  await page.getByRole('button', { name: 'Edit room', exact: true }).click();
  await expect(page.getByLabel('Room name')).toBeVisible();
  await capture('edit-room-desktop');

  for (const [route, name] of [
    ['/', 'home'],
    ['/my-rooms', 'my-rooms'],
    ['/discover', 'discover'],
  ] as const) {
    await page.goto(route);
    await expect(
      page.getByRole('heading', { name: 'Quiet study baseline', exact: true }).first(),
    ).toBeVisible();
    await capture(`${name}-desktop`);
  }
  await page.goto('/friends');
  await expect(page.getByRole('heading', { name: 'Your friends' })).toBeVisible();
  await capture('friends-desktop');

  await page.goto(roomUrl);
  await page.getByRole('button', { name: 'Enter room', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Room controls' })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('25:00');
  await expect(page.locator('.room-scene img').first()).toBeVisible();
  await capture('room-desktop');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await expect(page.getByLabel('Quality mode', { exact: true })).toBeEnabled();
  await capture('more-settings-desktop');
  await page.getByLabel('Quality mode', { exact: true }).selectOption('advanced');
  await capture('more-advanced-desktop');
  await page.getByRole('button', { name: 'Close more options' }).click();
  await page.getByRole('button', { name: 'Media', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Room media' });
  await expect(panel.getByText('You can control room playback.', { exact: false })).toBeVisible();
  await panel
    .getByLabel('YouTube video or Music link')
    .fill('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  await panel.getByRole('button', { name: 'Add to room', exact: true }).click();
  await expect(panel.locator('.media-queue')).toContainText('M7lc1UVf-VE');
  await capture('media-desktop');
  await page.setViewportSize({ width: 768, height: 1024 });
  await capture('media-tablet');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('media-mobile');
  await panel.getByRole('button', { name: 'Close media' }).click();
  await capture('room-mobile');
  await page.goto('/my-rooms');
  await expect(
    page.getByRole('heading', { name: 'Quiet study baseline', exact: true }),
  ).toBeVisible();
  await capture('my-rooms-mobile');
  await page.setViewportSize({ width: 3440, height: 1440 });
  await capture('my-rooms-ultrawide');

  expect(errors).toEqual([]);
  await writeFile(
    `${directory}/manifest.json`,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        browser: browserName,
        platform: process.platform,
        fixture:
          'Isolated study_test database, fake Google OAuth, no device capture or external player enabled. RTC harness uses quality stage A; normal deployment remains basic.',
        captures,
      },
      null,
      2,
    ) + '\n',
  );
});
