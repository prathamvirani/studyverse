import { layoutSchema, z } from '@study/contracts';
import type { TileLayout } from '@study/contracts';
import type { PreferenceDefinition } from '@study/feature-sdk';
import { TileHost, TileRegistry } from './ui.ts';

export const workspaceSchema = z.strictObject({
  panels: z.record(z.string().max(100), z.boolean()),
  dimmed: z.boolean(),
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
export function workspacePreference(roomId: string): PreferenceDefinition<WorkspacePreferences> {
  return {
    key: `room-layout.${roomId}`,
    version: 1,
    schema: workspaceSchema,
    defaultValue: { panels: {}, dimmed: false, tiles: [] },
  };
}
export interface Bounds {
  width: number;
  height: number;
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
  }
}
