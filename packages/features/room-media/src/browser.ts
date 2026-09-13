import { localRoomMixSchema } from '@study/contracts';
import type { MediaAction, MediaPlayback, MediaSettings, LocalRoomMix } from '@study/contracts';
import type { PreferenceDefinition, SharedVideoPlayer } from '@study/feature-sdk';
export const silentLayers = () => ({ rain: 0, white: 0, pink: 0, brown: 0 });
export const initialPlayback = (now: number): MediaPlayback => ({
  provider: 'youtube',
  queue: [],
  current: null,
  playing: false,
  position: 0,
  rate: 1,
  updatedAt: now,
  mix: { music: 0.6, ambience: silentLayers() },
});
export const defaultMediaSettings: MediaSettings = { controls: 'owner', ownerAbsent: 'preserve' };
export function mediaPosition(state: MediaPlayback, serverNow: number) {
  return Math.min(
    604800,
    state.position +
      (state.playing ? (Math.max(0, serverNow - state.updatedAt) * state.rate) / 1000 : 0),
  );
}
export function mayControl(
  settings: MediaSettings,
  role: 'owner' | 'moderator' | 'member' | null,
  ownerPresent: boolean,
) {
  if (!role) return false;
  if (role === 'owner') return true;
  if (!ownerPresent && settings.ownerAbsent !== 'preserve')
    return settings.ownerAbsent === 'ffa' || role === 'moderator';
  return (
    settings.controls === 'everyone' || (settings.controls === 'moderators' && role === 'moderator')
  );
}
export function applyMediaAction(
  previous: MediaPlayback,
  action: MediaAction,
  now: number,
): MediaPlayback {
  const s = structuredClone(previous);
  s.position = mediaPosition(previous, now);
  s.updatedAt = now;
  const invalid = () => {
    throw new Error('INVALID_REQUEST');
  };
  switch (action.type) {
    case 'enqueue':
      if (s.queue.length >= 50) invalid();
      s.queue.push(action.videoId);
      if (s.current === null) {
        s.current = 0;
        s.position = 0;
      }
      break;
    case 'remove':
      if (action.index >= s.queue.length) invalid();
      s.queue.splice(action.index, 1);
      if (s.current === action.index) {
        s.current = s.queue.length ? Math.min(action.index, s.queue.length - 1) : null;
        s.position = 0;
        s.playing = false;
      } else if (s.current !== null && action.index < s.current) s.current--;
      break;
    case 'select':
      if (action.index >= s.queue.length) invalid();
      s.current = action.index;
      s.position = 0;
      s.playing = false;
      break;
    case 'play':
      if (s.current === null) invalid();
      s.playing = true;
      break;
    case 'pause':
      s.playing = false;
      break;
    case 'seek':
      if (s.current === null) invalid();
      s.position = action.position;
      break;
    case 'rate':
      s.rate = action.rate;
      break;
    case 'mix':
      s.mix = structuredClone(action.mix);
      break;
  }
  return s;
}
/** Accept only public YouTube identifiers, never persist pasted URLs or query credentials. */
export function youtubeContentId(input: string): string | null {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    let id: string | null = null;
    if (u.hostname === 'youtu.be' && /^\/[^/]+$/.test(u.pathname)) id = u.pathname.slice(1);
    if (['youtube.com', 'www.youtube.com', 'music.youtube.com'].includes(u.hostname)) {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else if (/^\/(embed|shorts)\/[^/]+$/.test(u.pathname)) id = u.pathname.split('/')[2] ?? null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function correctMediaDrift(
  player: SharedVideoPlayer,
  state: MediaPlayback,
  serverNow: number,
  force = false,
) {
  if (!force && state.playing && player.buffering?.()) return;
  const target = mediaPosition(state, serverNow);
  if (force || Math.abs(player.position() - target) > 1.5) player.seek(target);
  player.rate(state.rate);
  if (state.playing !== player.playing()) {
    if (state.playing) player.play();
    else player.pause();
  }
}
export const defaultLocalRoomMix: LocalRoomMix = {
  music: 1,
  ambience: 1,
  muted: false,
  layers: { rain: 1, white: 1, pink: 1, brown: 1 },
  ambienceScope: 'room',
  personal: silentLayers(),
};
export function localMixPreference(userId: string): PreferenceDefinition<LocalRoomMix> {
  return {
    key: `room-media.mix.${userId}`,
    version: 1,
    schema: localRoomMixSchema,
    defaultValue: structuredClone(defaultLocalRoomMix),
  };
}
export function effectiveMix(shared: MediaPlayback['mix'], local: LocalRoomMix) {
  const layers = local.ambienceScope === 'room' ? shared.ambience : local.personal;
  return {
    music: local.muted ? 0 : shared.music * local.music,
    ambience: Object.fromEntries(
      Object.entries(layers).map(([id, level]) => [
        id,
        local.muted ? 0 : level * local.ambience * local.layers[id as keyof typeof layers],
      ]),
    ) as typeof layers,
  };
}
export const ambienceLibrary = [
  { id: 'rain', name: 'Soft rain', description: 'Filtered procedural rainfall texture' },
  { id: 'white', name: 'White noise', description: 'Even broadband noise' },
  { id: 'pink', name: 'Pink noise', description: 'Gentle filtered noise' },
  { id: 'brown', name: 'Brown noise', description: 'Low, warm noise' },
] as const;

export { createAmbienceEngine, noiseSamples } from './ambience.ts';
