import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { finishOnboarding } from './onboarding.ts';
import { roomSettings } from './room-settings.ts';
import { mkdirSync } from 'node:fs';
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
async function login(page: Page, provider = 'Google') {
  await page.goto('/home');
  await page.getByRole('button', { name: `Continue with ${provider}` }).click();
  await finishOnboarding(page);
}
async function enter(page: Page) {
  await login(page);
  const room = await api(page, 'rooms/create', { name: 'The quiet hours', privacy: 'public' });
  await page.goto(`/rooms/${room.id}?enter=1`);
  await expect(page.locator('.room-dock')).toBeVisible();
  return room;
}
test('independent cards, snap preview, keyboard, persistence, settings and presentation recovery', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enter(page);
  await expect(page.locator('.workspace-card')).toHaveCount(4);
  await expect(page.getByRole('timer')).toBeVisible();
  await page.screenshot({
    path: 'docs/references/mid04a/room-1440x1000-fresh.png',
    animations: 'disabled',
  });
  await expect(page.locator('.productivity-rail')).toHaveCount(0);
  await expect(page.locator('.app-navigation')).toHaveCount(0);
  await expect(page.locator('.room-title')).toContainText('public');
  const chat = page.locator('[data-card-type="chat.panel"]');
  await chat.getByRole('button', { name: 'Unsnap card' }).click();
  const move = chat.getByRole('button', { name: 'Move Chat', exact: true });
  await move.focus();
  await page.keyboard.press('ArrowLeft');
  const before = await chat.evaluate((el) => parseFloat((el as HTMLElement).style.left));
  await page.keyboard.press('Shift+ArrowLeft');
  expect(await chat.evaluate((el) => parseFloat((el as HTMLElement).style.left))).toBe(before - 32);
  const box = (await move.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 15);
  await page.mouse.down();
  await page.mouse.move(1390, 220, { steps: 6 });
  await expect(page.locator('.snap-preview')).toHaveCount(1);
  await page.mouse.up();
  await expect(chat).toHaveClass(/tile-snapped/);
  await chat.getByRole('button', { name: 'Minimize tile' }).click();
  await expect(chat).toBeHidden();
  await page.getByRole('button', { name: 'Restore Chat', exact: true }).click();
  await expect(chat).toHaveCount(1);
  await page.getByRole('button', { name: 'Workspace cards' }).click();
  await page
    .getByRole('region', { name: 'Workspace cards' })
    .getByLabel('Tasks', { exact: true })
    .uncheck();
  await page.getByRole('button', { name: 'Workspace cards' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          new Promise<boolean>((resolve) => {
            const request = indexedDB.open('study-preferences-v1');
            request.onsuccess = () => {
              const db = request.result;
              const read = db.transaction('preferences').objectStore('preferences').getAll();
              read.onsuccess = () => {
                resolve(
                  read.result.some(
                    (v) => v.value?.panels?.initialized && v.value.panels['tasks.panel'] === false,
                  ),
                );
                db.close();
              };
            };
          }),
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(page.locator('.room-dock')).toBeVisible();
  await expect(page.locator('[data-card-type="tasks.panel"]')).toBeHidden();
  await expect(page.locator('[data-card-type="chat.panel"]')).toHaveClass(/tile-snapped/);
  const sheet = await roomSettings(page, 'Appearance');
  await sheet.getByRole('radio', { name: 'Light', exact: true }).click();
  await sheet.getByLabel('Manual fill', { exact: true }).fill('100');
  const transparent = await page
    .locator('.room-dock')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  await sheet.getByLabel('Manual fill', { exact: true }).fill('0');
  expect(
    await page.locator('.room-dock').evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe(transparent);
  await sheet.getByRole('button', { name: 'Auto Recommended' }).click();
  await sheet.getByRole('combobox', { name: 'Presentation preset' }).click();
  await sheet.getByRole('option', { name: 'Projector', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();
  await expect(page.locator('.room-dock')).not.toBeVisible();
  await page.screenshot({ path: 'docs/references/mid04a/projector.png', animations: 'disabled' });
  await page.getByRole('button', { name: /Reveal controls/ }).click();
  await expect(page.locator('.room-dock')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.room-shell')).not.toHaveClass(/room-projector/);
  await expect(page.getByRole('button', { name: 'More', exact: true })).toBeFocused();
  await roomSettings(page);
  await sheet.getByRole('button', { name: 'Close room settings' }).focus();
  await page.keyboard.press('Shift+Tab');
  expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.mouse.click(3, 3);
  await expect(sheet).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'More', exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});
test('room geometry, atmosphere and settings at ultrawide, mobile, short heights and zoom-equivalent reflow', async ({
  page,
}) => {
  test.setTimeout(90000);
  await enter(page);
  mkdirSync('docs/references/mid04a', { recursive: true });
  for (const [width, height] of [
    [3440, 1440],
    [1440, 900],
    [820, 1024],
    [390, 844],
    [320, 568],
    [1024, 480],
    [640, 450],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await expect(page.locator('.scene-caption')).toBeVisible();
    for (const selector of ['.room-top', '.room-dock', '.scene-caption', '.participant-rail']) {
      await expect
        .poll(async () => {
          const r = await page.locator(selector).boundingBox();
          return (
            !!r &&
            r.x >= 0 &&
            r.y >= 0 &&
            r.x + r.width <= width! + 1 &&
            r.y + r.height <= height! + 1
          );
        })
        .toBe(true);
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width! + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(height! + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const header = (await page.locator('.room-top').boundingBox())!;
    const workspaceControl = (await page
      .getByRole('button', { name: 'Workspace cards', exact: true })
      .boundingBox())!;
    expect(
      header.x + header.width <= workspaceControl.x ||
        header.y + header.height <= workspaceControl.y ||
        workspaceControl.x + workspaceControl.width <= header.x,
    ).toBe(true);
    if (width! <= 760) {
      const quote = (await page.locator('.scene-caption').boundingBox())!;
      for (const restore of await page.locator('.workspace-restores button').all()) {
        const box = (await restore.boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(quote.y);
      }
    }
    await expect(page.locator('dialog.room-settings')).not.toBeVisible();
    await page.screenshot({
      path: `docs/references/mid04a/room-${width}x${height}.png`,
      animations: 'disabled',
    });
    const sheet = await roomSettings(page, 'Appearance');
    const box = (await sheet.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(width!);
    expect(await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({
      path: `docs/references/mid04a/settings-${width}x${height}.png`,
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
  }
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await expect(page.locator('.scene-caption')).toBeVisible();
  await expect(page.locator('.workspace-tile').first()).toHaveCSS('transition-duration', '0s');
});
test('Auto glass samples light, dark and complex images; contrast and presentation recovery', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await enter(page);
  const surface = page.locator('.environment-surface');
  const dockColor = () =>
    page.locator('.room-dock').evaluate((el) => getComputedStyle(el).backgroundColor);
  const colors: string[] = [];
  for (const material of ['light', 'dark', 'complex']) {
    const data = await page.evaluate((material) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext('2d')!;
      context.fillStyle = material === 'dark' ? '#070707' : '#fafafa';
      context.fillRect(0, 0, 256, 256);
      if (material === 'complex') {
        context.fillStyle = '#070707';
        context.fillRect(0, 0, 128, 256);
      }
      return canvas.toDataURL('image/png').split(',')[1]!;
    }, material);
    await page.getByRole('button', { name: 'Background', exact: true }).click();
    const backgrounds = page.getByRole('dialog', { name: 'Backgrounds' });
    await backgrounds.getByLabel('Upload custom background').setInputFiles({
      name: `${material}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from(data, 'base64'),
    });
    await expect(surface).toHaveAttribute('data-material', material);
    await backgrounds.getByRole('button', { name: 'Close backgrounds' }).click();
    await expect(backgrounds).not.toBeVisible();
    colors.push(await dockColor());
    await page.screenshot({
      path: `docs/references/mid04a/glass-${material}.png`,
      animations: 'disabled',
    });
  }
  expect(new Set(colors).size).toBe(3);
  const sheet = await roomSettings(page, 'Appearance');
  await sheet.getByRole('radio', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
  const dark = await dockColor();
  await sheet.getByRole('radio', { name: 'Light', exact: true }).click();
  await expect.poll(dockColor).not.toBe(dark);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  });
  await expect(page.locator('.room-dock')).toHaveCSS('backdrop-filter', 'blur(0px) saturate(1.2)');
  expect(await dockColor()).not.toContain('rgba');
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });
  for (const preset of ['Minimal', 'Ambient', 'Projector']) {
    await sheet.getByRole('combobox', { name: 'Presentation preset' }).click();
    await sheet.getByRole('option', { name: preset, exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(sheet).not.toBeVisible();
    await expect(page.locator('.room-dock')).not.toBeVisible();
    await expect(page.locator('.workspace-restores')).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Reveal controls/ })).toBeFocused();
    if (preset === 'Ambient')
      await expect(page.locator('.workspace-card:not([hidden])')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.room-dock')).toBeVisible();
    await roomSettings(page, 'Appearance');
  }
  await sheet.getByRole('combobox', { name: 'Presentation preset' }).click();
  await sheet.getByRole('option', { name: 'Projector', exact: true }).click();
  await page.keyboard.press('Escape');
  // Leaving flushes device-local state; re-entry must always restore discoverable chrome.
  await page.getByRole('button', { name: /Reveal controls/ }).click();
  await page.getByRole('button', { name: 'Back to room details' }).click();
  await page.getByRole('button', { name: 'Enter room', exact: true }).click();
  await expect(page.locator('.room-dock')).toBeVisible();
  await expect(page.locator('.room-top')).toBeVisible();
  await expect(page.locator('.room-shell')).not.toHaveClass(/room-projector/);
});

test('two distinct accounts: hidden presence still delivers chat, opt-in reconciles both rails, reconnect and leave', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const a = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
  });
  const b = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
  });
  const alice = await a.newPage(),
    bob = await b.newPage();
  try {
    await login(alice);
    await login(bob, 'Discord');
    const userA = await api(alice, 'account/me'),
      userB = await api(bob, 'account/me');
    expect(userA.id).not.toBe(userB.id);
    await api(alice, 'friends/unblock', { targetId: userB.id });
    await api(bob, 'friends/unblock', { targetId: userA.id });
    const privacy = { online: true, room: false, study: true, join: false, invites: true };
    await api(alice, 'friends/privacy', privacy);
    await api(bob, 'friends/privacy', privacy);
    const room = await api(alice, 'rooms/create', {
      name: 'Presence reproduction',
      privacy: 'public',
    });
    await alice.goto(`/rooms/${room.id}?enter=1`);
    await bob.goto(`/rooms/${room.id}?enter=1`);
    await expect(alice.locator('.participant-entry')).toHaveCount(2);
    await expect(bob.locator('.participant-entry')).toHaveCount(2);
    const chatB = bob.locator('[data-card-type="chat.panel"]');
    await chatB.getByRole('textbox').fill('B reaches A while room presence is private');
    await chatB.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(alice.locator('[data-card-type="chat.panel"]')).toContainText(
      'B reaches A while room presence is private',
    );
    await expect(alice.locator(`#participant-${userB.id}`)).toHaveCount(1);
    await api(alice, 'friends/privacy', { ...privacy, room: true });
    await api(bob, 'friends/privacy', { ...privacy, room: true });
    for (const page of [alice, bob]) {
      await expect(page.locator('.participant-entry')).toHaveCount(2);
      await expect(page.locator('.participant-rail')).toHaveAttribute(
        'aria-label',
        'Participants · 2 active',
      );
    }
    await b.setOffline(true);
    await b.setOffline(false);
    await expect(bob.locator('.participant-entry')).toHaveCount(2);
    await expect(alice.locator(`#participant-${userB.id}`)).toHaveCount(1);
    await bob.reload();
    await expect(bob.locator('.participant-entry')).toHaveCount(2);
    await expect(alice.locator('.participant-entry')).toHaveCount(2);
    await api(bob, 'friends/privacy', privacy);
    await expect(alice.locator('.participant-entry')).toHaveCount(2);
    await api(bob, 'friends/privacy', { ...privacy, room: true });
    await expect(alice.locator('.participant-entry')).toHaveCount(2);
    await bob.getByRole('button', { name: 'Back to room details' }).click();
    await expect(alice.locator('.participant-entry')).toHaveCount(1);
  } finally {
    await a.close();
    await b.close();
  }
});
