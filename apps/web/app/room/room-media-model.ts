import { reactive } from 'vue';
import { mediaViewSchema, mediaClockSchema, mediaMetadataSchema } from '@study/contracts';
import type { MediaAction, MediaView, MediaMetadata, MediaPlayback } from '@study/contracts';
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
    advanced: false,
    videoIntent: false,
    diagnostics: { playing: false, position: 0, mounts: 0, duration: 0 },
    metadata: {} as Record<string, MediaMetadata>,
    previewMix: null as MediaPlayback['mix'] | null,
    view: null as MediaView | null,
    busy: false,
    error: '',
    local: structuredClone(defaultLocalRoomMix),
    audioEnabled: false,
    duckMusicGain: 1,
  });
  const preference = localMixPreference(userId),
    ambience = createAmbienceEngine();
  let disposed = false,
    localChanged = false,
    clockOffset = 0,
    clockReady = false;
  let store: Awaited<ReturnType<typeof createPreferenceStore>> | undefined;
  let queue = Promise.resolve();
  let metadataQueue = Promise.resolve();
  const resolving = new Map<string, Promise<MediaMetadata>>();
  let pendingMix:
    { music?: number; ambience?: Partial<MediaPlayback['mix']['ambience']> } | undefined;
  let mixTimer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  const applyAudio = () =>
    ambience.set(
      state.view
        ? effectiveMix(state.previewMix ?? state.view.state.mix, state.local).ambience
        : { rain: 0, white: 0, pink: 0, brown: 0 },
    );
  const receive = (v: unknown) => {
    if (disposed) return;
    const view = mediaViewSchema.parse(v);
    if (state.view?.epoch === view.epoch && state.view.version > view.version) return;
    state.view = view;
    applyAudio();
    for (const id of new Set([
      ...view.state.queue,
      ...view.suggestions.flatMap((s) => ('videoId' in s.action ? [s.action.videoId] : [])),
    ]))
      void model.resolveMetadata(id);
  };
  async function flushMix(attempt = 0) {
    if (disposed || !pendingMix) return;
    if (!state.view?.canControl || !realtime.state.connected) {
      pendingMix = undefined;
      state.previewMix = null;
      applyAudio();
      return;
    }
    if (state.busy) {
      mixTimer = setTimeout(() => void flushMix(attempt), 100);
      return;
    }
    const patch = pendingMix;
    pendingMix = undefined;
    const mix = {
      ...state.view.state.mix,
      ...patch,
      ambience: { ...state.view.state.mix.ambience, ...patch.ambience },
    };
    const success = await model.act({ type: 'mix', mix });
    if (!success && attempt < 2 && !disposed) {
      const latest = pendingMix as
        { music?: number; ambience?: Partial<MediaPlayback['mix']['ambience']> } | undefined;
      pendingMix = {
        ...patch,
        ...latest,
        ambience: { ...patch.ambience, ...latest?.ambience },
      };
      mixTimer = setTimeout(() => void flushMix(attempt + 1), 400);
    } else if (!pendingMix) {
      state.previewMix = null;
      applyAudio();
    }
  }
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
    async resolveMetadata(videoId: string): Promise<MediaMetadata> {
      if (state.metadata[videoId]) return state.metadata[videoId]!;
      if (resolving.has(videoId)) return resolving.get(videoId)!;
      let value: MediaMetadata = {
        videoId,
        provider: 'youtube',
        status: 'failed',
        title: 'Couldn’t load',
      };
      const task = metadataQueue.then(async () => {
        if (disposed) return value;
        try {
          value = mediaMetadataSchema.parse(
            await realtime.send('room-media.metadata', { roomId, videoId }),
          );
        } catch {
          /* Descriptive metadata failure never blocks authorized playback. */
        }
        if (!disposed) {
          const keys = Object.keys(state.metadata);
          if (keys.length >= 100) delete state.metadata[keys[0]!];
          state.metadata[videoId] = value;
        }
        return value;
      });
      resolving.set(videoId, task);
      metadataQueue = task.then(() => {});
      void task.finally(() => resolving.delete(videoId));
      return task;
    },
    scheduleMix(patch: { music?: number; ambience?: Partial<MediaPlayback['mix']['ambience']> }) {
      if (!state.view?.canControl || disposed || !realtime.state.connected) return;
      pendingMix = {
        ...pendingMix,
        ...patch,
        ambience: { ...pendingMix?.ambience, ...patch.ambience },
      };
      state.previewMix = {
        ...state.view.state.mix,
        ...pendingMix,
        ambience: { ...state.view.state.mix.ambience, ...pendingMix.ambience },
      };
      applyAudio();
      clearTimeout(mixTimer);
      mixTimer = setTimeout(() => void flushMix(), 350);
    },
    serverNow: () => Date.now() + clockOffset,
    connected: () => realtime.state.connected,
    clockReady: () => clockReady,
    async init() {
      unsubscribe = realtime.subscribe(
        'room-media.snapshot',
        { roomId },
        (v) => {
          const first = !state.view;
          receive(v);
          if (first || !clockReady) void syncClock();
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
      if (!state.view || state.busy || disposed || !realtime.state.connected) return false;
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
        return true;
      } catch (e) {
        if (!disposed) state.error = (e as Error).message;
        return false;
      } finally {
        state.busy = false;
        if (!disposed) realtime.refresh('room-media.snapshot');
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
      state.advanced = false;
      document.querySelector<HTMLElement>('[aria-label="Media"]')?.focus();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe?.();
      clearInterval(clockTimer);
      clearTimeout(mixTimer);
      pendingMix = undefined;
      state.view = null;
      void ambience.close();
      void queue.finally(() => store?.close());
    },
  };
  return model;
}
export type RoomMediaModel = ReturnType<typeof createRoomMediaModel>;
