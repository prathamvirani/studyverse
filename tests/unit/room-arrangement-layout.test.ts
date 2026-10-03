import { expect, it } from 'vitest';
import { rectanglesOverlap } from '@study/core/browser';
import { arrangementSchema } from '../../apps/web/app/lib/room-arrangement.ts';
import {
  bounded,
  displace,
  headerAnchors,
  magneticHeader,
  railRectangle,
} from '../../apps/web/app/lib/room-arrangement-layout.ts';

const bounds = { width: 1200, height: 800 };
const header = { x: 98, y: 12, width: 380, height: 44 };
it('fits the top rail into current free width and moves below chrome only when necessary', () => {
  const workspace = { x: 980, y: 12, width: 208, height: 44 };
  const rail = railRectangle('top', bounds, header, [workspace], 8, 950);
  expect(rail.y).toBe(12);
  expect(rail.width).toBe(486);
  expect(rail.x).toBe(486);
  for (const obstacle of [header, workspace])
    expect(rectanglesOverlap(rail, obstacle, 7)).toBe(false);
  const narrow = { width: 390, height: 844 };
  const fullHeader = { x: 12, y: 12, width: 366, height: 44 };
  const below = railRectangle('top', narrow, fullHeader, [], 1, 12);
  expect(below).toEqual({ x: 12, y: 64, width: 200, height: 86 });
});
it('recovers old named-anchor preferences and distinguishes persisted free placement', () => {
  expect(arrangementSchema.parse({ header: 2, rail: 'left', points: {} }).headerX).toBeNull();
  expect(
    arrangementSchema.parse({ header: 2, headerX: 233.5, rail: 'left', points: {} }).headerX,
  ).toBe(233.5);
  const anchors = headerAnchors(bounds, 380);
  expect(anchors).toEqual([12, 98, 410, 808]);
  for (const [anchor, x] of anchors.entries())
    expect(magneticHeader(x + 7, anchors)).toEqual({ x, anchor });
  expect(magneticHeader(233.5, anchors)).toEqual({ x: 233.5, anchor: null });
  expect(bounded({ ...header, x: 9999, y: -40 }, bounds)).toMatchObject({ x: 808, y: 12 });
});
it.each([12, 500, 980])(
  'displaces the dock around a bottom rail at x=%s without changing its requested rectangle',
  (x) => {
    const rail = railRectangle('bottom', bounds, header, [], 1, x);
    const requested = { x: Math.max(12, Math.min(780, x - 100)), y: 724, width: 420, height: 68 };
    const original = { ...requested };
    const dock = displace(requested, [rail], bounds, undefined, true)!;
    expect(rail.y + rail.height).toBe(792);
    expect(rectanglesOverlap(rail, dock, 7)).toBe(false);
    expect(dock.y).toBe(requested.y);
    expect(requested).toEqual(original);
  },
);
it('stacks a narrow dock above the bottom rail when no horizontal segment can fit it', () => {
  const narrow = { width: 320, height: 568 };
  const rail = railRectangle('bottom', narrow, { ...header, width: 240 }, [], 3, 12);
  const dock = displace(
    { x: 12, y: 492, width: 296, height: 68 },
    [rail],
    narrow,
    undefined,
    true,
  )!;
  expect(rail.y + rail.height).toBe(560);
  expect(dock.y + dock.height).toBeLessThanOrEqual(rail.y - 7);
  expect(dock.x).toBeGreaterThanOrEqual(12);
});
it('uses the actual free header footprint for vertical rail collision and leaves the lower edge usable', () => {
  const overlapping = railRectangle('left', bounds, { ...header, x: 40 }, [], 3);
  const clear = railRectangle('left', bounds, { ...header, x: 234 }, [], 3);
  expect(overlapping.y).toBe(64);
  expect(clear.y).toBe(12);
  expect(overlapping.y + overlapping.height).toBe(792);
  expect(clear.y + clear.height).toBe(792);
});
