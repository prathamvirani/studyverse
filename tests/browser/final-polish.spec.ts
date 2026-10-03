import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { finishOnboarding } from './onboarding.ts';
import { roomSettings } from './room-settings.ts';
const evidence = 'docs/references/mid04a/final-polish';
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
      const r = await fetch(
        '/api/v1/' + path,
        input === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
              body: JSON.stringify(input),
            },
      );
      if (!r.ok) throw new Error(path + ': ' + r.status);
      return r.json();
    },
    { path, input },
  );
}
async function create(page: Page) {
  return api(page, 'rooms/create', { name: 'Visual QA ' + Date.now(), privacy: 'public' });
}
async function active(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  const room = await create(page);
  await page.goto('/rooms/' + room.publicId);
  await expect(page.locator('.room-shell')).toHaveAttribute('data-entry-state', 'active');
  await expect(page.getByRole('timer')).toBeVisible();
  return room;
}
async function capture(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
  const session = await page.context().newCDPSession(page);
  try {
    const { data } = await session.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    });
    writeFileSync(`${evidence}/${name}.png`, Buffer.from(data, 'base64'));
  } finally {
    await session.detach();
  }
}

test('final polish: touch retains inline editing and keeps task actions reachable', async ({
  browser,
}) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await active(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const tasks = page.locator('[data-card-type="tasks.panel"]');
    await tasks.getByRole('button', { name: 'Move Tasks', exact: true }).tap();
    for (const name of ['Touch one', 'Touch two']) {
      await tasks.getByRole('textbox', { name: 'New task', exact: true }).fill(name);
      await tasks.getByRole('button', { name: 'Save new task' }).tap();
      await expect(tasks.getByRole('textbox', { name: 'New task', exact: true })).toHaveValue('');
      await expect(tasks.getByText(name, { exact: true })).toBeVisible();
    }
    const rows = tasks.locator('.task-list li');
    await rows.first().locator('.task-text').tap();
    await expect(rows.first().getByRole('textbox')).toBeFocused();
    await expect(rows.first().locator('.productivity-actions')).toHaveCSS('opacity', '1');
    await expect(rows.last().locator('.productivity-actions')).toHaveCSS('opacity', '1');
    await capture(page, 'touch-task-selected');
    await rows.first().getByRole('textbox').fill('Touch edited');
    await rows.first().getByRole('textbox').press('Enter');
    await expect(rows.first().locator('.task-text')).toHaveText('Touch edited');
  } finally {
    await context.close();
  }
});

test('final polish: expressive identity keeps its foreground on bright, dark and complex scenes', async ({
  page,
}) => {
  await active(page);
  const appearance = await roomSettings(page, 'Appearance');
  await appearance.getByRole('slider', { name: 'Manual fill', exact: true }).fill('0');
  await page.keyboard.press('Escape');
  for (const [id, title] of [
    ['morning-studio', 'Morning studio'],
    ['night-observatory', 'After midnight'],
    ['cedar-library', 'Cedar library'],
  ] as const) {
    await page.getByRole('button', { name: 'Background', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Backgrounds', exact: true });
    await modal.getByRole('button', { name: 'Select ' + title, exact: true }).click();
    await modal.getByRole('button', { name: 'Close backgrounds', exact: true }).click();
    await expect(page.locator('.environment-surface')).toHaveAttribute('data-background', id);
    const name = page.locator('.room-name');
    await expect(name).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(name).toHaveCSS('font-weight', '400');
    expect(await name.evaluate((el) => getComputedStyle(el).fontFamily)).toContain(
      'Instrument Serif',
    );
    expect(
      await page
        .locator('.room-title > span:not(.room-name)')
        .evaluate((el) => getComputedStyle(el).fontFamily),
    ).not.toContain('Instrument Serif');
    await capture(page, 'identity-' + id);
  }
});

test('final polish: integrated headers, lateral timer controls and contextual task actions', async ({
  page,
}) => {
  await active(page);
  const timer = page.locator('[data-card-type="pomodoro.panel"]'),
    tasks = page.locator('[data-card-type="tasks.panel"]');
  for (const card of [timer, tasks]) {
    const header = card.locator('.tile-toolbar'),
      initial = (await header.boundingBox())!;
    await expect(header.locator('.tile-utilities')).toBeVisible();
    await expect(header.locator('.ui-segments')).toBeVisible();
    await header.getByRole('radio', { name: 'Shared', exact: true }).click();
    expect(await header.boundingBox()).toEqual(initial);
    await header.getByRole('radio', { name: 'Personal', exact: true }).click();
  }
  for (const title of ['First step', 'Second step']) {
    await tasks.getByLabel('New task', { exact: true }).fill(title);
    await tasks.getByRole('button', { name: 'Save new task' }).click();
    await expect(tasks.getByRole('textbox', { name: 'New task', exact: true })).toHaveValue('');
    await expect(tasks.getByText(title, { exact: true })).toBeVisible();
  }
  const rows = tasks.locator('.task-list li'),
    actions = rows.first().locator('.productivity-actions');
  await page.mouse.move(300, 300);
  await page.keyboard.press('Tab');
  await timer.getByRole('timer').click();
  await expect(actions).toHaveCSS('opacity', '0');
  const text = rows.first().locator('.task-text'),
    before = (await text.boundingBox())!;
  await expect(text).toHaveCSS('text-align', 'left');
  await rows.first().hover();
  await expect(actions).toHaveCSS('opacity', '1');
  await expect(rows.last().locator('.productivity-actions')).toHaveCSS('opacity', '0');
  expect(await text.boundingBox()).toEqual(before);
  await expect(rows.first().getByRole('button', { name: 'Move task up' })).toBeDisabled();
  await expect(rows.last().getByRole('button', { name: 'Move task down' })).toBeDisabled();
  await text.click();
  const edit = rows.first().getByRole('textbox');
  await edit.fill('Edited first step');
  await edit.press('Enter');
  await expect(rows.first().locator('.task-text')).toHaveText('Edited first step');
  await expect(rows.first().getByRole('checkbox')).toBeEnabled();
  await rows.first().getByRole('checkbox').focus();
  await page.mouse.move(300, 300);
  await expect(actions).toHaveCSS('opacity', '1');
  await capture(page, 'tasks-focused-row');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    if (width === 390)
      await expect
        .poll(async () => (await timer.boundingBox())!.x)
        .toBeGreaterThanOrEqual(
          (await page.locator('.participant-rail').boundingBox())!.width + 20,
        );
    const digits = (await timer.getByRole('timer').boundingBox())!,
      reset = (await timer.getByRole('button', { name: 'Reset timer' }).boundingBox())!,
      play = (await timer.getByRole('button', { name: 'Play timer' }).boundingBox())!,
      settings = (await timer.getByRole('button', { name: 'Timer settings' }).boundingBox())!,
      skip = (await timer.getByRole('button', { name: 'Skip cycle' }).boundingBox())!;
    expect(reset.x + reset.width).toBeLessThanOrEqual(digits.x);
    expect(play.x).toBeGreaterThanOrEqual(digits.x + digits.width);
    expect(settings.x).toBeGreaterThanOrEqual(digits.x + digits.width);
    expect(Math.abs(reset.y + reset.height / 2 - digits.y - digits.height / 2)).toBeLessThan(2);
    expect(Math.abs(skip.x + skip.width / 2 - digits.x - digits.width / 2)).toBeLessThan(2);
    expect(Math.hypot(play.x - settings.x, play.y - settings.y)).toBeLessThan(50);
    await capture(page, 'headers-timer-' + width);
  }
});

test('final polish: compound address has one focus boundary and edits only the slug', async ({
  page,
}) => {
  await login(page);
  const room = await create(page);
  await page.goto(`/rooms/${room.publicId}/configure`);
  const form = page.locator('.room-address'),
    input = form.getByRole('textbox');
  const prefix = form.locator('.room-address-prefix');
  await input.fill('final-' + Date.now());
  await input.press('End');
  await input.press('x');
  await expect(prefix).toHaveText('studyspace.my/rooms/');
  await expect(prefix).toHaveCSS('user-select', 'none');
  await expect(input).toHaveCSS('border-left-width', '0px');
  await expect(input).toHaveCSS('outline-style', 'none');
  await expect(input).toHaveCSS('box-shadow', 'none');
  const geometry = await prefix.evaluate((el) => {
    const box = el.getBoundingClientRect(),
      input = el.nextElementSibling!;
    return {
      gap: parseFloat(getComputedStyle(el).paddingRight),
      seam: input.getBoundingClientRect().x - box.right,
      outline: getComputedStyle(el.parentElement!).outlineWidth,
    };
  });
  expect(geometry.gap).toBeGreaterThanOrEqual(8);
  expect(Math.abs(geometry.seam)).toBeLessThan(1);
  expect(geometry.outline).toBe('2px');
  await capture(page, 'address-focused');
  await form.getByRole('button', { name: 'Save room address' }).click();
  await expect(form.locator('.room-address-saved')).toHaveText('Saved');
});

test('final polish: shared menu rows retain hover foreground and native escape', async ({
  page,
}) => {
  await active(page);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const menu = page.getByRole('region', { name: 'Quick room actions' }),
    row = menu.locator('.ui-menu-row').first();
  const foreground = await row.evaluate((el) => getComputedStyle(el).color);
  await row.hover();
  await expect(row).toHaveCSS('color', foreground);
  expect(await row.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
    'rgba(0, 0, 0, 0)',
  );
  await capture(page, 'more-hover');
  await page.keyboard.press('Escape');
  const context = page.getByRole('menu', { name: 'Study Space actions' });
  const prevented = await page.locator('.room-top').evaluate(
    (el) =>
      !el.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 800,
          clientY: 300,
        }),
      ),
  );
  expect(prevented).toBe(true);
  await expect(context).toBeVisible();
  expect(await context.locator('.ui-menu-row svg').count()).toBe(
    await context.locator('.ui-menu-row').count(),
  );
  const disabled = context.locator('.ui-menu-row:disabled');
  for (const item of await disabled.all()) {
    await expect(item).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(item).toHaveCSS('opacity', '0.5');
  }
  await capture(page, 'context-menu');
  const native = await page.locator('.room-top').evaluate((el) =>
    el.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 800,
        clientY: 300,
      }),
    ),
  );
  expect(native).toBe(true);
  await expect(context).toBeHidden();
  await page
    .locator('[data-card-type="tasks.panel"]')
    .getByRole('textbox', { name: 'New task', exact: true })
    .dispatchEvent('contextmenu', { clientX: 900, clientY: 400 });
  await expect(context).toBeVisible();
  await expect(context.getByRole('menuitem', { name: 'Cut', exact: true })).toBeDisabled();
  await expect(context.getByRole('menuitem', { name: 'Cut', exact: true })).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  await expect(context.getByRole('menuitem', { name: 'Cut', exact: true })).toHaveCSS(
    'opacity',
    '0.5',
  );
  await capture(page, 'disabled-context-menu');
});

test('final polish: live chrome changes card snaps and top rail previews match the drop', async ({
  page,
}) => {
  test.setTimeout(60000);
  await active(page);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Rearrange view', exact: true }).click();
  const card = page.locator('[data-card-type="pomodoro.panel"]');
  const overlap = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  async function snapCard(name: string) {
    const grip = (await card
      .getByRole('button', { name: 'Move Pomodoro', exact: true })
      .boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(1350, 100);
    const preview = page.locator('.workspace-surface .snap-preview');
    await expect(preview).toBeVisible();
    const rect = (await preview.boundingBox())!;
    await capture(page, 'snap-preview-' + name);
    await page.mouse.up();
    await expect(card).toHaveClass(/tile-snapped/);
    await expect
      .poll(async () => {
        const actual = (await card.boundingBox())!;
        return Math.max(
          ...(['x', 'y', 'width', 'height'] as const).map((key) =>
            Math.abs(rect[key] - actual[key]),
          ),
        );
      })
      .toBeLessThan(1);
    for (const selector of ['.workspace-controls', '.room-top', '.room-dock', '.participant-rail'])
      expect(
        overlap((await card.boundingBox())!, (await page.locator(selector).boundingBox())!),
      ).toBe(false);
    return rect;
  }
  const initial = await snapCard('initial');
  const workspace = page.locator('.workspace-controls'),
    wg = (await page.getByRole('button', { name: 'Move workspace controls' }).boundingBox())!,
    wr = (await workspace.boundingBox())!;
  await page.mouse.move(wg.x + wg.width / 2, wg.y + wg.height / 2);
  await page.mouse.down();
  await page.mouse.move(wg.x + wg.width / 2 + 1440 - wr.width - 12 - wr.x, wg.y + wg.height / 2);
  await page.mouse.up();
  const changed = await snapCard('workspace-top-right');
  expect(changed).not.toEqual(initial);
  await page.getByRole('button', { name: 'Move room header' }).press('Alt+ArrowRight');
  await page.getByRole('button', { name: 'Move room dock' }).press('Shift+ArrowLeft');
  const rg = (await page.getByRole('button', { name: 'Move participants' }).boundingBox())!;
  await page.mouse.move(rg.x + rg.width / 2, rg.y + rg.height / 2);
  await page.mouse.down();
  await page.mouse.move(950, 20);
  const railPreview = (await page.locator('.rail-snap-preview').boundingBox())!;
  await capture(page, 'top-rail-preview');
  await page.mouse.up();
  await expect(page.locator('.room-shell')).toHaveAttribute('data-rail-edge', 'top');
  const rail = (await page.locator('.participant-rail').boundingBox())!;
  for (const key of ['x', 'y', 'width', 'height'] as const)
    expect(rail[key]).toBeCloseTo(railPreview[key], 0);
  expect(rail.width).toBeLessThan(400);
  expect(overlap(rail, (await workspace.boundingBox())!)).toBe(false);
  await snapCard('moved-header-rail-dock');
  await card.getByRole('button', { name: 'Unsnap card' }).click();
  await card.getByRole('button', { name: 'Move Pomodoro' }).press('Shift+ArrowLeft');
  const free = (await card.boundingBox())!;
  await page.getByRole('button', { name: 'Move workspace controls' }).press('Shift+ArrowLeft');
  await expect(card).not.toHaveClass(/tile-snapped/);
  expect(await card.boundingBox()).toEqual(free);
  await capture(page, 'top-rail-and-free-card');
});

test('final polish: friend context is compact, anchored and uses an overlay select', async ({
  browser,
}) => {
  test.setTimeout(60000);
  const a = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1000 },
    }),
    b = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const page = await a.newPage(),
      friendPage = await b.newPage();
    await login(page);
    await login(friendPage);
    const friend = await api(friendPage, 'account/me');
    await api(friendPage, 'friends/privacy', {
      online: true,
      room: false,
      study: false,
      join: false,
      invites: true,
    });
    await api(page, 'friends/request', { username: friend.username });
    const owner = await api(page, 'account/me');
    await api(friendPage, 'friends/accept', { targetId: owner.id });
    await create(page);
    await page.goto('/home');
    const anchor = page.locator('.home-friend').filter({ hasText: friend.username });
    await anchor.click();
    const popup = page.locator('.friend-quick-card[data-open="true"]');
    await expect(popup).toBeVisible();
    await expect(popup.locator('.friend-quick-name')).toContainText(friend.displayName);
    await expect(popup.locator('.friend-quick-name')).toContainText('·');
    await expect(popup.locator('.friend-quick-identity small')).toHaveText('@' + friend.username);
    const rect = (await popup.boundingBox())!,
      source = (await anchor.boundingBox())!;
    expect(rect.width).toBeLessThanOrEqual(300);
    expect(rect.height).toBeLessThan(250);
    expect(Math.abs(rect.x + rect.width - source.x - source.width)).toBeLessThan(2);
    expect(
      Math.min(
        Math.abs(rect.y - source.y - source.height),
        Math.abs(rect.y + rect.height - source.y),
      ),
    ).toBeLessThanOrEqual(8);
    await expect(popup.getByRole('link', { name: 'Friend details & shared rooms' })).toHaveClass(
      /ui-menu-row/,
    );
    await expect(popup.getByRole('link')).toHaveCSS('text-decoration-line', 'none');
    await popup.getByRole('combobox', { name: 'Invite to' }).click();
    await expect(page.getByRole('option').first()).toBeVisible();
    expect(await popup.boundingBox()).toEqual(rect);
    await capture(page, 'friend-context-select');
    await page.keyboard.press('Escape');
    await expect(popup).toBeVisible();
    await capture(page, 'friend-context');
  } finally {
    await a.close();
    await b.close();
  }
});
