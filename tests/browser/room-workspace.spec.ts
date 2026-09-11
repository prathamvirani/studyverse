import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { syntheticMedia } from './synthetic-media.ts';
async function enter(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Continue with Microsoft' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL('/account');
  await page.goto('/rooms/new');
  await page.getByLabel('Room name').fill('The quiet hours');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await page.getByRole('button', { name: 'Enter room', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Room controls' })).toBeVisible();
}
async function openTile(page: Page) {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Open workspace guide', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Move Workspace guide' })).toBeVisible();
}
test('a room-entry response arriving after navigation cannot reopen media or the room', async ({
  page,
}) => {
  await enter(page);
  await page.getByRole('button', { name: 'Back to room details' }).click();
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted!: () => void;
  const waiting = new Promise<void>((resolve) => {
    intercepted = resolve;
  });
  await page.route('**/api/v1/rooms/join', async (route) => {
    const response = await route.fetch();
    intercepted();
    await delayed;
    await route.fulfill({ response });
  });
  let mediaJoins = 0;
  await page.route('**/api/v1/rtc/join', async (route) => {
    mediaJoins++;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Enter room', exact: true }).click();
  await waiting;
  await page.getByRole('link', { name: '← My Rooms', exact: true }).click();
  await expect(page).toHaveURL('/my-rooms');
  const response = page.waitForResponse('**/api/v1/rooms/join');
  release();
  await response;
  // Allow the retired component's promise continuation and any resulting admission request to run.
  await page.waitForTimeout(300);
  expect(mediaJoins).toBe(0);
  await expect(page.locator('.room-shell')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'My Rooms', exact: true })).toBeVisible();
});
test('canonical room, tile pointer/keyboard lifecycle and device-local persistence', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enter(page);
  expect(await page.locator('.productivity-rail summary').allTextContents()).toEqual([
    'Pomodoro⌄',
    'Tasks⌄',
    'Chat⌄',
  ]);
  expect(await page.locator('.room-dock small').allTextContents()).toEqual([
    'Media',
    'Background',
    'Microphone',
    'Camera',
    'Screen Share',
    'More',
  ]);
  await expect(page.locator('.workspace-tile')).toHaveCount(0);
  await page.screenshot({ path: '.local/validation/phase02-desktop.png' });
  await openTile(page);
  const move = page.getByRole('button', { name: 'Move Workspace guide' }),
    tile = page.locator('[data-workspace-id]');
  const handle = (await move.boundingBox())!;
  await page.mouse.move(handle.x + 60, handle.y + 18);
  await page.mouse.down();
  await page.mouse.move(handle.x + 190, handle.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect(tile).toHaveCSS('left', '130px');
  const resize = page.getByRole('button', { name: 'Resize tile' }),
    grip = (await resize.boundingBox())!;
  await page.mouse.move(grip.x + 8, grip.y + 8);
  await page.mouse.down();
  await page.mouse.move(grip.x + 72, grip.y + 56, { steps: 8 });
  await page.mouse.up();
  await resize.focus();
  await page.keyboard.press('ArrowRight');
  const before = await tile.getAttribute('style');
  await page.locator('summary').filter({ hasText: 'Tasks' }).click();
  // Wait for the actual IndexedDB commit, not a fixed delay.
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          new Promise<number>((resolve) => {
            const request = indexedDB.open('study-preferences-v1');
            request.onsuccess = () => {
              const db = request.result,
                read = db
                  .transaction('preferences')
                  .objectStore('preferences')
                  .get('room-layout.' + location.pathname.split('/').at(-1));
              read.onsuccess = () => {
                resolve(
                  [read.result].filter((v) =>
                    v?.value.tiles.some((t: { layout: { x: number } }) => t.layout.x === 130),
                  ).length,
                );
                db.close();
              };
            };
          }),
      ),
    )
    .toBeGreaterThan(0);
  await page.reload();
  await page.getByRole('button', { name: 'Enter room', exact: true }).click();
  await expect(tile).toHaveAttribute('style', before!);
  await expect(
    page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Tasks' }) }),
  ).not.toHaveAttribute('open');
  await page.getByRole('button', { name: 'Fullscreen tile', exact: true }).click();
  await expect(tile).toHaveClass(/tile-fullscreen/);
  await page.keyboard.press('Escape');
  await expect(tile).not.toHaveClass(/tile-fullscreen/);
  await page.getByRole('button', { name: 'Minimize tile' }).click();
  await expect(tile).toHaveCount(0);
  await page.getByRole('button', { name: 'Restore Workspace guide' }).click();
  await expect(tile).toHaveCount(1);
  await page.screenshot({ path: '.local/validation/phase02-workspace.png' });
  await page.getByRole('button', { name: 'Close tile' }).click();
  await expect(tile).toHaveCount(0);
});
test('camera owns one renderer, returns on minimize/close, and remains off after reload', async ({
  page,
}) => {
  // Phase 06 replaces the inert demo with the same shell and real synthetic browser tracks.
  await syntheticMedia(page);
  await page.context().grantPermissions(['camera', 'microphone']);
  await page.goto('/__test/rtc');
  const renderer = page.locator('[data-camera-renderer="self"]');
  await expect(renderer).toHaveCount(0);
  await page.getByRole('button', { name: 'Camera off', exact: true }).click();
  await expect(renderer).toHaveCount(1);
  await page.evaluate(() => {
    (window as unknown as { cameraNode: Element | null }).cameraNode = document.querySelector(
      '[data-camera-renderer="self"]',
    );
  });
  await page.locator('#participant-self').click();
  await page.getByRole('button', { name: 'Expand camera', exact: true }).click();
  await expect(page.locator('[data-avatar="self"]')).toHaveCount(1);
  await expect(renderer).toHaveCount(1);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { cameraNode: Element | null }).cameraNode ===
        document.querySelector('[data-camera-renderer="self"]'),
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Minimize tile' }).click();
  await expect(renderer).toHaveCount(1);
  await expect(page.locator('#participant-self [data-camera-renderer]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Restore Camera' }).click();
  await expect(renderer).toHaveCount(1);
  await page.getByRole('button', { name: 'Close tile' }).click();
  await expect(renderer).toHaveCount(1);
  await page.reload();
  await expect(renderer).toHaveCount(0);
});
test('tablet/mobile, keyboard focus, reduced motion and corrupt layout recovery', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 768, height: 1024 });
  await enter(page);
  await page.screenshot({ path: '.local/validation/phase02-tablet.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Hide panels' }).click();
  await page.screenshot({ path: '.local/validation/phase02-mobile.png' });
  const dockBox = (await page.locator('.room-dock').boundingBox())!;
  const moreBox = (await page.getByRole('button', { name: 'More', exact: true }).boundingBox())!;
  expect(moreBox.x + moreBox.width).toBeGreaterThan(dockBox.x + dockBox.width - 12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page.locator('.room-scene').evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0s');
  await page.locator('#participant-self').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Close participant controls' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#participant-self')).toBeFocused();
  await openTile(page);
  await page.getByRole('button', { name: 'Resize tile' }).focus();
  await page.keyboard.press('ArrowDown');
  const box = (await page.locator('.workspace-tile').boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '.local/validation/phase02-mobile-workspace.png' });
  await page.evaluate(
    async () =>
      new Promise<void>((resolve) => {
        const request = indexedDB.open('study-preferences-v1');
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction('preferences', 'readwrite'),
            store = tx.objectStore('preferences'),
            keys = store.getAllKeys();
          keys.onsuccess = () => {
            for (const key of keys.result)
              store.put({ version: 1, value: { tiles: 'corrupt', isOwner: true } }, key);
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Enter room', exact: true }).click();
  await expect(page.locator('.workspace-tile')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Room controls' })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 568 });
  for (const button of await page.locator('.room-dock button').all()) {
    const rect = (await button.boundingBox())!;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(320);
  }
});
