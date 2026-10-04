import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { ActivityView } from '@study/contracts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { refreshApi, refreshLogin, refreshRoom } from './refresh-helpers.ts';
import { providerMock } from './media-provider.ts';
import { syntheticMedia } from './synthetic-media.ts';
test.use({ actionTimeout: 10000 });
const tile = (page: Page) => page.locator('.workspace-tile[aria-label="Break activities"]');
async function open(page: Page) {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Advanced settings', exact: true }).click();
  await page.getByRole('button', { name: 'Break activities', exact: true }).click();
  await expect(tile(page).locator('.activity-panel')).toBeVisible();
  await expect(tile(page)).not.toContainText('Connecting');
}
async function snapshot(page: Page, roomId: string): Promise<ActivityView> {
  return refreshApi(page, `activities/snapshot?roomId=${roomId}`);
}
const revision = (view: ActivityView) => ({
  roomId: view.roomId,
  activityId: view.activity!.id,
  version: view.activity!.version,
  round: view.activity!.round,
  requestId: crypto.randomUUID(),
});
async function denied(page: Page, path: string, input: unknown) {
  return page.evaluate(
    async ({ path, input }) => {
      const csrf = await fetch('/api/v1/session/csrf').then((r) => r.json());
      const response = await fetch('/api/v1/' + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
        body: JSON.stringify(input),
      });
      return response.status;
    },
    { path, input },
  );
}
test('three clients synchronize word evaluation/completion while spectators and nonparticipants retain room controls', async ({
  browser,
}) => {
  test.setTimeout(150000);
  const contexts = await Promise.all(
      Array.from({ length: 3 }, () => browser.newContext({ ignoreHTTPSErrors: true })),
    ),
    pages = await Promise.all(contexts.map((c) => c.newPage())),
    [a, b, c] = pages as [Page, Page, Page];
  const errors: string[] = [];
  for (const page of pages) {
    page.on('pageerror', (e) => errors.push(e.message));
    await providerMock(page);
    await syntheticMedia(page);
    await refreshLogin(page);
  }
  try {
    const room = await refreshRoom(a, 'Word break');
    await a.getByRole('button', { name: 'Media', exact: true }).click();
    await a.getByLabel('YouTube URL').fill('https://youtu.be/M7lc1UVf-VE');
    await a.locator('.media-compact').getByRole('button', { name: 'Play', exact: true }).click();
    await expect(a.locator('.room-video')).toHaveAttribute('data-player-state', 'playing');
    await a.getByRole('button', { name: 'Media', exact: true }).click();
    await b.goto(`/rooms/${room.publicId}`);
    await c.goto(`/rooms/${room.publicId}`);
    for (const page of pages)
      await expect(page.getByRole('button', { name: 'Media', exact: true })).toBeVisible();
    await open(a);
    await tile(a).getByLabel('Seconds per turn').fill('180');
    await tile(a).getByRole('button', { name: 'Offer Letter Lantern' }).click();
    await expect.poll(async () => (await snapshot(a, room.id)).activity?.state).toBe('lobby');
    await open(b);
    await tile(b).getByRole('button', { name: 'Join activity', exact: true }).click();
    await expect
      .poll(async () => (await snapshot(b, room.id)).activity?.myMode)
      .toBe('participant');
    await open(c);
    await tile(c).getByRole('button', { name: 'Spectate activity', exact: true }).click();
    await expect.poll(async () => (await snapshot(c, room.id)).activity?.myMode).toBe('spectator');
    await expect(
      tile(a)
        .getByText(/spectator/)
        .first(),
    ).toBeVisible();
    await tile(a).getByRole('button', { name: 'Begin activity', exact: true }).click();
    await expect(tile(b).getByLabel('Activity guess')).toBeVisible();
    expect(JSON.stringify((await snapshot(b, room.id)).activity?.data)).not.toContain('reveal');
    await tile(b).getByLabel('Activity guess').fill('ZZZZZ');
    await tile(b).getByLabel('Activity guess').press('Enter');
    await expect(tile(a).locator('.word-guesses li')).toHaveCount(1);
    await expect(tile(c).locator('.word-guesses li')).toHaveCount(1);
    await expect(tile(b).getByLabel('Activity guess')).toBeFocused();
    mkdirSync('docs/references/phase11', { recursive: true });
    await b.screenshot({ path: 'docs/references/phase11/word-keyboard-guess.png' });
    const spectatorView = await snapshot(c, room.id);
    expect(
      await denied(c, 'activities/play', {
        ...revision(spectatorView),
        action: { type: 'guess', guess: 'APPLE' },
      }),
    ).toBe(403);
    await tile(c).getByRole('button', { name: 'Leave activity', exact: true }).click();
    await tile(c).getByRole('button', { name: 'Close tile', exact: true }).click();
    const restoreTasks = c.getByRole('button', { name: 'Restore Tasks', exact: true });
    if (await restoreTasks.count()) await restoreTasks.click();
    await c.getByLabel('New task', { exact: true }).fill('Keep studying');
    await c.getByLabel('New task', { exact: true }).press('Enter');
    await expect(
      c.getByRole('button', { name: 'Edit task title: Keep studying', exact: true }),
    ).toBeVisible();
    const restoreChat = c.getByRole('button', { name: 'Restore Chat', exact: true });
    if (await restoreChat.count()) await restoreChat.click();
    await c.getByLabel('Message', { exact: true }).fill('Still studying');
    await expect(c.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
    await c.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(c.locator('.chat-panel')).toContainText('Still studying');
    await c
      .locator('[data-card-type="pomodoro.panel"]')
      .getByRole('button', { name: 'Play timer', exact: true })
      .click();
    await expect
      .poll(async () => (await refreshApi(c, 'pomodoro/personal-snapshot')).state.running)
      .toBe(true);
    await c.getByRole('button', { name: 'Media', exact: true }).click();
    await c.getByRole('button', { name: 'Show video', exact: true }).click();
    await expect(c.locator('.room-video')).toHaveAttribute('data-player-state', 'playing');
    await c.getByRole('button', { name: 'Media', exact: true }).click();
    await c.locator('.media-compact').getByRole('radio', { name: 'Personal', exact: true }).click();
    await c.getByLabel('Mute room media locally').check();
    expect((await refreshApi(c, `room-media/snapshot?roomId=${room.id}`)).state.playing).toBe(true);
    await c
      .locator('.media-compact')
      .getByRole('radio', { name: 'Study Player', exact: true })
      .click();
    await c.getByLabel('Personal media URL').fill('https://youtu.be/M7lc1UVf-VE');
    await c.getByRole('button', { name: 'Open privately', exact: true }).click();
    await expect(
      c.locator('.workspace-tile[aria-label="Personal Study Player"] iframe'),
    ).toHaveCount(1);
    await c.getByRole('button', { name: 'Microphone off', exact: true }).click();
    await expect(c.getByRole('button', { name: 'Microphone on', exact: true })).toBeVisible();
    await c.getByRole('button', { name: 'Microphone on', exact: true }).click();
    await expect(c.getByRole('button', { name: 'Camera off', exact: true })).toBeVisible();
    await c.waitForTimeout(10000);
    for (const guess of ['XXXXX', 'VVVVV', 'JJJJJ', 'KKKKK', 'NNNNN']) {
      const current = await snapshot(b, room.id);
      await refreshApi(b, 'activities/play', {
        ...revision(current),
        action: { type: 'guess', guess },
      });
    }
    await expect.poll(async () => (await snapshot(a, room.id)).activity?.state).toBe('completed');
    await expect(tile(a)).toContainText('Word:');
    await expect(tile(b)).toContainText('Word:');
    expect(errors).toEqual([]);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});
test('drawing ownership, strokes, server guesses, timed turn, reconnect, responsive card and popout', async ({
  browser,
}) => {
  test.setTimeout(150000);
  const aContext = await browser.newContext({ ignoreHTTPSErrors: true }),
    bContext = await browser.newContext({ ignoreHTTPSErrors: true }),
    a = await aContext.newPage(),
    b = await bContext.newPage();
  try {
    await refreshLogin(a);
    const room = await refreshRoom(a, 'Sketch break');
    await refreshLogin(b);
    await b.goto(`/rooms/${room.publicId}`);
    await open(a);
    await tile(a).getByLabel('Seconds per turn').fill('30');
    await tile(a).getByRole('button', { name: 'Offer Sketch Circle' }).click();
    await expect.poll(async () => (await snapshot(a, room.id)).activity?.state).toBe('lobby');
    await open(b);
    await tile(b).getByRole('button', { name: 'Join activity', exact: true }).click();
    await expect(tile(a).getByText(/participant · 0 points/)).toHaveCount(2);
    await tile(a).getByRole('button', { name: 'Begin activity', exact: true }).click();
    await expect(tile(a).getByText('Your prompt:', { exact: false })).toBeVisible();
    const board = tile(a).locator('.drawing-board'),
      box = await board.boundingBox();
    expect(box).not.toBeNull();
    await a.mouse.move(box!.x + 25, box!.y + 25);
    await a.mouse.down();
    await a.mouse.move(box!.x + 100, box!.y + 80, { steps: 8 });
    await a.mouse.up();
    await expect(tile(b).locator('.drawing-board polyline')).toHaveCount(1);
    mkdirSync('docs/references/phase11', { recursive: true });
    await b.screenshot({ path: 'docs/references/phase11/sketch-shared-stroke.png' });
    const view = await snapshot(b, room.id);
    expect(view.activity?.data).not.toHaveProperty('prompt');
    expect(
      await denied(b, 'activities/play', {
        ...revision(view),
        action: { type: 'stroke', strokes: [{ color: 'ink', width: 4, points: [{ x: 0, y: 0 }] }] },
      }),
    ).toBe(403);
    const deadline = view.activity!.deadline;
    await b.reload();
    await open(b);
    expect((await snapshot(b, room.id)).activity!.deadline).toBe(deadline);
    await expect(tile(b).locator('.drawing-board polyline')).toHaveCount(1);
    // Wait for the actual server deadline, then recover the next authoritative drawer/round.
    await expect
      .poll(async () => (await snapshot(b, room.id)).activity?.round, {
        timeout: 45000,
        intervals: [1000],
      })
      .toBe(2);
    await expect(tile(b).getByText('Your prompt:', { exact: false })).toBeVisible();
    const drawer = await snapshot(b, room.id);
    const prompt = drawer.activity!.data.type === 'drawing' ? drawer.activity!.data.prompt! : '';
    await expect(tile(a).getByLabel('Activity guess', { exact: true })).toBeVisible();
    await tile(a).getByLabel('Activity guess', { exact: true }).fill(prompt);
    await tile(a).getByLabel('Activity guess', { exact: true }).press('Enter');
    await expect
      .poll(async () => (await snapshot(a, room.id)).activity?.members.some((m) => m.score === 100))
      .toBe(true);
    mkdirSync('docs/references/phase11', { recursive: true });
    for (const [width, height, label] of [
      [360, 800, 'mobile'],
      [768, 1024, 'tablet'],
      [1440, 1000, 'desktop'],
      [2560, 1080, 'ultrawide'],
    ] as const) {
      await a.setViewportSize({ width, height });
      await expect(tile(a)).toBeVisible();
      const cardBox = await tile(a).boundingBox(),
        railBox = await a.getByRole('complementary', { name: /^Participants/ }).boundingBox();
      expect(cardBox).not.toBeNull();
      expect(railBox).not.toBeNull();
      expect(cardBox!.x).toBeGreaterThanOrEqual(railBox!.x + railBox!.width);
      if (width === 360)
        expect(
          await tile(a)
            .getByRole('button', { name: 'Leave activity', exact: true })
            .evaluate((element) => element.getBoundingClientRect().height),
        ).toBeGreaterThanOrEqual(44);
      expect(
        await tile(a)
          .locator('.activity-panel')
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await a.screenshot({ path: `docs/references/phase11/sketch-${label}.png` });
    }
    await a.setViewportSize({ width: 1440, height: 1000 });
    const popupEvent = a.waitForEvent('popup');
    await tile(a).getByRole('button', { name: 'Pop out Break activities', exact: true }).click();
    const popup = await popupEvent;
    await expect(popup.locator('.activity-panel')).toBeVisible();
    const capture = await popup.context().newCDPSession(popup);
    try {
      const { data } = await capture.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync('docs/references/phase11/sketch-popout.png', Buffer.from(data, 'base64'));
    } finally {
      await capture.detach();
    }
    await popup.close();
    await expect(tile(a)).toBeVisible();
    await expect(a.getByRole('button', { name: 'Media', exact: true })).toBeVisible();
  } finally {
    await Promise.allSettled([aContext.close(), bContext.close()]);
  }
});
test('generic Pomodoro break suggestion is dismissible, preferences persist and never auto-start', async ({
  page,
}) => {
  test.setTimeout(100000);
  await refreshLogin(page);
  const room = await refreshRoom(page, 'Optional break');
  await open(page);
  await tile(page).getByRole('button', { name: 'Activity preferences', exact: true }).click();
  const preference = tile(page).getByLabel('Suggest activities during breaks');
  await expect(preference).toBeChecked();
  await tile(page).getByRole('button', { name: 'Close tile', exact: true }).click();
  await page.waitForTimeout(5500);
  let timing = await refreshApi(page, 'pomodoro/personal-snapshot');
  await refreshApi(page, 'pomodoro/personal-control', {
    version: timing.state.version,
    action: 'skip',
  });
  await expect(page.getByRole('status', { name: 'Optional break suggestion' })).toBeVisible({
    timeout: 12000,
  });
  expect((await snapshot(page, room.id)).activity).toBeNull();
  expect(await tile(page).count()).toBe(0);
  mkdirSync('docs/references/phase11', { recursive: true });
  await page.screenshot({ path: 'docs/references/phase11/optional-break-suggestion.png' });
  await page.setViewportSize({ width: 360, height: 800 });
  const suggestion = page.getByRole('status', { name: 'Optional break suggestion' });
  expect(
    await suggestion.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.left >= 0 &&
        rect.right <= innerWidth &&
        [...element.querySelectorAll('button')].every((button) => {
          const box = button.getBoundingClientRect();
          return (
            box.width >= 44 &&
            box.height >= 44 &&
            button.contains(
              document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
            )
          );
        })
      );
    }),
  ).toBe(true);
  await page.screenshot({ path: 'docs/references/phase11/optional-break-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Optional break suggestion' })).toHaveCount(0);
  await open(page);
  await tile(page).getByRole('button', { name: 'Activity preferences', exact: true }).click();
  await tile(page).getByLabel('Suggest activities during breaks').uncheck();
  await tile(page).getByLabel('Mute activity sounds').uncheck();
  await tile(page).getByRole('slider', { name: 'Activity SFX volume', exact: true }).fill('0.25');
  await tile(page).getByRole('button', { name: 'Preview activity sound' }).click();
  await page.reload();
  await open(page);
  await tile(page).getByRole('button', { name: 'Activity preferences', exact: true }).click();
  await expect(tile(page).getByLabel('Suggest activities during breaks')).not.toBeChecked();
  await expect(
    tile(page).getByRole('slider', { name: 'Activity SFX volume', exact: true }),
  ).toHaveValue('0.25');
  timing = await refreshApi(page, 'pomodoro/personal-snapshot');
  await refreshApi(page, 'pomodoro/personal-control', {
    version: timing.state.version,
    action: 'reset',
  });
  await page.waitForTimeout(5500);
  timing = await refreshApi(page, 'pomodoro/personal-snapshot');
  await refreshApi(page, 'pomodoro/personal-control', {
    version: timing.state.version,
    action: 'skip',
  });
  await page.waitForTimeout(6500);
  await expect(page.getByRole('status', { name: 'Optional break suggestion' })).toHaveCount(0);
  expect((await snapshot(page, room.id)).activity).toBeNull();
});
