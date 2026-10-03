import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { finishOnboarding } from './onboarding.ts';
async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
}
async function api(page: Page, path: string, input?: unknown) {
  return page.evaluate(
    async ({ path, input }) => {
      const csrf = await fetch('/api/v1/session/csrf').then((r) => r.json());
      const response = await fetch(
        `/api/v1/${path}`,
        input === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
              body: JSON.stringify(input),
            },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    { path, input },
  );
}
async function settled(page: Page) {
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByText(/^(Loading rooms…|Finding your space…|Loading…)$/)).toHaveCount(0);
  await expect(page.locator('.route-veil')).toHaveCount(0);
}
async function create(page: Page, name: string, privacy = 'public') {
  return api(page, 'rooms/create', {
    name,
    privacy,
    description: 'A calm place to work together',
    tags: ['Physics'],
  });
}

test('shared room card confirms entry by body, Open room and keyboard; settings never joins', async ({
  page,
}) => {
  await login(page);
  const room = await create(page, 'Card interaction');
  await api(page, 'backgrounds/change', { roomId: room.id, assetId: 'cedar-library', version: 0 });
  const joins: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/rooms/join')) joins.push(r.url());
  });
  await page.goto('/home');
  await settled(page);
  await page
    .locator('.home-rooms > section')
    .first()
    .locator('.room-card')
    .filter({ hasText: 'Card interaction' })
    .getByRole('button', { name: 'Open room', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'Open room', exact: true })).toBeVisible();
  expect(joins).toHaveLength(0);
  await page.keyboard.press('Escape');
  await page.goto('/my-rooms?search=Card&sort=largest');
  await settled(page);
  const card = page.locator('.room-card').filter({ hasText: 'Card interaction' });
  await expect(card).toContainText('Public');
  await expect(card).toContainText('Owner');
  await expect(card).toContainText('1 member');
  await expect(card).toContainText('0 online');
  await expect(card.locator('img')).toHaveAttribute(
    'src',
    /^\/_ipx\/.*\/backgrounds\/cedar-library-thumb\.webp$/,
  );
  await expect
    .poll(() => card.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await card.getByRole('link', { name: 'Settings for Card interaction' }).click();
  await settled(page);
  expect(joins).toHaveLength(0);
  await expect(page.locator('.room-shell')).toHaveCount(0);
  await page.screenshot({
    path: '.local/validation/mid03/desktop-room-management.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/my-rooms\?search=Card&sort=largest$/);
  await settled(page);
  await card.click({ position: { x: 120, y: 120 } });
  await expect(page.getByRole('dialog', { name: 'Open room', exact: true })).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Open room', exact: true })
    .getByRole('button', { name: 'Join room', exact: true })
    .click();
  await expect(page.locator('.room-shell')).toHaveAttribute('data-entry-state', 'active');
  expect(joins).toHaveLength(1);
  await page.goto('/my-rooms');
  await settled(page);
  await card.getByRole('button', { name: /Open room/ }).click();
  await expect(page.getByRole('dialog', { name: 'Open room', exact: true })).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Open room', exact: true })
    .getByRole('button', { name: 'Join room', exact: true })
    .click();
  await expect(page.locator('.room-shell')).toHaveAttribute('data-entry-state', 'active');
  expect(joins).toHaveLength(2);
  await page.goto('/my-rooms');
  await settled(page);
  await card.getByRole('button', { name: 'Card interaction', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog', { name: 'Open room', exact: true })).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Open room', exact: true })
    .getByRole('button', { name: 'Join room', exact: true })
    .click();
  await expect(page.locator('.room-shell')).toHaveAttribute('data-entry-state', 'active');
  expect(joins).toHaveLength(3);
  await page.goto('/my-rooms');
  await settled(page);
  await card.getByRole('button', { name: 'Card interaction', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Open room', exact: true })).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Open room', exact: true })
    .getByRole('button', { name: 'Join room', exact: true })
    .click();
  await expect(page.locator('.room-shell')).toHaveAttribute('data-entry-state', 'active');
  expect(joins).toHaveLength(4);
  await page.goto(`/rooms/${room.publicId}/configure?from=https://evil.test`);
  await settled(page);
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
  expect(joins).toHaveLength(4);
  await page.route('**/backgrounds/*-thumb.webp', (route) => route.abort());
  await page.goto('/my-rooms');
  await settled(page);
  await expect(card.locator('img')).toHaveCount(0);
  await expect(card.getByRole('button', { name: /Open room/ })).toBeVisible();
});

test('search, filters, ordering, query persistence and compact empty states', async ({ page }) => {
  await login(page);
  const suffix = Date.now();
  const name = `Browse ${suffix}`;
  await create(page, `${name} public`);
  await create(page, `${name} private`, 'private');
  await create(page, `${name} unlisted`, 'unlisted');
  await page.goto(`/discover?search=${encodeURIComponent(name)}&sort=newest&columns=2`);
  await settled(page);
  await expect(page.locator('.browse-main .room-card')).toHaveCount(1);
  await expect(page.locator('.browse-main')).not.toContainText(`${name} private`);
  await page.getByRole('button', { name: 'Friends here', exact: true }).click();
  await expect(page).toHaveURL(/filter=friends/);
  await expect(page.getByRole('heading', { name: 'No matching rooms' })).toBeVisible();
  await page.reload();
  await settled(page);
  await expect(page.getByRole('button', { name: 'Friends here', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Complete the clear operation before starting a separate search.
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/api/v1/rooms/browse' &&
        url.searchParams.get('filter') === 'all' &&
        url.searchParams.get('search') === ''
      );
    }),
    page.getByRole('button', { name: 'Clear filters' }).click(),
  ]);
  await settled(page);
  await page.getByRole('searchbox', { name: 'Search rooms', exact: true }).fill(`${name} private`);
  await page.getByRole('searchbox', { name: 'Search rooms', exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: 'No matching rooms' })).toBeVisible();
  await page.goto('/my-rooms');
  await settled(page);
  await page.getByRole('searchbox', { name: 'Search rooms', exact: true }).fill(`${name} private`);
  await expect(page.locator('.room-card')).toHaveCount(1);
  await expect(page.locator('.room-card')).toContainText('Private');
  await page.getByRole('combobox', { name: 'Grid columns', exact: true }).click();
  await page.getByRole('option', { name: '1 column', exact: true }).click();
  await expect(page).toHaveURL(/columns=1/);
  await page.goto('/my-rooms');
  await settled(page);
  await expect(page.locator('.room-grid')).toHaveAttribute('data-columns', '1');
  await page.getByRole('link', { name: 'Create a room', exact: true }).click();
  await settled(page);
  await page.getByLabel('Room name', { exact: true }).fill('Preview room');
  await page.getByRole('radio', { name: 'Unlisted Anyone with the room link' }).check();
  await expect(page.getByRole('complementary', { name: 'Room preview' })).toContainText(
    'Preview room',
  );
  await expect(page.getByRole('complementary', { name: 'Room preview' })).toContainText('Unlisted');
  await page.screenshot({
    path: '.local/validation/mid03/desktop-create-preview.png',
    fullPage: true,
  });
});

test('Home, browse and form composition reflow across themes and screen sizes', async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (let n = 0; n < 6; n++)
    await create(page, `Study corner ${n}`, n === 0 ? 'private' : 'public');
  const matrix = [
    ['desktop', 'light', 1440, 900],
    ['ultrawide', 'dark', 3440, 1440],
    ['tablet', 'light', 820, 1180],
    ['mobile', 'dark', 390, 844],
    ['small', 'light', 320, 760],
  ] as const;
  for (const [label, theme, width, height] of matrix) {
    await page.context().addCookies([
      {
        name: 'study-appearance',
        value: encodeURIComponent(JSON.stringify({ version: 1, value: theme })),
        domain: 'localhost',
        path: '/',
        secure: true,
        sameSite: 'Lax',
      },
    ]);
    await page.setViewportSize({ width, height });
    for (const route of ['/home', '/my-rooms', '/discover', '/friends', '/rooms/new']) {
      await page.goto(route);
      await settled(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(page.locator('.app-footer')).toBeAttached();
      if (route === '/home') {
        await expect(page.getByRole('heading', { name: 'My Rooms', exact: true })).toBeVisible();
        await expect(
          page.getByRole('heading', { name: 'Public Rooms', exact: true }),
        ).toBeVisible();
        await expect(page.getByRole('complementary', { name: 'Friends' })).toBeAttached();
        await expect(page.locator('.hero')).toHaveCount(0);
      }
      if (route === '/my-rooms') {
        const tracks = await page
          .locator('.room-grid')
          .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
        expect(tracks).toBeGreaterThanOrEqual(width >= 1400 ? 3 : 1);
      }
      if (
        route === '/home' ||
        route === '/my-rooms' ||
        (label === 'desktop' && (route === '/friends' || route === '/discover'))
      )
        await page.screenshot({
          path: `.local/validation/mid03/${label}-${route.slice(1)}.png`,
          fullPage: true,
        });
    }
  }
  await page.context().addCookies([
    {
      name: 'study-appearance',
      value: encodeURIComponent(JSON.stringify({ version: 1, value: 'system' })),
      domain: 'localhost',
      path: '/',
      secure: true,
      sameSite: 'Lax',
    },
  ]);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/my-rooms');
  await settled(page);
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'system');
  await expect(page.locator('.room-card-background').first()).toHaveCSS(
    'transition-duration',
    '0s',
  );
  expect(errors).toEqual([]);
});

test('Friends exact username search, selected pane, requests, invitation and mobile drill-in', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const a = await browser.newContext({ ignoreHTTPSErrors: true }),
    b = await browser.newContext({ ignoreHTTPSErrors: true });
  const alice = await a.newPage(),
    bob = await b.newPage();
  try {
    await login(alice);
    await login(bob);
    const owner = await api(alice, 'account/me'),
      friend = await api(bob, 'account/me');
    const room = await create(alice, 'Shared revision');
    await api(bob, 'rooms/join', { roomId: room.id });
    await alice.goto('/friends');
    await settled(alice);
    await alice
      .getByRole('searchbox', { name: 'Search people', exact: true })
      .fill(friend.username);

    await alice.getByRole('button', { name: 'Add friend' }).click();
    await bob.goto('/friends');
    await settled(bob);
    await bob.getByRole('button', { name: 'Accept', exact: true }).click();
    await alice.getByRole('button', { name: new RegExp(friend.username) }).click();
    await expect(alice.getByRole('region', { name: 'Selected friend' })).toContainText(
      'Shared revision',
    );
    await alice.getByRole('button', { name: 'Invite to room' }).click();
    await expect(bob.getByRole('heading', { name: 'Room invitations' })).toBeVisible();
    await alice.screenshot({
      path: '.local/validation/mid03/desktop-friend-selected.png',
      fullPage: true,
    });
    expect(await alice.locator('main').innerText()).not.toContain(friend.id);
    await api(bob, 'friends/privacy', {
      online: false,
      room: false,
      study: false,
      join: false,
      invites: true,
    });
    await alice.goto('/home');
    await settled(alice);
    const social = alice.getByRole('complementary', { name: 'Friends' });
    await expect(social).toContainText('Presence private');
    await expect(social.locator('.home-friend')).not.toContainText('Shared revision');
    await alice.goto(`/friends?friend=${friend.username}`);
    await settled(alice);
    await expect(alice.getByRole('region', { name: 'Selected friend' })).toContainText(
      friend.username,
    );
    await alice.setViewportSize({ width: 390, height: 844 });
    await expect(alice.getByRole('button', { name: '← Friends', exact: true })).toBeVisible();
    await alice.screenshot({
      path: '.local/validation/mid03/mobile-friend-selected.png',
      fullPage: true,
    });
    await alice.getByRole('button', { name: '← Friends', exact: true }).click();
    await expect(
      alice.getByRole('searchbox', { name: 'Search people', exact: true }),
    ).toBeVisible();
    await api(bob, 'friends/block', { targetId: owner.id });
    await expect(alice.locator('.friend-row')).toHaveCount(0);
    await alice.goto('/home');
    await settled(alice);
    await expect(alice.getByRole('complementary', { name: 'Friends' })).not.toContainText(
      friend.username,
    );
  } finally {
    await a.close();
    await b.close();
  }
});
