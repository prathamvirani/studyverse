/** Provider-neutral visual contract. Audio remains independently controlled. */
export interface EnvironmentAsset {
  id: string;
  title: string;
  category: string;
  kind: 'static' | 'loop';
  source: string;
  thumbnail: string;
  poster: string;
  effect?: 'rain' | 'stars';
}
export interface EnvironmentProvider {
  id: string;
  assets(): readonly EnvironmentAsset[];
}
export interface LocalVisualAsset {
  id: string;
  title: string;
  frames: Blob[];
  durations: number[];
  thumbnail: Blob;
  width: number;
  height: number;
  bytes: number;
}
/** Device-local binary asset ownership; no public URLs or server upload implied. */
export interface LocalVisualStore {
  list(): Promise<Omit<LocalVisualAsset, 'frames'>[]>;
  get(id: string): Promise<LocalVisualAsset | undefined>;
  put(asset: LocalVisualAsset): Promise<void>;
  delete(id: string): Promise<void>;
  close(): void;
}
