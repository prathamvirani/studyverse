import { expect, test } from '@playwright/test';

test('signs in, creates a lasting room, edits its profile and manages invitations', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL('/account');
  await expect(page.getByRole('heading', { name: 'Account & devices' })).toBeVisible();
  await page.getByLabel('Display name', { exact: true }).fill('<script>alert(1)</script>');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved.');
  await page.getByRole('link', { name: 'My Rooms', exact: true }).click();
  await page.getByRole('link', { name: 'Create a room' }).click();
  const name = `Study room ${Date.now()}`;
  await page.getByLabel('Room name').fill(name);
  await page.getByLabel('Privacy').selectOption('private');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const roomUrl = page.url();
  await page.getByRole('button', { name: 'Enter room', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Room controls' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to room details' }).click();
  await page.getByRole('button', { name: 'Create invite link', exact: true }).click();
  await expect(page.getByLabel('New invite link')).toContainText('/invite#');
  await page.getByRole('button', { name: 'Revoke invite', exact: true }).first().click();
  await page.reload();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.goto('/my-rooms');
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  // Simulate browser restart by restoring cookie state into a fresh browser context.
  const browser = context.browser()!;
  const next = await browser.newContext({
    storageState: await context.storageState(),
    ignoreHTTPSErrors: true,
  });
  const restored = await next.newPage();
  await restored.goto(roomUrl);
  await expect(restored.getByRole('heading', { name, exact: true })).toBeVisible();
  await next.close();
  const storage = await page.evaluate(async () => ({
    cookie: document.cookie,
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    databases: await indexedDB.databases(),
  }));
  expect(storage.cookie).not.toContain('__Host-study-session');
  expect(storage.local).toEqual([]);
  expect(storage.session).toEqual([]);
  expect(storage.databases.map((db) => db.name)).toEqual(['study-preferences-v1']);
  await page.screenshot({ path: '.local/validation/phase01-my-rooms.png', fullPage: true });
});

test('callback errors are read-only and a small viewport remains usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  await page.goto('/auth/callback/google?error=access_denied&state=invalid');
  await expect(page.getByRole('alert')).toContainText('cancelled');
  expect(posts).toEqual([]);
  expect(page.url()).not.toContain('state=');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Continue with Discord' })).toBeVisible();
  await page.screenshot({ path: '.local/validation/phase01-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

for (const provider of ['Discord']) {
  test(`completes the isolated ${provider} provider flow and signs out`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: `Continue with ${provider}` }).click();
    await expect(page).toHaveURL('/account');
    await expect(
      page.getByRole('button', { name: `Reauthenticate with ${provider.toLowerCase()}` }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  });
}
