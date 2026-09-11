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
test('real productivity controls across clients, safe chat, private tasks and reconnect', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const a = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1000 },
    }),
    b = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1000 },
    });
  const alice = await a.newPage(),
    bob = await b.newPage(),
    errors: string[] = [];
  alice.on('pageerror', (e) => errors.push(e.message));
  bob.on('pageerror', (e) => errors.push(e.message));
  try {
    await login(alice, 'Google');
    await login(bob, 'Discord');
    const ua = await api(alice, 'account/me'),
      ub = await api(bob, 'account/me');
    for (const [page, id] of [
      [alice, ub.id],
      [bob, ua.id],
    ] as [Page, string][]) {
      const snapshot = await api(page, 'friends/snapshot');
      if (snapshot.blocked.some((p: { id: string }) => p.id === id))
        await api(page, 'friends/unblock', { targetId: id });
    }
    const room = await api(alice, 'rooms/create', { name: 'A little progress', privacy: 'public' });
    await alice.goto(`/rooms/${room.id}`);
    await bob.goto(`/rooms/${room.id}`);
    await alice.getByRole('button', { name: 'Enter room', exact: true }).click();
    await bob.getByRole('button', { name: 'Join room', exact: true }).click();
    await alice
      .getByRole('group', { name: 'Pomodoro scope' })
      .getByRole('button', { name: 'Shared', exact: true })
      .click();
    await bob
      .getByRole('group', { name: 'Pomodoro scope' })
      .getByRole('button', { name: 'Shared', exact: true })
      .click();
    await expect(alice.getByRole('button', { name: 'Start / Resume', exact: true })).toBeVisible();
    await expect(bob.getByText('Room owner controls the timer')).toBeVisible();
    await alice.getByRole('button', { name: 'Start / Resume', exact: true }).click();
    await expect(alice.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect.poll(async () => await bob.getByRole('timer').innerText()).not.toBe('25:00');
    await alice.getByRole('button', { name: 'Pause', exact: true }).click();
    await alice.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(bob.getByText(/SHORT BREAK · CYCLE/)).toBeVisible();
    await alice.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(bob.getByRole('timer')).toHaveText('25:00');
    await alice.getByLabel('New task', { exact: true }).fill('Private revision plan');
    await alice.getByRole('button', { name: 'Add task', exact: true }).click();
    await expect(alice.getByText('Private revision plan', { exact: true })).toBeVisible();
    await expect(bob.getByText('Private revision plan', { exact: true })).toHaveCount(0);
    await alice
      .getByRole('group', { name: 'Task scope', exact: true })
      .getByRole('button', { name: 'Shared', exact: true })
      .click();
    await bob
      .getByRole('group', { name: 'Task scope', exact: true })
      .getByRole('button', { name: 'Shared', exact: true })
      .click();
    await alice.getByLabel('New task', { exact: true }).fill('Review chapter together');
    await alice.getByRole('button', { name: 'Add task', exact: true }).click();
    await expect(bob.getByText('Review chapter together', { exact: true })).toBeVisible();
    await expect(bob.getByLabel('Edit Review chapter together', { exact: true })).toHaveCount(0);
    await alice.getByLabel('Complete Review chapter together', { exact: true }).check();
    await expect(bob.getByLabel('Complete Review chapter together', { exact: true })).toBeChecked();
    const hostile = '<script>window.pwned=true</script> 🌱';
    await bob.getByLabel('Message', { exact: true }).fill(hostile);
    await bob.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(alice.getByText(hostile, { exact: true })).toBeVisible();
    expect(await alice.locator('.chat-list script').count()).toBe(0);
    await alice
      .getByLabel('Message', { exact: true })
      .fill('One small step at a time. Ready for the next focus session?');
    await alice.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(
      bob.getByText('One small step at a time. Ready for the next focus session?', { exact: true }),
    ).toBeVisible();
    await b.setOffline(true);
    await b.setOffline(false);
    await bob.reload();
    await bob.getByRole('button', { name: 'Enter room', exact: true }).click();
    await expect(bob.getByText(hostile, { exact: true })).toBeVisible();
    await bob
      .getByRole('group', { name: 'Pomodoro scope' })
      .getByRole('button', { name: 'Shared', exact: true })
      .click();
    await expect(bob.getByRole('timer')).toHaveText('25:00');
    await alice.getByRole('button', { name: 'Start / Resume', exact: true }).click();
    await expect(alice.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await alice.getByLabel('Study panels').evaluate((el) => {
      el.scrollTop = 0;
    });
    await alice.screenshot({
      path: '.local/validation/phase04-productivity-desktop.png',
      fullPage: true,
    });
    await alice.setViewportSize({ width: 768, height: 1024 });
    await alice.getByLabel('Study panels').evaluate((el) => {
      el.scrollTop = 0;
    });
    await alice.screenshot({
      path: '.local/validation/phase04-productivity-tablet.png',
      fullPage: true,
    });
    await alice.setViewportSize({ width: 390, height: 844 });
    await alice.getByLabel('Study panels').evaluate((el) => {
      el.scrollTop = 0;
    });
    await alice.screenshot({
      path: '.local/validation/phase04-productivity-mobile.png',
      fullPage: true,
    });
    await alice.getByLabel('Study panels').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await alice.screenshot({ path: '.local/validation/phase04-chat-mobile.png', fullPage: true });
    expect(await alice.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});

test('personal timer survives scope changes, room changes and reload without leaking to members', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const a = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
  });
  const b = await browser.newContext({ ignoreHTTPSErrors: true });
  const alice = await a.newPage(),
    bob = await b.newPage();
  const select = async (page: Page, name: string) =>
    page
      .getByRole('group', { name: 'Pomodoro scope' })
      .getByRole('button', { name, exact: true })
      .click();
  try {
    await login(alice, 'Google');
    await login(bob, 'Discord');
    const first = await api(alice, 'rooms/create', {
      name: 'Personal continuity',
      privacy: 'public',
    });
    await alice.goto(`/rooms/${first.id}`);
    await alice.getByRole('button', { name: 'Enter room', exact: true }).click();
    await bob.goto(`/rooms/${first.id}`);
    await bob.getByRole('button', { name: 'Join room', exact: true }).click();
    await alice.getByRole('button', { name: 'Timer settings', exact: true }).click();
    await alice.getByLabel('Focus minutes', { exact: true }).fill('37');
    await alice.getByRole('button', { name: 'Save timer settings', exact: true }).click();
    await expect(alice.getByRole('timer')).toHaveText('37:00');
    await expect(bob.getByRole('timer')).toHaveText('25:00');
    await select(alice, 'Shared');
    await expect(alice.getByRole('timer')).toHaveText('25:00');
    await select(bob, 'Shared');
    await expect(bob.getByText('Room owner controls the timer')).toBeVisible();
    await select(alice, 'Personal');
    await expect(alice.getByRole('timer')).toHaveText('37:00');
    await alice.getByRole('button', { name: 'Start / Resume', exact: true }).click();
    await expect(alice.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    const before = await api(alice, 'pomodoro/personal-snapshot');
    const second = await api(alice, 'rooms/create', {
      name: 'Another study space',
      privacy: 'public',
    });
    await alice.goto(`/rooms/${second.id}`);
    await alice.getByRole('button', { name: 'Enter room', exact: true }).click();
    await expect(alice.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await alice.reload();
    await alice.getByRole('button', { name: 'Enter room', exact: true }).click();
    await expect(alice.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    const after = await api(alice, 'pomodoro/personal-snapshot');
    expect(after.state).toEqual(before.state);
    await expect(bob.getByRole('timer')).toHaveText('25:00');
    await select(bob, 'Personal');
    await expect(bob.getByRole('button', { name: 'Start / Resume', exact: true })).toBeVisible();
    await expect(bob.getByRole('timer')).toHaveText('25:00');
    await alice.getByLabel('Study panels').evaluate((el) => {
      el.scrollTop = 0;
    });
    await alice.screenshot({
      path: '.local/validation/phase04-personal-desktop.png',
      fullPage: true,
    });
    await alice.setViewportSize({ width: 390, height: 844 });
    await alice.getByLabel('Study panels').evaluate((el) => {
      el.scrollTop = 0;
    });
    await alice.screenshot({
      path: '.local/validation/phase04-personal-mobile.png',
      fullPage: true,
    });
    expect(await alice.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await a.close();
    await b.close();
  }
});
