import { reactive } from 'vue';
import { backgroundViewSchema } from '@study/contracts';
import {
  EnvironmentCatalog,
  curatedProvider,
  defaultBackground,
  backgroundPreference,
} from '@study/backgrounds/browser';
import { createPreferenceStore, createLocalVisualStore } from '@study/adapters/indexeddb';
import type { LocalVisualStore, LocalVisualAsset } from '@study/feature-sdk';
import type { RealtimeClient } from '../lib/realtime.ts';
import { importBackground } from './import-background.ts';
export function createBackgroundModel(roomId: string, userId: string, realtime: RealtimeClient) {
  const catalog = new EnvironmentCatalog();
  catalog.register(curatedProvider);
  const preference = backgroundPreference(userId, roomId);
  let store: Awaited<ReturnType<typeof createPreferenceStore>> | undefined,
    assets: LocalVisualStore | undefined,
    disposed = false,
    selectionGeneration = 0;
  let queue = Promise.resolve();
  let unsubscribe: (() => void) | undefined;
  let assetOpening: Promise<LocalVisualStore> | undefined;
  const ensureAssets = async () => {
    try {
      assets ??= await (assetOpening ??= createLocalVisualStore(userId));
      if (disposed) {
        assets.close();
        throw new Error('Room closed.');
      }
      return assets;
    } catch (e) {
      assetOpening = undefined;
      throw e;
    }
  };
  const state = reactive({
    open: false,
    ready: false,
    available: false,
    canControl: false,
    roomAsset: defaultBackground,
    version: 0,
    selected: null as string | null,
    favorites: [] as string[],
    paused: false,
    error: '',
    busy: false,
    custom: null as LocalVisualAsset | null,
    customs: [] as (Omit<LocalVisualAsset, 'frames'> & { preview: string })[],
  });
  const save = () => {
    queue = queue
      .then(async () => {
        await store?.set(preference, {
          selected: state.selected,
          favorites: [...state.favorites],
          paused: state.paused,
        });
        if (store?.mode === 'memory')
          state.error = 'Preferences are temporary because device storage is unavailable.';
      })
      .catch(() => {
        state.error = 'Could not save the device preference.';
      });
    return queue;
  };
  const refreshCustoms = async () => {
    const items = (await assets?.list()) ?? [];
    if (disposed) return;
    for (const a of state.customs) URL.revokeObjectURL(a.preview);
    state.customs = items.map((a) => ({ ...a, preview: URL.createObjectURL(a.thumbnail) }));
  };
  const select = async (id: string | null, persist = true) => {
    const generation = ++selectionGeneration;
    state.error = '';
    let custom: LocalVisualAsset | undefined;
    if (id?.startsWith('custom-')) {
      try {
        custom = await (await ensureAssets()).get(id);
      } catch {
        /* Missing/evicted storage recovers below. */
      }
    }
    if (disposed || generation !== selectionGeneration) return;
    if (id && !catalog.find(id) && !custom) {
      id = null;
      state.error = 'That image is no longer on this device. Using the room background.';
    }
    state.custom = custom ?? null;
    state.selected = id;
    if (persist) await save();
  };
  let preparation: Promise<void> | undefined;
  let markRendered!: () => void;
  const rendered = new Promise<void>((resolve) => {
    markRendered = resolve;
  });
  const model = {
    state,
    catalog,
    rendered,
    markRendered,
    async browse() {
      try {
        await ensureAssets();
        await refreshCustoms();
      } catch {
        state.error = 'Custom image storage is unavailable on this device.';
      }
    },
    prepare(roomAsset = defaultBackground) {
      state.roomAsset = catalog.resolve(roomAsset).id;
      return (preparation ??= (async () => {
        const initialSelection = selectionGeneration;
        store = await createPreferenceStore([preference]);
        if (disposed) {
          await store.close();
          return;
        }
        const saved = await store.get(preference);
        if (disposed) return;
        if (initialSelection === selectionGeneration) {
          Object.assign(state, saved);
          await select(saved.selected, false);
        } else await save();
        if (disposed) return;
        // Decode the actual device override or authorized durable room asset before reveal.
        const source = state.custom?.frames[0];
        const url = source
          ? URL.createObjectURL(source)
          : catalog.resolve(state.selected ?? state.roomAsset).source;
        try {
          const image = new Image();
          image.src = url;
          await image.decode();
        } finally {
          if (source) URL.revokeObjectURL(url);
        }
        if (!disposed) state.ready = true;
      })());
    },
    async init() {
      await model.prepare(state.roomAsset);
      model.activate();
    },
    activate() {
      if (disposed || unsubscribe) return;
      // Reuse the productivity socket; no additional RTC or polling channel.
      unsubscribe = realtime.subscribe(
        'backgrounds.snapshot',
        { roomId },
        (v) => {
          if (disposed) return;
          const view = backgroundViewSchema.parse(v);
          if (view.state.version < state.version) return;
          state.available = true;
          state.canControl = view.canControl;
          state.roomAsset = catalog.resolve(view.state.assetId).id;
          state.version = view.state.version;
        },
        () => {
          state.available = false;
          state.canControl = false;
        },
      );
    },
    select,
    async favorite(id: string) {
      state.favorites = state.favorites.includes(id)
        ? state.favorites.filter((a) => a !== id)
        : [...state.favorites, id].slice(-100);
      await save();
    },
    async pause() {
      state.paused = !state.paused;
      await save();
    },
    async roomDefault(id: string) {
      if (!state.available || !state.canControl || state.busy) return;
      state.busy = true;
      state.error = '';
      try {
        const v = backgroundViewSchema.parse(
          await realtime.send('backgrounds.change', {
            roomId,
            assetId: id,
            version: state.version,
          }),
        );
        state.roomAsset = v.state.assetId;
        state.version = v.state.version;
        await select(null);
      } catch (e) {
        state.error = (e as Error).message;
      } finally {
        state.busy = false;
        realtime.refresh('backgrounds.snapshot');
      }
    },
    async upload(file: File) {
      if (!state.available || state.busy) return;
      state.busy = true;
      state.error = '';
      try {
        if (!assets) throw new Error('Device image storage unavailable.');
        const asset = await importBackground(file);
        if (disposed) return;
        await assets.put(asset);
        await refreshCustoms();
        await select(asset.id);
      } catch (e) {
        state.error = (e as Error).message || 'Unable to decode this image.';
      } finally {
        state.busy = false;
      }
    },
    async remove(id: string) {
      try {
        await assets?.delete(id);
        if (state.selected === id) await select(null);
        state.favorites = state.favorites.filter((a) => a !== id);
        await refreshCustoms();
        await save();
      } catch {
        state.error = 'Could not remove that image. Try again.';
      }
    },
    close() {
      state.open = false;
      document.querySelector<HTMLElement>('[aria-label="Background"]')?.focus();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe?.();
      selectionGeneration++;
      for (const a of state.customs) URL.revokeObjectURL(a.preview);
      assets?.close();
      void queue.finally(() => store?.close());
    },
  };
  return model;
}
export type BackgroundModel = ReturnType<typeof createBackgroundModel>;
