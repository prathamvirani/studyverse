import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  initialPlayback,
  applyMediaAction,
  mediaPosition,
  correctMediaDrift,
  mayControl,
  youtubeContentId,
  defaultMediaSettings,
  defaultLocalRoomMix,
  effectiveMix,
  localMixPreference,
  noiseSamples,
  ambienceLibrary,
} from '@study/room-media/browser';
import { mediaCommandSchema, localRoomMixSchema } from '@study/contracts';
import { createPreferenceStore } from '@study/adapters/indexeddb';
import type { SharedVideoPlayer } from '@study/feature-sdk';
it('timestamps preserve play, pause, seek, speed and deterministic late join positions', () => {
  let s = applyMediaAction(
    initialPlayback(1000),
    { type: 'enqueue', videoId: 'M7lc1UVf-VE' },
    1000,
  );
  s = applyMediaAction(s, { type: 'play' }, 2000);
  expect(mediaPosition(s, 12000)).toBe(10);
  s = applyMediaAction(s, { type: 'rate', rate: 2 }, 12000);
  expect(mediaPosition(s, 17000)).toBe(20);
  s = applyMediaAction(s, { type: 'pause' }, 17000);
  expect(mediaPosition(s, 99999)).toBe(20);
  s = applyMediaAction(s, { type: 'seek', position: 90 }, 18000);
  expect(mediaPosition(s, 1)).toBe(90);
  expect(mediaPosition(s, 99999)).toBe(90);
});
it('queue selection/removal and bounds preserve current identity without autoplaying replacements', () => {
  let s = initialPlayback(0);
  expect(() => applyMediaAction(s, { type: 'play' }, 1)).toThrow('INVALID_REQUEST');
  for (const videoId of ['M7lc1UVf-VE', 'abcdefghijk', '12345678901'])
    s = applyMediaAction(s, { type: 'enqueue', videoId }, 1);
  s = applyMediaAction(s, { type: 'select', index: 1 }, 2);
  s = applyMediaAction(s, { type: 'play' }, 3);
  s = applyMediaAction(s, { type: 'remove', index: 0 }, 4);
  expect(s.current).toBe(0);
  expect(s.playing).toBe(true);
  s = applyMediaAction(s, { type: 'remove', index: 0 }, 5);
  expect(s.queue[s.current!]).toBe('12345678901');
  expect(s.playing).toBe(false);
  expect(() => applyMediaAction(s, { type: 'select', index: 49 }, 6)).toThrow('INVALID_REQUEST');
  s = applyMediaAction(s, { type: 'remove', index: 0 }, 6);
  expect(s.current).toBeNull();
});
it('drift correction has a tolerance and enforces authoritative pause/play without server ticks', () => {
  let position = 9,
    playing = false,
    seeks = 0;
  const p: SharedVideoPlayer = {
    cue: () => {},
    play: () => {
      playing = true;
    },
    pause: () => {
      playing = false;
    },
    seek: (v) => {
      position = v;
      seeks++;
    },
    rate: () => {},
    volume: () => {},
    position: () => position,
    playing: () => playing,
    destroy: () => {},
  };
  const s = { ...initialPlayback(1000), playing: true };
  correctMediaDrift(p, s, 11000);
  expect(seeks).toBe(0);
  expect(playing).toBe(true);
  position = 4;
  correctMediaDrift(p, s, 11000);
  expect(position).toBe(10);
  expect(seeks).toBe(1);
  correctMediaDrift(p, { ...s, playing: false, position: 25 }, 11000, true);
  expect(position).toBe(25);
  expect(playing).toBe(false);
});
it('all control modes preserve owner authority and separately apply owner-absent policy', () => {
  for (const controls of ['everyone', 'suggestions', 'moderators', 'owner'] as const)
    for (const ownerAbsent of ['ffa', 'moderators', 'preserve'] as const)
      for (const present of [false, true]) {
        const settings = { controls, ownerAbsent };
        expect(mayControl(settings, 'owner', present)).toBe(true);
        expect(mayControl(settings, null, present)).toBe(false);
        expect(mayControl(settings, 'member', present)).toBe(
          !present && ownerAbsent !== 'preserve' ? ownerAbsent === 'ffa' : controls === 'everyone',
        );
        expect(mayControl(settings, 'moderator', present)).toBe(
          (!present && ownerAbsent !== 'preserve') ||
            controls === 'everyone' ||
            controls === 'moderators',
        );
      }
  expect(mayControl(defaultMediaSettings, 'member', false)).toBe(false);
});
it('YouTube URL adapter canonicalizes supported public video IDs and rejects hostile identifiers', () => {
  for (const link of [
    'M7lc1UVf-VE',
    'https://youtu.be/M7lc1UVf-VE',
    'https://music.youtube.com/watch?v=M7lc1UVf-VE&list=private',
    'https://www.youtube.com/shorts/M7lc1UVf-VE',
  ])
    expect(youtubeContentId(link)).toBe('M7lc1UVf-VE');
  for (const link of [
    'javascript:alert(1)',
    'https://youtube.com.evil.test/watch?v=M7lc1UVf-VE',
    'https://user:secret@youtube.com/watch?v=M7lc1UVf-VE',
    'https://www.youtube.com/playlist?list=x',
    'https://youtu.be/%3Cscript%3E',
    'http://youtu.be/M7lc1UVf-VE',
  ])
    expect(youtubeContentId(link)).toBeNull();
  const base = {
    roomId: crypto.randomUUID(),
    epoch: crypto.randomUUID(),
    version: 0,
    action: { type: 'enqueue', videoId: 'M7lc1UVf-VE' },
  };
  expect(mediaCommandSchema.safeParse(base).success).toBe(true);
  for (const extra of [
    { role: 'owner' },
    { owner: true },
    { controller: crypto.randomUUID() },
    { userId: crypto.randomUUID() },
  ])
    expect(mediaCommandSchema.safeParse({ ...base, ...extra }).success).toBe(false);
  for (const videoId of ['<script/>', '../12345678', 'https://evil.test', 'x'.repeat(12)])
    expect(
      mediaCommandSchema.safeParse({ ...base, action: { type: 'enqueue', videoId } }).success,
    ).toBe(false);
});
it('local volume and personal ambience never mutate the room mix; muted layers are zero', () => {
  const shared = initialPlayback(0).mix;
  shared.ambience.rain = 0.5;
  const local = structuredClone(defaultLocalRoomMix);
  local.music = 0.5;
  local.layers.rain = 0.4;
  expect(effectiveMix(shared, local)).toMatchObject({ music: 0.3, ambience: { rain: 0.2 } });
  local.ambienceScope = 'personal';
  local.personal.brown = 0.7;
  expect(effectiveMix(shared, local).ambience).toMatchObject({ rain: 0, brown: 0.7 });
  local.muted = true;
  expect(Object.values(effectiveMix(shared, local).ambience)).toEqual([0, 0, 0, 0]);
  expect(effectiveMix(shared, local).music).toBe(0);
  expect(shared.ambience.rain).toBe(0.5);
  expect(localRoomMixSchema.safeParse({ ...local, token: 'secret' }).success).toBe(false);
});
it('device mix persists separately by account and contains no active player objects', async () => {
  const a = localMixPreference(crypto.randomUUID()),
    b = localMixPreference(crypto.randomUUID());
  const store = await createPreferenceStore([a, b]);
  const value = { ...structuredClone(defaultLocalRoomMix), music: 0.23 };
  await store.set(a, value);
  await store.close();
  const next = await createPreferenceStore([a, b]);
  expect(await next.get(a)).toEqual(value);
  expect((await next.get(b)).music).toBe(1);
  await next.close();
});
it('each shipped ambience texture has provenance and finite bounded deterministic samples', async () => {
  const provenance = JSON.parse(
    await readFile('packages/features/room-media/provenance.json', 'utf8'),
  );
  for (const source of ambienceLibrary) {
    expect(provenance.sources.find((s: { id: string }) => s.id === source.id).license).toContain(
      'Project-owned',
    );
    const samples = noiseSamples(source.id, 8192);
    expect(samples).toEqual(noiseSamples(source.id, 8192));
    expect(samples.some((v) => v !== 0)).toBe(true);
    expect(samples.every((v) => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true);
    expect(samples[0]).toBe(0);
    expect(Math.abs(samples[samples.length - 1]!)).toBe(0);
  }
});

it('buffering does not cause repeated corrective seeks that restart provider loading', () => {
  let seeks = 0;
  const player: SharedVideoPlayer = {
    cue: () => {},
    play: () => {},
    pause: () => {},
    seek: () => {
      seeks++;
    },
    rate: () => {},
    volume: () => {},
    position: () => 0,
    playing: () => false,
    buffering: () => true,
    destroy: () => {},
  };
  correctMediaDrift(player, { ...initialPlayback(0), playing: true }, 10000);
  expect(seeks).toBe(0);
  correctMediaDrift(player, { ...initialPlayback(0), playing: false }, 10000, true);
  expect(seeks).toBe(1);
});
