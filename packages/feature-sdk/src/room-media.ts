/** Server-only occupancy; never project this through privacy-filtered participant lists. */
export interface RoomOccupancy {
  members(roomId: string): Promise<readonly string[]>;
}

/** Provider control port: media bytes travel directly between browser and provider. */
export interface MediaMetadataResolver {
  resolve(videoId: string): Promise<import('@study/contracts').MediaMetadata>;
}
export interface SharedVideoPlayer {
  cue(videoId: string, position: number): void;
  play(): void;
  pause(): void;
  seek(position: number): void;
  rate(value: number): void;
  volume(value: number): void;
  position(): number;
  playing(): boolean;
  buffering?(): boolean;
  duration?(): number;
  rates?(): readonly number[];
  playbackRate?(): number;
  metadata?(): { title: string };
  destroy(): void;
}
export interface SharedVideoProvider {
  mount(
    host: HTMLElement,
    events: {
      error(message: string): void;
      ended(): void;
      blocked(): void;
      playback?(playing: boolean, position: number): void;
    },
    videoId: string,
    options?: { signal?: AbortSignal; title?: string },
  ): Promise<SharedVideoPlayer>;
}
