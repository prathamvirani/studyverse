import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { openDB, deleteDB } from 'idb';
import { createPreferenceStore } from '@study/adapters/indexeddb';
import { personalYoutubeAdapter } from '@study/adapters/youtube/personal';
import { personalVimeoAdapter } from '@study/adapters/vimeo/browser';
import { directMediaAdapter } from '@study/adapters/direct-media/browser';
import {
  PersonalProviderRegistry,
  personalPreference,
  createPersonalState,
  createPersonalPlayer,
  personalKey,
  resumePosition,
  smoothGain,
} from '@study/personal-media/browser';
import type { PersonalMediaAdapter, SharedVideoPlayer } from '@study/feature-sdk';
import { createPersonalMediaModel } from '../../apps/web/app/room/personal-media-model.ts';

function fixture() {
  let position = 0,
    playing = false,
    volume = 0,
    rate = 1,
    destroyed = 0;
  const player: SharedVideoPlayer = {
    cue: (_id, p) => {
      position = p;
    },
    play: () => {
      playing = true;
    },
    pause: () => {
      playing = false;
    },
    seek: (p) => {
      position = p;
    },
    rate: (r) => {
      rate = r;
    },
    volume: (v) => {
      volume = v;
    },
    position: () => position,
    duration: () => 100,
    playing: () => playing,
    rates: () => [1, 1.5, 2],
    playbackRate: () => rate,
    destroy: () => {
      destroyed++;
    },
  };
  const adapter: PersonalMediaAdapter = {
    id: 'fixture',
    label: 'Test lecture',
    capabilities: {
      embed: true,
      personal: true,
      roomSync: false,
      seek: true,
      play: true,
      pause: true,
    },
    match: (input) => {
      try {
        const u = new URL(input);
        return u.hostname === 'lecture.example'
          ? {
              provider: 'fixture',
              contentId: u.pathname,
              canonicalUrl: `https://lecture.example${u.pathname}`,
            }
          : null;
      } catch {
        return null;
      }
    },
    resolveMetadata: async () => ({ title: 'Private lecture' }),
    mount: async () => player,
  };
  return {
    adapter,
    player,
    get volume() {
      return volume;
    },
    get rate() {
      return rate;
    },
    get destroyed() {
      return destroyed;
    },
  };
}
describe('private provider extension and canonicalization', () => {
  it('registers providers through contracts; accepts normalized public identity and rejects unsupported/malformed/private sources', () => {
    const r = new PersonalProviderRegistry();
    r.register(personalYoutubeAdapter);
    r.register(personalVimeoAdapter);
    r.register(directMediaAdapter('https://study.example'));
    expect(
      r.resolve('https://music.youtube.com/watch?v=M7lc1UVf-VE&token=private')?.source,
    ).toEqual({
      provider: 'youtube',
      contentId: 'M7lc1UVf-VE',
      canonicalUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    });
    expect(r.resolve('https://vimeo.com/123456?utm_source=test')?.source.canonicalUrl).toBe(
      'https://vimeo.com/123456',
    );
    expect(
      r.resolve('https://study.example/media/lecture.mp4?utm_source=test#t=20')?.source.contentId,
    ).toBe('https://study.example/media/lecture.mp4');
    for (const url of [
      'not a URL',
      'javascript:alert(1)',
      'http://youtube.com/watch?v=M7lc1UVf-VE',
      'https://youtube.com.evil/watch?v=M7lc1UVf-VE',
      'https://user:pass@youtube.com/watch?v=M7lc1UVf-VE',
      'https://vimeo.com/123456?h=private',
      'https://vimeo.com/123456/private',
      'https://study.example/media/lecture.mp4?Signature=sensitive',
      'https://elsewhere.example/lecture.mp4',
      'https://study.example/arbitrary.html',
    ])
      expect(r.resolve(url), url).toBeNull();
    expect(() => r.register(personalYoutubeAdapter)).toThrow();
  });
  it('adds a test adapter without edits to player core, validates persisted identity and advertises capabilities', () => {
    const r = new PersonalProviderRegistry(),
      f = fixture();
    r.register(f.adapter);
    const resolved = r.resolve('https://lecture.example/chapter?tracking=remove')!;
    expect(resolved.adapter.capabilities.roomSync).toBe(false);
    expect(resolved.source.canonicalUrl).toBe('https://lecture.example/chapter');
    expect(r.restore({ ...resolved.source, contentId: '/forged' })).toBeNull();
    expect(personalYoutubeAdapter.roomItem?.(personalYoutubeAdapter.match('M7lc1UVf-VE')!)).toEqual(
      { videoId: 'M7lc1UVf-VE' },
    );
    expect(personalVimeoAdapter.roomItem).toBeUndefined();
  });
  it('isolates a failing extension matcher from other registered providers', () => {
    const registry = new PersonalProviderRegistry(),
      f = fixture();
    registry.register({
      ...f.adapter,
      id: 'broken',
      match() {
        throw new Error('Unavailable extension');
      },
    });
    registry.register(f.adapter);
    expect(registry.resolve('https://lecture.example/chapter')?.source.provider).toBe('fixture');
  });
});
describe('local persistence and one personal playback owner', () => {
  it('cancels pending play on a close or replacement instead of autoplaying the next source', async () => {
    const f = fixture(),
      model = createPersonalMediaModel('intent-fixture', [f.adapter], () => {});
    await model.ready;
    await model.open('https://lecture.example/one');
    await model.play();
    model.cancelPlay();
    await model.mount({} as HTMLElement);
    model.player!.tick();
    expect(model.state.playing).toBe(false);
    model.player!.detach();
    await model.play();
    await model.open('https://lecture.example/two');
    await model.mount({} as HTMLElement);
    model.player!.tick();
    expect(model.state.playing).toBe(false);
    await model.player!.clear();
    await model.dispose();
  });
  it('extends a previous v1 IndexedDB without clearing existing preferences; dedupes/resumes/history/rate/mix/geometry locally', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const name = 'personal-upgrade',
      db = await openDB(name, 1, {
        upgrade: (d) => {
          d.createObjectStore('preferences');
        },
      });
    await db.put('preferences', { version: 1, value: { scale: 1.5 } }, 'fixture.display');
    db.close();
    const pref = personalPreference('fixture'),
      store = await createPreferenceStore([pref], name),
      r = new PersonalProviderRegistry(),
      f = fixture();
    r.register(f.adapter);
    const state = createPersonalState(),
      gains: number[] = [];
    const owner = createPersonalPlayer({
      registry: r,
      state,
      store,
      preference: pref,
      roomGain: (v) => gains.push(v),
    });
    try {
      await owner.init();
      expect(owner.select('https://lecture.example/one?token=removed')).toBe(true);
      await owner.mount({} as HTMLElement);
      owner.play();
      f.player.seek(43);
      owner.tick();
      owner.rate(1.5);
      owner.preferences({ volume: 0.4, muted: true });
      owner.tile({
        version: 1,
        x: 99,
        y: 77,
        width: 480,
        height: 400,
        zIndex: 1,
        minimized: false,
        fullscreen: false,
      });
      owner.pause();
      await owner.flush();
      expect(state.data.history).toHaveLength(1);
      expect(state.data.history[0]?.position).toBe(43);
      expect(f.volume).toBe(0);
      owner.detach();
      await owner.flush();
      await owner.mount({} as HTMLElement);
      expect(state.position).toBe(43);
      expect(f.rate).toBe(1.5);
      expect(state.data.tile?.x).toBe(99);
      owner.select('https://lecture.example/one');
      await owner.flush();
      expect(state.data.history).toHaveLength(1);
      await owner.dispose();
      const reopened = await createPreferenceStore([pref], name),
        saved = await reopened.get(pref);
      expect(saved.history[0]?.source.canonicalUrl).not.toContain('token');
      expect(saved.volume).toBe(0.4);
      expect(saved.muted).toBe(true);
      expect(saved.selected).toBe(personalKey(saved.history[0]!.source));
      await reopened.close();
      const preserved = await openDB(name);
      expect(await preserved.get('preferences', 'fixture.display')).toEqual({
        version: 1,
        value: { scale: 1.5 },
      });
      expect(preserved.version).toBe(1);
      preserved.close();
    } finally {
      await owner.dispose();
      vi.useRealTimers();
      await deleteDB(name);
    }
  });
  it('ducking is independent, smoothly restores and never accumulates; voice loss/disable restores local output', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const pref = personalPreference('ducking'),
      store = await createPreferenceStore([pref], 'personal-ducking'),
      r = new PersonalProviderRegistry(),
      f = fixture();
    r.register(f.adapter);
    let effective = 1;
    const state = createPersonalState(),
      owner = createPersonalPlayer({
        registry: r,
        state,
        store,
        preference: pref,
        roomGain: (v) => {
          effective = 0.6 * v;
        },
      });
    try {
      await owner.init();
      owner.select('https://lecture.example/one');
      await owner.mount({} as HTMLElement);
      for (let i = 0; i < 4; i++) {
        owner.play();
        await vi.advanceTimersByTimeAsync(250);
        owner.tick();
        expect(effective).toBeCloseTo(0.12);
        owner.pause();
        await vi.advanceTimersByTimeAsync(250);
        owner.tick();
        expect(effective).toBeCloseTo(0.6);
      }
      owner.preferences({ voiceDucking: true });
      owner.activity(true, true);
      await vi.advanceTimersByTimeAsync(250);
      owner.tick();
      expect(f.volume).toBeCloseTo(0.175);
      owner.activity(false, false);
      await vi.advanceTimersByTimeAsync(250);
      owner.tick();
      expect(f.volume).toBeCloseTo(0.7);
      owner.activity(true, true);
      owner.preferences({ voiceDucking: false });
      await vi.advanceTimersByTimeAsync(250);
      owner.tick();
      expect(f.volume).toBeCloseTo(0.7);
      expect(state.data.volume).toBe(0.7);
      expect(state.data.duckLevel).toBe(0.2);
      await owner.dispose();
      expect(effective).toBeCloseTo(0.6);
    } finally {
      await owner.dispose();
      vi.useRealTimers();
      await deleteDB('personal-ducking');
    }
  });
  it('handles near-end/invalid duration, unsupported speed and disabled persistence without network work', async () => {
    expect(resumePosition(98, 100)).toBe(0);
    expect(resumePosition(35, NaN)).toBe(35);
    expect(resumePosition(NaN, 10)).toBe(0);
    expect(smoothGain(1, 0.2, 125)).toBeCloseTo(0.6);
    const r = new PersonalProviderRegistry(),
      f = fixture();
    r.register(f.adapter);
    const pref = personalPreference('limited'),
      store = await createPreferenceStore([pref], 'personal-limited'),
      state = createPersonalState();
    const owner = createPersonalPlayer({
      registry: r,
      state,
      store,
      preference: pref,
      roomGain: () => {},
    });
    await owner.init();
    owner.select('https://lecture.example/one');
    await owner.mount({} as HTMLElement);
    owner.rate(3);
    expect(f.rate).toBe(1);
    owner.preferences({ rememberHistory: false, rememberProgress: false });
    owner.seek(50);
    await owner.flush();
    expect(state.data.history).toEqual([]);
    expect(state.data.selected).toBeNull();
    await owner.clear();
    expect(await store.get(pref)).toEqual(pref.defaultValue);
    await owner.dispose();
    await deleteDB('personal-limited');
  });
  it('fences cancelled provider mounts and final owner destruction, with bounded writes and resource release', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const r = new PersonalProviderRegistry(),
      f = fixture(),
      pref = personalPreference('cancel'),
      store = await createPreferenceStore([pref], 'personal-cancel');
    let finish!: (p: SharedVideoPlayer) => void;
    f.adapter.mount = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    r.register(f.adapter);
    const state = createPersonalState(),
      owner = createPersonalPlayer({
        registry: r,
        state,
        store,
        preference: pref,
        roomGain: () => {},
      }),
      set = vi.spyOn(store, 'set');
    try {
      await owner.init();
      owner.select('https://lecture.example/one');
      const mounting = owner.mount({} as HTMLElement);
      owner.detach();
      finish(f.player);
      await mounting;
      expect(f.destroyed).toBe(1);
      expect(state.mounts).toBe(0);
      f.adapter.mount = async () => f.player;
      await owner.mount({} as HTMLElement);
      owner.play();
      for (let i = 0; i < 20; i++) {
        await vi.advanceTimersByTimeAsync(200);
        owner.tick();
      }
      await owner.flush();
      expect(set.mock.calls.length).toBeLessThanOrEqual(5);
      await owner.dispose();
      expect(f.destroyed).toBe(2);
      expect(state.playing).toBe(false);
    } finally {
      await owner.dispose();
      vi.useRealTimers();
      await deleteDB('personal-cancel');
    }
  });
  it('does not recreate cleared history when a tile unmounts during deletion or the owner disposes', async () => {
    const registry = new PersonalProviderRegistry(),
      f = fixture(),
      preference = personalPreference('clear-race'),
      store = await createPreferenceStore([preference], 'personal-clear-race'),
      state = createPersonalState();
    registry.register(f.adapter);
    const owner = createPersonalPlayer({ registry, state, store, preference, roomGain: () => {} });
    await owner.init();
    owner.select('https://lecture.example/one');
    await owner.mount({} as HTMLElement);
    owner.seek(35);
    await owner.flush();
    const clearing = owner.clear();
    owner.detach();
    await clearing;
    await owner.dispose();
    const db = await openDB('personal-clear-race', 1);
    expect(await db.get('preferences', preference.key)).toBeUndefined();
    db.close();
    await deleteDB('personal-clear-race');
  });
  it('preserves saved resume while a newly cued provider still reports zero, including an early close', async () => {
    const registry = new PersonalProviderRegistry(),
      f = fixture(),
      preference = personalPreference('early-close'),
      store = await createPreferenceStore([preference], 'personal-early-close'),
      state = createPersonalState();
    registry.register(f.adapter);
    const owner = createPersonalPlayer({ registry, state, store, preference, roomGain: () => {} });
    await owner.init();
    owner.select('https://lecture.example/chapter');
    await owner.mount({} as HTMLElement);
    owner.seek(43);
    owner.detach();
    await owner.flush();
    await owner.mount({} as HTMLElement);
    f.player.seek(0);
    owner.tick();
    owner.pause();
    expect(state.position).toBe(43);
    owner.detach();
    await owner.flush();
    expect((await store.get(preference)).history[0]?.position).toBe(43);
    await owner.dispose();
    await deleteDB('personal-early-close');
  });
});
