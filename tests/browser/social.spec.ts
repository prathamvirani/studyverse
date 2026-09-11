import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
async function login(page: Page, provider: string) {
  await page.goto('/');
  await page.getByRole('button', { name: `Continue with ${provider}` }).click();
  await expect(page).toHaveURL('/account');
}
async function api(page: Page, path: string, input?: unknown) {
  return page.evaluate(
    async ({ path, input }) => {
      const csrf = await fetch('/api/v1/session/csrf').then((r) => r.json());
      const r = await fetch(
        `/api/v1/${path}`,
        input === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
              body: JSON.stringify(input),
            },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    { path, input },
  );
}
test('live participant menus, Friends, privacy and targeted invitation across two browsers', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const a = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 900 },
    }),
    b = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 900 },
    });
  const alice = await a.newPage(),
    bob = await b.newPage();
  a.setDefaultTimeout(10000);
  b.setDefaultTimeout(10000);
  const pageErrors: string[] = [];
  alice.on('pageerror', (error) => pageErrors.push(error.message));
  bob.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await login(alice, 'Google');
    await login(bob, 'Discord');
    await api(alice, 'account/profile', { displayName: 'Alex' });
    await api(bob, 'account/profile', { displayName: 'Sam' });
    await api(alice, 'friends/privacy', {
      online: true,
      room: true,
      study: true,
      join: false,
      invites: true,
    });
    await api(bob, 'friends/privacy', {
      online: true,
      room: true,
      study: true,
      join: false,
      invites: true,
    });
    const userA = await api(alice, 'account/me'),
      userB = await api(bob, 'account/me');
    for (const [page, targetId] of [
      [alice, userB.id],
      [bob, userA.id],
    ] as [Page, string][]) {
      const snapshot = await api(page, 'friends/snapshot');
      if (snapshot.blocked.some((p: { id: string }) => p.id === targetId))
        await api(page, 'friends/unblock', { targetId });
      if (snapshot.friends.some((p: { id: string }) => p.id === targetId))
        await api(page, 'friends/remove', { targetId });
      if (
        [...snapshot.incoming, ...snapshot.outgoing].some((p: { id: string }) => p.id === targetId)
      )
        await api(page, 'friends/decline', { targetId });
    }
    const room = await api(alice, 'rooms/create', { name: 'The quiet hours', privacy: 'public' });
    await alice.goto(`/rooms/${room.id}`);
    await bob.goto(`/rooms/${room.id}`);
    await alice.getByRole('button', { name: 'Enter room', exact: true }).click();
    await bob.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(alice.locator(`#participant-${userB.id}`)).toBeVisible();
    await expect(bob.locator(`#participant-${userA.id}`)).toBeVisible();
    await expect(alice.locator('.participant-entry')).toHaveCount(2);
    await alice.locator(`#participant-${userB.id}`).click();
    await alice.getByRole('button', { name: 'Add friend', exact: true }).click();
    await bob.goto('/friends');
    await expect(bob.getByRole('heading', { name: 'Friend requests', exact: true })).toBeVisible();
    await bob.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(bob.getByRole('heading', { name: 'Alex', exact: true })).toBeVisible();
    await bob.goto(`/rooms/${room.id}`);
    await bob.getByRole('button', { name: 'Enter room', exact: true }).click();
    await bob.locator('#participant-self').click();
    await bob
      .getByLabel('Your status', { exact: true })
      .selectOption('focusing', { timeout: 5000 });
    await expect(alice.locator(`#participant-${userB.id}`)).toHaveAttribute('title', /Focusing/);
    await alice.getByRole('button', { name: 'Close participant controls' }).click();
    await alice.screenshot({ path: '.local/validation/phase03-presence-desktop.png' });
    await alice.setViewportSize({ width: 768, height: 1024 });
    await alice.screenshot({ path: '.local/validation/phase03-presence-tablet.png' });
    await alice.setViewportSize({ width: 390, height: 844 });
    await alice.getByRole('button', { name: 'Hide panels' }).click();
    await alice.screenshot({ path: '.local/validation/phase03-presence-mobile.png' });
    expect(await alice.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await alice.goto('/friends');
    await alice.setViewportSize({ width: 1440, height: 900 });
    await expect(alice.getByRole('heading', { name: 'Sam', exact: true })).toBeVisible();
    await alice.screenshot({
      path: '.local/validation/phase03-friends-desktop.png',
      fullPage: true,
    });
    await alice.setViewportSize({ width: 768, height: 1024 });
    await alice.screenshot({
      path: '.local/validation/phase03-friends-tablet.png',
      fullPage: true,
    });
    await alice.setViewportSize({ width: 1440, height: 900 });
    await alice.getByText('Friend options', { exact: true }).click();
    await alice.getByRole('button', { name: 'Invite to room', exact: true }).click();
    await bob.goto('/friends');
    await expect(bob.getByRole('heading', { name: 'Room invitations', exact: true })).toBeVisible();
    await bob.getByRole('button', { name: 'Accept invitation', exact: true }).click();
    await bob.getByText('Presence & invitation privacy', { exact: true }).click();
    await bob.getByLabel('Show online presence', { exact: true }).uncheck();
    await bob.getByRole('button', { name: 'Save privacy' }).click();
    await expect(alice.getByText('Presence private', { exact: true })).toBeVisible();
    await alice.setViewportSize({ width: 390, height: 844 });
    await alice.screenshot({
      path: '.local/validation/phase03-friends-mobile.png',
      fullPage: true,
    });
    expect(await alice.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await alice.getByRole('button', { name: 'Block', exact: true }).click();
    await expect(alice.getByRole('heading', { name: 'Sam', exact: true })).toHaveCount(0);
    await alice.getByText('Blocked people (1)', { exact: true }).click();
    await alice.getByRole('button', { name: 'Unblock', exact: true }).click();
    expect(pageErrors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
