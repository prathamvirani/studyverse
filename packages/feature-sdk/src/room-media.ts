/** Server-only occupancy; never project this through privacy-filtered participant lists. */
export interface RoomOccupancy {
  members(roomId: string): Promise<readonly string[]>;
}

/** Provider control port: media bytes travel directly between browser and provider. */
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
  destroy(): void;
}
export interface SharedVideoProvider {
  mount(
    host: HTMLElement,
    events: { error(message: string): void; ended(): void; blocked(): void },
    videoId: string,
  ): Promise<SharedVideoPlayer>;
}
