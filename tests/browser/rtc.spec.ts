import { expect, test } from '@playwright/test';
import { syntheticMedia } from './synthetic-media.ts';
test('synthetic mic, camera, screen lifecycle and responsive room evidence', async ({ page }) => {
  await syntheticMedia(page);
  await page.context().grantPermissions(['camera', 'microphone']);
  await page.addInitScript(() => {
    // Native OS picker cannot be driven portably. Only this test substitutes its returned stream.
    navigator.mediaDevices.getDisplayMedia = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });
      (window as unknown as { endShare: () => void }).endShare = () => {
        const t = stream.getVideoTracks()[0]!;
        t.stop();
        t.dispatchEvent(new Event('ended'));
      };
      return stream;
    };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/__test/rtc');
  await expect(page.locator('video,audio')).toHaveCount(0);
  await page.screenshot({ path: '.local/validation/phase06-off-desktop.png' });
  await page.getByRole('button', { name: 'Microphone off', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Microphone on', exact: true })).toBeVisible();
  await page.screenshot({ path: '.local/validation/phase06-mic-desktop.png' });
  await page.getByRole('button', { name: 'Camera off', exact: true }).click();
  await expect(page.locator('#participant-self video')).toHaveCount(1);
  await expect
    .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth))
    .toBeGreaterThan(0);
  await page.screenshot({ path: '.local/validation/phase06-camera-circle-desktop.png' });
  await page.locator('#participant-self').click();
  await page.getByRole('button', { name: 'Expand camera', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('video')).toHaveCount(1);
  await expect(page.locator('[data-avatar="self"]')).toHaveCount(1);
  await page.screenshot({ path: '.local/validation/phase06-camera-expanded-desktop.png' });
  await page.getByRole('button', { name: 'Close tile', exact: true }).click();
  await page.getByRole('button', { name: 'Screen Share off', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Move Screen share', exact: true })).toBeVisible();
  await expect(page.locator('video')).toHaveCount(2);
  await page.screenshot({ path: '.local/validation/phase06-screen-desktop.png' });
  for (const [name, width, height] of [
    ['tablet', 768, 1024],
    ['mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    if (width < 760) await page.getByRole('button', { name: 'Hide panels' }).click();
    await page.screenshot({ path: `.local/validation/phase06-screen-${name}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.evaluate(() => (window as unknown as { endShare: () => void }).endShare());
  await expect(page.getByRole('button', { name: 'Screen Share off', exact: true })).toBeVisible();
  await expect(page.locator('video')).toHaveCount(1);
  await page.getByRole('button', { name: 'Camera on', exact: true }).click();
  await expect(page.locator('video')).toHaveCount(0);
  await page.getByRole('button', { name: 'Microphone on', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Microphone off', exact: true })).toBeVisible();
});
test('permission denial and picker cancellation never retry automatically', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { calls: number }).calls = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      (window as unknown as { calls: number }).calls++;
      throw new DOMException('Denied', 'NotAllowedError');
    };
    navigator.mediaDevices.getDisplayMedia = async () => {
      (window as unknown as { calls: number }).calls++;
      throw new DOMException('Cancelled', 'NotAllowedError');
    };
  });
  await page.goto('/__test/rtc');
  expect(await page.evaluate(() => (window as unknown as { calls: number }).calls)).toBe(0);
  await page.getByRole('button', { name: 'Camera off', exact: true }).click();
  await expect(
    page.getByText('Permission denied or selection cancelled.', { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { calls: number }).calls)).toBe(1);
  await page.screenshot({ path: '.local/validation/phase06-permission-error.png' });
  await page.getByRole('button', { name: 'Screen Share off', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { calls: number }).calls)).toBe(2);
  await expect(page.locator('video,audio')).toHaveCount(0);
});
test('real application fails closed before any device prompt when media is disabled', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { captures: number }).captures = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      (window as unknown as { captures: number }).captures++;
      throw new Error('Must not acquire');
    };
  });
  await page.route('**/api/v1/rtc/join', async (route) => {
    const response = await route.fetch({ url: 'https://localhost:8449/__test/rtc-disabled/join' });
    expect(response.status()).toBe(404);
    await route.fulfill({ response });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL('/account');
  await page.goto('/rooms/new');
  await page.getByLabel('Room name').fill('RTC authorization check');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await page.getByRole('button', { name: 'Enter room', exact: true }).click();
  await page.getByRole('button', { name: 'Camera off', exact: true }).click();
  await expect(page.getByText('Media unavailable.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { captures: number }).captures)).toBe(0);
  await expect(page.locator('video,audio')).toHaveCount(0);
  await page.screenshot({ path: '.local/validation/phase06-real-room-unavailable.png' });
  await page.getByRole('button', { name: 'Dismiss notice' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByLabel('Voice preset').selectOption('high');
  const settings = (await page.locator('.more-popover').boundingBox())!;
  expect(settings.y).toBeGreaterThanOrEqual(0);
  expect(settings.y + settings.height).toBeLessThan(844);
});
test('multiple synthetic remote cameras and screen shares use the generic workspace', async ({
  page,
}) => {
  await syntheticMedia(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/__test/rtc');
  await page.evaluate(() =>
    (window as unknown as { addRemoteMedia: () => Promise<void> }).addRemoteMedia(),
  );
  await expect(page.locator('.participant-circle video')).toHaveCount(2);
  await expect(page.locator('.workspace-tile video')).toHaveCount(2);
  await page.locator('#participant-remote-one').click();
  await page.getByRole('button', { name: 'Expand camera', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-camera-renderer="remote-one"]')).toHaveCount(1);
  await expect(page.locator('#participant-remote-one [data-avatar]')).toHaveCount(1);
  await expect(page.locator('.workspace-tile video')).toHaveCount(3);
  await page.screenshot({ path: '.local/validation/phase06-multiple-synthetic-participants.png' });
});
