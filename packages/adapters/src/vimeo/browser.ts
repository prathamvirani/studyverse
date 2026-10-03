import type { PersonalMediaAdapter, PersonalMediaSource } from '@study/feature-sdk';

interface VimeoPlayer {
  ready(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  setCurrentTime(value: number): Promise<number>;
  setVolume(value: number): Promise<number>;
  getDuration(): Promise<number>;
  getVideoTitle(): Promise<string>;
  on(name: string, callback: (data: { seconds?: number; duration?: number }) => void): void;
  off(name: string): void;
  destroy(): Promise<void>;
}
interface VimeoSdk {
  Player: new (iframe: HTMLIFrameElement) => VimeoPlayer;
}
const sdkWindow = () => window as Window & { Vimeo?: VimeoSdk };
let loading: Promise<VimeoSdk> | undefined;
function sdk() {
  if (sdkWindow().Vimeo) return Promise.resolve(sdkWindow().Vimeo!);
  return (loading ??= new Promise<VimeoSdk>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => finish(false), 15000);
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (ok && sdkWindow().Vimeo) resolve(sdkWindow().Vimeo!);
      else {
        script.remove();
        reject(new Error('Vimeo is unavailable.'));
      }
    };
    script.nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? '';
    script.src = 'https://player.vimeo.com/api/player.js';
    // Vimeo serves CORS headers; an anonymous CORS request satisfies strict COEP.
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.head.append(script);
  }).catch((error) => {
    loading = undefined;
    throw error;
  }));
}
export function vimeoSource(input: string): PersonalMediaSource | null {
  try {
    const u = new URL(input);
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      u.port ||
      [...u.searchParams.keys()].some((k) => !/^(utm_\w+|t|start)$/i.test(k))
    )
      return null;
    const id = ['vimeo.com', 'www.vimeo.com'].includes(u.hostname)
      ? /^\/([1-9]\d{0,11})\/?$/.exec(u.pathname)?.[1]
      : u.hostname === 'player.vimeo.com'
        ? /^\/video\/([1-9]\d{0,11})\/?$/.exec(u.pathname)?.[1]
        : null;
    return id
      ? { provider: 'vimeo', contentId: id, canonicalUrl: `https://vimeo.com/${id}` }
      : null;
  } catch {
    return null;
  }
}
export const personalVimeoAdapter: PersonalMediaAdapter = {
  id: 'vimeo',
  label: 'Vimeo',
  capabilities: {
    embed: true,
    personal: true,
    roomSync: false,
    seek: true,
    play: true,
    pause: true,
  },
  match: vimeoSource,
  async resolveMetadata(_source, player) {
    return player?.metadata?.() ?? { title: 'Vimeo study video' };
  },
  async mount(host, events, source) {
    const api = await sdk();
    if (events.signal.aborted || !host.isConnected || !vimeoSource(source.canonicalUrl))
      throw new Error('Player closed.');
    const iframe = document.createElement('iframe');
    if (crossOriginIsolated && !('credentialless' in iframe))
      throw new Error('This browser cannot isolate the Vimeo embed.');
    iframe.setAttribute('credentialless', '');
    iframe.title = 'Personal Vimeo player';
    iframe.src = `https://player.vimeo.com/video/${source.contentId}?dnt=1&playsinline=1`;
    iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-presentation allow-popups',
    );
    iframe.style.cssText = 'width:100%;height:100%;min-height:200px';
    host.append(iframe);
    const player = new api.Player(iframe);
    let position = 0,
      duration = 0,
      playing = false,
      title = 'Vimeo study video',
      destroyed = false;
    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      events.signal.removeEventListener('abort', destroy);
      for (const name of ['play', 'pause', 'timeupdate', 'ended', 'error']) player.off(name);
      void player.destroy().catch(() => {});
      iframe.remove();
    };
    events.signal.addEventListener('abort', destroy, { once: true });
    let cleanupReady = () => {};
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Vimeo did not become ready.')), 15000);
        const abort = () => reject(new Error('Player closed.'));
        cleanupReady = () => {
          clearTimeout(timer);
          events.signal.removeEventListener('abort', abort);
        };
        events.signal.addEventListener('abort', abort, { once: true });
        void player.ready().then(resolve, reject);
      }).finally(() => cleanupReady());
      if (events.signal.aborted) throw new Error('Player closed.');
      // These descriptive calls are optional. Provider readiness must not await unbounded metadata.
      void player
        .getDuration()
        .then((value) => {
          if (!destroyed) duration = value;
        })
        .catch(() => {});
      void player
        .getVideoTitle()
        .then((value) => {
          if (!destroyed) title = value.slice(0, 200);
        })
        .catch(() => {});
      player.on('timeupdate', (data) => {
        position = data.seconds ?? position;
        duration = data.duration ?? duration;
      });
      player.on('play', () => {
        playing = true;
        events.playback(true, position);
      });
      player.on('pause', () => {
        playing = false;
        events.playback(false, position);
      });
      player.on('ended', () => {
        playing = false;
        position = 0;
        events.ended();
      });
      player.on('error', () => {
        playing = false;
        events.error(
          'Vimeo cannot play this video here. It may be private or embedding may be disabled.',
        );
      });
      return {
        cue(_id, start) {
          position = start;
          void player
            .setCurrentTime(start)
            .catch(() =>
              events.error(
                'This Vimeo video cannot resume here. Start over or choose another video.',
              ),
            );
        },
        play() {
          void player.play().catch(() => events.blocked());
        },
        pause() {
          void player.pause().catch(() => {});
          playing = false;
        },
        seek(value) {
          position = value;
          void player
            .setCurrentTime(value)
            .catch(() => events.error('Seeking is unavailable for this Vimeo video.'));
        },
        rate() {
          /* Speed depends on the publisher's paid Vimeo plan; do not advertise it universally. */
        },
        rates: () => [1],
        playbackRate: () => 1,
        volume(value) {
          void player.setVolume(value).catch(() => {});
        },
        position: () => position,
        duration: () => duration,
        playing: () => playing,
        metadata: () => ({ title }),
        destroy,
      };
    } catch (error) {
      destroy();
      throw error;
    }
  },
};
