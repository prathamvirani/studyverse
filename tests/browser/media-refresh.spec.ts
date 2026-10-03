import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { providerMock } from './media-provider.ts';
import { refreshApi, refreshCapture, refreshLogin, refreshRoom } from './refresh-helpers.ts';
test('blocked autoplay offers one local Play gesture while authority and provider identity remain stable', async ({
  page,
}) => {
  await providerMock(page, true);
  await refreshLogin(page);
  const room = await refreshRoom(page, 'Autoplay fallback');
  await page.getByRole('button', { name: 'Media', exact: true }).click();
  const main = page.locator('.media-compact');
  await main.getByLabel('YouTube URL').fill('M7lc1UVf-VE');
  await main.getByRole('button', { name: 'Play', exact: true }).click();
  const video = page.locator('.room-video');
  await expect(video).toContainText('Playback needs your permission. Press Play.');
  const before = await refreshApi(page, `room-media/snapshot?roomId=${room.id}`);
  expect(before.state.playing).toBe(true);
  await video.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(video).toHaveAttribute('data-player-state', 'playing');
  await expect(video.getByRole('button', { name: 'Play', exact: true })).toHaveCount(0);
  expect((await refreshApi(page, `room-media/snapshot?roomId=${room.id}`)).version).toBe(
    before.version,
  );
  expect(
    await page.evaluate(() => (window as unknown as { mediaTest: unknown[] }).mediaTest.length),
  ).toBe(1);
});
test('media metadata, reorder, immediate mixer, late join and collapsed playback retain one owner', async ({
  browser,
}) => {
  test.setTimeout(100000);
  const a = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
  });
  const b = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
  });
  const owner = await a.newPage(),
    member = await b.newPage();
  await providerMock(owner);
  await providerMock(member);
  const errors: string[] = [];
  owner.on('pageerror', (e) => errors.push(e.message));
  member.on('pageerror', (e) => errors.push(e.message));
  try {
    await refreshLogin(owner);
    const room = await refreshRoom(owner, 'Media refresh');
    const main = owner.locator('.media-compact');
    await owner.getByRole('button', { name: 'Media', exact: true }).click();
    await main.getByLabel('YouTube URL').fill('https://youtu.be/M7lc1UVf-VE');
    await main.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(owner.locator('.room-video')).toHaveAttribute('data-player-state', 'playing');
    await owner.evaluate(() =>
      Object.assign(window, {
        mediaRefreshFrame: document.querySelector('.youtube-host iframe'),
        mediaRefreshTimer: document.querySelector('.pomodoro-timer'),
      }),
    );
    await owner.getByRole('button', { name: 'Media', exact: true }).click();
    await expect(
      main.getByRole('heading', {
        name: 'YouTube Developers Live: Embedded Web Player Customization',
      }),
    ).toBeVisible();
    await expect(main.locator('.media-queue')).not.toContainText('M7lc1UVf-VE');
    for (const id of ['abcdefghijk', '12345678901']) {
      await main.getByRole('button', { name: 'Add media', exact: true }).click();
      await main.getByLabel('YouTube URL').fill(id);
      await main.getByRole('button', { name: 'Queue', exact: true }).click();
    }
    await expect(main.locator('.media-queue li')).toHaveCount(3);
    await expect(main.locator('.media-queue')).toContainText('Unavailable');
    await main.getByRole('button', { name: 'Move queue item 3 up', exact: true }).click();
    await expect(main.locator('.media-queue li').nth(1)).toContainText('A quiet study session');
    await main.getByRole('button', { name: 'Remove queue item 3', exact: true }).click();
    await expect(main.locator('.media-queue li')).toHaveCount(2);
    await main.getByRole('slider', { name: 'Playback position', exact: true }).fill('40');
    await main
      .getByRole('slider', { name: 'Playback position', exact: true })
      .dispatchEvent('change');
    await expect
      .poll(
        async () =>
          (await refreshApi(owner, `room-media/snapshot?roomId=${room.id}`)).state.position,
      )
      .toBe(40);
    await main.getByRole('button', { name: 'Add ambience', exact: true }).click();
    await main.getByRole('button', { name: /Soft rain Filtered/ }).click();
    await main.getByRole('slider', { name: 'Room Soft rain', exact: true }).fill('0.2');
    await main.getByRole('slider', { name: 'Room Soft rain', exact: true }).fill('0.7');
    await expect
      .poll(
        async () =>
          (await refreshApi(owner, `room-media/snapshot?roomId=${room.id}`)).state.mix.ambience
            .rain,
      )
      .toBe(0.7);
    await main.getByRole('button', { name: 'Mute Soft rain', exact: true }).click();
    await expect(main.getByRole('button', { name: 'Unmute Soft rain', exact: true })).toBeVisible();
    await main.getByRole('button', { name: 'Unmute Soft rain', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await refreshApi(owner, `room-media/snapshot?roomId=${room.id}`)).state.mix.ambience
            .rain,
      )
      .toBe(0.7);
    mkdirSync('docs/references/mid06', { recursive: true });
    await refreshCapture(owner, 'docs/references/mid06/media-mixer.png');
    await main.evaluate((el) => {
      el.scrollTop = 0;
    });
    await refreshCapture(owner, 'docs/references/mid06/media-desktop.png');
    await owner.keyboard.press('Escape');
    const tile = owner.getByRole('article', { name: 'Room YouTube', exact: true });
    await tile.getByRole('button', { name: 'Minimize tile', exact: true }).click();
    await expect(owner.locator('.youtube-host iframe')).toBeVisible();
    const prior = Number(await owner.locator('.room-video').getAttribute('data-player-position'));
    await expect
      .poll(
        async () => Number(await owner.locator('.room-video').getAttribute('data-player-position')),
        { timeout: 12000 },
      )
      .toBeGreaterThan(prior + 5);
    await tile.getByRole('button', { name: 'Open player', exact: true }).click();
    await refreshLogin(member, 'Discord');
    await member.goto(`/rooms/${room.publicId}`);
    await member.getByRole('button', { name: 'Media', exact: true }).click();
    const remote = member.locator('.media-compact');
    await expect(remote.locator('.media-queue li')).toHaveCount(2);
    await remote.getByRole('button', { name: 'Show video', exact: true }).click();
    await expect(member.locator('.room-video')).toHaveAttribute('data-player-state', 'playing');
    await owner.getByRole('button', { name: 'Media', exact: true }).click();
    await main.getByRole('button', { name: 'Pause room', exact: true }).click();
    await expect(member.locator('.room-video')).toHaveAttribute('data-player-state', 'paused');
    await main.getByRole('button', { name: 'Play room', exact: true }).click();
    await expect(member.locator('.room-video')).toHaveAttribute('data-player-state', 'playing');
    await owner.context().setOffline(true);
    await owner.context().setOffline(false);
    await owner.getByRole('button', { name: 'Media', exact: true }).click();
    await expect(main.locator('.media-queue li')).toHaveCount(2);
    await main.getByRole('button', { name: 'Remove Soft rain', exact: true }).click();
    await expect(main.getByRole('slider', { name: 'Room Soft rain', exact: true })).toHaveCount(0);
    await owner.setViewportSize({ width: 390, height: 844 });
    expect(await main.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await refreshCapture(owner, 'docs/references/mid06/media-narrow.png');
    expect(
      await owner.evaluate(() => {
        const w = window as unknown as {
          mediaRefreshFrame: Element;
          mediaRefreshTimer: Element;
          mediaTest: unknown[];
        };
        return {
          sameFrame: w.mediaRefreshFrame === document.querySelector('.youtube-host iframe'),
          sameTimer: w.mediaRefreshTimer === document.querySelector('.pomodoro-timer'),
          mounts: w.mediaTest.length,
        };
      }),
    ).toEqual({ sameFrame: true, sameTimer: true, mounts: 1 });
    expect(errors).toEqual([]);
  } finally {
    await Promise.allSettled([a.close(), b.close()]);
  }
});
