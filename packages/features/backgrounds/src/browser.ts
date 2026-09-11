import { z } from '@study/contracts';
import type {
  EnvironmentProvider,
  EnvironmentAsset,
  PreferenceDefinition,
} from '@study/feature-sdk';
export const defaultBackground = 'quiet-hours';
export const curatedProvider: EnvironmentProvider = {
  id: 'curated',
  assets: () =>
    [
      ['quiet-hours', 'The quiet hours', 'Cozy rooms', 'static'],
      ['cedar-library', 'Cedar library', 'Libraries', 'static'],
      ['morning-studio', 'Morning studio', 'Cozy rooms', 'static'],
      ['alpine-lake', 'Alpine stillness', 'Nature', 'static'],
      ['rainy-window', 'Rain at the window', 'Rainy windows', 'loop', 'rain'],
      ['night-observatory', 'After midnight', 'Space', 'loop', 'stars'],
    ].map(([id, title, category, kind, effect]) => ({
      id: id!,
      title: title!,
      category: category!,
      kind: kind as 'static' | 'loop',
      source: `/backgrounds/${id}.webp`,
      poster: `/backgrounds/${id}.webp`,
      thumbnail: `/backgrounds/${id}-thumb.webp`,
      ...(effect ? { effect: effect as 'rain' | 'stars' } : {}),
    })),
};
export class EnvironmentCatalog {
  private readonly providers = new Map<string, EnvironmentProvider>();
  register(provider: EnvironmentProvider) {
    if (this.providers.has(provider.id)) throw new Error('Duplicate environment provider');
    const ids = new Set(this.assets().map((a) => a.id));
    for (const asset of provider.assets()) {
      if (ids.has(asset.id)) throw new Error('Duplicate environment asset');
      ids.add(asset.id);
    }
    this.providers.set(provider.id, provider);
  }
  assets(): readonly EnvironmentAsset[] {
    return [...this.providers.values()].flatMap((p) => [...p.assets()]);
  }
  find(id: string) {
    return this.assets().find((a) => a.id === id);
  }
  resolve(id: string) {
    return this.find(id) ?? this.find(defaultBackground)!;
  }
}
export function backgroundPreference(
  userId: string,
  roomId: string,
): PreferenceDefinition<{ selected: string | null; favorites: string[]; paused: boolean }> {
  return {
    key: `background.${userId}.${roomId}`,
    version: 1,
    schema: z.strictObject({
      selected: z.string().max(100).nullable(),
      favorites: z.array(z.string().max(100)).max(100),
      paused: z.boolean(),
    }),
    defaultValue: { selected: null, favorites: [], paused: false },
  };
}
export function shouldAnimate(input: {
  hidden: boolean;
  reduced: boolean;
  saving: boolean;
  paused: boolean;
}) {
  return !input.hidden && !input.reduced && !input.saving && !input.paused;
}
export { inspectImage } from './inspect.ts';
