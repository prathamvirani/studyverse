import type { SharedVideoPlayer } from './room-media.ts';

/** Device-private source. This contract has no REST/realtime binding. */
export interface PersonalMediaSource {
  provider: string;
  contentId: string;
  canonicalUrl: string;
}
export interface PersonalMediaCapabilities {
  embed: boolean;
  personal: boolean;
  roomSync: boolean;
  seek: boolean;
  play: boolean;
  pause: boolean;
}
export interface PersonalMediaEvents {
  signal: AbortSignal;
  error(message: string): void;
  ended(): void;
  blocked(): void;
  playback(playing: boolean, position: number): void;
}
export interface PersonalMediaAdapter {
  id: string;
  label: string;
  capabilities: PersonalMediaCapabilities;
  match(input: string): PersonalMediaSource | null;
  resolveMetadata(
    source: PersonalMediaSource,
    player?: SharedVideoPlayer,
  ): Promise<{ title: string }>;
  mount(
    host: HTMLElement,
    events: PersonalMediaEvents,
    source: PersonalMediaSource,
  ): Promise<SharedVideoPlayer>;
  /** Only public identity supported by the existing room command, never local progress/mix. */
  roomItem?(source: PersonalMediaSource): { videoId: string } | null;
}
