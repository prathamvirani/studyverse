import { layoutSchema, z } from '@study/contracts';
import type { TileLayout } from '@study/contracts';
import type { PreferenceDefinition } from '@study/feature-sdk';
import { TileHost, TileRegistry } from './ui.ts';

export const workspaceSchema = z.strictObject({
  panels: z.record(z.string().max(100), z.boolean()),
  dimmed: z.boolean(),
  snaps: z.record(z.string().max(250), z.number().int().min(0).max(3)).default({}),
  tiles: z
    .array(
      z.strictObject({
        type: z.string().max(100),
        resourceKey: z.string().max(100),
        layout: layoutSchema,
      }),
    )
    .max(32),
});
export type WorkspacePreferences = z.infer<typeof workspaceSchema>;
export function workspacePreference(
  roomId: string,
  userId?: string,
): PreferenceDefinition<WorkspacePreferences> {
  return {
    key: userId ? `room-layout.${userId}.${roomId}` : `room-layout.${roomId}`,
    version: 1,
    schema: workspaceSchema,
    defaultValue: { panels: {}, dimmed: false, tiles: [], snaps: {} },
  };
}
export interface Bounds {
  width: number;
  height: number;
}
export interface Rectangle extends Bounds {
  x: number;
  y: number;
}
export function rectanglesOverlap(a: Rectangle, b: Rectangle, gap = 8) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}
/** Nearest free position, including the edges of obstacles. No collision offset is persisted. */
export function avoidOverlap(
  rect: Rectangle,
  obstacles: Rectangle[],
  bounds: Bounds,
): Rectangle | null {
  const xs = [
    rect.x,
    0,
    bounds.width - rect.width,
    ...obstacles.flatMap((o) => [o.x - rect.width - 8, o.x + o.width + 8]),
  ];
  const ys = [
    rect.y,
    0,
    bounds.height - rect.height,
    ...obstacles.flatMap((o) => [o.y - rect.height - 8, o.y + o.height + 8]),
  ];
  const candidates = xs
    .flatMap((x) => ys.map((y) => ({ ...rect, x, y })))
    .filter(
      (r) =>
        r.x >= 0 &&
        r.y >= 0 &&
        r.x + r.width <= bounds.width &&
        r.y + r.height <= bounds.height &&
        !obstacles.some((o) => rectanglesOverlap(r, o)),
    );
  return (
    candidates.sort(
      (a, b) => Math.hypot(a.x - rect.x, a.y - rect.y) - Math.hypot(b.x - rect.x, b.y - rect.y),
    )[0] ?? null
  );
}
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
/** Clamp only active edges; each opposite anchor is taken from the gesture's initial rectangle. */
export function resizeLayout(
  start: TileLayout,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  minimum: Bounds,
  bounds: Bounds,
): TileLayout {
  let left = start.x,
    top = start.y,
    right = start.x + start.width,
    bottom = start.y + start.height;
  const width = minimum.width,
    height = minimum.height;
  if (edge.includes('e')) right = Math.max(left + width, Math.min(bounds.width, right + dx));
  if (edge.includes('w')) left = Math.min(right - width, Math.max(0, left + dx));
  if (edge.includes('s')) bottom = Math.max(top + height, Math.min(bounds.height, bottom + dy));
  if (edge.includes('n')) top = Math.min(bottom - height, Math.max(0, top + dy));
  return {
    ...start,
    x: left,
    y: top,
    width: Math.max(width, right - left),
    height: Math.max(height, bottom - top),
  };
}
/** Shared pointer lifecycle for cards and room objects; works in the owning document of a popout. */
export function layoutGesture(
  event: PointerEvent,
  move: (dx: number, dy: number, event: PointerEvent) => void,
  finish: (event: PointerEvent) => void = () => {},
) {
  const handle = event.currentTarget as HTMLElement,
    x = event.clientX,
    y = event.clientY;
  event.preventDefault();
  handle.setPointerCapture(event.pointerId);
  const moving = (e: PointerEvent) => move(e.clientX - x, e.clientY - y, e);
  const cleanup = () => {
    handle.removeEventListener('pointermove', moving);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      handle.removeEventListener(type, ending as EventListener);
  };
  const ending = (e: PointerEvent) => {
    cleanup();
    finish(e);
  };
  handle.addEventListener('pointermove', moving);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    handle.addEventListener(type, ending as EventListener);
  return cleanup;
}
export function constrainLayout(layout: TileLayout, minimum: Bounds, bounds: Bounds): TileLayout {
  const width = Math.max(minimum.width, Math.min(layout.width, bounds.width));
  const height = Math.max(minimum.height, Math.min(layout.height, bounds.height));
  return {
    ...layout,
    width,
    height,
    x: Math.max(0, Math.min(layout.x, Math.max(0, bounds.width - width))),
    y: Math.max(0, Math.min(layout.y, Math.max(0, bounds.height - height))),
  };
}
/** Finite geometry, edge snapping, bounded stacking and validated local recovery. */
export class Workspace extends TileHost {
  readonly snaps = new Map<string, number>();
  snapSlots(
    bounds: Bounds,
    obstacles: Rectangle[] = [],
    target?: { id: string; slot: number; type: string },
  ) {
    const cards = this.types.values().filter((t) => t.workspaceCard);
    const definitions = [
      ...cards.filter((t) => t.openByDefault !== false),
      ...cards.filter(
        (t) =>
          t.openByDefault === false &&
          (target?.type === t.type ||
            this.values().some(
              (item) => item.type === t.type && !item.layout.minimized && this.snaps.has(item.id),
            )),
      ),
    ];
    const minimum = (index: number) => {
      const type =
        target?.slot === index
          ? target.type
          : this.values().find(
              (item) =>
                item.id !== target?.id &&
                !item.layout.minimized &&
                this.snaps.get(item.id) === index,
            )?.type;
      return Math.max(
        120,
        (type ? this.types.get(type) : definitions[index])?.minimumSize.height ?? 120,
      );
    };
    const desiredWidth = Math.min(bounds.width, 320);
    const minimumWidth = Math.min(
      bounds.width,
      Math.max(120, ...definitions.map((d) => d.minimumSize.width)),
    );
    // Columns can shrink to the current horizontal gap, while honoring registered minima.
    const columns = [
      { x: bounds.width - desiredWidth, width: desiredWidth },
      { x: 0, width: desiredWidth },
      ...obstacles.flatMap((o) => {
        const leftWidth = Math.min(desiredWidth, o.x - 8);
        const rightX = Math.max(0, o.x + o.width + 8);
        const rightWidth = Math.min(desiredWidth, bounds.width - rightX);
        return [
          { x: Math.max(0, o.x - leftWidth - 8), width: leftWidth },
          { x: rightX, width: rightWidth },
        ];
      }),
    ];
    const areas = columns
      .filter(({ x, width }) => width >= minimumWidth && x >= 0 && x + width <= bounds.width)
      .flatMap(({ x, width }) => {
        const blocked = obstacles
          .filter(
            (o) =>
              o.width > 0 &&
              o.height > 0 &&
              o.y + o.height > 0 &&
              o.y < bounds.height &&
              o.x < x + width + 8 &&
              o.x + o.width + 8 > x,
          )
          .map((o) => [Math.max(0, o.y - 8), Math.min(bounds.height, o.y + o.height + 8)] as const)
          .sort((a, b) => a[0] - b[0]);
        const free: Rectangle[] = [];
        let y = 0;
        for (const [top, bottom] of blocked) {
          if (top > y) free.push({ x, y, width, height: top - y });
          y = Math.max(y, bottom);
        }
        if (y < bounds.height) free.push({ x, y, width, height: bounds.height - y });
        return free;
      });
    const fit = (height: number) => {
      let count = Math.min(4, Math.floor(height / 120));
      while (
        count > 0 &&
        Array.from({ length: count }, (_, i) => minimum(i)).reduce((a, b) => a + b, 0) +
          (count - 1) * 10 >
          height
      )
        count--;
      return count;
    };
    const area = areas
      .filter((a) => fit(a.height) > 0)
      .sort(
        (a, b) => fit(b.height) - fit(a.height) || b.width - a.width || b.x - a.x || a.y - b.y,
      )[0];
    if (!area) return [];
    const count = fit(area.height);
    const minima = Array.from({ length: count }, (_, i) => minimum(i));
    const extra = Math.max(
      0,
      (area.height - (count - 1) * 10 - minima.reduce((a, b) => a + b, 0)) / count,
    );
    let y = area.y;
    return minima.map((height) => {
      const slot = { x: area.x, y, width: area.width, height: height + extra };
      y += slot.height + 10;
      return slot;
    });
  }
  snapTarget(id: string, slot: number, bounds: Bounds, obstacles: Rectangle[] = []) {
    const item = this.values().find((i) => i.id === id);
    if (!item || !this.types.get(item.type)?.workspaceCard) return;
    let target = slot;
    for (let attempt = 0; attempt < 4; attempt++) {
      const slots = this.snapSlots(bounds, obstacles, { id, slot: target, type: item.type });
      if (!slots.length) return;
      const index = Math.max(0, Math.min(target, slots.length - 1));
      if (index === target) return { index, rect: slots[index]! };
      target = index;
    }
  }
  snap(id: string, slot: number, bounds: Bounds, obstacles: Rectangle[] = []) {
    const item = this.values().find((i) => i.id === id);
    if (!item || !this.types.get(item.type)?.workspaceCard) return;
    const destination = this.snapTarget(id, slot, bounds, obstacles);
    if (!destination) return;
    const { index: target, rect } = destination;
    for (const [other, index] of this.snaps) {
      if (other !== id && index === target) {
        this.snaps.delete(other);
        const displaced = avoidOverlap(
          {
            ...this.values().find((i) => i.id === other)!.layout,
            x: Math.max(0, rect.x - 340),
            y: rect.y,
          },
          [...obstacles, rect],
          bounds,
        );
        if (displaced) this.place(other, displaced, bounds, false);
      }
    }
    this.snaps.set(id, target);
    this.place(id, rect, bounds, false);
    this.reflow(bounds, obstacles);
  }
  unsnap(id: string) {
    this.snaps.delete(id);
  }
  reflow(bounds: Bounds, obstacles: Rectangle[] = []) {
    const slots = this.snapSlots(bounds, obstacles);
    for (const item of this.values()) {
      const slot = this.snaps.get(item.id);
      if (slot !== undefined && slot >= slots.length) this.snaps.delete(item.id);
      this.place(item.id, slot !== undefined && slots[slot] ? slots[slot]! : {}, bounds, false);
    }
  }
  override close(id: string) {
    this.snaps.delete(id);
    super.close(id);
  }
  constructor(
    readonly types: TileRegistry,
    can: (permission: string) => boolean = () => false,
  ) {
    super(types, can);
  }
  focus(id: string) {
    const ordered = [...this.values()].sort((a, b) => a.layout.zIndex - b.layout.zIndex);
    const target = ordered.find((item) => item.id === id);
    if (!target) return;
    for (const [zIndex, item] of [...ordered.filter((item) => item !== target), target].entries())
      this.update(item.id, { ...item.layout, zIndex });
  }
  resize(id: string, start: TileLayout, edge: ResizeEdge, dx: number, dy: number, bounds: Bounds) {
    const item = this.values().find((i) => i.id === id),
      definition = item && this.types.get(item.type);
    if (!item || !definition?.resizable) return;
    this.unsnap(id);
    this.update(id, resizeLayout(start, edge, dx, dy, definition.minimumSize, bounds));
  }
  place(id: string, patch: Partial<TileLayout>, bounds: Bounds, snap = true) {
    const item = this.values().find((item) => item.id === id);
    if (!item) return;
    const definition = this.types.get(item.type)!;
    if (
      !definition.resizable &&
      ((patch.width !== undefined && patch.width !== item.layout.width) ||
        (patch.height !== undefined && patch.height !== item.layout.height))
    )
      throw new Error('Tile is not resizable');
    let layout = constrainLayout(
      layoutSchema.parse({ ...item.layout, ...patch }),
      definition.resizable
        ? definition.minimumSize
        : { width: item.layout.width, height: item.layout.height },
      bounds,
    );
    if (snap) {
      const right = Math.max(0, bounds.width - layout.width),
        bottom = Math.max(0, bounds.height - layout.height);
      layout = {
        ...layout,
        x: layout.x < 16 ? 0 : Math.abs(right - layout.x) < 16 ? right : layout.x,
        y: layout.y < 16 ? 0 : Math.abs(bottom - layout.y) < 16 ? bottom : layout.y,
      };
    }
    this.update(id, layout);
  }
  snapshot(): WorkspacePreferences['tiles'] {
    return this.values()
      .filter((item) => this.types.get(item.type)?.persist !== false)
      .map((item) => ({
        type: item.type,
        resourceKey: item.resourceKey,
        layout: { ...item.layout, fullscreen: false },
      }));
  }
  recover(raw: unknown, bounds: Bounds) {
    const parsed = workspaceSchema.safeParse(raw);
    if (!parsed.success) return;
    for (const saved of parsed.data.tiles) {
      const definition = this.types.get(saved.type);
      if (!definition || definition.persist === false) continue;
      let id: string | undefined;
      try {
        id = this.open(saved.type, saved.resourceKey).id;
        this.place(id, { ...saved.layout, fullscreen: false }, bounds);
      } catch {
        if (id) this.close(id);
      }
    }
    for (const [id, slot] of Object.entries(parsed.data.snaps)) this.snap(id, slot, bounds);
  }
}
