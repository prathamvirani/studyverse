import { expect, it } from 'vitest';
import {
  historyDestination,
  recordVisit,
  safeAppPath,
} from '../../apps/web/app/lib/app-history.ts';
import type { AppHistory } from '../../apps/web/app/lib/app-history.ts';
import { roomEntryBundles, nextEntryBundle } from '../../apps/web/app/lib/room-entry-copy.ts';
it('limits app navigation to known internal routes and removes bearer/auth query values', () => {
  for (const path of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/auth/callback/google',
    '/invite#secret',
    '/unknown',
    '/rooms/ab',
    '/rooms/new/unknown',
  ])
    expect(safeAppPath(path)).toBeNull();
  expect(safeAppPath('/discover?search=Physics&sort=largest&token=secret&state=auth')).toBe(
    '/discover?search=Physics&sort=largest',
  );
  expect(safeAppPath('/rooms/quiet-study/configure?from=%2Ffriends')).toBe(
    '/rooms/quiet-study/configure?from=%2Ffriends',
  );
});
it('restores actual previously visited app pages including query and scroll, and clears obsolete forward visits', () => {
  const history: AppHistory = { visits: [], cursor: -1, pending: null };
  recordVisit(history, '/home', 10);
  expect(historyDestination(history, -1)).toBeNull();
  recordVisit(history, '/discover?search=Physics&filter=friends', 11);
  history.visits[1]!.scroll = 640;
  recordVisit(history, '/rooms/quiet-study/configure', 12);
  expect(historyDestination(history, -1)).toMatchObject({
    path: '/discover?search=Physics&filter=friends',
    scroll: 640,
  });
  history.pending = 1;
  recordVisit(history, '/discover?search=Physics&filter=friends', 13);
  expect(history.cursor).toBe(1);
  expect(historyDestination(history, 1)?.path).toBe('/rooms/quiet-study/configure');
  recordVisit(history, '/friends', 14);
  expect(historyDestination(history, 1)).toBeNull();
  recordVisit(history, '/home', 10);
  expect(historyDestination(history, -1)).toBeNull();
  recordVisit(history, '//evil.test', 15);
  expect(history.cursor).toBe(0);
});
it('chooses authored linked entry and secondary bundles without immediate repetition', () => {
  let index = -1;
  const seen = new Set<number>();
  for (let n = 0; n < roomEntryBundles.length * 3; n++) {
    const next = nextEntryBundle(index);
    expect(next).not.toBe(index);
    index = next;
    seen.add(index);
    const bundle = roomEntryBundles[index]!;
    expect(bundle.question).toMatch(/\?$/);
    expect(bundle.yes).toBeTruthy();
    expect(bundle.no).toBeTruthy();
    expect(bundle.secondary.question).toMatch(/\?$/);
    expect(bundle.secondary.yes).toBeTruthy();
    expect(bundle.secondary.no).toBeTruthy();
  }
  expect(seen.size).toBe(roomEntryBundles.length);
});
