import { rectanglesOverlap } from '@study/core/browser';
import type { Bounds, Rectangle } from '@study/core/browser';

export type RailEdge = 'left' | 'right' | 'top' | 'bottom';
export interface SafeEdges {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export const defaultSafeEdges: SafeEdges = { left: 12, right: 12, top: 12, bottom: 8 };
export function bounded(rect: Rectangle, bounds: Bounds, safe = defaultSafeEdges): Rectangle {
  return {
    ...rect,
    x: Math.max(
      safe.left,
      Math.min(rect.x, Math.max(safe.left, bounds.width - safe.right - rect.width)),
    ),
    y: Math.max(
      safe.top,
      Math.min(rect.y, Math.max(safe.top, bounds.height - safe.bottom - rect.height)),
    ),
  };
}
export function headerAnchors(bounds: Bounds, width: number, safe = defaultSafeEdges) {
  const right = Math.max(safe.left, bounds.width - safe.right - width);
  return [
    safe.left,
    Math.min(right, safe.left + 86),
    Math.max(safe.left, (bounds.width - width) / 2),
    right,
  ];
}
export function magneticHeader(x: number, anchors: number[], radius = 18) {
  const closest = anchors
    .map((value, anchor) => ({ x: value, anchor, distance: Math.abs(value - x) }))
    .sort((a, b) => a.distance - b.distance)[0]!;
  return closest.distance <= radius
    ? { x: closest.x, anchor: closest.anchor }
    : { x, anchor: null };
}
/** Derive displacement from occupied rectangles; never write collision offsets into preferences. */
export function displace(
  requested: Rectangle,
  obstacles: Rectangle[],
  bounds: Bounds,
  safe = defaultSafeEdges,
  preferHorizontal = false,
): Rectangle | null {
  const rect = bounded(requested, bounds, safe);
  const occupied = obstacles.filter((o) => o.width > 0 && o.height > 0);
  const xs = [
    rect.x,
    safe.left,
    bounds.width - safe.right - rect.width,
    ...occupied.flatMap((o) => [o.x - rect.width - 8, o.x + o.width + 8]),
  ];
  const ys = [
    rect.y,
    safe.top,
    bounds.height - safe.bottom - rect.height,
    ...occupied.flatMap((o) => [o.y - rect.height - 8, o.y + o.height + 8]),
  ];
  const candidates = xs
    .flatMap((x) => ys.map((y) => ({ ...rect, x, y })))
    .filter(
      (r) =>
        r.x >= safe.left &&
        r.y >= safe.top &&
        r.x + r.width <= bounds.width - safe.right &&
        r.y + r.height <= bounds.height - safe.bottom &&
        !occupied.some((o) => rectanglesOverlap(r, o, 7)),
    );
  const distance = (r: Rectangle) => Math.hypot(r.x - rect.x, r.y - rect.y);
  return (
    candidates.sort(
      (a, b) =>
        (preferHorizontal ? Number(a.y !== rect.y) - Number(b.y !== rect.y) : 0) ||
        distance(a) - distance(b),
    )[0] ?? null
  );
}
export function railRectangle(
  edge: RailEdge,
  bounds: Bounds,
  header: Rectangle,
  obstacles: Rectangle[],
  participants: number,
  horizontalX?: number,
  safe = defaultSafeEdges,
): Rectangle {
  const usableWidth = Math.max(1, bounds.width - safe.left - safe.right);
  if (edge === 'left' || edge === 'right') {
    const width = Math.min(72, usableWidth);
    const x = edge === 'left' ? safe.left : bounds.width - safe.right - width;
    let y = safe.top;
    for (const obstacle of [header, ...obstacles]) {
      if (
        obstacle.width > 0 &&
        obstacle.height > 0 &&
        obstacle.x < x + width + 8 &&
        obstacle.x + obstacle.width + 8 > x
      )
        y = Math.max(y, obstacle.y + obstacle.height + 8);
    }
    y = Math.min(y, Math.max(safe.top, bounds.height - safe.bottom - 80));
    return { x, y, width, height: Math.max(1, bounds.height - safe.bottom - y) };
  }
  const width = Math.min(usableWidth, Math.max(200, participants * 80 + 64));
  const height = Math.min(86, Math.max(1, bounds.height - safe.top - safe.bottom));
  const rail = bounded(
    {
      x: horizontalX ?? safe.left,
      y: edge === 'bottom' ? bounds.height - safe.bottom - height : safe.top,
      width,
      height,
    },
    bounds,
    safe,
  );
  // Bottom owns its safe edge; the dock is displaced instead.
  if (edge === 'bottom') return rail;
  const occupied = [header, ...obstacles].filter((o) => o.width > 0 && o.height > 0);
  const ys = [safe.top, ...occupied.map((o) => o.y + o.height + 8)]
    .filter((y) => y + height <= bounds.height - safe.bottom)
    .sort((a, b) => a - b);
  for (const y of ys) {
    const blocked = occupied
      .filter((o) => o.y < y + height + 8 && o.y + o.height + 8 > y)
      .map(
        (o) =>
          [
            Math.max(safe.left, o.x - 8),
            Math.min(bounds.width - safe.right, o.x + o.width + 8),
          ] as const,
      )
      .filter(([left, right]) => right > left)
      .sort((a, b) => a[0] - b[0]);
    const segments: { left: number; right: number }[] = [];
    let left = safe.left;
    for (const [start, end] of blocked) {
      if (start > left) segments.push({ left, right: start });
      left = Math.max(left, end);
    }
    if (left < bounds.width - safe.right) segments.push({ left, right: bounds.width - safe.right });
    const candidates = segments
      .filter((s) => s.right - s.left >= Math.min(width, 144))
      .map((s) => {
        const availableWidth = Math.min(width, s.right - s.left);
        return {
          x: Math.max(s.left, Math.min(horizontalX ?? safe.left, s.right - availableWidth)),
          y,
          width: availableWidth,
          height,
        };
      });
    const result = candidates.sort((a, b) => Math.abs(a.x - rail.x) - Math.abs(b.x - rail.x))[0];
    if (result) return result;
  }
  return displace(rail, occupied, bounds, safe, true) ?? rail;
}
