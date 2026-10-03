import type { Page } from '@playwright/test';
import { finishOnboarding } from './onboarding.ts';
export async function refreshLogin(page: Page, provider = 'Google') {
  await page.goto('/');
  await page.getByRole('button', { name: `Continue with ${provider}`, exact: true }).click();
  await finishOnboarding(page);
}
export async function refreshApi(page: Page, path: string, input?: unknown) {
  return page.evaluate(
    async ({ path, input }) => {
      const csrf = await fetch('/api/v1/session/csrf').then((r) => r.json());
      const response = await fetch(
        `/api/v1/${path}`,
        input === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
              body: JSON.stringify(input),
            },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
      return response.json();
    },
    { path, input },
  );
}
export async function refreshRoom(page: Page, name: string) {
  const room = await refreshApi(page, 'rooms/create', { name, privacy: 'public' });
  await page.goto(`/rooms/${room.publicId}`);
  return room;
}
export async function refreshCapture(page: Page, path: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) =>
          Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)),
        )
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  await page.screenshot({ path });
}
