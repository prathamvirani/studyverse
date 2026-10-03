import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { finishOnboarding } from './onboarding.ts';

const evidence = 'docs/references/mid04a/layout-entry';
test.beforeAll(() => mkdirSync(evidence, { recursive: true }));
async function login(page: Page) {
  await page.goto('/home');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
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
  await expect(page.getByText(/^(Loading rooms…|Finding your space…|Loading…)$/)).toHaveCount(0);
}
async function room(page: Page) {
  await login(page);
  return api(page, 'rooms/create', { name: 'Focused entry', privacy: 'public' });
}
async function rearrange(page: Page) {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Rearrange view', exact: true }).click();
}
function overlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
test('layout follow-up: compact descriptor retains rail nodes, previews actual footprints and shares the bottom edge', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const value = await room(page);
  let sockets = 0;
  page.on('websocket', () => sockets++);
  await page.goto(`/rooms/${value.publicId}`);
  await expect(page.locator('.participant-entry')).toHaveCount(1);
  await page.evaluate(() =>
    Object.assign(window, {
      railNode: document.querySelector('.participant-rail'),
      participantNode: document.querySelector('.participant-entry'),
      shellNode: document.querySelector('.room-shell'),
    }),
  );
  await rearrange(page);
  const initialSockets = sockets;
  await expect(page.getByRole('button', { name: 'Move audio status' })).toHaveCount(0);
  for (const [edge, x, y] of [
    ['right', 1420, 350],
    ['top', 700, 20],
    ['bottom', 700, 980],
    ['left', 20, 350],
  ] as const) {
    const grip = page.getByRole('button', { name: 'Move participants' });
    await grip.hover();
    const r = (await grip.boundingBox())!;
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(600, 400);
    await expect(page.locator('.rail-drag-label')).toBeVisible();
    await expect(page.locator('.rail-drag-label')).toHaveText('Participant Rail');
    const descriptor = (await page.locator('.participant-rail').boundingBox())!;
    expect(descriptor.width).toBeLessThanOrEqual(220);
    expect(descriptor.height).toBeCloseTo(56, 0);
    await page.mouse.move(650, 430);
    const moved = (await page.locator('.participant-rail').boundingBox())!;
    expect(moved.x - descriptor.x).toBeCloseTo(50, 0);
    expect(moved.y - descriptor.y).toBeCloseTo(30, 0);
    await expect(page.locator('.rail-snap-preview')).toHaveCount(0);
    await page.screenshot({ path: `${evidence}/descriptor-${edge}.png` });
    await page.mouse.move(x, y);
    await expect(page.locator('.rail-snap-preview')).toHaveAttribute('data-edge', edge);
    const preview = (await page.locator('.rail-snap-preview').boundingBox())!;
    expect(Math.min(preview.width, preview.height)).toBeLessThanOrEqual(86);
    await page.screenshot({ path: `${evidence}/preview-${edge}.png` });
    await page.mouse.up();
    await expect(page.locator('.room-shell')).toHaveAttribute('data-rail-edge', edge);
    const rail = (await page.locator('.participant-rail').boundingBox())!;
    for (const key of ['x', 'y', 'width', 'height'] as const)
      expect(rail[key]).toBeCloseTo(preview[key], 0);
    await expect(page.locator('.participant-rail')).toHaveCSS(
      'flex-direction',
      ['left', 'right'].includes(edge) ? 'column' : 'row',
    );
    const dock = (await page.locator('.room-dock').boundingBox())!;
    expect(overlap(rail, dock)).toBe(false);
    if (edge === 'bottom') expect(rail.y + rail.height).toBeCloseTo(992, 0);
    expect(
      await page.evaluate(() => {
        const w = window as unknown as {
          railNode: Element;
          participantNode: Element;
          shellNode: Element;
        };
        return (
          w.railNode === document.querySelector('.participant-rail') &&
          w.participantNode === document.querySelector('.participant-entry') &&
          w.shellNode === document.querySelector('.room-shell')
        );
      }),
    ).toBe(true);
  }
  expect(sockets).toBe(initialSockets);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Move participants' }).press('ArrowDown');
  const rail = (await page.locator('.participant-rail').boundingBox())!,
    dock = (await page.locator('.room-dock').boundingBox())!;
  expect(overlap(rail, dock)).toBe(false);
  expect(rail.y + rail.height).toBeCloseTo(836, 0);
  expect(dock.y + dock.height).toBeLessThanOrEqual(rail.y - 7);
  await page.screenshot({ path: `${evidence}/bottom-narrow.png` });
});

test('layout follow-up: free horizontal header placement persists alongside all four magnetic anchors', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const value = await room(page);
  const user = await api(page, 'account/me');
  await page.goto(`/rooms/${value.publicId}`);
  await expect(page.locator('.room-dock')).toBeVisible();
  await rearrange(page);
  async function dragHeader(x: number) {
    const header = (await page.locator('.room-top').boundingBox())!;
    const grip = (await page.getByRole('button', { name: 'Move room header' }).boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + x - header.x, grip.y + grip.height / 2 + 150);
    const moved = (await page.locator('.room-top').boundingBox())!;
    expect(moved.y).toBe(header.y);
  }
  await dragHeader(234.5);
  await expect(page.locator('.header-snap-preview')).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator('.room-shell')).toHaveAttribute('data-header-slot', 'free');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        ({ key }) =>
          new Promise<number | null>((resolve) => {
            const request = indexedDB.open('study-preferences-v1');
            request.onsuccess = () => {
              const db = request.result,
                read = db.transaction('preferences').objectStore('preferences').get(key);
              read.onsuccess = () => {
                resolve(read.result?.value.headerX ?? null);
                db.close();
              };
            };
          }),
        { key: `room-arrangement.${user.id}.${value.id}` },
      ),
    )
    .toBeCloseTo(234.5, 0);
  await page.reload();
  await expect(page.locator('.room-shell')).toHaveAttribute('data-header-slot', 'free');
  expect((await page.locator('.room-top').boundingBox())!.x).toBeCloseTo(234.5, 0);
  await rearrange(page);
  const width = (await page.locator('.room-top').boundingBox())!.width;
  const anchors = [12, 98, (1440 - width) / 2, 1440 - width - 12];
  for (const [slot, x] of anchors.entries()) {
    await dragHeader(x + 6);
    await expect(page.locator('.header-snap-preview')).toBeVisible();
    await page.mouse.up();
    await expect(page.locator('.room-shell')).toHaveAttribute('data-header-slot', String(slot));
    expect((await page.locator('.room-top').boundingBox())!.x).toBeCloseTo(x, 0);
  }
  await page.screenshot({ path: `${evidence}/header-snaps.png` });
});

test('entry follow-up: room preview waits for admission and keeps fixed copy, cancel has no admission and commit joins once', async ({
  browser,
}) => {
  test.setTimeout(60000);
  const owner = await browser.newContext({ ignoreHTTPSErrors: true }),
    viewer = await browser.newContext({ ignoreHTTPSErrors: true });
  const creator = await owner.newPage(),
    page = await viewer.newPage();
  try {
    const value = await room(creator);
    await login(page);
    let joins = 0,
      rtc = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/rooms/join')) joins++;
      if (r.method() === 'POST' && r.url().endsWith('/rtc/join')) rtc++;
    });
    await page.goto(`/discover?search=${encodeURIComponent(value.name)}`);
    await settled(page);
    const card = page.locator('.room-card').filter({ hasText: value.name }).first();
    const original = page.url(),
      modal = page.getByRole('dialog', { name: 'Open room', exact: true });
    await card.click({ position: { x: 120, y: 120 } });
    await expect(modal).toBeVisible();
    expect(page.url()).toContain(`/rooms/${value.publicId}`);
    expect(joins).toBe(0);
    expect(rtc).toBe(0);
    await expect(page.locator('.room-shell')).toHaveAttribute('data-entry-state', 'preview');
    await expect(modal).toHaveCSS('transform', 'none');
    const before = (await modal.boundingBox())!,
      prompt = await modal.locator('.entry-prompt').textContent();
    await page.waitForTimeout(12500);
    await expect(modal.locator('.entry-prompt')).toHaveText(prompt!);
    const after = (await modal.boundingBox())!;
    expect(after.height).toBe(before.height);
    expect(after.width).toBe(before.width);
    await page.screenshot({ path: `${evidence}/entry-confirmation.png` });
    await modal.getByRole('button', { name: 'Cancel room entry' }).click();
    await expect(modal.locator('.entry-prompt')).toHaveAttribute('data-step', 'leave');
    expect((await modal.boundingBox())!.height).toBe(before.height);
    await page.screenshot({ path: `${evidence}/entry-leave-confirmation.png` });
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(page).toHaveURL(original);
    await settled(page);
    expect(joins).toBe(0);
    expect(rtc).toBe(0);
    expect(
      (await api(page, 'rooms/browse?scope=mine')).rooms.some(
        (r: { id: string }) => r.id === value.id,
      ),
    ).toBe(false);
    await card.getByRole('button', { name: value.name, exact: true }).press('Enter');
    await modal.getByRole('button', { name: 'Cancel room entry' }).click();
    await modal.getByRole('button', { name: 'Cancel room entry' }).click();
    await expect(modal).toBeHidden();
    await expect(page).toHaveURL(original);
    await settled(page);
    expect(joins).toBe(0);
    await card.getByRole('button', { name: 'Open room', exact: true }).click();
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/v1/rooms/join', async (route) => {
      await hold;
      await route.continue();
    });
    await modal.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(modal.getByRole('button', { name: 'Join room' })).toBeDisabled();
    expect(page.url()).toContain(`/rooms/${value.publicId}`);
    expect(rtc).toBe(0);
    release();
    await expect(page.locator('.room-shell')).toBeVisible();
    await expect.poll(() => rtc).toBe(1);
    expect(joins).toBe(1);
    expect(
      (await api(page, 'rooms/browse?scope=mine')).rooms.some(
        (r: { id: string }) => r.id === value.id,
      ),
    ).toBe(true);
  } finally {
    await owner.close();
    await viewer.close();
  }
});

test('entry follow-up: server rejects a stale public-card decision after the room becomes private', async ({
  browser,
}) => {
  const owner = await browser.newContext({ ignoreHTTPSErrors: true }),
    viewer = await browser.newContext({ ignoreHTTPSErrors: true });
  const creator = await owner.newPage(),
    page = await viewer.newPage();
  try {
    const value = await room(creator);
    await login(page);
    await page.goto(`/discover?search=${encodeURIComponent(value.name)}`);
    await settled(page);
    await page
      .locator('.room-card')
      .filter({ hasText: value.name })
      .first()
      .getByRole('button', { name: 'Open room', exact: true })
      .click();
    await expect(page.getByRole('dialog', { name: 'Open room', exact: true })).toBeVisible();
    await api(creator, 'rooms/update', {
      roomId: value.id,
      version: value.version,
      name: value.name,
      privacy: 'private',
      tags: value.tags,
      description: value.description,
    });
    const original = page.url(),
      modal = page.getByRole('dialog', { name: 'Open room', exact: true });
    await modal.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(modal.locator('.entry-error')).toContainText('could not be opened');
    expect(page.url()).toBe(original);
    await expect(page.locator('.room-shell')).toHaveAttribute('data-entry-state', 'preview');
    expect(
      (await api(page, 'rooms/browse?scope=mine')).rooms.some(
        (r: { id: string }) => r.id === value.id,
      ),
    ).toBe(false);
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  } finally {
    await owner.close();
    await viewer.close();
  }
});

test('shell follow-up: shared ambient backgrounds reflow in both themes and compact links retain icon labels/actions', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      value: async () => {
        Object.assign(window, { shareCalled: true });
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (value: string) => {
          Object.assign(window, { copiedValue: value });
        },
      },
    });
  });
  const value = await room(page);
  for (const theme of ['light', 'dark']) {
    await page.context().addCookies([
      {
        name: 'study-appearance',
        value: encodeURIComponent(JSON.stringify({ version: 1, value: theme })),
        url: 'https://localhost:8449',
        secure: true,
        sameSite: 'Lax',
      },
    ]);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [path, composition] of [
        ['/home', 'home'],
        ['/my-rooms', 'my-rooms'],
        ['/discover', 'discover'],
        ['/friends', 'friends'],
        ['/account', 'account'],
        [`/rooms/${value.publicId}/configure`, 'configure'],
      ]) {
        await page.goto(path!);
        await settled(page);
        await expect(page.locator('.app-ambient')).toHaveAttribute(
          'data-composition',
          composition!,
        );
        await expect(page.locator('.app-ambient')).toHaveCSS('position', 'fixed');
        expect(
          await page.locator('.app-ambient').evaluate((el) => getComputedStyle(el).backgroundImage),
        ).toContain('radial-gradient');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({ path: `${evidence}/ambient-${composition}-${theme}-${width}.png` });
      }
    }
  }
  const compact = page.locator('.compact-link').filter({ hasText: 'Copy' }).first();
  for (const name of ['Copy room link', 'Share room link']) {
    const button = compact.getByRole('button', { name, exact: true });
    await expect(button.locator('svg')).toHaveCount(1);
    await expect(button.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await button.focus();
    await page.keyboard.press('Enter');
  }
  await expect(compact.getByRole('status')).toHaveText('Copied.');
  expect(
    await page.evaluate(() => !!(window as unknown as { shareCalled: boolean }).shareCalled),
  ).toBe(true);
  expect(
    await page.evaluate(() => (window as unknown as { copiedValue: string }).copiedValue),
  ).toBe(new URL(`/rooms/${value.publicId}`, page.url()).href);
});
