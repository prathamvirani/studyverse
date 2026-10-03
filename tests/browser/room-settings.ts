import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
export async function roomSettings(page: Page, category = 'Media & Devices') {
  const sheet = page.locator('dialog.room-settings');
  if ((await sheet.getAttribute('open')) === null) {
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name: 'Advanced settings', exact: true }).click();
  }
  await expect(sheet).toHaveAttribute('open', '');
  const back = sheet.getByRole('button', { name: 'Categories', exact: true });
  if (await back.isVisible()) await back.click();
  await sheet.getByRole('navigation').getByRole('button', { name: category, exact: true }).click();
  await expect(sheet.locator('#room-settings-category')).toHaveText(category);
  return sheet;
}
export async function hideWorkspaceCards(page: Page) {
  await page.getByRole('button', { name: 'Workspace cards', exact: true }).click();
  for (const checkbox of await page
    .getByRole('region', { name: 'Workspace cards', exact: true })
    .getByRole('checkbox')
    .all())
    await checkbox.uncheck();
  await page.getByRole('button', { name: 'Workspace cards', exact: true }).click();
}
