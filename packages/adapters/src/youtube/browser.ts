import type { SharedVideoProvider, SharedVideoPlayer } from '@study/feature-sdk';
import { youtubeIdSchema } from '@study/contracts';
interface YouTubePlayer {
  cueVideoById(id: string, start: number): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(position: number, allowSeekAhead: boolean): void;
  setPlaybackRate(rate: number): void;
  getAvailablePlaybackRates(): number[] | undefined;
  getPlaybackRate?(): number;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration?(): number;
  getPlayerState(): number;
  destroy(): void;
}
interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      events: {
        onReady(): void;
        onError(e: { data: number }): void;
        onStateChange(e: { data: number }): void;
        onAutoplayBlocked(): void;
      };
    },
  ) => YouTubePlayer;
}
const apiWindow = () =>
  window as Window & { YT?: YouTubeApi; onYouTubeIframeAPIReady?: (() => void) | undefined };
let loading: Promise<YouTubeApi> | undefined;
function loadApi(): Promise<YouTubeApi> {
  if (apiWindow().YT?.Player) return Promise.resolve(apiWindow().YT!);
  if (loading) return loading;
  loading = new Promise<YouTubeApi>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(
      () => finish(new Error('YouTube did not load. Check your connection or content blocker.')),
      15000,
    );
    const previous = apiWindow().onYouTubeIframeAPIReady;
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      apiWindow().onYouTubeIframeAPIReady = previous;
      if (error) {
        script.remove();
        reject(error);
      } else if (apiWindow().YT) resolve(apiWindow().YT!);
    };
    apiWindow().onYouTubeIframeAPIReady = () => {
      previous?.();
      finish();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? '';
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.onerror = () =>
      finish(new Error('YouTube is unavailable. Ambience and the room remain usable.'));
    document.head.append(script);
  }).catch((e) => {
    loading = undefined;
    throw e;
  });
  return loading;
}
export const youtubeProvider: SharedVideoProvider = {
  async mount(host, events, videoId, options) {
    const api = await loadApi();
    if (!host.isConnected || options?.signal?.aborted) throw new Error('Player closed.');
    const iframe = document.createElement('iframe');
    if (crossOriginIsolated && !('credentialless' in iframe))
      throw new Error(
        'This browser cannot isolate the YouTube embed. Use a browser with credentialless iframe support.',
      );
    iframe.setAttribute('credentialless', '');
    iframe.title = options?.title ?? 'Room YouTube player';
    iframe.src =
      'https://www.youtube.com/embed/' +
      youtubeIdSchema.parse(videoId) +
      '?enablejsapi=1&playsinline=1&origin=' +
      encodeURIComponent(location.origin);
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-presentation allow-popups',
    );
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.minHeight = '200px';
    host.append(iframe);
    let player: YouTubePlayer | undefined;
    let expectedPlayback: boolean | undefined;
    let cancelReady: (() => void) | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        const aborted = () => {
          clearTimeout(timeout);
          reject(new Error('Player closed.'));
        };
        const timeout = setTimeout(
          () =>
            reject(
              new Error('YouTube player did not become ready. Retry or choose another video.'),
            ),
          15000,
        );
        options?.signal?.addEventListener('abort', aborted, { once: true });
        cancelReady = () => {
          clearTimeout(timeout);
          options?.signal?.removeEventListener('abort', aborted);
        };
        player = new api.Player(iframe, {
          events: {
            onReady: () => {
              cancelReady?.();
              resolve();
            },
            onStateChange: (e) => {
              if (e.data === 0) events.ended();
              if ([1, 2].includes(e.data)) {
                const playing = e.data === 1;
                if (playing === expectedPlayback) expectedPlayback = undefined;
                else events.playback?.(playing, player?.getCurrentTime() ?? 0);
              }
            },
            onAutoplayBlocked: events.blocked,
            onError: (e) => {
              const message =
                e.data === 100
                  ? 'This video was removed or is private.'
                  : [101, 150].includes(e.data)
                    ? 'The publisher does not allow this video to be embedded.'
                    : e.data === 153
                      ? 'YouTube could not identify this embed. Check browser referrer settings.'
                      : 'YouTube cannot play this video here. Try another item.';
              events.error(message);
            },
          },
        });
      });
      const p = player!;
      const adapter: SharedVideoPlayer = {
        cue: (id, start) => p.cueVideoById(youtubeIdSchema.parse(id), start),
        play: () => {
          expectedPlayback = true;
          p.playVideo();
        },
        pause: () => {
          expectedPlayback = false;
          p.pauseVideo();
        },
        seek: (position) => p.seekTo(position, true),
        rate: (value) => {
          if ((p.getAvailablePlaybackRates() ?? []).includes(value)) p.setPlaybackRate(value);
          else if (value !== 1) events.error('This video does not support the room playback rate.');
        },
        volume: (value) => p.setVolume(Math.max(0, Math.min(100, value * 100))),
        position: () => p.getCurrentTime() || 0,
        duration: () => p.getDuration?.() || 0,
        rates: () => p.getAvailablePlaybackRates() ?? [1],
        playbackRate: () => p.getPlaybackRate?.() ?? 1,
        playing: () => p.getPlayerState() === 1,
        buffering: () => p.getPlayerState() === 3,
        destroy: () => {
          p.destroy();
          iframe.remove();
        },
      };
      return adapter;
    } catch (e) {
      cancelReady?.();
      player?.destroy();
      iframe.remove();
      throw e;
    }
  },
};
