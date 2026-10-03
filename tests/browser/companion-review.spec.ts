import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { finishOnboarding } from './onboarding.ts';
import { syntheticMedia } from './synthetic-media.ts';
import { providerMock } from './media-provider.ts';
import { roomEntryBundles } from '../../apps/web/app/lib/room-entry-copy.ts';
const evidence = 'docs/references/mid04a/companion-review';
test.beforeAll(() => mkdirSync(evidence, { recursive: true }));
// Capture the actual Chromium companion surface without Playwright's page-resize preparation.
async function captureCompanion(page: Page, name: string) {
  await page.bringToFront();
  const session = await page.context().newCDPSession(page);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const size = page.viewportSize()!;
    const result = await Promise.race([
      session.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
        clip: { x: 0, y: 0, ...size, scale: 1 },
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Companion surface capture timed out')), 10000);
      }),
    ]);
    writeFileSync(`${evidence}/${name}.png`, Buffer.from(result.data, 'base64'));
  } finally {
    clearTimeout(timer);
    await session.detach();
  }
}
async function login(page: Page) {
  await page.goto('/home');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
  await settled(page);
}
async function api(page: Page, path: string, input?: unknown) {
  return page.evaluate(
    async ({ path, input }) => {
      const { csrfToken } = await fetch('/api/v1/session/csrf').then((r) => r.json());
      const response = await fetch(
        '/api/v1/' + path,
        input === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
              body: JSON.stringify(input),
            },
      );
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    },
    { path, input },
  );
}
async function settled(page: Page) {
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.route-veil')).toHaveCount(0);
}
async function create(page: Page, name = 'Companion review ' + Date.now()) {
  return api(page, 'rooms/create', { name, privacy: 'public' });
}
async function active(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  const room = await create(page);
  await page.goto(`/rooms/${room.publicId}`);
  await expect(page.locator('.room-shell')).toHaveAttribute('data-entry-state', 'active');
  await expect(page.getByLabel('Message', { exact: true })).toBeVisible();
  return room;
}
async function context(page: Page, selector: string, x = 100, y = 100) {
  return page.locator(selector).evaluate(
    (el, { x, y }) => {
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    },
    { x, y },
  );
}

test('companion review: inline handles reveal on hover/focus without changing footprints', async ({
  page,
}) => {
  await active(page);
  await expect(page.locator('.room-object-grip')).toHaveCount(0);
  await expect(page.locator('.inline-drag-icon').first()).toHaveCSS('opacity', '0');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Rearrange view', exact: true }).click();
  await page.mouse.move(700, 500);
  for (const selector of [
    '.workspace-controls',
    '.room-top',
    '.participant-rail',
    '.room-dock',
    '.scene-caption',
    '[data-card-type="chat.panel"]',
  ]) {
    const object = page.locator(selector),
      before = await object.boundingBox();
    const grip = object.locator('.room-object-grip, .inline-drag-icon').first();
    await expect(grip).toHaveCSS('opacity', '0');
    await object.hover();
    await expect(grip).toHaveCSS('opacity', '1');
    expect(await object.boundingBox()).toEqual(before);
    const row = await grip.boundingBox();
    expect(row!.y).toBeGreaterThanOrEqual(before!.y);
    expect(row!.y + row!.height).toBeLessThanOrEqual(before!.y + before!.height);
    if (selector !== '.participant-rail' && selector !== '[data-card-type="chat.panel"]') {
      const label = object.locator('button:not(.room-object-grip), label').first();
      if (await label.count()) {
        const box = await label.boundingBox();
        expect(Math.abs(box!.y + box!.height / 2 - (row!.y + row!.height / 2))).toBeLessThan(8);
      }
    }
    await page.mouse.move(700, 500);
  }
  const workspace = page.getByRole('button', { name: 'Move workspace controls', exact: true });
  await workspace.focus();
  await expect(workspace).toHaveCSS('opacity', '1');
  await workspace.press('ArrowRight');
  await page.screenshot({ path: `${evidence}/inline-rearrange.png` });
});

test('companion review: Chat clamps height, scrolls history, preserves IME and exposes authorized icon actions', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const a = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1000 },
    }),
    b = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1000 },
      hasTouch: true,
      isMobile: true,
    });
  const alice = await a.newPage(),
    bob = await b.newPage();
  try {
    const room = await active(alice);
    await login(bob);
    await bob.goto(`/rooms/${room.publicId}`);
    const chat = bob.locator('[data-card-type="chat.panel"]'),
      field = chat.getByRole('textbox', { name: 'Message', exact: true });
    await field.fill('   ');
    await expect(chat.getByRole('button', { name: 'Send message' })).toBeDisabled();
    await field.press('Enter');
    await field.fill('line one');
    await field.press('Shift+Enter');
    await field.press('End');
    await field.type('line two');
    await expect(field).toHaveValue('line one\nline two');
    await field.dispatchEvent('compositionstart');
    await field.press('Enter');
    await expect(field).toHaveValue('line one\nline two\n');
    await expect(chat.locator('.chat-list li')).toHaveCount(0);
    await field.dispatchEvent('compositionend');
    await field.press('Enter');
    const own = chat.locator('.chat-list li').first();
    await expect(own).toContainText('line two');
    await expect(field).toHaveValue('');
    await expect(own.getByRole('button', { name: 'Delete message' })).toHaveCSS('opacity', '1');
    await alice.getByLabel('Message', { exact: true }).fill('owner message');
    await alice.getByLabel('Message', { exact: true }).press('Enter');
    await expect(
      chat
        .locator('.chat-list li')
        .filter({ hasText: 'owner message' })
        .getByRole('button', { name: 'Delete message' }),
    ).toHaveCount(0);
    for (let n = 0; n < 7; n++) {
      await field.fill('encouragement ' + n);
      // A previous send clears the draft before its refreshed history arrives.
      await expect(chat.getByRole('button', { name: 'Send message' })).toBeEnabled();
      await field.press('Enter');
      await expect(field).toHaveValue('');
    }
    await chat.getByRole('button', { name: 'Unsnap card' }).click();
    const resize = chat.getByRole('button', { name: 'Resize tile', exact: true });
    for (let n = 0; n < 20; n++) await resize.press('Shift+ArrowUp');
    await expect.poll(async () => (await chat.boundingBox())!.height).toBeLessThanOrEqual(201);
    const card = await chat.boundingBox(),
      composer = await field.boundingBox();
    expect(card!.height).toBeGreaterThanOrEqual(200);
    expect(card!.height).toBeLessThanOrEqual(201);
    expect(composer!.y + composer!.height).toBeLessThanOrEqual(card!.y + card!.height);
    expect(
      await chat.locator('.chat-history').evaluate((el) => el.scrollHeight > el.clientHeight),
    ).toBe(true);
    await chat.locator('.chat-history').evaluate((el) => (el.scrollTop = 0));
    await own.getByRole('button', { name: 'Delete message' }).click();
    await expect(own).toContainText('Message deleted');
    await alice.locator('.chat-list li').filter({ hasText: 'owner message' }).hover();
    const ownOwner = alice.locator('.chat-list li').filter({ hasText: 'owner message' }),
      footprint = await ownOwner.boundingBox();
    await ownOwner.getByRole('button', { name: 'Delete message' }).focus();
    await expect(ownOwner.getByRole('button', { name: 'Delete message' })).toHaveCSS(
      'opacity',
      '1',
    );
    expect(await ownOwner.boundingBox()).toEqual(footprint);
    await bob.screenshot({ path: `${evidence}/chat-minimum-touch.png` });
  } finally {
    await a.close();
    await b.close();
  }
});

test('companion review: slug check/save and compact invites remove revoked records', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  const room = await create(page);
  const taken = 'taken-' + Date.now(),
    other = await create(page, 'Taken address');
  await api(page, 'rooms/slug', { roomId: other.id, version: other.version, slug: taken });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/rooms/${room.publicId}/configure`);
  await settled(page);
  const field = page.getByRole('textbox', { name: 'Room address (optional)' }),
    form = page.locator('.room-address');
  await field.fill(taken);
  await expect(form.locator('.room-address-status')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Room address validation' })).toContainText(
    'Address unavailable',
  );
  const shape = await form.boundingBox();
  await page.keyboard.press('Escape');
  expect(await form.boundingBox()).toEqual(shape);
  await field.fill('bad--address');
  await expect(page.getByRole('region', { name: 'Room address validation' })).toContainText(
    'Invalid address',
  );
  const slug = 'companion-' + Date.now();
  await field.fill(slug);
  await expect(form.getByRole('button', { name: 'Save room address' })).toBeEnabled();
  await form.getByRole('button', { name: 'Save room address' }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${slug}/configure`));
  await expect(form.locator('.room-address-saved')).toBeVisible();
  await expect(field).toHaveValue(slug);
  await expect(page.getByText('Address available', { exact: true })).toHaveCount(0);
  await field.fill(slug + '-new');
  await expect(form.getByRole('button', { name: 'Save room address' })).toBeEnabled();
  const hours = page.getByLabel('Expires in hours'),
    uses = page.getByLabel('Maximum new members');
  expect((await hours.boundingBox())!.y).toBe((await uses.boundingBox())!.y);
  await page.getByRole('button', { name: 'Create invite link', exact: true }).click();
  const card = page.locator('.card.device'),
    createButton = await page
      .getByRole('button', { name: 'Create invite link', exact: true })
      .boundingBox();
  expect(
    (await card.boundingBox())!.y - createButton!.y - createButton!.height,
  ).toBeGreaterThanOrEqual(16);
  await page.getByRole('button', { name: 'Revoke invite', exact: true }).click();
  await page.getByRole('button', { name: 'Delete revoked invite' }).click();
  await page
    .getByRole('dialog', { name: 'Remove revoked invite?' })
    .getByRole('button', { name: 'Remove invite', exact: true })
    .click();
  await expect(card).toHaveCount(0);
  const link = page.getByRole('link', { name: 'All my rooms →', exact: true });
  await expect(link).toHaveCSS('display', 'inline-flex');
  await expect(link).toHaveCSS('align-items', 'center');
  await expect(link).toHaveCSS('line-height', '18.2px');
  await page.screenshot({ path: `${evidence}/address-invites-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await uses.boundingBox())!.y).toBeGreaterThan((await hours.boundingBox())!.y);
  await page.screenshot({ path: `${evidence}/address-invites-narrow.png`, fullPage: true });
});

test('companion review: Back follows visited app pages and preserves filters/scroll and wordmark geometry', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 700 });
  await login(page);
  const room = await create(page);
  await page.goto('/home');
  await settled(page);
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
  const wordmark = (await page.getByRole('link', { name: 'Study Space Home' }).boundingBox())!,
    title = (await page.locator('.shell-brand-row').boundingBox())!;
  await page.getByRole('link', { name: 'Discover', exact: true }).first().click();
  await settled(page);
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
  expect(
    (await page.getByRole('link', { name: 'Study Space Home' }).boundingBox())!.x - wordmark.x,
  ).toBe(52);
  expect((await page.locator('.shell-brand-row').boundingBox())!.height).toBe(title.height);
  await page.getByRole('searchbox', { name: /Search/ }).fill(room.name);
  await expect(page).toHaveURL(/search=/);
  await settled(page);
  const origin = page.url();
  await page.evaluate(() => window.scrollTo(0, 300));
  const scroll = await page.evaluate(() => window.scrollY);
  await page
    .locator('.room-card')
    .filter({ hasText: room.name })
    .getByRole('link', { name: 'Settings for ' + room.name })
    .click();
  await settled(page);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(origin);
  await settled(page);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scroll);
  await page.goto(`/rooms/${room.publicId}/configure?from=https://evil.test`);
  await settled(page);
  await expect(page.getByRole('button', { name: 'Enter room', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${evidence}/shell-direct-no-back.png` });
});

test('companion review: room-first doorway has fixed linked copy, no pre-entry owners, and retains the shell after admission', async ({
  browser,
}) => {
  test.setTimeout(70000);
  const a = await browser.newContext({ ignoreHTTPSErrors: true }),
    b = await browser.newContext({ ignoreHTTPSErrors: true });
  const owner = await a.newPage(),
    page = await b.newPage();
  try {
    await login(owner);
    const room = await create(owner, 'Doorway room ' + Date.now());
    await login(page);
    await page.goto('/discover?search=' + encodeURIComponent(room.name));
    await settled(page);
    const origin = page.url();
    let joins = 0,
      rtc = 0;
    const previewCommands: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/rooms/join')) joins++;
      if (r.method() === 'POST' && r.url().endsWith('/rtc/join')) rtc++;
    });
    page.on('websocket', (socket) =>
      socket.on('framesent', ({ payload }) => {
        try {
          const message = JSON.parse(String(payload));
          if (message.payload?.roomId === room.id) previewCommands.push(message.command);
        } catch {
          /* Ignore non-command provider frames. */
        }
      }),
    );
    await page.evaluate(
      () =>
        (navigator.mediaDevices.getUserMedia = async () => {
          throw new Error('Unexpected preview capture');
        }),
    );
    const modal = page.getByRole('dialog', { name: 'Open room', exact: true });
    const card = page.locator('.room-card').filter({ hasText: room.name });
    await card.getByRole('button', { name: 'Open room', exact: true }).click();
    await expect(modal).toBeVisible();
    await expect(page.locator('.room-shell')).toHaveAttribute('data-entry-state', 'preview');
    expect(page.url()).toContain('/rooms/' + room.publicId);
    expect(joins).toBe(0);
    expect(rtc).toBe(0);
    expect(previewCommands).toEqual([]);
    await expect(page.locator('.participant-entry')).toHaveCount(0);
    const question = await modal.locator('.entry-prompt').innerText(),
      bundle = roomEntryBundles.find((v) => v.question === question)!;
    expect(await modal.getByRole('button', { name: 'Join room' }).innerText()).toBe(bundle.yes);
    expect(await modal.getByRole('button', { name: 'Cancel room entry' }).innerText()).toBe(
      bundle.no,
    );
    await page.waitForTimeout(12500);
    await expect(modal.locator('.entry-prompt')).toHaveText(question);
    await page.screenshot({ path: `${evidence}/room-first-doorway.png` });
    await modal.getByRole('button', { name: 'Cancel room entry' }).click();
    await expect(modal.locator('.entry-prompt')).toHaveText(bundle.secondary.question);
    await expect(modal.getByRole('button', { name: 'Return to room entry' })).toHaveText(
      bundle.secondary.yes,
    );
    await modal.getByRole('button', { name: 'Cancel room entry' }).click();
    await expect(page).toHaveURL(origin);
    await settled(page);
    expect(joins).toBe(0);
    expect(rtc).toBe(0);
    expect(previewCommands).toEqual([]);
    expect(
      (await api(page, 'rooms/browse?scope=mine')).rooms.some(
        (r: { id: string }) => r.id === room.id,
      ),
    ).toBe(false);
    await card.getByRole('button', { name: 'Open room', exact: true }).click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('.entry-prompt')).not.toHaveText(question);
    await page.evaluate(() =>
      Object.assign(window, { doorwayShell: document.querySelector('.room-shell') }),
    );
    await modal.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(page.locator('.room-shell')).toHaveAttribute('data-entry-state', 'active');
    await expect.poll(() => rtc).toBe(1);
    expect(joins).toBe(1);
    expect(
      await page.evaluate(
        () =>
          document.querySelector('.room-shell') ===
          (window as unknown as { doorwayShell: Element }).doorwayShell,
      ),
    ).toBe(true);
    await expect(page.locator('.participant-entry')).toHaveCount(1);
    await expect(modal).toBeHidden();
    await page.screenshot({ path: `${evidence}/same-shell-admitted.png` });
  } finally {
    await a.close();
    await b.close();
  }
});

test('companion review: one context host supports contextual actions, native escape, keyboard, viewport and editing', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (value: string) => Object.assign(window, { clipboardValue: value }),
        readText: async () => 'pasted words',
      },
    }),
  );
  await login(page);
  const room = await create(page);
  await page.goto('/my-rooms');
  await settled(page);
  expect(await context(page, '.room-card', 1270, 715)).toBe(true);
  const menu = page.getByRole('menu', { name: 'Study Space actions' });
  await expect(menu).toBeVisible();
  for (const name of [
    'Open room',
    'Open in new tab',
    'Copy room link',
    'Share room',
    'Settings',
    'Invite people',
  ])
    await expect(menu.getByRole('menuitem', { name, exact: true })).toBeVisible();
  const box = (await menu.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(1280);
  expect(box.y + box.height).toBeLessThanOrEqual(720);
  expect(await context(page, '.room-card')).toBe(false);
  await expect(menu).toHaveCount(0);
  const cardButton = page
    .locator('.room-card')
    .getByRole('button', { name: room.name, exact: true });
  await cardButton.focus();
  await cardButton.press('Shift+F10');
  await expect(menu).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Open in new tab' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(cardButton).toBeFocused();
  await page
    .locator('.room-card')
    .getByRole('link', { name: 'Settings for ' + room.name })
    .click();
  await settled(page);
  const field = page.getByRole('textbox', { name: 'Room address (optional)' });
  await field.fill('selection');
  await field.selectText();
  expect(await context(page, '.room-address input')).toBe(true);
  await expect(menu.getByRole('menuitem', { name: 'Cut', exact: true })).toBeEnabled();
  await menu.getByRole('menuitem', { name: 'Cut', exact: true }).click();
  await expect(field).toHaveValue('');
  expect(await context(page, '.room-address input')).toBe(true);
  await menu.getByRole('menuitem', { name: 'Paste', exact: true }).click();
  await expect(field).toHaveValue('pasted words');
  expect(await context(page, '.room-address input')).toBe(true);
  await menu.getByRole('menuitem', { name: 'Select all', exact: true }).click();
  expect(
    await field.evaluate((el: HTMLInputElement) => el.selectionEnd! - el.selectionStart!),
  ).toBe(12);
  await field.evaluate((el: HTMLInputElement) => {
    el.setSelectionRange(0, 0);
    el.blur();
    document.getSelection()?.removeAllRanges();
  });
  expect(await context(page, '.management-main')).toBe(true);
  await expect(menu.getByRole('menuitem', { name: 'Back', exact: true })).toBeVisible();
  await page.screenshot({ path: `${evidence}/global-context-menu.png` });
  await page.mouse.click(20, 20);
  await expect(menu).toHaveCount(0);
});

test('companion review: each tool, rail, dock and visible camera gets its own responsive companion with one owner', async ({
  page,
}) => {
  test.setTimeout(100000);
  let roomSockets = 0,
    rtcJoins = 0;
  page.on('websocket', () => roomSockets++);
  page.on('request', (r) => {
    if (r.url().endsWith('/rtc/join')) rtcJoins++;
  });
  await syntheticMedia(page);
  await providerMock(page);
  await page.addInitScript(() =>
    Object.defineProperty(window, 'documentPictureInPicture', {
      value: undefined,
      configurable: true,
    }),
  );
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia;
    Object.assign(window, { captureCalls: 0 });
    navigator.mediaDevices.getUserMedia = (constraints) => {
      (window as unknown as { captureCalls: number }).captureCalls++;
      return original.call(navigator.mediaDevices, constraints);
    };
  });
  const room = await active(page);
  await page.getByRole('button', { name: 'Camera off', exact: true }).click();
  await expect(page.locator('.participant-entry video')).toHaveCount(1);
  await page.evaluate(() =>
    Object.assign(window, {
      originalVideo: document.querySelector('video'),
      originalRail: document.querySelector('.participant-rail'),
      originalDock: document.querySelector('.room-dock'),
      originalChat: document.querySelector('[data-card-type="chat.panel"]'),
    }),
  );
  await page.getByRole('button', { name: 'Workspace cards', exact: true }).click();
  await page
    .getByRole('region', { name: 'Workspace cards', exact: true })
    .getByRole('checkbox', { name: 'Clock', exact: true })
    .check();
  await page.getByRole('button', { name: 'Workspace cards', exact: true }).click();
  const initialSockets = roomSockets,
    initialJoins = rtcJoins,
    initialCaptures = await page.evaluate(
      () => (window as unknown as { captureCalls: number }).captureCalls,
    ),
    initialAudience = await api(page, 'rtc/audience', { roomId: room.id });
  const windows: Page[] = [];
  let sockets = 0;
  page.on('popup', (popup) => {
    windows.push(popup);
    popup.on('websocket', () => sockets++);
  });
  const chatStyle = await page
    .locator('[data-card-type="chat.panel"]')
    .evaluate((el: HTMLElement) => [el.style.left, el.style.top, el.style.width, el.style.height]);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Pop out all', exact: true }).click();
  await expect.poll(() => windows.length).toBe(7);
  await expect.poll(() => page.context().pages().length).toBe(8);

  const byId = new Map<string, Page>();
  for (const popup of windows) {
    await expect(popup.locator('.popout-stage')).toBeVisible();
    byId.set((await popup.locator('.popout-stage').getAttribute('data-companion-id'))!, popup);
  }
  const participants = byId.get('participant-rail')!,
    dock = byId.get('room-controls')!,
    camera = windows.find((p) =>
      [...byId].some(([id, value]) => value === p && id.includes('rtc.camera')),
    )!;
  await expect(participants.locator('.participant-entry')).toHaveCount(1);
  await participants.locator('#participant-self').click();
  await expect(
    participants.getByRole('button', { name: 'Close participant controls', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close participant controls' })).toHaveCount(0);
  await participants.keyboard.press('Escape');
  await expect(participants.locator('#participant-self')).toBeFocused();
  await expect(camera.locator('video')).toHaveCount(1);
  const selfName = (await participants.locator('#participant-self').getAttribute('title'))!.split(
    ' ·',
  )[0]!;
  await expect(camera.locator('.participant-video-caption')).toHaveText(selfName);
  await expect(
    camera.locator('.participant-video-caption').getByLabel('Microphone off'),
  ).toBeVisible();
  expect(
    await camera
      .locator('video')
      .evaluate(
        (el) => el === (window.opener as unknown as { originalVideo: Element }).originalVideo,
      ),
  ).toBe(true);
  for (const label of [
    'Media',
    'Background',
    'Microphone off',
    'Camera on',
    'Screen Share off',
    'More',
  ])
    await expect(dock.getByRole('button', { name: label, exact: true })).toBeVisible();
  const chat = windows.find((p) =>
    [...byId].some(([id, value]) => value === p && id.includes('chat.panel')),
  )!;
  for (const size of [
    { width: 300, height: 620 },
    { width: 720, height: 300 },
  ]) {
    await participants.setViewportSize(size);
    await dock.setViewportSize(size);
    await chat.setViewportSize(size);
    await expect(participants.locator('.participant-rail')).toHaveCSS('display', 'grid');
    await expect(dock.locator('[data-extension-point="bottomDock"]')).toHaveCSS(
      'flex-direction',
      size.width > 420 ? 'row' : 'column',
    );
    const rect = await chat.locator('.workspace-tile').boundingBox();
    expect(rect!.width).toBe(size.width - 12);
    expect(rect!.height).toBe(size.height - 12);
    const input = await chat.getByLabel('Message', { exact: true }).boundingBox();
    expect(input!.y + input!.height).toBeLessThanOrEqual(size.height);
  }
  await chat.getByLabel('Message', { exact: true }).fill('From companion');
  await chat.getByLabel('Message', { exact: true }).press('Enter');
  await expect(chat.getByText('From companion', { exact: true })).toBeVisible();
  await dock.getByRole('button', { name: 'More', exact: true }).click();
  await dock.getByRole('button', { name: 'Pop out all', exact: true }).click();
  expect(windows.length).toBe(7);
  await captureCompanion(chat, 'chat-companion-wide');
  await captureCompanion(participants, 'participants-companion-wide');
  await captureCompanion(dock, 'dock-companion-wide');
  await captureCompanion(camera, 'same-track-camera-companion');
  await chat.close();
  await expect(page.locator('[data-card-type="chat.panel"]')).toBeVisible();
  expect(
    await page
      .locator('[data-card-type="chat.panel"]')
      .evaluate((el: HTMLElement) => [
        el.style.left,
        el.style.top,
        el.style.width,
        el.style.height,
      ]),
  ).toEqual(chatStyle);
  expect(page.context().pages()).toHaveLength(7);
  await dock.getByRole('button', { name: 'More', exact: true }).click();
  await dock.getByRole('button', { name: 'Restore all', exact: true }).click();
  await expect.poll(() => page.context().pages().length).toBe(1);
  expect(sockets).toBe(0);
  expect(roomSockets).toBe(initialSockets);
  expect(rtcJoins).toBe(initialJoins);
  expect(
    await page.evaluate(() => (window as unknown as { captureCalls: number }).captureCalls),
  ).toBe(initialCaptures);
  expect(await api(page, 'rtc/audience', { roomId: room.id })).toEqual(initialAudience);
  expect(
    await page.evaluate(
      () =>
        document.querySelector('.participant-rail') ===
          (window as unknown as { originalRail: Element }).originalRail &&
        document.querySelector('.room-dock') ===
          (window as unknown as { originalDock: Element }).originalDock,
    ),
  ).toBe(true);
  await page.evaluate(() =>
    Object.defineProperty(window, 'open', { value: () => null, configurable: true }),
  );
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Pop out all', exact: true }).click();
  await expect(page.getByText(/Could not open:/)).toContainText('Participant rail');
  await expect(page.locator('.participant-rail')).toBeVisible();
  await expect(page.locator('.room-dock')).toBeVisible();
  await expect(page.locator('[data-card-type="chat.panel"]')).toBeVisible();
});

test('companion review: approved glass endpoints and intermediate mapping remain locked in both themes', async ({
  page,
}) => {
  await login(page);
  await page.goto('/account');
  await settled(page);
  for (const theme of ['light', 'dark']) {
    for (const level of [0, 25, 50, 75, 100]) {
      const alpha = await page.evaluate(
        ({ theme, level }) => {
          document.documentElement.setAttribute('data-appearance', theme);
          document.documentElement.setAttribute('data-glass-transparency', String(100 - level));
          const probe = document.createElement('div');
          probe.className = 'ui-glass';
          document.body.append(probe);
          const color = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return color.startsWith('rgba') ? Number(color.slice(color.lastIndexOf(',') + 1, -1)) : 1;
        },
        { theme, level },
      );
      expect(alpha).toBeCloseTo(level / 100, 2);
    }
    await page.evaluate(() =>
      document.documentElement.setAttribute('data-glass-transparency', 'auto'),
    );
    await expect(page.locator('.card').first()).not.toHaveCSS('background-color', /rgba\(.+, 0\)/);
  }
});

test('companion review: remote video adoption keeps the same subscribed track and closes with its owning room', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const a = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1000 },
    }),
    b = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1000 },
    });
  const owner = await a.newPage(),
    page = await b.newPage();
  try {
    await syntheticMedia(owner);
    const room = await active(owner);
    const user = await api(owner, 'account/me');
    await page.addInitScript(() => {
      Object.defineProperty(window, 'documentPictureInPicture', {
        value: undefined,
        configurable: true,
      });
      const peers: RTCPeerConnection[] = [];
      Object.assign(window, { rtcPeers: peers });
      window.RTCPeerConnection = new Proxy(window.RTCPeerConnection, {
        construct(target, args) {
          const peer = new target(...args);
          peers.push(peer);
          return peer;
        },
      });
    });
    await login(page);
    await page.goto(`/rooms/${room.publicId}`);
    await expect(page.locator('.room-dock')).toBeVisible();
    await owner.getByRole('button', { name: 'Camera off', exact: true }).click();
    const remote = page.locator(`video[data-camera-renderer="${user.id}"]`);
    await expect(remote).toHaveCount(1, { timeout: 20000 });
    await expect
      .poll(() => remote.evaluate((video: HTMLVideoElement) => video.videoWidth), {
        timeout: 20000,
      })
      .toBeGreaterThan(0);
    await remote.evaluate((video: HTMLVideoElement) =>
      Object.assign(window, { originalRemoteVideo: video, originalRemoteStream: video.srcObject }),
    );
    await page.locator(`#participant-${user.id}`).click();
    await page.getByRole('button', { name: 'Expand camera', exact: true }).click();
    await page.keyboard.press('Escape');
    const before = await page.evaluate(
      () => (window as unknown as { rtcPeers: RTCPeerConnection[] }).rtcPeers.length,
    );
    let extraSockets = 0;
    const promise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Pop out Camera', exact: true }).click();
    const popup = await promise;
    popup.on('websocket', () => extraSockets++);
    await expect(popup.locator('video')).toHaveCount(1);
    expect(
      await popup
        .locator('video')
        .evaluate(
          (video: HTMLVideoElement) =>
            video ===
              (window.opener as unknown as { originalRemoteVideo: Element }).originalRemoteVideo &&
            video.srcObject ===
              (window.opener as unknown as { originalRemoteStream: MediaStream })
                .originalRemoteStream,
        ),
    ).toBe(true);
    const frames = await popup
      .locator('video')
      .evaluate((video: HTMLVideoElement) => video.getVideoPlaybackQuality().totalVideoFrames);
    await expect
      .poll(
        () =>
          popup
            .locator('video')
            .evaluate(
              (video: HTMLVideoElement) => video.getVideoPlaybackQuality().totalVideoFrames,
            ),
        { timeout: 15000 },
      )
      .toBeGreaterThan(frames);
    expect(
      await page.evaluate(
        () => (window as unknown as { rtcPeers: RTCPeerConnection[] }).rtcPeers.length,
      ),
    ).toBe(before);
    expect(extraSockets).toBe(0);
    await captureCompanion(popup, 'same-subscription-remote-video');
    await popup.close();
    await expect(remote).toHaveCount(1);
    expect(
      await remote.evaluate(
        (video) =>
          video === (window as unknown as { originalRemoteVideo: Element }).originalRemoteVideo,
      ),
    ).toBe(true);
    const again = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Pop out Camera', exact: true }).click();
    const companion = await again;
    await page.goto('/account');
    await settled(page);
    await expect.poll(() => companion.isClosed()).toBe(true);
  } finally {
    await a.close();
    await b.close();
  }
});
