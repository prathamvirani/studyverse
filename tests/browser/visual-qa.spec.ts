import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { finishOnboarding } from './onboarding.ts';
import { roomSettings } from './room-settings.ts';
const evidence = 'docs/references/mid04a/visual-qa';
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

test('visual QA: address availability is informational and invite output is an inline read-only field', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (value: string) => Object.assign(window, { copied: value }) },
    });
    Object.defineProperty(navigator, 'share', {
      value: async (value: unknown) => Object.assign(window, { shared: value }),
    });
  });
  await login(page);
  const room = await create(page);
  await page.goto(`/rooms/${room.publicId}/configure`);
  const form = page.locator('.room-address'),
    field = form.getByRole('textbox');
  await expect(form.locator('.room-address-prefix')).toHaveText('studyspace.my/rooms/');
  await expect(form.locator('.room-address-status')).toHaveCount(0);
  const slug = 'visual-' + Date.now();
  let saves = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/rooms/slug')) saves++;
  });
  await field.fill(slug);
  await expect(form.locator('.room-address-status')).toHaveAttribute(
    'aria-label',
    'Availability: available',
  );
  await form.locator('.room-address-status').click();
  expect(saves).toBe(0);
  await form.getByRole('button', { name: 'Save room address', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${slug}/configure`));
  await expect(form.locator('.room-address-saved')).toHaveText('Saved');
  expect(saves).toBe(1);
  await page.getByRole('button', { name: 'Copy room link' }).click();
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(
    new URL('/rooms/' + slug, page.url()).href,
  );
  await page.getByRole('button', { name: 'Share room link' }).click();
  expect(
    await page.evaluate(() => (window as unknown as { shared: { url: string } }).shared.url),
  ).toBe(new URL('/rooms/' + slug, page.url()).href);
  await field.fill(slug + '-next');
  await expect(form.locator('.room-address-saved')).toHaveCount(0);
  await expect(form.getByRole('button', { name: 'Save room address' })).toBeEnabled();
  await page.getByRole('button', { name: 'Create invite link', exact: true }).click();
  const output = page.locator('.generated-invite'),
    link = output.getByRole('textbox', { name: 'New invite link' });
  await expect(link).toHaveAttribute('readonly', '');
  await expect(link).toHaveValue(/\?invite-code=/);
  await output.getByRole('button', { name: 'Copy invite link' }).click();
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(
    await link.inputValue(),
  );
  await expect(output.locator('.link-field button')).toHaveCount(2);
  const rect = (await output.boundingBox())!,
    history = (await page.locator('.card.device').first().boundingBox())!;
  expect(history.y - rect.y - rect.height).toBeGreaterThanOrEqual(24);
  await capture(page, 'address-invite-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, 'address-invite-narrow');
});

test('visual QA: opaque preload waits for the actual selected background and admits the same inert scene', async ({
  page,
}) => {
  await login(page);
  const room = await create(page);
  const bg = await api(page, 'backgrounds/snapshot?roomId=' + room.id);
  await api(page, 'backgrounds/change', {
    roomId: room.id,
    version: bg.state.version,
    assetId: 'cedar-library',
  });
  await page.goto('/my-rooms');
  await expect(page.locator('.route-veil')).toHaveCount(0);
  let release!: () => void;
  const wait = new Promise<void>((r) => (release = r));
  await page.route('**/backgrounds/cedar-library.webp', async (route) => {
    await wait;
    await route.continue();
  });
  let joins = 0,
    rtc = 0;
  const commands: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/rooms/join')) joins++;
    if (r.method() === 'POST' && r.url().endsWith('/rtc/join')) rtc++;
  });
  page.on('websocket', (socket) =>
    socket.on('framesent', ({ payload }) => {
      try {
        const m = JSON.parse(String(payload));
        if (m.payload?.roomId === room.id) commands.push(m.command);
      } catch {
        /* provider frame */
      }
    }),
  );
  await page
    .locator('.room-card')
    .filter({ hasText: room.name })
    .getByRole('button', { name: 'Open room', exact: true })
    .click();
  await expect(page.locator('.route-veil')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Open room', exact: true })).toBeHidden();
  expect(joins).toBe(0);
  expect(rtc).toBe(0);
  release();
  const modal = page.getByRole('dialog', { name: 'Open room', exact: true });
  await expect(modal).toBeVisible();
  const environment = page.locator('.environment-surface');
  await expect(environment).toHaveAttribute('data-background', 'cedar-library');
  await expect(environment.locator('img')).toHaveAttribute(
    'src',
    '/backgrounds/cedar-library.webp',
  );
  expect(
    await environment
      .locator('img')
      .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
  ).toBe(true);
  await expect(page.locator('.room-preview-background')).toHaveCount(0);
  await expect(page.locator('.room-shell')).toHaveAttribute('inert', '');
  await expect(page.locator('.room-name')).toHaveText(room.name);
  expect(joins).toBe(0);
  expect(rtc).toBe(0);
  expect(commands).toEqual([]);
  await page.evaluate(() =>
    Object.assign(window, {
      previewShell: document.querySelector('.room-shell'),
      previewEnvironment: document.querySelector('.environment-surface'),
      previewImage: document.querySelector('.environment-surface img'),
    }),
  );
  await capture(page, 'actual-selected-preentry');
  await modal.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator('.room-shell')).toHaveAttribute('data-entry-state', 'active');
  await expect(environment).toHaveAttribute('data-background', 'cedar-library');
  expect(
    await page.evaluate(() => {
      const w = window as unknown as {
        previewShell: Element;
        previewEnvironment: Element;
        previewImage: Element;
      };
      return (
        w.previewShell === document.querySelector('.room-shell') &&
        w.previewEnvironment === document.querySelector('.environment-surface') &&
        w.previewImage === document.querySelector('.environment-surface img')
      );
    }),
  ).toBe(true);
  expect(joins).toBe(1);
  await expect.poll(() => rtc).toBe(1);
  await expect(page.getByText('Make yourself a little space.', { exact: true })).toBeVisible();
  await capture(page, 'same-selected-admitted');
});

test('visual QA: inline tasks and header scopes reflow, timer settings and slider endpoints align', async ({
  page,
}) => {
  await active(page);
  const tasks = page.locator('[data-card-type="tasks.panel"]'),
    timer = page.locator('[data-card-type="pomodoro.panel"]');
  for (const card of [tasks, timer]) {
    await expect(card.locator('.tile-toolbar .ui-segments')).toBeVisible();
    await expect(card.locator('[data-tile-id] strong')).toHaveCount(0);
  }
  const field = tasks.getByLabel('New task', { exact: true });
  await field.fill('First step');
  await tasks.getByRole('button', { name: 'Save new task' }).click();
  await expect(tasks.getByText('First step', { exact: true })).toBeVisible();
  await field.fill('Second step');
  await tasks.getByRole('button', { name: 'Save new task' }).click();
  const rows = tasks.locator('.task-list li');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().getByRole('button', { name: 'Move task up' })).toBeDisabled();
  await expect(rows.last().getByRole('button', { name: 'Move task down' })).toBeDisabled();
  await expect(tasks.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  const old = await rows.first().boundingBox();
  await rows.first().hover();
  expect(await rows.first().boundingBox()).toEqual(old);
  await rows
    .first()
    .getByRole('button', { name: 'Edit task title: First step', exact: true })
    .click();
  const edit = rows.first().getByRole('textbox');
  await edit.fill('Updated first step');
  await edit.press('Enter');
  await expect(rows.first().getByText('Updated first step', { exact: true })).toBeVisible();
  const controls = (await timer.locator('.timer-controls').boundingBox())!,
    digits = (await timer.getByRole('timer').boundingBox())!,
    skip = (await timer.getByRole('button', { name: 'Skip cycle' }).boundingBox())!;
  expect(Math.abs(skip.x + skip.width / 2 - (digits.x + digits.width / 2))).toBeLessThan(2);
  expect(controls.width).toBeLessThan(160);
  await timer.getByRole('button', { name: 'Timer settings' }).click();
  const sheet = page.getByRole('dialog', { name: 'Timer settings', exact: true });
  const durations = sheet.locator('.timer-duration-grid');
  expect(
    await durations.evaluate(
      (el) =>
        getComputedStyle(el)
          .gridTemplateColumns.split(' ')
          .filter((n) => parseFloat(n) > 0).length,
    ),
  ).toBe(4);
  await expect(sheet.getByRole('status')).toContainText('Changes apply immediately');
  await sheet.getByLabel('Focus minutes', { exact: true }).fill('26');
  await sheet.getByLabel('Focus minutes', { exact: true }).press('Tab');
  await expect(sheet.getByRole('status')).toContainText('Saved');
  await expect(sheet).toBeVisible();
  const volume = sheet.getByRole('slider', { name: 'Alert volume' });
  await expect(volume).toBeVisible();
  for (const value of ['0', '0.5', '1']) {
    await volume.fill(value);
    const geometry = await volume.evaluate((el) => {
      const input = el as HTMLInputElement,
        box = input.getBoundingClientRect(),
        track = input.parentElement!.querySelector('.ui-slider-track')!.getBoundingClientRect(),
        css = getComputedStyle(input),
        f = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
      return {
        padding: [css.paddingLeft, css.paddingRight],
        thumb: box.x + 10 + f * (box.width - 20),
        expected: track.x + f * track.width,
        fill: getComputedStyle(input.parentElement!).getPropertyValue('--slider-fill'),
      };
    });
    expect(geometry.padding).toEqual(['0px', '0px']);
    expect(geometry.thumb).toBeCloseTo(geometry.expected, 4);
    expect(geometry.fill).toBe(`${Number(value) * 100}%`);
  }
  await capture(page, 'timer-settings-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await durations.evaluate(
      (el) =>
        getComputedStyle(el)
          .gridTemplateColumns.split(' ')
          .filter((n) => parseFloat(n) > 0).length,
    ),
  ).toBe(2);
  await capture(page, 'timer-settings-narrow');
});

test('visual QA: lower workspace uses empty dock sides and freed dock area, corners stay clean', async ({
  page,
}) => {
  await active(page);
  const chat = page.locator('[data-card-type="chat.panel"]');
  await expect(chat.locator('.tile-resize svg')).toHaveCount(0);
  await expect(chat.locator('.tile-resize')).toHaveCount(8);
  const surface = (await page.locator('.workspace-surface').boundingBox())!;
  expect(surface.y + surface.height).toBeGreaterThan(980);
  await chat.getByRole('button', { name: 'Unsnap card' }).click();
  const move = chat.getByRole('button', { name: 'Move Chat', exact: true });
  for (let n = 0; n < 40; n++) await move.press('Shift+ArrowDown');
  const box = (await chat.boundingBox())!;
  expect(box.y + box.height).toBeGreaterThan(970);
  for (let n = 0; n < 4; n++) await move.press('Shift+ArrowUp');
  const resizedStart = (await chat.boundingBox())!;
  for (let n = 0; n < 4; n++)
    await chat.getByRole('button', { name: 'Resize tile', exact: true }).press('Shift+ArrowDown');
  const resizedEnd = (await chat.boundingBox())!;
  expect(resizedEnd.y).toBe(resizedStart.y);
  expect(resizedEnd.x).toBe(resizedStart.x);
  expect(resizedEnd.y + resizedEnd.height).toBeGreaterThan(970);
  const dock = (await page.locator('.room-dock').boundingBox())!;
  expect(box.x >= dock.x + dock.width + 7 || box.x + box.width <= dock.x - 7).toBe(true);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const menu = page.getByRole('region', { name: 'Quick room actions' });
  await expect(menu.locator('.ui-menu-row')).toHaveCount(3);
  await expect(menu.locator('.ui-menu-row').first()).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  await page.keyboard.press('Escape');
  await page.locator('.room-dock').dispatchEvent('contextmenu', { clientX: 700, clientY: 850 });
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('menuitem', { name: 'Pop out room controls', exact: true }).click();
  const popup = await popupPromise;
  await popup.setViewportSize({ width: 720, height: 240 });
  await expect(popup.locator('.room-dock')).toBeVisible();
  const strip = (await popup.locator('.room-dock').boundingBox())!;
  expect(strip.height).toBeLessThan(110);
  await capture(popup, 'compact-controls-companion');
  for (let n = 0; n < 26; n++) await move.press('Shift+ArrowLeft');
  const freed = (await chat.boundingBox())!;
  expect(freed.y + freed.height).toBeGreaterThan(970);
  await capture(page, 'usable-lower-workspace');
  await popup.close();
});

test('visual QA: participant popover and identity retain readable hierarchy across actual backgrounds', async ({
  page,
}) => {
  await active(page);
  await page.locator('#participant-self').click();
  const popover = page.getByRole('region', { name: 'Participant controls' });
  await expect(popover.getByRole('combobox', { name: 'Your status', exact: true })).toBeVisible();
  await expect(popover.locator('select')).toHaveCount(0);
  const shape = await popover.boundingBox();
  await popover.getByRole('combobox', { name: 'Your status' }).click();
  await expect(page.getByRole('option', { name: 'Online', exact: true })).toBeVisible();
  expect(await popover.boundingBox()).toEqual(shape);
  await page.keyboard.press('Escape');
  await capture(page, 'participant-popover');
  await popover.getByRole('button', { name: 'Close participant controls' }).click();
  const appearance = await roomSettings(page, 'Appearance');
  await appearance.getByRole('slider', { name: 'Manual fill', exact: true }).fill('0');
  await page.keyboard.press('Escape');
  for (const [id, title] of [
    ['morning-studio', 'Morning studio'],
    ['night-observatory', 'After midnight'],
    ['cedar-library', 'Cedar library'],
  ] as const) {
    await page.getByRole('button', { name: 'Background', exact: true }).click();
    const backgrounds = page.getByRole('dialog', { name: 'Backgrounds', exact: true });
    await backgrounds.getByRole('button', { name: 'Select ' + title, exact: true }).click();
    await backgrounds.getByRole('button', { name: 'Close backgrounds', exact: true }).click();
    await expect(page.locator('.environment-surface')).toHaveAttribute('data-background', id);
    const name = page.locator('.room-name');
    await expect(name).toHaveCSS('color', 'rgb(255, 255, 255)');
    const size = await name.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThan(15);
    await expect(page.locator('.scene-caption')).toBeVisible();
    await capture(page, 'identity-' + id);
  }
});

test('visual QA: authorized participants adopt one responsive grid while the room keeps its rail', async ({
  browser,
}) => {
  test.setTimeout(60000);
  const contexts = await Promise.all(
    Array.from({ length: 3 }, () =>
      browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } }),
    ),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  try {
    const room = await active(pages[0]!);
    for (const page of pages.slice(1)) {
      await login(page);
      await page.goto('/rooms/' + room.publicId);
    }
    const owner = pages[0]!;
    await expect(owner.locator('.participant-entry')).toHaveCount(3);
    await owner.evaluate(() =>
      Object.assign(window, {
        originalParticipants: [...document.querySelectorAll('.participant-entry')],
      }),
    );
    await owner
      .locator('.participant-rail')
      .dispatchEvent('contextmenu', { clientX: 90, clientY: 200 });
    const waiting = owner.waitForEvent('popup');
    await owner.getByRole('menuitem', { name: 'Pop out participants', exact: true }).click();
    const popup = await waiting;
    for (const size of [
      { width: 720, height: 300 },
      { width: 220, height: 600 },
    ]) {
      await popup.setViewportSize(size);
      const rail = popup.locator('.participant-rail');
      await expect(rail).toHaveCSS('display', 'grid');
      await expect(rail.locator('.participant-entry')).toHaveCount(3);
      const columns = await rail.evaluate(
        (el) =>
          getComputedStyle(el)
            .gridTemplateColumns.split(' ')
            .filter((n) => parseFloat(n) > 0).length,
      );
      expect(columns).toBe(size.width > 500 ? 3 : 1);
      await expect(pages[1]!.locator('.participant-rail')).toHaveCSS('display', 'flex');
      expect(
        await rail.evaluate((el) => {
          const w = window.opener as unknown as { originalParticipants: Element[] };
          return [...el.querySelectorAll('.participant-entry')].every(
            (p, i) => p === w.originalParticipants[i],
          );
        }),
      ).toBe(true);
      await capture(popup, 'participant-grid-' + size.width);
    }
    await popup.close();
    await expect(owner.locator('.participant-rail')).toHaveCSS('display', 'flex');
  } finally {
    for (const context of contexts) await context.close();
  }
});
