import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
export async function finishOnboarding(page: Page) {
  await expect(page).toHaveURL('/onboarding');
  await page
    .getByLabel('Username', { exact: true })
    .fill(`member_${crypto.randomUUID().replaceAll('-', '').slice(0, 15)}`);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your light.' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Finish setup', exact: true }).click();
  await expect(page).toHaveURL('/home');
}
