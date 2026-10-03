import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createPool } from '@study/adapters/postgres';
import { finishOnboarding } from './onboarding.ts';
import { providerMock } from './media-provider.ts';
import { hideWorkspaceCards, roomSettings } from './room-settings.ts';

const evidence = 'docs/references/mid04a/owner-qa';
test.beforeAll(() => mkdirSync(evidence, { recursive: true }));
async function login(page: Page) {
  await page.goto('/home');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
}
async function api(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      const { csrfToken } = await fetch('/api/v1/session/csrf').then((r) => r.json());
      const response = await fetch(
        '/api/v1/' + path,
        body === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
              body: JSON.stringify(body),
            },
      );
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      return response.json();
    },
    { path, body },
  );
}
async function enter(page: Page) {
  await login(page);
  const room = await api(page, 'rooms/create', { name: 'Owner QA follow-up', privacy: 'public' });
  await page.goto(`/rooms/${room.publicId}`);
  await expect(page.locator('.room-dock')).toBeVisible();
  return room;
}

test('owner QA: all eight resize cursors, narrow hit zones, fixed anchors and unobstructed header actions', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await enter(page);
  await hideWorkspaceCards(page);
  await page.getByRole('button', { name: 'Workspace cards' }).click();
  await page
    .getByRole('region', { name: 'Workspace cards' })
    .getByLabel('Pomodoro', { exact: true })
    .check();
  await page.getByRole('button', { name: 'Workspace cards' }).click();
  const tile = page.locator('[data-card-type="pomodoro.panel"]');
  if (await tile.getByRole('button', { name: 'Unsnap card' }).count())
    await tile.getByRole('button', { name: 'Unsnap card' }).click();
  // Put the card away from all boundaries so every handle must change its active edge.
  const move = tile.getByRole('button', { name: 'Move Pomodoro' });
  for (let count = 0; count < 16; count++) await move.press('Shift+ArrowLeft');
  for (let count = 0; count < 6; count++) await move.press('Shift+ArrowDown');
  const cursors = {
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize',
    ne: 'nesw-resize',
    nw: 'nwse-resize',
    se: 'nwse-resize',
    sw: 'nesw-resize',
  };
  for (const [edge, cursor] of Object.entries(cursors)) {
    const handle = tile.locator('.resize-' + edge);
    await expect(handle).toHaveCSS('cursor', cursor);
    const zone = (await handle.boundingBox())!;
    expect(Math.min(zone.width, zone.height)).toBeLessThanOrEqual(edge.length === 1 ? 5 : 10);
    expect(
      await handle.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
      }),
    ).toBe(true);
    const start = (await tile.boundingBox())!;
    await page.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      zone.x + zone.width / 2 + (edge.includes('w') ? -30 : edge.includes('e') ? 30 : 0),
      zone.y + zone.height / 2 + (edge.includes('n') ? -30 : edge.includes('s') ? 30 : 0),
    );
    await page.mouse.up();
    const end = (await tile.boundingBox())!;
    if (edge.includes('e') || edge.includes('w'))
      expect(end.width).toBeCloseTo(start.width + 30, 0);
    if (edge.includes('n') || edge.includes('s'))
      expect(end.height).toBeCloseTo(start.height + 30, 0);
    expect(edge.includes('w') ? end.x + end.width : end.x).toBeCloseTo(
      edge.includes('w') ? start.x + start.width : start.x,
      0,
    );
    expect(edge.includes('n') ? end.y + end.height : end.y).toBeCloseTo(
      edge.includes('n') ? start.y + start.height : start.y,
      0,
    );
  }
  for (const button of await tile.locator('.tile-toolbar button:visible').all()) {
    expect(
      await button.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return (
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === el
        );
      }),
    ).toBe(true);
  }
  await tile.getByRole('button', { name: 'Fullscreen tile' }).click();
  await tile.getByRole('button', { name: 'Exit fullscreen' }).click();
  await tile.getByRole('button', { name: 'Minimize tile' }).click();
  await page.getByRole('button', { name: 'Restore Pomodoro', exact: true }).click();
  await page.screenshot({ path: `${evidence}/workspace-handles.png` });
});

test('owner QA: participant rail follows pointer with one localized edge preview and retained nodes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const room = await enter(page);
  await expect(page.locator('.participant-entry')).toHaveCount(1);
  await page.evaluate(() =>
    Object.assign(window, {
      originalRail: document.querySelector('.participant-rail'),
      originalParticipant: document.querySelector('.participant-entry'),
    }),
  );
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Rearrange view' }).click();
  for (const [edge, x, y] of [
    ['right', 1420, 350],
    ['top', 700, 20],
    ['bottom', 700, 980],
    ['left', 20, 350],
  ] as const) {
    const grip = (await page.getByRole('button', { name: 'Move participants' }).boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(600, 400);
    await expect(page.locator('.room-shell')).toHaveAttribute('data-rail-dragging', 'true');
    await expect(page.locator('.rail-snap-preview')).toHaveCount(0);
    const middle = (await page.locator('.participant-rail').boundingBox())!;
    await page.mouse.move(650, 430);
    const moved = (await page.locator('.participant-rail').boundingBox())!;
    expect(moved.x - middle.x).toBeCloseTo(50, 0);
    expect(moved.y - middle.y).toBeCloseTo(30, 0);
    await page.screenshot({ path: `${evidence}/rail-free-drag-${edge}.png` });
    await page.mouse.move(x, y);
    const preview = page.locator('.rail-snap-preview');
    await expect(preview).toHaveAttribute('data-edge', edge);
    const rect = (await preview.boundingBox())!;
    expect(Math.min(rect.width, rect.height)).toBeLessThanOrEqual(86);
    await page.screenshot({ path: `${evidence}/rail-preview-${edge}.png` });
    await page.mouse.up();
    await expect(page.locator('.room-shell')).toHaveAttribute('data-rail-edge', edge);
    await expect(page.locator('.participant-rail')).toHaveCSS(
      'flex-direction',
      ['left', 'right'].includes(edge) ? 'column' : 'row',
    );
    expect(
      await page.evaluate(() => {
        const state = window as unknown as { originalRail: Element; originalParticipant: Element };
        return (
          state.originalRail === document.querySelector('.participant-rail') &&
          state.originalParticipant === document.querySelector('.participant-entry')
        );
      }),
    ).toBe(true);
  }
  await page.getByRole('button', { name: 'Move participants' }).press('ArrowRight');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const user = await api(page, 'account/me');
  await expect
    .poll(() =>
      page.evaluate(
        async (key) =>
          new Promise<string | undefined>((resolve) => {
            const request = indexedDB.open('study-preferences-v1');
            request.onsuccess = () => {
              const db = request.result;
              const read = db.transaction('preferences').objectStore('preferences').get(key);
              read.onsuccess = () => {
                resolve(read.result?.value?.rail);
                db.close();
              };
              read.onerror = () => {
                db.close();
                resolve(undefined);
              };
            };
          }),
        `room-arrangement.${user.id}.${room.id}`,
      ),
    )
    .toBe('right');
  await page.reload();
  await expect(page.locator('.room-shell')).toHaveAttribute('data-rail-edge', 'right');
});

test('owner QA: collapsed and closed video presentation keeps one advancing synchronized player; explicit pause and stop work', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } }),
    ),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const [owner, member] = pages as [Page, Page];
  const position = (page: Page) =>
    page.evaluate(() =>
      (window as unknown as { mediaTest: { position: () => number }[] }).mediaTest[0]!.position(),
    );
  try {
    for (const page of pages) await providerMock(page);
    const room = await enter(owner);
    await login(member);
    await member.goto(`/rooms/${room.publicId}`);
    await expect(member.locator('.room-dock')).toBeVisible();
    await owner.getByRole('button', { name: 'Media', exact: true }).click();
    await owner.getByRole('textbox', { name: 'YouTube URL', exact: true }).fill('M7lc1UVf-VE');
    await owner
      .getByRole('region', { name: 'Media', exact: true })
      .getByRole('button', { name: 'Play', exact: true })
      .click();
    await member.getByRole('button', { name: 'Media', exact: true }).click();
    await member.getByRole('button', { name: 'Show video', exact: true }).click();
    for (const page of pages) {
      await expect(page.locator('.youtube-host iframe')).toHaveCount(1);
      await page.evaluate(() =>
        Object.assign(window, { originalPlayer: document.querySelector('.youtube-host iframe') }),
      );
    }
    const tile = owner.locator('.workspace-tile').filter({ has: owner.locator('.youtube-host') });
    const start = await position(owner);
    await tile.getByRole('button', { name: 'Minimize tile' }).click();
    await expect(tile).toHaveClass(/tile-collapsed-presentation/);
    await expect.poll(() => position(owner), { timeout: 10000 }).toBeGreaterThan(start + 5);
    await expect
      .poll(async () => Math.abs((await position(owner)) - (await position(member))))
      .toBeLessThan(2);
    const frame = (await owner.locator('.youtube-host iframe').boundingBox())!;
    expect(frame.width).toBeGreaterThanOrEqual(200);
    expect(frame.height).toBeGreaterThanOrEqual(200);
    await owner.screenshot({ path: `${evidence}/media-collapsed.png` });
    await tile.getByRole('button', { name: 'Open player', exact: true }).click();
    expect(await position(owner)).toBeGreaterThan(start + 5);
    await tile.getByRole('button', { name: 'Close tile', exact: true }).click();
    await expect(tile).toHaveClass(/tile-collapsed-presentation/);
    const closedPosition = await position(owner);
    await expect.poll(() => position(owner)).toBeGreaterThan(closedPosition + 4);
    for (const page of pages) {
      expect(
        await page.evaluate(
          () =>
            document.querySelector('.youtube-host iframe') ===
            (window as unknown as { originalPlayer: Element }).originalPlayer,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(() => (window as unknown as { mediaTest: unknown[] }).mediaTest.length),
      ).toBe(1);
    }
    await owner.getByRole('button', { name: 'Media', exact: true }).click();
    await owner.getByRole('button', { name: 'Pause room', exact: true }).click();
    for (const page of pages)
      await expect(page.locator('.room-video')).toHaveAttribute('data-player-state', 'paused');
    const stopped = await position(owner);
    await owner.waitForTimeout(3500);
    expect(await position(owner)).toBeCloseTo(stopped, 1);
    await owner.getByRole('button', { name: 'Remove queue item 1' }).click();
    await expect
      .poll(async () => (await api(owner, `room-media/snapshot?roomId=${room.id}`)).state.current)
      .toBeNull();
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});

test('owner QA: material fills visually transmit the backdrop across 0–100 in both themes and retain accessibility overrides', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const room = await enter(page);
  await page.goto('/account');
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  const layers = [];
  for (const theme of ['light', 'dark']) {
    for (const level of [0, 25, 50, 75, 100]) {
      await page.evaluate(
        ({ theme, level }) => {
          document.documentElement.setAttribute('data-appearance', theme);
          document.documentElement.setAttribute('data-glass-transparency', String(100 - level));
          document.body.style.background = 'rgb(40, 70, 110)';
          document.querySelector('#material-probe')?.remove();
          document.querySelector('#material-backdrop')?.remove();
          const backdrop = document.createElement('div');
          backdrop.id = 'material-backdrop';
          Object.assign(backdrop.style, {
            position: 'fixed',
            left: '400px',
            top: '300px',
            width: '300px',
            height: '160px',
            zIndex: '998',
            background: 'rgb(40, 70, 110)',
          });
          document.body.append(backdrop);
          const outer = document.createElement('div');
          outer.id = 'material-probe';
          outer.className = 'card ui-glass';
          Object.assign(outer.style, {
            position: 'fixed',
            left: '400px',
            top: '300px',
            width: '300px',
            height: '160px',
            zIndex: '999',
            border: '0',
            boxShadow: 'none',
            backdropFilter: 'none',
            borderRadius: '0',
            padding: '0',
          });
          const inner = document.createElement('div');
          inner.className = 'ui-glass ui-glass-elevated';
          Object.assign(inner.style, {
            position: 'absolute',
            left: '150px',
            top: '0',
            width: '150px',
            height: '160px',
            border: '0',
            boxShadow: 'none',
            backdropFilter: 'none',
            borderRadius: '0',
            padding: '0',
          });
          outer.append(inner);
          document.body.append(outer);
        },
        { theme, level },
      );
      layers.push(
        await page.locator('#material-probe').evaluate(
          (el, input) => ({
            ...input,
            outer: getComputedStyle(el).backgroundColor,
            inner: getComputedStyle(el.firstElementChild!).backgroundColor,
            before: getComputedStyle(el, '::before').backgroundImage,
            after: getComputedStyle(el, '::after').backgroundImage,
            card: getComputedStyle(document.querySelector('.card')!).backgroundColor,
          }),
          { theme, level },
        ),
      );
      await page
        .locator('#material-probe')
        .screenshot({ path: `${evidence}/fill-pixels-${theme}-${level}.png` });
      await page.evaluate(() => {
        document.querySelector('#material-probe')?.remove();
        document.querySelector('#material-backdrop')?.remove();
      });
      await page.screenshot({
        path: `${evidence}/account-fill-${theme}-${level}.png`,
        fullPage: true,
      });
    }
  }
  await page.goto(`/rooms/${room.publicId}`);
  await expect(page.locator('.room-dock')).toBeVisible();
  await page.evaluate(() =>
    document.documentElement.setAttribute('data-glass-transparency', '100'),
  );
  for (const selector of [
    '.participant-rail',
    '.workspace-tile:not([hidden])',
    '.room-title',
    '.room-dock',
  ])
    await expect(page.locator(selector).first()).toHaveCSS('background-color', /rgba\(.+, 0\)/);
  const sheet = await roomSettings(page, 'Appearance');
  await sheet.getByRole('slider', { name: 'Manual fill' }).fill('0');
  await expect(sheet).toHaveCSS('background-color', /rgba\(.+, 0\)/);
  await page.screenshot({ path: `${evidence}/room-fill-zero.png` });
  await page.emulateMedia({ contrast: 'more' });
  await expect(sheet).toHaveCSS('background-color', /rgb\(/);
  await expect(page.locator('.room-dock')).toHaveCSS('backdrop-filter', /blur\(0px\)/);
  await page.emulateMedia({ contrast: 'no-preference' });
  await page.evaluate(() =>
    document.documentElement.setAttribute('data-glass-transparency', 'auto'),
  );
  await expect(sheet).not.toHaveCSS('background-color', /rgba\(.+, 0\)/);
  writeFileSync(
    '.local/validation/mid04a-owner-qa/material-layers.json',
    JSON.stringify(layers, null, 2),
  );
});

test('owner QA: room filters and compact actions align at desktop, tablet and narrow widths', async ({
  page,
}) => {
  test.setTimeout(60000);
  await login(page);
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ['/my-rooms', '/discover']) {
      await page.goto(path);
      await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
      const controls = page
        .locator('.browse-filters')
        .locator('button[role="combobox"], .browse-filter-chips > button');
      const rectangles = await controls.evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { y: r.y, height: r.height };
        }),
      );
      for (const rect of rectangles) expect(rect.height).toBeCloseTo(44, 0);
      if (width === 1440) expect(new Set(rectangles.map((r) => Math.round(r.y))).size).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: `${evidence}/${path.slice(1)}-${width}.png` });
    }
    await page.goto('/home');
    for (const name of ['See all', 'Find a study friend →', 'All my rooms →', 'Explore rooms →']) {
      const action = page.getByRole('link', { name, exact: true });
      await expect(action).toHaveClass(/action-link/);
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test('owner QA: new active invites redisplay after reload; real hash-only legacy invite keeps its fallback', async ({
  page,
}) => {
  await login(page);
  const room = await api(page, 'rooms/create', { name: 'Invite continuity', privacy: 'private' });
  const fresh = await api(page, 'rooms/invite-create', {
    roomId: room.id,
    maxUses: 5,
    expiresInHours: 24,
  });
  const legacy = await api(page, 'rooms/invite-create', {
    roomId: room.id,
    maxUses: 5,
    expiresInHours: 24,
  });
  const local = Object.fromEntries(
    readFileSync('.local/compose.env', 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split('=')),
  );
  const url =
    process.env.TEST_DATABASE_URL ??
    `postgresql://study_runtime:${local.RUNTIME_PASSWORD}@localhost:5433/study_test`;
  if (!new URL(url).pathname.endsWith('_test')) throw new Error('Dedicated test database required');
  const pool = createPool(url);
  try {
    await pool.query('UPDATE rooms.invites SET token_cipher=NULL WHERE id=$1', [legacy.id]);
  } finally {
    await pool.end();
  }
  await page.goto(`/rooms/${room.publicId}/configure`);
  const links = page.locator('.compact-link[aria-label="Invite link"] input');
  await expect(links).toHaveCount(1);
  expect(await links.getAttribute('title')).toContain(fresh.token);
  await expect(
    page.getByText('This older link cannot be re-displayed. Create a new link to share again.'),
  ).toBeVisible();
  await page.reload();
  await expect(links).toHaveCount(1);
  expect(await links.getAttribute('title')).toContain(fresh.token);
  const listing = await api(page, `rooms/invites?roomId=${room.id}`);
  expect(listing.find((i: { id: string }) => i.id === fresh.id).status).toBe('active');
  expect(listing.find((i: { id: string }) => i.id === legacy.id).token).toBeNull();
  for (const item of listing) {
    expect(Object.keys(item)).not.toContain('token_hash');
    expect(Object.keys(item)).not.toContain('token_cipher');
  }
});
