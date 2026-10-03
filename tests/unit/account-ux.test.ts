import { expect, it } from 'vitest';
import { usernameProblem, normalizeUsername, safeReturnTo } from '@study/contracts';
import { deviceSummary } from '../../apps/web/app/lib/device-summary.ts';
it('uses the same human-readable username policy without Unicode confusables', () => {
  expect(normalizeUsername('  PraTHam_12 ')).toBe('pratham_12');
  expect(usernameProblem('Pratham_12')).toBeNull();
  for (const name of ['ad', 'аdmin', 'admin', 'study_space_staff', 'bad-name', '123hello'])
    expect(usernameProblem(name)).not.toBeNull();
});
it('never guesses Windows version or hardware from reduced UA', () => {
  expect(
    deviceSummary('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0 Safari/537.36'),
  ).toBe('Windows · Chrome 140.0.0.0');
  expect(
    deviceSummary('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.5 Safari/605.1.15'),
  ).toBe('macOS · Safari 18.5');
  expect(deviceSummary('Mozilla/5.0 (Linux; Android 15) Chrome/130.0.0.0')).toBe(
    'Android 15 · Chrome 130.0.0.0',
  );
  expect(deviceSummary('unknown')).toBe('Unknown operating system · Browser');
});
it('uses an internal return allowlist', () => {
  for (const target of [
    '//evil.test',
    'https://evil.test',
    '/home%0d%0aLocation:evil',
    '/home?redirect=evil',
  ])
    expect(safeReturnTo(target)).toBe('/home');
  expect(safeReturnTo('/account#delete')).toBe('/account#delete');
});
