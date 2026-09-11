import { expect, test } from '@playwright/test';
import { ids } from '../fixtures/dummy-module.ts';

test('serves the Nuxt skeleton over HTTPS with CSP and no browser-readable authentication', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A quiet place to focus.' })).toBeVisible();
  const csp = response?.headers()['content-security-policy'];
  expect(csp).toContain("'nonce-");
  expect(csp).not.toContain("'unsafe-eval'");
  expect(csp).not.toContain("'unsafe-inline'");
  await context.request.post('/__test/session');
  const cookie = (await context.cookies()).find((item) => item.name === '__Host-study-session');
  expect(cookie?.secure).toBe(true);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  const storage = await page.evaluate(async () => ({
    cookies: document.cookie,
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    databases: await indexedDB.databases(),
  }));
  expect(storage.cookies).not.toContain('__Host-study-session');
  expect(storage.local).toEqual([]);
  expect(storage.session).toEqual([]);
  expect(storage.databases).toEqual([]);
  expect(errors).toEqual([]);
});
test('exercises same-origin cookie mutations and CSRF rejection in a real browser', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await context.request.post('/__test/session');
  const result = await page.evaluate(
    async ({ scopeId, id }) => {
      const token = (await fetch('/api/v1/session/csrf').then((response) => response.json())) as {
        csrfToken: string;
      };
      const path = `/api/v1/fixture/${scopeId}/${id}`;
      const missing = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: 'blocked' }),
      });
      const valid = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': token.csrfToken },
        body: JSON.stringify({ value: 'allowed' }),
      });
      return {
        missing: missing.status,
        valid: valid.status,
        body: (await valid.json()) as { value: string },
      };
    },
    { scopeId: ids.scopeA, id: ids.objectA },
  );
  expect(result).toEqual({ missing: 403, valid: 200, body: { value: 'allowed' } });
});
