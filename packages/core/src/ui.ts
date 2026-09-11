import { extensionPoints, layoutSchema } from '@study/contracts';
import type { ExtensionPoint, TileLayout } from '@study/contracts';
import type { TileDefinition, UiContribution } from '@study/feature-sdk';
import { Registry } from './registry.ts';

export class UiRegistry extends Registry<UiContribution> {
  override register(id: string, contribution: UiContribution) {
    if (
      id !== contribution.id ||
      !extensionPoints.includes(contribution.point) ||
      !Number.isFinite(contribution.order)
    )
      throw new Error('Invalid UI contribution');
    return super.register(id, contribution);
  }
  at(
    point: ExtensionPoint,
    can: (permission: string) => boolean = () => false,
  ): readonly UiContribution[] {
    return this.values()
      .filter((item) => item.point === point && (!item.permission || can(item.permission)))
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }
}
export class TileRegistry extends Registry<TileDefinition> {
  override register(id: string, tile: TileDefinition) {
    if (
      id !== tile.type ||
      ![
        tile.minimumSize.width,
        tile.minimumSize.height,
        tile.defaultSize.width,
        tile.defaultSize.height,
      ].every(Number.isFinite) ||
      tile.minimumSize.width <= 0 ||
      tile.minimumSize.height <= 0 ||
      tile.defaultSize.width < tile.minimumSize.width ||
      tile.defaultSize.height < tile.minimumSize.height
    )
      throw new Error('Invalid tile dimensions');
    return super.register(id, tile);
  }
}
export interface TileInstance {
  readonly id: string;
  readonly type: string;
  readonly resourceKey: string;
  layout: TileLayout;
}
/** Generic local instance/layout ownership. No media or feature-specific behavior. */
export class TileHost {
  private readonly instances = new Map<string, TileInstance>();
  constructor(
    private readonly registry: TileRegistry,
    private readonly can: (permission: string) => boolean = () => false,
  ) {}
  open(type: string, resourceKey: string): TileInstance {
    const definition = this.registry.get(type);
    if (!definition || (definition.permission && !this.can(definition.permission)))
      throw new Error('Tile unavailable');
    const id = JSON.stringify([type, resourceKey]);
    const existing = this.instances.get(id);
    if (existing) return existing;
    const layout = definition.layoutSchema.parse({
      version: 1,
      x: 0,
      y: 0,
      ...definition.defaultSize,
      zIndex: this.instances.size,
      minimized: false,
      fullscreen: false,
    });
    const instance = { id, type, resourceKey, layout };
    this.instances.set(id, instance);
    try {
      definition.onOpen?.(id);
    } catch (error) {
      this.instances.delete(id);
      throw error;
    }
    return instance;
  }
  update(id: string, raw: unknown): void {
    const instance = this.instances.get(id);
    const definition = instance && this.registry.get(instance.type);
    if (!instance || !definition) throw new Error('Tile unavailable');
    const layout = definition.layoutSchema.parse(layoutSchema.parse(raw));
    if (
      layout.width < definition.minimumSize.width ||
      layout.height < definition.minimumSize.height ||
      (!definition.fullscreenable && layout.fullscreen) ||
      (!definition.resizable &&
        (layout.width !== instance.layout.width || layout.height !== instance.layout.height))
    )
      throw new Error('Invalid tile layout');
    instance.layout = layout;
    definition.onLayoutChange?.(id, layout);
  }
  close(id: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    this.instances.delete(id);
    this.registry.get(instance.type)?.onClose?.(id);
  }
  values(): readonly TileInstance[] {
    return [...this.instances.values()];
  }
}
