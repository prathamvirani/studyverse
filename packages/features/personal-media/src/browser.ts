import { z, layoutSchema } from '@study/contracts';
import type { TileLayout } from '@study/contracts';
import type {
  PersonalMediaAdapter,
  PersonalMediaSource,
  SharedVideoPlayer,
  PreferenceDefinition,
  PreferenceStore,
} from '@study/feature-sdk';

const sourceSchema = z.strictObject({
  provider: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  contentId: z.string().min(1).max(2048),
  canonicalUrl: z
    .string()
    .max(2048)
    .url()
    .refine((value) => {
      const u = new URL(value);
      return (
        u.protocol === 'https:' &&
        !u.username &&
        !u.password &&
        !u.hash &&
        [...u.searchParams.keys()].every((key) => key === 'v')
      );
    }),
});
const recordSchema = z.strictObject({
  source: sourceSchema,
  title: z.string().min(1).max(200),
  position: z.number().finite().min(0).max(604800),
  rate: z.number().finite().min(0.25).max(4),
  lastOpenedAt: z.number().finite().nonnegative(),
});
export const personalDataSchema = z.strictObject({
  history: z.array(recordSchema).max(30),
  selected: z.string().max(2100).nullable(),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  duckRoom: z.boolean(),
  duckLevel: z.number().min(0).max(1),
  voiceDucking: z.boolean(),
  rememberProgress: z.boolean(),
  rememberHistory: z.boolean(),
  tile: layoutSchema.nullable(),
});
export type PersonalData = z.infer<typeof personalDataSchema>;
export type PersonalRecord = PersonalData['history'][number];
export const personalKey = (source: PersonalMediaSource) =>
  `${source.provider}:${source.contentId}`;
export const defaultPersonalData = (): PersonalData => ({
  history: [],
  selected: null,
  volume: 0.7,
  muted: false,
  duckRoom: true,
  duckLevel: 0.2,
  voiceDucking: false,
  rememberProgress: true,
  rememberHistory: true,
  tile: null,
});
/** New namespace in the existing v1 preferences object store; no DB upgrade or destructive migration. */
export function personalPreference(userId: string): PreferenceDefinition<PersonalData> {
  return {
    key: `personal-media.player.${userId}`,
    version: 1,
    schema: personalDataSchema,
    defaultValue: defaultPersonalData(),
  };
}
export class PersonalProviderRegistry {
  private readonly adapters = new Map<string, PersonalMediaAdapter>();
  register(adapter: PersonalMediaAdapter) {
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(adapter.id) || this.adapters.has(adapter.id))
      throw new Error('Duplicate or invalid personal provider');
    this.adapters.set(adapter.id, adapter);
  }
  resolve(input: string) {
    if (input.length > 2048) return null;
    for (const adapter of this.adapters.values()) {
      let source: PersonalMediaSource | null;
      try {
        source = adapter.match(input);
      } catch {
        continue;
      }
      const parsed = sourceSchema.safeParse(source);
      if (
        parsed.success &&
        parsed.data.provider === adapter.id &&
        adapter.capabilities.personal &&
        adapter.capabilities.embed
      )
        return { adapter, source: parsed.data };
    }
    return null;
  }
  restore(source: PersonalMediaSource) {
    const result = this.resolve(source.canonicalUrl);
    return result && personalKey(result.source) === personalKey(source) ? result : null;
  }
}
export function resumePosition(position: number, duration: number) {
  if (!Number.isFinite(position) || position < 0) return 0;
  if (Number.isFinite(duration) && duration > 0)
    return position >= duration - 5 ? 0 : Math.min(position, duration);
  return Math.min(position, 604800);
}
export function recentMedia(history: PersonalRecord[], entry: PersonalRecord) {
  return [
    entry,
    ...history.filter((item) => personalKey(item.source) !== personalKey(entry.source)),
  ].slice(0, 30);
}
export function smoothGain(current: number, target: number, elapsedMs: number, fadeMs = 250) {
  const step = Math.min(1, Math.max(0, elapsedMs / fadeMs));
  const value = current + (target - current) * step;
  return Math.abs(value - target) < 0.002 ? target : value;
}
export function createPersonalState() {
  return {
    data: defaultPersonalData(),
    current: null as PersonalRecord | null,
    ready: false,
    loading: false,
    playing: false,
    duration: 0,
    position: 0,
    rates: [1] as number[],
    error: '',
    storage: 'indexeddb',
    resumePrompt: false,
    mounts: 0,
    attached: false,
    canSeek: false,
    roomGain: 1,
    voiceGain: 1,
    voiceAvailable: false,
  };
}
export type PersonalState = ReturnType<typeof createPersonalState>;

/** One private owner, with injected adapters/storage/gain sink. No room transport or RTC SDK. */
export function createPersonalPlayer(options: {
  registry: PersonalProviderRegistry;
  state: PersonalState;
  preference: PreferenceDefinition<PersonalData>;
  store: PreferenceStore & { readonly mode?: string };
  roomGain(value: number): void;
  now?: () => number;
}) {
  const { state, registry, store, preference } = options,
    now = options.now ?? Date.now;
  let host: HTMLElement | undefined, player: SharedVideoPlayer | undefined;
  let clearing = false,
    cleared = false;
  let pending: AbortController | undefined;
  let generation = 0,
    disposed = false,
    writes = Promise.resolve(),
    saveTimer: ReturnType<typeof setTimeout> | undefined;
  let lastSave = 0,
    lastTick = now(),
    speakingUntil = 0;
  function record() {
    if (!state.current) return;
    state.current.position = state.data.rememberProgress
      ? Math.min(604800, Math.max(0, state.position))
      : 0;
    if (state.data.rememberHistory)
      state.data.history = recentMedia(state.data.history, {
        ...state.current,
        source: { ...state.current.source },
      });
  }
  function flush() {
    if (clearing || cleared) return writes;
    clearTimeout(saveTimer);
    record();
    const value = personalDataSchema.parse(JSON.parse(JSON.stringify(state.data)));
    writes = writes
      .then(() => store.set(preference, value))
      .then(() => {
        state.storage = store.mode ?? 'indexeddb';
      })
      .catch(() => {
        state.error = 'Could not save this device’s playback. It remains private.';
      });
    lastSave = now();
    return writes;
  }
  function save() {
    if (clearing) return;
    cleared = false;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void flush(), 400);
  }
  function effectiveAudio(elapsed = 0) {
    const target =
      state.playing && !state.data.muted && state.data.volume > 0 && state.data.duckRoom
        ? state.data.duckLevel
        : 1;
    state.roomGain = smoothGain(state.roomGain, target, elapsed);
    const voice =
      state.data.voiceDucking && state.voiceAvailable && now() < speakingUntil ? 0.25 : 1;
    state.voiceGain = smoothGain(state.voiceGain, voice, elapsed);
    options.roomGain(state.roomGain);
    player?.volume(state.data.muted ? 0 : state.data.volume * state.voiceGain);
  }
  function release() {
    generation++;
    if (player) {
      const position = player.position();
      if (Number.isFinite(position) && (!state.resumePrompt || position > 0))
        state.position = Math.min(604800, Math.max(0, position));
      player.pause();
      player.destroy();
    }
    pending?.abort();
    pending = undefined;
    player = undefined;
    state.attached = false;
    state.playing = false;
    state.loading = false;
    effectiveAudio();
  }
  const owner = {
    state,
    async init() {
      const data = await store.get(preference);
      if (disposed) return;
      data.history = data.history.filter((entry) => !!registry.restore(entry.source));
      state.data = data;
      state.current =
        data.history.find((entry) => personalKey(entry.source) === data.selected) ?? null;
      state.canSeek = !!(
        state.current && registry.restore(state.current.source)?.adapter.capabilities.seek
      );
      state.position = state.current?.position ?? 0;
      state.resumePrompt = state.position > 0;
      state.storage = store.mode ?? 'indexeddb';
      state.ready = true;
    },
    select(input: string) {
      if (!state.ready || disposed) return false;
      const match = registry.resolve(input);
      if (!match) {
        state.error =
          'Use a public YouTube or Vimeo link, or a public MP4/WebM on this site. Private or signed links cannot play here.';
        return false;
      }
      release();
      record();
      const key = personalKey(match.source),
        saved = state.data.history.find((entry) => personalKey(entry.source) === key);
      state.current = {
        source: match.source,
        title: saved?.title ?? `${match.adapter.label} study media`,
        position: state.data.rememberProgress ? (saved?.position ?? 0) : 0,
        rate: saved?.rate ?? 1,
        lastOpenedAt: now(),
      };
      state.position = state.current.position;
      state.duration = 0;
      state.canSeek = match.adapter.capabilities.seek;
      state.rates = [1];
      state.error = '';
      state.resumePrompt = state.position > 0;
      state.data.selected = state.data.rememberHistory ? key : null;
      record();
      save();
      // Renderer initialization follows the owning tile's mount; never from a control surface.
      if (host) void owner.mount(host);
      return true;
    },
    async mount(node: HTMLElement) {
      host = node;
      if (disposed || !state.current || player || state.loading) return;
      const match = registry.restore(state.current.source);
      if (!match) return;
      const current = state.current,
        ticket = ++generation;
      pending = new AbortController();
      state.loading = true;
      try {
        const result = await match.adapter.mount(
          node,
          {
            signal: pending.signal,
            error: (message) => {
              if (ticket === generation) {
                state.error = message;
                state.playing = false;
                player?.pause();
                effectiveAudio();
                void flush();
              }
            },
            blocked: () => {
              if (ticket === generation) {
                state.error = 'Playback needs your permission. Press Play personal.';
                state.playing = false;
                effectiveAudio();
              }
            },
            ended: () => {
              if (ticket === generation) {
                state.playing = false;
                state.position = 0;
                state.resumePrompt = false;
                effectiveAudio();
                void flush();
              }
            },
            playback: (playing, position) => {
              if (ticket === generation) {
                state.playing = playing;
                if (Number.isFinite(position) && (!state.resumePrompt || position > 0 || playing))
                  state.position = Math.min(604800, Math.max(0, position));
                if (playing) state.resumePrompt = false;
                effectiveAudio();
                if (!playing) void flush();
              }
            },
          },
          current.source,
        );
        if (ticket !== generation || disposed || host !== node) {
          result.destroy();
          return;
        }
        player = result;
        state.attached = true;
        state.mounts++;
        const rates = result.rates?.() ?? [1];
        state.rates = [
          ...new Set(rates.filter((rate) => Number.isFinite(rate) && rate >= 0.25 && rate <= 4)),
        ];
        if (!state.rates.includes(1)) state.rates.unshift(1);
        if (!state.rates.includes(current.rate)) current.rate = 1;
        state.duration = result.duration?.() ?? 0;
        state.position = match.adapter.capabilities.seek
          ? resumePosition(current.position, state.duration)
          : 0;
        state.resumePrompt = state.position > 0;
        result.cue(current.source.contentId, state.position);
        result.rate(current.rate);
        result.pause();
        effectiveAudio();
        const metadata = await match.adapter.resolveMetadata(current.source, result);
        if (ticket !== generation || disposed) return;
        current.title = z
          .string()
          .trim()
          .min(1)
          .max(200)
          .catch(`${match.adapter.label} study media`)
          .parse(metadata.title);
        record();
        save();
      } catch {
        if (ticket === generation && !disposed) {
          state.error =
            'This media cannot play here. The source may be unavailable, private, blocked or incompatible with this browser.';
          state.playing = false;
          effectiveAudio();
        }
      } finally {
        if (ticket === generation) state.loading = false;
      }
    },
    detach() {
      if (disposed) return;
      release();
      host = undefined;
      if (state.current) void flush();
    },
    async prepare() {
      if (host && !player && !disposed) await owner.mount(host);
    },
    play(startOver = false) {
      if (
        !player ||
        !state.current ||
        !registry.restore(state.current.source)?.adapter.capabilities.play
      )
        return;
      if (startOver) owner.seek(0);
      else if (state.resumePrompt) owner.seek(resumePosition(state.position, state.duration));
      state.resumePrompt = false;
      state.error = '';
      player.play();
    },
    pause() {
      player?.pause();
      state.playing = false;
      const position = player?.position();
      if (
        position !== undefined &&
        Number.isFinite(position) &&
        (!state.resumePrompt || position > 0)
      )
        state.position = Math.min(604800, Math.max(0, position));
      effectiveAudio();
      void flush();
    },
    seek(position: number) {
      if (
        !player ||
        !state.current ||
        !registry.restore(state.current.source)?.adapter.capabilities.seek
      )
        return;
      state.position = resumePosition(position, 0);
      if (Number.isFinite(state.duration) && state.duration > 0)
        state.position = Math.min(state.position, state.duration);
      player.seek(state.position);
      state.resumePrompt = false;
      void flush();
    },
    rate(value: number) {
      if (!state.current || !state.rates.includes(value)) return;
      player?.rate(value);
      state.current.rate = value;
      save();
    },
    preferences(patch: Partial<Omit<PersonalData, 'history' | 'selected' | 'tile'>>) {
      state.data = personalDataSchema.parse({ ...state.data, ...patch });
      if (!state.data.rememberHistory) {
        state.data.history = [];
        state.data.selected = null;
      }
      if (!state.data.rememberProgress) {
        for (const item of state.data.history) item.position = 0;
      }
      effectiveAudio();
      save();
    },
    tile(layout: TileLayout) {
      state.data.tile = { ...layout, fullscreen: false, minimized: false };
      save();
    },
    activity(available: boolean, speaking: boolean) {
      state.voiceAvailable = available;
      if (available && speaking) speakingUntil = now() + 600;
      if (!available) speakingUntil = 0;
      effectiveAudio();
    },
    roomItem() {
      return state.current
        ? (registry.restore(state.current.source)?.adapter.roomItem?.(state.current.source) ?? null)
        : null;
    },
    tick() {
      if (disposed) return;
      const time = now(),
        elapsed = time - lastTick;
      lastTick = time;
      if (player) {
        state.playing = player.playing();
        const position = player.position(),
          duration = player.duration?.() ?? 0;
        if (Number.isFinite(position) && (!state.resumePrompt || position > 0))
          state.position = Math.max(0, Math.min(604800, position));
        state.duration = Number.isFinite(duration) && duration > 0 ? duration : 0;
        if (
          state.current &&
          state.rates.includes(state.current.rate) &&
          player.playbackRate?.() !== state.current.rate
        )
          player.rate(state.current.rate);
        const metadata = player.metadata?.();
        if (metadata?.title && state.current && metadata.title !== state.current.title) {
          state.current.title = metadata.title.slice(0, 200);
          save();
        }
        const rates = player.rates?.();
        if (rates?.length)
          state.rates = [...new Set([1, ...rates.filter((r) => r >= 0.25 && r <= 4)])];
      }
      effectiveAudio(elapsed);
      if (state.playing && time - lastSave >= 5000) void flush();
    },
    flush,
    async clear() {
      clearing = true;
      release();
      state.current = null;
      state.position = 0;
      state.duration = 0;
      clearTimeout(saveTimer);
      try {
        await writes;
        await store.delete(preference.key);
        state.data = defaultPersonalData();
        state.resumePrompt = false;
        state.error = '';
        cleared = true;
      } finally {
        clearing = false;
      }
    },
    async dispose() {
      if (disposed) return;
      release();
      disposed = true;
      host = undefined;
      await flush();
      options.roomGain(1);
      await store.close();
    },
  };
  return owner;
}
export type PersonalPlayer = ReturnType<typeof createPersonalPlayer>;
