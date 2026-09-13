import { reactive } from 'vue';
import { mediaViewSchema, mediaClockSchema } from '@study/contracts';
import type { MediaAction, MediaView } from '@study/contracts';
import { createPreferenceStore } from '@study/adapters/indexeddb';
import {
  localMixPreference,
  defaultLocalRoomMix,
  createAmbienceEngine,
  effectiveMix,
} from '@study/room-media/browser';
import type { RealtimeClient } from '../lib/realtime.ts';
export function createRoomMediaModel(roomId: string, userId: string, realtime: RealtimeClient) {
  const state = reactive({
    open: false,
    view: null as MediaView | null,
    busy: false,
    error: '',
    local: structuredClone(defaultLocalRoomMix),
    audioEnabled: false,
  });
  const preference = localMixPreference(userId),
    ambience = createAmbienceEngine();
  let disposed = false,
    localChanged = false,
    clockOffset = 0,
    clockReady = false;
  let store: Awaited<ReturnType<typeof createPreferenceStore>> | undefined;
  let queue = Promise.resolve();
  const applyAudio = () =>
    ambience.set(
      state.view
        ? effectiveMix(state.view.state.mix, state.local).ambience
        : { rain: 0, white: 0, pink: 0, brown: 0 },
    );
  const receive = (v: unknown) => {
    if (disposed) return;
    const view = mediaViewSchema.parse(v);
    if (state.view?.epoch === view.epoch && state.view.version > view.version) return;
    state.view = view;
    applyAudio();
  };
  async function syncClock() {
    const sent = Date.now();
    try {
      const result = mediaClockSchema.parse(await realtime.send('room-media.clock', { roomId }));
      if (!disposed) {
        clockOffset = result.serverNow - (sent + Date.now()) / 2;
        clockReady = true;
      }
    } catch {
      clockReady = false;
    }
  }
  const clockTimer = setInterval(() => {
    if (state.view) void syncClock();
  }, 60000);
  const model = {
    state,
    serverNow: () => Date.now() + clockOffset,
    clockReady: () => clockReady,
    async init() {
      realtime.subscribe(
        'room-media.snapshot',
        { roomId },
        (v) => {
          const first = !state.view;
          receive(v);
          if (first) void syncClock();
        },
        () => {
          state.view = null;
          clockReady = false;
          applyAudio();
        },
      );
      store = await createPreferenceStore([preference]);
      if (disposed) {
        await store.close();
        return;
      }
      const saved = await store.get(preference);
      if (!disposed && localChanged) model.saveLocal();
      if (!disposed && !localChanged) {
        state.local = saved;
        applyAudio();
      }
    },
    async command(
      kind: 'control' | 'configure' | 'reconcile' | 'suggest' | 'suggestion-decide',
      fields: Record<string, unknown>,
    ) {
      if (!state.view || state.busy || disposed) return;
      state.busy = true;
      state.error = '';
      try {
        receive(
          await realtime.send('room-media.' + kind, {
            roomId,
            epoch: state.view.epoch,
            version: state.view.version,
            ...fields,
          }),
        );
      } catch (e) {
        if (!disposed) state.error = (e as Error).message;
      } finally {
        state.busy = false;
        realtime.refresh('room-media.snapshot');
      }
    },
    act(action: MediaAction, suggest = false) {
      return model.command(suggest ? 'suggest' : 'control', { action });
    },
    saveLocal() {
      localChanged = true;
      applyAudio();
      const saved = JSON.parse(JSON.stringify(state.local));
      queue = queue
        .then(async () => {
          if (disposed) return;
          await store?.set(preference, saved);
          if (store?.mode === 'memory')
            state.error = 'Local mix is temporary because device storage is unavailable.';
        })
        .catch(() => {
          if (!disposed) state.error = 'Could not save your local mix.';
        });
    },
    async enableAudio() {
      try {
        await ambience.enable();
        if (disposed) {
          await ambience.close();
          return;
        }
        state.audioEnabled = true;
        applyAudio();
      } catch {
        state.error = 'Audio could not start. Try enabling ambience again.';
      }
    },
    close() {
      state.open = false;
      document.querySelector<HTMLElement>('[aria-label="Media"]')?.focus();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearInterval(clockTimer);
      state.view = null;
      void ambience.close();
      void queue.finally(() => store?.close());
    },
  };
  return model;
}
export type RoomMediaModel = ReturnType<typeof createRoomMediaModel>;
