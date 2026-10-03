import { providerMock } from './media-provider.ts';
import { hideWorkspaceCards } from './room-settings.ts';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { finishOnboarding } from './onboarding.ts';
import { mkdirSync, writeFileSync } from 'node:fs';

async function api(page: Page, path: string, input?: unknown) {
  return page.evaluate(
    async ({ path, input }) => {
      const csrf = await fetch('/api/v1/session/csrf').then((r) => r.json());
      const response = await fetch(
        '/api/v1/' + path,
        input === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
              body: JSON.stringify(input),
            },
      );
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      return response.json();
    },
    { path, input },
  );
}
async function login(page: Page) {
  await page.goto('/home');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
}

test('three accounts with private external room disclosure see exactly three active room participants', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const contexts = await Promise.all(
    Array.from({ length: 3 }, () =>
      browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } }),
    ),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  try {
    for (const p of pages) {
      await login(p);
      await api(p, 'friends/privacy', {
        online: false,
        room: false,
        study: false,
        join: false,
        invites: true,
      });
    }
    const room = await api(pages[0]!, 'rooms/create', {
      name: 'Three active members',
      privacy: 'public',
    });
    for (const p of pages) {
      await p.goto(`/rooms/${room.publicId}`);
      await expect(p.locator('.room-dock')).toBeVisible();
    }
    for (const p of pages) await expect(p.locator('.participant-entry')).toHaveCount(3);
    await contexts[2]!.setOffline(true);
    await contexts[2]!.setOffline(false);
    for (const p of pages) await expect(p.locator('.participant-entry')).toHaveCount(3);
    await pages[2]!.getByRole('button', { name: 'Back to room details' }).click();
    for (const p of pages.slice(0, 2)) await expect(p.locator('.participant-entry')).toHaveCount(2);
  } finally {
    for (const c of contexts) await c.close();
  }
});

test('rearrange snaps, boundary popout targets and utility controls keep one room and media owner', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() =>
    Object.defineProperty(window, 'documentPictureInPicture', {
      value: undefined,
      configurable: true,
    }),
  );
  await providerMock(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  const room = await api(page, 'rooms/create', { name: 'One workspace owner', privacy: 'public' });
  await page.goto(`/rooms/${room.publicId}`);
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Rearrange view', exact: true }).click();
  const header = page.getByRole('button', { name: 'Move room header' });
  await header.focus();
  await header.press('Alt+ArrowRight');
  await expect(page.locator('.room-shell')).toHaveAttribute('data-header-slot', '1');
  await page.getByRole('button', { name: 'Move participants' }).press('ArrowDown');
  await expect(page.locator('.room-shell')).toHaveAttribute('data-rail-edge', 'bottom');
  await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.screenshot({ path: 'docs/references/mid04a/room-1440x1000-fresh.png' });
  const timer = page.locator('[data-card-type="pomodoro.panel"]');
  await timer.getByRole('button', { name: 'Unsnap card' }).click();
  await timer.getByRole('button', { name: 'Move Pomodoro' }).press('ArrowLeft');
  const resize = timer.getByRole('button', { name: 'Resize tile', exact: true });
  const start = await timer.boundingBox(),
    handle = (await resize.boundingBox())!;
  await page.mouse.move(handle.x + 6, handle.y + 6);
  await page.mouse.down();
  await page.mouse.move(1800, 1200, { steps: 5 });
  await page.mouse.up();
  const end = await timer.boundingBox();
  expect(end!.x).toBe(start!.x);
  expect(end!.y).toBe(start!.y);
  const utilityPromise = page.waitForEvent('popup');
  await timer.getByRole('button', { name: 'Pop out Pomodoro', exact: true }).click();
  const utility = await utilityPromise;
  let extraSockets = 0;
  utility.on('websocket', () => extraSockets++);
  await expect(utility.getByRole('timer')).toBeVisible();
  await utility.getByRole('button', { name: 'Play timer', exact: true }).click();
  await expect(utility.getByRole('button', { name: 'Pause timer', exact: true })).toBeVisible();
  await utility.close();
  await expect(timer.getByRole('button', { name: 'Pause timer', exact: true })).toBeVisible();
  await hideWorkspaceCards(page);
  await page.getByRole('button', { name: 'Media', exact: true }).click();
  await page.getByRole('textbox', { name: 'YouTube URL', exact: true }).fill('M7lc1UVf-VE');
  await page
    .getByRole('region', { name: 'Media', exact: true })
    .getByRole('button', { name: 'Play', exact: true })
    .click();
  await expect(page.locator('.youtube-host iframe')).toHaveCount(1);
  await page.evaluate(() =>
    Object.assign(window, { samePlayer: document.querySelector('.youtube-host iframe') }),
  );
  const mediaPopup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Pop out Room YouTube', exact: true }).click();
  const controller = await mediaPopup;
  controller.on('websocket', () => extraSockets++);
  await expect(controller.getByRole('heading', { name: 'Room media' })).toBeVisible();
  await expect(controller.locator('iframe')).toHaveCount(0);
  await controller.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('.room-video')).toHaveAttribute('data-player-state', 'paused');
  expect(
    await page.evaluate(
      () =>
        document.querySelector('.youtube-host iframe') ===
        (window as unknown as { samePlayer: Element }).samePlayer,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => (window as unknown as { mediaTest: unknown[] }).mediaTest.length),
  ).toBe(1);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Pop out all', exact: true }).click();
  await expect.poll(() => page.context().pages().length).toBe(4);
  const companions = page
    .context()
    .pages()
    .filter((p) => p !== page && p !== controller);
  await expect(companions[0]!.locator('.participant-rail')).toBeVisible();
  await expect(companions[1]!.getByRole('button', { name: 'More', exact: true })).toBeVisible();
  await companions[1]!.getByRole('button', { name: 'More', exact: true }).click();
  await companions[1]!.getByRole('button', { name: 'Restore all', exact: true }).click();
  await expect.poll(() => page.context().pages().length).toBe(1);
  expect(extraSockets).toBe(0);
  if (!controller.isClosed()) await controller.close();
  await expect(page.locator('.youtube-host iframe')).toHaveCount(1);
});

test('room feature nodes and wallpaper survive snapshot traffic and transport recovery', async ({
  page,
}) => {
  test.setTimeout(150000);
  mkdirSync('.local/validation/mid04a', { recursive: true });
  const closes: string[] = [];
  page.on('websocket', (socket) =>
    socket.on('close', () => closes.push(new URL(socket.url()).pathname)),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await providerMock(page);
  await login(page);
  const room = await api(page, 'rooms/create', { name: 'Stable composition', privacy: 'public' });
  await page.goto(`/rooms/${room.publicId}`);
  await expect(page.getByRole('timer')).toBeVisible();
  const chat = page.locator('[data-card-type="chat.panel"]');
  await chat.getByRole('textbox').fill('Draft must survive');
  await page.getByRole('button', { name: 'Play timer', exact: true }).click();
  await page.getByRole('button', { name: 'Media', exact: true }).click();
  const compact = page.getByRole('region', { name: 'Media', exact: true });
  await page.getByRole('textbox', { name: 'YouTube URL', exact: true }).fill('M7lc1UVf-VE');
  await compact.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.youtube-host iframe')).toHaveCount(1);
  await page.getByRole('button', { name: 'Background', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Backgrounds', exact: true });
  await sheet.getByRole('combobox', { name: 'Background scope' }).click();
  await page.getByRole('option', { name: 'Room default', exact: true }).click();
  await sheet
    .getByRole('button', { name: /Select .+/ })
    .first()
    .click();
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const nodes = Object.fromEntries(
      [
        '.room-shell',
        '.workspace-surface',
        '.pomodoro-timer',
        '.chat-list',
        '.environment-surface',
        '.youtube-host iframe',
      ].map((s) => [s, document.querySelector(s)]),
    );
    Object.assign(window, { roomBaselineNodes: nodes });
  });
  await api(page, 'rooms/join', { roomId: room.id });
  for (let n = 0; n < 13; n++) {
    await page.waitForTimeout(5000);
    await api(page, 'rooms/join', { roomId: room.id });
    await api(page, 'chat/send', {
      roomId: room.id,
      text: 'Snapshot traffic ' + n,
      requestId: crypto.randomUUID(),
    });
  }
  await page.context().setOffline(true);
  await page.waitForTimeout(1500);
  await page.context().setOffline(false);
  await page.waitForTimeout(6500);
  await expect(page.getByRole('timer')).toBeVisible();
  const stable = await page.evaluate(() =>
    Object.entries(
      (window as unknown as { roomBaselineNodes: Record<string, Element> }).roomBaselineNodes,
    ).map(([s, n]) => ({ selector: s, same: n === document.querySelector(s) })),
  );
  writeFileSync(
    '.local/validation/mid04a/runtime-result.json',
    JSON.stringify({ stable, closes }, null, 2),
  );
  expect(stable.every((n) => n.same)).toBe(true);
  await expect(chat.getByRole('textbox')).toHaveValue('Draft must survive');
  expect(
    await page.evaluate(() => (window as unknown as { mediaTest: unknown[] }).mediaTest.length),
  ).toBe(1);
  await page.screenshot({ path: 'docs/references/mid04a/runtime-desktop.png' });
});

test('native Document Picture-in-Picture adopts and restores the existing timer without a second owner', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  const room = await api(page, 'rooms/create', { name: 'Native utility', privacy: 'public' });
  let admissions = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/rtc/join') admissions++;
  });
  await page.goto(`/rooms/${room.publicId}`);
  await expect(page.getByRole('button', { name: 'Play timer', exact: true })).toBeEnabled();
  await expect.poll(() => admissions).toBe(1);
  await page.evaluate(() =>
    Object.assign(window, {
      nativeTimer: document.querySelector('[data-card-type="pomodoro.panel"]'),
    }),
  );
  await page.getByRole('button', { name: 'Pop out Pomodoro', exact: true }).click();
  const state = () =>
    page.evaluate(() => {
      const pip = (
        window as unknown as Window & {
          documentPictureInPicture: { window: Window | null };
          nativeTimer: Element;
        }
      ).documentPictureInPicture.window;
      return {
        open: !!pip,
        same:
          pip?.document.querySelector('[data-card-type="pomodoro.panel"]') ===
          (window as unknown as { nativeTimer: Element }).nativeTimer,
        owners: document.querySelectorAll('.room-shell:not(.popout-stage)').length,
      };
    });
  await expect.poll(state).toEqual({ open: true, same: true, owners: 1 });
  await page.evaluate(() => {
    const pip = (window as unknown as Window & { documentPictureInPicture: { window: Window } })
      .documentPictureInPicture.window;
    pip.document.querySelector<HTMLButtonElement>('[aria-label="Play timer"]')!.click();
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const pip = (window as unknown as Window & { documentPictureInPicture: { window: Window } })
          .documentPictureInPicture.window;
        return (
          !!pip.document.querySelector('[aria-label="Pause timer"]') &&
          pip.document.documentElement.getAttribute('data-theme') === 'dark'
        );
      }),
    )
    .toBe(true);
  expect(admissions).toBe(1);
  await page.evaluate(() =>
    (
      window as unknown as Window & { documentPictureInPicture: { window: Window } }
    ).documentPictureInPicture.window.close(),
  );
  await expect(page.getByRole('button', { name: 'Pause timer', exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.querySelector('[data-card-type="pomodoro.panel"]') ===
        (window as unknown as { nativeTimer: Element }).nativeTimer,
    ),
  ).toBe(true);
});
