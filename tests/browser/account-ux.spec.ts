import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { finishOnboarding } from './onboarding.ts';
const evidence = '.local/validation/mid02';
async function mutation(page: Page, path: string, input: unknown) {
  return page.evaluate(
    async ({ path, input }) => {
      const { csrfToken } = await fetch('/api/v1/session/csrf').then((r) => r.json());
      const r = await fetch(`/api/v1/${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
          'x-study-auth': '1',
        },
        body: JSON.stringify(input),
      });
      return { status: r.status, body: await r.json() };
    },
    { path, input },
  );
}
test('signed-out branding, stale cookie, provider failure isolation and responsive themes', async ({
  page,
  context,
}) => {
  await mkdir(evidence, { recursive: true });
  await context.addCookies([
    {
      name: '__Host-study-session',
      value: 'invalid-stale-cookie',
      url: 'https://localhost:8449',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  for (const [label, width, height, theme] of [
    ['auth-light', 1440, 900, 'light'],
    ['auth-dark-mobile', 390, 844, 'dark'],
    ['auth-tablet', 820, 1180, 'light'],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Discord' })).toBeVisible();
    await expect(page.locator('.app-navigation')).toHaveCount(0);
    await expect
      .poll(() =>
        page
          .locator('.provider-mark img')
          .evaluateAll((images) =>
            images.every((img) => (img as HTMLImageElement).naturalWidth > 0),
          ),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `${evidence}/${label}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.route('**/api/v1/account/start', async (route) => {
    if (route.request().postDataJSON().provider === 'google')
      await route.fulfill({ status: 503, body: '{}' });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('alert')).toContainText('Google sign-in could not start');
  await expect(page.getByRole('button', { name: 'Continue with Discord' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue with Discord' }).click();
  await finishOnboarding(page);
  await page.reload();
  await expect(page.getByRole('button', { name: /Continue with/ })).toHaveCount(0);
});
test('resumes first-run setup, persists appearance and width, integrates ultrawide without permission prompts', async ({
  page,
}) => {
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 2560, height: 1080 });
  const violations: string[] = [];
  page.on('pageerror', (e) => violations.push(e.message));
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new Error('Unexpected capture permission');
    };
    Notification.requestPermission = async () => {
      throw new Error('Unexpected notification permission');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL('/onboarding');
  await page.getByLabel('Display name', { exact: true }).fill('Quiet Scholar');
  await page.getByLabel('Username', { exact: true }).fill(`scholar_${Date.now()}`);
  await page.screenshot({ path: `${evidence}/onboarding-identity.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your light.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Choose your light.' })).toBeVisible();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
  await page.screenshot({ path: `${evidence}/onboarding-appearance.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(
    page.getByText('You’re using an ultrawide display.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Compressed', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Compressed', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
  await page.screenshot({
    path: `${evidence}/onboarding-ultrawide.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Finish setup', exact: true }).click();
  await expect(page).toHaveURL('/home');
  await page.reload();
  await expect(page).toHaveURL('/home');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(violations).toEqual([]);
});
test('account devices, cosmetic rename, responsive layout and dedicated deletion step-up', async ({
  page,
  context,
}) => {
  await mkdir(evidence, { recursive: true });
  let code = '';
  page.on('request', (r) => {
    if (r.url().endsWith('/account/finish') && !code) code = r.postDataJSON().code;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await finishOnboarding(page);
  await page.goto('/account');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await expect(page.getByText('Not connected', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reauthenticate with Google' })).toBeVisible();
  await expect(page.locator('.raw-ua')).not.toBeVisible();
  await page.getByText('Device details & name', { exact: true }).click();
  await page.getByLabel('Device name', { exact: true }).fill('Library laptop');
  await page.getByRole('button', { name: 'Save device name' }).click();
  await expect(page.getByRole('heading', { name: 'Library laptop' })).toBeVisible();
  await page.getByText('Technical details', { exact: true }).click();
  await expect(page.locator('.raw-ua')).toContainText('Mozilla');
  for (const [label, width, height] of [
    ['account-desktop', 1440, 1000],
    ['account-tablet', 820, 1180],
    ['account-mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `${evidence}/${label}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({
    path: `${evidence}/account-dark-mobile.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Sign out other devices' }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Other devices signed out.');
  expect((await mutation(page, 'account/delete-account', { confirmation: 'DELETE' })).status).toBe(
    403,
  );
  await page.route('**/api/v1/account/start', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const url = new URL(body.authorizationUrl);
    url.searchParams.set('code', code);
    body.authorizationUrl = url.toString();
    await route.fulfill({ response, json: body });
  });
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Delete your account' })).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Reauthenticate with Google' })
    .click();
  await expect(page).toHaveURL('/account#delete');
  await expect(page.getByLabel('Type DELETE to confirm')).toBeVisible();
  await page.getByLabel('Type DELETE to confirm').fill('delete');
  await expect(page.getByRole('button', { name: 'Permanently delete my account' })).toBeDisabled();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.screenshot({ path: `${evidence}/delete-confirmation.png`, fullPage: true });
  await page.getByRole('button', { name: 'Permanently delete my account' }).click();
  await expect(page).toHaveURL('/?deleted=done');
  await expect(page.getByText('Your account has been deleted.', { exact: true })).toBeVisible();
  expect((await context.cookies()).some((c) => c.name === '__Host-study-session')).toBe(false);
  expect((await page.request.get('/api/v1/account/me')).status()).toBe(401);
  expect(
    (await context.cookies()).filter((c) =>
      ['study-appearance', 'study-layout-width', 'study-glass-transparency'].includes(c.name),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const open = indexedDB.open('study-preferences-v1');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const count = db.transaction('preferences').objectStore('preferences').count();
            count.onsuccess = () => {
              resolve(count.result);
              db.close();
            };
            count.onerror = () => reject(count.error);
          };
        }),
    ),
  ).toBe(0);
});
for (const style of ['legacy', 'canonical'] as const) {
  test(
    style === 'legacy'
      ? 'an invite survives sign-in and onboarding without a browser-readable bearer store'
      : 'a canonical invite survives signup, hides its query and tracks one signup and join',
    async ({ page, browser }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Continue with Google' }).click();
      await finishOnboarding(page);
      const room = await mutation(page, 'rooms/create', {
        name: 'Invitation return',
        privacy: 'private',
      });
      const invite = await mutation(page, 'rooms/invite-create', {
        roomId: room.body.id,
        expiresInHours: 1,
        maxUses: 3,
      });
      const guestContext = await browser.newContext({ ignoreHTTPSErrors: true });
      const guest = await guestContext.newPage();
      try {
        await guest.goto(
          style === 'legacy'
            ? `https://localhost:8449/invite#${invite.body.token}`
            : `https://localhost:8449/rooms/${room.body.publicId}?invite-code=${invite.body.token}`,
        );
        await expect(guest.getByRole('button', { name: 'Continue with Discord' })).toBeVisible();
        if (style === 'canonical') await expect(guest).not.toHaveURL(/invite-code=/);
        await guest.getByRole('button', { name: 'Continue with Discord' }).click();
        await expect(guest).toHaveURL('/onboarding');
        await guest.getByLabel('Username', { exact: true }).fill(`invited_${Date.now()}`);
        await guest.getByRole('button', { name: 'Continue', exact: true }).click();
        await guest.getByRole('button', { name: 'Continue', exact: true }).click();
        await guest.getByRole('button', { name: 'Finish setup', exact: true }).click();
        await expect(guest.getByRole('button', { name: 'Accept invitation' })).toBeEnabled();
        await guest.getByRole('button', { name: 'Accept invitation' }).click();
        await expect(guest).toHaveURL(`/rooms/${room.body.publicId}`);
        await expect(guest.locator('.room-dock')).toBeVisible();
        if (style === 'canonical') {
          const tracked = await page.evaluate(
            async (roomId) => fetch(`/api/v1/rooms/invites?roomId=${roomId}`).then((r) => r.json()),
            room.body.id,
          );
          expect(tracked.find((item: { id: string }) => item.id === invite.body.id)).toMatchObject({
            signups: 1,
            joins: 1,
          });
        }
        expect(
          await guest.evaluate(() => ({
            local: Object.keys(localStorage),
            session: Object.keys(sessionStorage),
          })),
        ).toEqual({ local: [], session: [] });
      } finally {
        await guestContext.close();
      }
    },
  );
}
