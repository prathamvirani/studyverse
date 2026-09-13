import { reactive } from 'vue';
import { mediaPreference } from '@study/rtc/browser';
import { mediaQualitySchema } from '@study/contracts';
import type { MediaQualityPreferences } from '@study/contracts';
import type { RealtimeMediaProvider } from '@study/feature-sdk';
import { createPreferenceStore } from '@study/adapters/indexeddb';

export function createQualityModel(provider: RealtimeMediaProvider, userId: string) {
  const definition = mediaPreference(userId);
  const state = reactive({
    ...structuredClone(definition.defaultValue),
    ready: false,
    busy: false,
    message: '',
  });
  let disposed = false;
  let store: Awaited<ReturnType<typeof createPreferenceStore>> | undefined;
  let write = Promise.resolve();
  const ready = (async () => {
    store = await createPreferenceStore([definition]);
    if (disposed) {
      await store.close();
      return;
    }
    const value = await store.get(definition);
    if (disposed) return;
    state.current = value.current;
    state.saved = value.saved;
    await provider.quality?.apply(value.current);
    if (!disposed) state.ready = true;
  })().catch(() => {
    if (!disposed) {
      state.ready = true;
      state.message = 'Using defaults; saved preferences unavailable.';
    }
  });
  async function persist() {
    const value = mediaPreferencesValue();
    write = write
      .catch(() => {})
      .then(async () => {
        if (!disposed) await store?.set(definition, value);
      });
    await write;
  }
  function mediaPreferencesValue() {
    return definition.schema.parse({ current: state.current, saved: state.saved });
  }
  return {
    state,
    ready,
    capabilities: provider.quality?.capabilities(),
    async apply(input: MediaQualityPreferences) {
      if (disposed || !state.ready || state.busy) return;
      state.busy = true;
      try {
        const value = mediaQualitySchema.parse(input);
        await provider.quality?.apply(value);
        if (disposed) return;
        state.current = value;
        await persist();
        state.message = 'Preferences applied. Check actual delivery in diagnostics.';
      } catch {
        if (!disposed && provider.quality) {
          state.current = provider.quality.preferences();
          await persist().catch(() => {});
        }
        state.message =
          'Could not apply this profile. Check dimensions, FPS, bitrate and device support.';
      } finally {
        state.busy = false;
      }
    },
    async save(name: string) {
      name = name.trim();
      if (!name || name.length > 40 || state.saved.length >= 12) {
        state.message = 'Use a name of 1–40 characters; up to 12 saved profiles.';
        return;
      }
      state.saved = [
        ...state.saved.filter((p) => p.name !== name),
        { name, quality: mediaQualitySchema.parse(state.current) },
      ];
      await persist();
      state.message = 'Profile saved on this device.';
    },
    async remove(name: string) {
      state.saved = state.saved.filter((p) => p.name !== name);
      await persist();
    },
    async dispose() {
      disposed = true;
      await ready;
      await write.catch(() => {});
      await store?.close();
    },
  };
}
export type QualityModel = ReturnType<typeof createQualityModel>;
