import { reactive } from 'vue';
import { activityViewSchema, breakStartedSchema, clockSchema } from '@study/contracts';
import type {
  ActivityAction,
  ActivityOptions,
  ActivitySettings,
  ActivityView,
} from '@study/contracts';
import { activityPreference, shouldSuggest } from '@study/activities/browser';
import { createPreferenceStore } from '@study/adapters/indexeddb';
import type { AudioEffects } from '@study/feature-sdk';
import type { EventBus } from '@study/core/browser';
import type { RealtimeClient } from '../lib/realtime.ts';
export function createActivitiesModel(
  roomId: string,
  userId: string,
  realtime: RealtimeClient,
  events: EventBus,
  audio: AudioEffects,
) {
  const definition = activityPreference(userId);
  const state = reactive({
    view: null as ActivityView | null,
    busy: false,
    error: '',
    suggestion: false,
    preferences: { ...definition.defaultValue },
    remaining: 0,
  });
  let store: Awaited<ReturnType<typeof createPreferenceStore>> | undefined,
    disposed = false,
    changed = false,
    previousBoundary: string | null = null;
  let queue = Promise.resolve(),
    offset = 0;
  const receive = (value: unknown) => {
    if (disposed) return;
    const view = activityViewSchema.parse(value),
      old = state.view?.activity,
      next = view.activity;
    if (old?.id === next?.id && old && next && old.version > next.version) return;
    if (
      old?.id === next?.id &&
      old &&
      next &&
      ['participant', 'spectator'].includes(next.myMode) &&
      next.members.some(
        (m) => m.score > (old.members.find((member) => member.id === m.id)?.score ?? 0),
      ) &&
      !state.preferences.muted
    )
      audio.effect(660, state.preferences.volume);
    state.view = view;
    if (next && old?.id !== next.id) void clock();
  };
  const unsubscribe = realtime.subscribe('activities.snapshot', { roomId }, receive, () => {
    state.view = null;
  });
  const stopEvents = events.subscribe('timer.break.started', async (value) => {
    const event = breakStartedSchema.parse(value);
    if (
      !disposed &&
      state.view !== null &&
      event.roomId === roomId &&
      shouldSuggest(state.preferences, event.scope + ':' + event.boundary, previousBoundary)
    ) {
      previousBoundary = event.scope + ':' + event.boundary;
      state.suggestion = true;
    }
  });
  async function clock() {
    if (!realtime.state.connected || disposed) return;
    try {
      const sent = Date.now(),
        result = clockSchema.parse(await realtime.send('activities.clock', { roomId }));
      if (!disposed) offset = result.serverNow - (sent + Date.now()) / 2;
    } catch {
      /* Countdown resumes from the next authoritative sample. */
    }
  }
  const ticking = setInterval(() => {
    state.remaining = Math.max(
      0,
      Math.ceil(((state.view?.activity?.deadline ?? 0) - Date.now() - offset) / 1000),
    );
  }, 250);
  const sampling = setInterval(() => void clock(), 30000);
  async function send(operation: string, input: unknown, prepare?: () => Promise<unknown>) {
    if (disposed || state.busy || !realtime.state.connected) return false;
    state.busy = true;
    state.error = '';
    try {
      const payload = prepare ? await prepare() : input;
      if (disposed) return false;
      const value = await realtime.send(operation, payload);
      receive(value);
      return true;
    } catch (e) {
      if (!disposed) {
        state.error = e instanceof Error ? e.message : 'Activity is unavailable.';
        realtime.refresh('activities.snapshot');
      }
      return false;
    } finally {
      if (!disposed) state.busy = false;
    }
  }
  const revision = () => {
    const s = state.view?.activity;
    return s
      ? {
          roomId,
          activityId: s.id,
          version: s.version,
          round: s.round,
          requestId: crypto.randomUUID(),
        }
      : null;
  };
  async function freshRevision(requireRound = false) {
    const expected = revision();
    if (!expected) throw new Error('Activity is no longer available.');
    receive(await realtime.send('activities.snapshot', { roomId }));
    const current = revision();
    if (
      !current ||
      current.activityId !== expected.activityId ||
      (requireRound && current.round !== expected.round)
    )
      throw new Error('Activity changed. Review the current round and try again.');
    return current;
  }
  const model = {
    state,
    async init() {
      const opened = await createPreferenceStore([definition]);
      if (disposed) {
        await opened.close();
        return;
      }
      store = opened;
      const preference = await opened.get(definition);
      if (!disposed && !changed) state.preferences = preference;
      else if (!disposed) await opened.set(definition, { ...state.preferences });
      if (!disposed && opened.mode === 'memory')
        state.error = 'Activity preferences are temporary on this device.';
      await clock();
    },
    start(kind: string, options: ActivityOptions) {
      state.suggestion = false;
      return send('activities.start', { roomId, requestId: crypto.randomUUID(), kind, options });
    },
    member(action: 'join' | 'decline' | 'spectate' | 'leave' | 'begin' | 'cancel' | 'report') {
      return send('activities.member', null, async () => ({ ...(await freshRevision()), action }));
    },
    play(action: ActivityAction) {
      return send('activities.play', null, async () => {
        // Drawing changes the shared version between periodic snapshots. Sample authority
        // just before an action; the server still rejects a concurrent/stale revision.
        const r = await freshRevision(true);
        return { ...r, action };
      });
    },
    configure(settings: ActivitySettings) {
      return send('activities.configure', { roomId, settings });
    },
    preferences(value: typeof state.preferences) {
      changed = true;
      state.preferences = { ...value };
      if (!value.suggestions) state.suggestion = false;
      queue = queue
        .then(() => store?.set(definition, value))
        .then(() => {})
        .catch(() => {
          if (!disposed) state.error = 'Activity preferences could not be saved.';
        });
    },
    async preview() {
      try {
        await audio.enable();
        if (!disposed && !state.preferences.muted) audio.effect(660, state.preferences.volume);
      } catch {
        state.error = 'Sound could not start. Try again.';
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      stopEvents();
      clearInterval(ticking);
      clearInterval(sampling);
      void queue.finally(() => store?.close());
      state.view = null;
    },
  };
  void model.init().catch(() => {
    if (!disposed) state.error = 'Activity preferences are temporary.';
  });
  return model;
}
export type ActivitiesModel = ReturnType<typeof createActivitiesModel>;
