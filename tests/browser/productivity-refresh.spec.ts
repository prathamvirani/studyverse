import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { refreshApi, refreshLogin, refreshRoom, refreshCapture } from './refresh-helpers.ts';
const evidence = 'docs/references/mid05';
test('productivity appearance stays local, retains state and supports clock, tasks and narrow reflow', async ({
  page,
}) => {
  test.setTimeout(100000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await refreshLogin(page);
  await refreshRoom(page, 'Productivity refresh');
  const timer = page.locator('[data-card-type="pomodoro.panel"]');
  await expect(timer.getByRole('timer')).toBeVisible();
  const initial = await refreshApi(page, 'pomodoro/personal-snapshot');
  const nodes = [
    '.room-shell',
    '.workspace-surface',
    '.pomodoro-timer',
    '.chat-panel',
    '.room-clock',
  ];
  await page.evaluate((selectors) => {
    (window as unknown as Record<string, unknown>).refreshNodes = selectors.map((s) =>
      document.querySelector(s),
    );
  }, nodes);
  await timer.getByRole('button', { name: 'Timer settings', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Timer settings', exact: true });
  expect(
    await sheet.locator('.timer-style-options').evaluate((el) => getComputedStyle(el).display),
  ).toBe('grid');
  for (const style of ['Flip', 'Progress bar', 'Gauge', 'Dot matrix', 'Pie', 'Default']) {
    await sheet.getByRole('button', { name: `Timer style: ${style}`, exact: true }).click();
    await expect(
      sheet.getByRole('button', { name: `Timer style: ${style}`, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
  }
  await sheet.getByRole('slider', { name: 'Timer scale', exact: true }).fill('1.1');
  await sheet.getByRole('combobox', { name: 'Alert sound', exact: true }).click();
  await page.getByRole('option', { name: 'Soft tone', exact: true }).click();
  await sheet.getByRole('button', { name: 'Preview alert', exact: true }).click();
  expect((await refreshApi(page, 'pomodoro/personal-snapshot')).state).toEqual(initial.state);
  await sheet.getByRole('button', { name: 'Close timer settings', exact: true }).click();
  await page.getByRole('button', { name: 'Clock settings', exact: true }).click();
  const clockSettings = page.getByRole('dialog', { name: 'Clock settings', exact: true });
  expect(
    await clockSettings
      .locator('.clock-style-options')
      .evaluate((el) => getComputedStyle(el).display),
  ).toBe('grid');
  await clockSettings.getByRole('radio', { name: '12-hour', exact: true }).click();
  await clockSettings.getByLabel('Show seconds', { exact: true }).check();
  await clockSettings.getByLabel('Flip clock', { exact: true }).check();
  await clockSettings.getByRole('button', { name: 'Serif', exact: true }).click();
  await clockSettings.getByRole('button', { name: 'Close clock settings', exact: true }).click();
  await expect(page.locator('.room-clock time')).toHaveAttribute(
    'aria-label',
    /\d{2}:\d{2}:\d{2} (AM|PM)/,
  );
  await expect(page.locator('.room-clock')).toHaveAttribute('data-clock-style', 'serif');
  const input = page.getByLabel('New task', { exact: true });
  await page
    .getByRole('radiogroup', { name: 'Task scope', exact: true })
    .getByRole('radio', { name: 'Shared', exact: true })
    .click();
  for (const title of ['First next step', 'Second next step']) {
    await input.fill(title);
    await input.press('Enter');
    await expect(
      page.getByRole('button', { name: `Edit task title: ${title}`, exact: true }),
    ).toBeVisible();
  }
  const second = page.locator('.task-list li').filter({ hasText: 'Second next step' });
  await second
    .getByRole('button', { name: 'Edit task title: Second next step', exact: true })
    .focus();
  await second.getByRole('button', { name: 'Move task up', exact: true }).click();
  await expect(page.locator('.task-list li').first()).toContainText('Second next step');
  await page.getByLabel('Complete Second next step', { exact: true }).check();
  await expect(page.getByLabel('Task completion', { exact: true })).toHaveText('1 / 2 completed');
  await page.getByLabel('Message', { exact: true }).fill('Draft kept through display changes');
  expect(
    await page.evaluate((selectors) => {
      const saved = (window as unknown as Record<string, unknown>)
        .refreshNodes as (Element | null)[];
      return selectors.every((s, i) => document.querySelector(s) === saved[i]);
    }, nodes),
  ).toBe(true);
  mkdirSync(evidence, { recursive: true });
  await refreshCapture(page, `${evidence}/productivity-desktop.png`);
  await page.reload();
  await expect(page.locator('.room-clock')).toHaveAttribute('data-clock-style', 'serif');
  await expect(page.locator('.room-clock time')).toHaveAttribute(
    'aria-label',
    /\d{2}:\d{2}:\d{2} (AM|PM)/,
  );
  await page
    .getByRole('radiogroup', { name: 'Task scope', exact: true })
    .getByRole('radio', { name: 'Shared', exact: true })
    .click();
  await expect(page.locator('.task-list li').first()).toContainText('Second next step');
  await page.setViewportSize({ width: 390, height: 844 });
  // Floating cards retain their arrangement at narrow widths; keyboard access also
  // exercises the settings affordance when another retained card overlaps it.
  await page.getByRole('button', { name: 'Clock settings', exact: true }).focus();
  await page.getByRole('button', { name: 'Clock settings', exact: true }).press('Enter');
  await expect(clockSettings).toBeVisible();
  expect(await clockSettings.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await refreshCapture(page, `${evidence}/clock-settings-narrow.png`);
});

test('natural completion alerts with auto-start off, respects runtime and ignores manual Skip', async ({
  page,
}) => {
  test.setTimeout(105000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await refreshLogin(page);
  await refreshRoom(page, 'Completion alert');
  const prior = await refreshApi(page, 'pomodoro/personal-snapshot');
  await refreshApi(page, 'pomodoro/personal-control', {
    version: prior.state.version,
    action: 'configure',
    config: {
      focusSeconds: 60,
      shortBreakSeconds: 60,
      longBreakSeconds: 120,
      cycles: 2,
      autoStart: false,
    },
  });
  await expect(page.getByRole('timer')).toHaveText('01:00');
  await page.getByRole('button', { name: 'Timer settings', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Timer settings', exact: true });
  await sheet.getByRole('combobox', { name: 'Personal alert runtime', exact: true }).click();
  await page.getByRole('option', { name: 'Until dismissed', exact: true }).click();
  await sheet.getByRole('button', { name: 'Close timer settings', exact: true }).click();
  await page.getByRole('button', { name: 'Skip cycle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dismiss alert', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset timer', exact: true }).click();
  await page.getByRole('button', { name: 'Play timer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dismiss alert', exact: true })).toBeVisible({
    timeout: 70000,
  });
  await expect(page.getByRole('button', { name: 'Play timer', exact: true })).toBeVisible();
  await expect(page.getByText('1 focus sessions', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss alert', exact: true }).click();
  await expect(page.locator('.timer-completion-bloom')).toHaveCount(0);
});
