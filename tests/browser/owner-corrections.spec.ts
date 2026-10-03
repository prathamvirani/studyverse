import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { finishOnboarding } from './onboarding.ts';

async function login(page: Page) {
  await page.goto('/home');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
}
async function create(page: Page) {
  return page.evaluate(async () => {
    const { csrfToken } = await fetch('/api/v1/session/csrf').then((r) => r.json());
    const r = await fetch('/api/v1/rooms/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ name: 'Owner corrections', privacy: 'private' }),
    });
    if (!r.ok) throw new Error('Create room failed');
    return r.json();
  });
}
test('owner claims a short address, redisplays and revokes an invite, and uses the separate study route', async ({
  page,
}) => {
  test.setTimeout(60000);
  await login(page);
  const room = await create(page);
  expect(room.publicId).toMatch(/^[a-f0-9]{12}$/);
  await page.goto(`/rooms/${room.publicId}/configure`);
  await expect(page.getByRole('link', { name: 'Study Space Home' })).toBeVisible();
  const slug = 'quiet-' + Date.now();
  await page.getByRole('textbox', { name: 'Room address (optional)' }).fill(slug);
  await expect(page.getByRole('button', { name: 'Save room address' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save room address' }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${slug}/configure`));
  await page.getByRole('button', { name: 'Create invite link', exact: true }).click();
  const link = page.locator('.compact-link[aria-label="Invite link"] input');
  await expect(link).toHaveValue(/\?invite-code=/);
  const full = await link.getAttribute('title');
  await page.reload();
  await expect(link).toHaveAttribute('title', full!);
  await page.screenshot({ path: 'docs/references/mid04a/room-configure.png', fullPage: true });
  await page.getByRole('button', { name: 'Revoke invite', exact: true }).click();
  await expect(link).toHaveCount(0);
  await page.getByRole('button', { name: 'Enter room', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${slug}(?:\\?|$)`));
  await expect(page.locator('.room-shell')).toBeVisible();
  await page.reload();
  await expect(page.locator('.room-shell')).toBeVisible();
});

test('username explanations and select overlays leave account geometry fixed at desktop and narrow widths', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Blocked people' })).toBeVisible();
  const section = page
    .locator('section.card')
    .filter({ has: page.getByRole('heading', { name: 'Username', exact: true }) });
  const field = section.getByRole('textbox', { name: 'Username', exact: true });
  await field.fill('admin');
  const measure = () =>
    section.evaluate((el) => ({
      x: (el as HTMLElement).offsetLeft,
      y: (el as HTMLElement).offsetTop,
      width: (el as HTMLElement).offsetWidth,
      height: (el as HTMLElement).offsetHeight,
    }));
  const before = await measure();
  await section.locator('.username-status').click();
  await expect(page.getByRole('region', { name: 'Username availability' })).toBeVisible();
  expect(await measure()).toEqual(before);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'docs/references/mid04a/account-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/references/mid04a/account-narrow.png', fullPage: true });
  const loaded = page.waitForResponse('**/api/v1/rooms/browse?scope=discover*');
  await page.goto('/discover');
  await loaded;
  await expect(page.getByText('Loading rooms…', { exact: true })).toHaveCount(0);
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.route-veil')).toHaveCount(0);
  const main = await page.locator('main').boundingBox();
  await page.getByRole('combobox', { name: 'Sort rooms' }).click();
  await expect(page.getByRole('listbox')).toBeVisible();
  expect(await page.locator('main').boundingBox()).toEqual(main);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'docs/references/mid04a/discover-narrow.png', fullPage: true });
});
