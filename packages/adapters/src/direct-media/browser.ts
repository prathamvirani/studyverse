import type { PersonalMediaAdapter, PersonalMediaSource } from '@study/feature-sdk';

/** Deliberately bounded to public same-origin files; no arbitrary URL fetch/proxy or streaming dependency. */
export function directMediaAdapter(origin: string): PersonalMediaAdapter {
  const match = (input: string): PersonalMediaSource | null => {
    try {
      const u = new URL(input);
      if (
        u.protocol !== 'https:' ||
        u.origin !== origin ||
        u.username ||
        u.password ||
        !/\.(mp4|webm)$/i.test(u.pathname) ||
        [...u.searchParams.keys()].some((k) => !/^(utm_\w+|t|start)$/i.test(k))
      )
        return null;
      const url = u.origin + u.pathname;
      return { provider: 'direct', contentId: url, canonicalUrl: url };
    } catch {
      return null;
    }
  };
  return {
    id: 'direct',
    label: 'Video',
    capabilities: {
      embed: true,
      personal: true,
      roomSync: false,
      seek: true,
      play: true,
      pause: true,
    },
    match,
    async resolveMetadata(source) {
      let title = 'Study video';
      try {
        title =
          decodeURIComponent(new URL(source.canonicalUrl).pathname.split('/').at(-1)!)
            .replace(/\.(mp4|webm)$/i, '')
            .replaceAll('-', ' ')
            .slice(0, 200) || title;
      } catch {
        /* Safe fallback. */
      }
      return { title };
    },
    async mount(host, events, source) {
      if (!match(source.canonicalUrl) || events.signal.aborted)
        throw new Error('Unsupported source');
      const video = document.createElement('video');
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.crossOrigin = 'anonymous';
      video.setAttribute('aria-label', 'Personal video player');
      video.style.cssText = 'width:100%;height:100%;min-height:200px;object-fit:contain';
      const onPlay = () => events.playback(true, video.currentTime);
      const onPause = () => events.playback(false, video.currentTime);
      const onEnd = () => events.ended();
      const onError = () =>
        events.error(
          'This file is unavailable or its format is unsupported. Choose another source.',
        );
      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('ended', onEnd);
      video.addEventListener('error', onError);
      host.append(video);
      video.src = source.canonicalUrl;
      let pendingPosition = 0,
        destroyed = false;
      const ready = () => {
        if (Number.isFinite(video.duration) && pendingPosition < video.duration)
          video.currentTime = pendingPosition;
      };
      video.addEventListener('loadedmetadata', ready);
      const destroy = () => {
        if (destroyed) return;
        destroyed = true;
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('ended', onEnd);
        video.removeEventListener('error', onError);
        video.removeEventListener('loadedmetadata', ready);
        events.signal.removeEventListener('abort', destroy);
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.remove();
      };
      events.signal.addEventListener('abort', destroy, { once: true });
      return {
        cue(_id, start) {
          pendingPosition = start;
          if (video.readyState >= 1) ready();
        },
        play() {
          void video.play().catch(() => events.blocked());
        },
        pause: () => video.pause(),
        seek(position) {
          pendingPosition = position;
          if (video.readyState >= 1) ready();
        },
        rate: (value) => {
          video.playbackRate = value;
        },
        volume: (value) => {
          video.volume = Math.min(1, Math.max(0, value));
        },
        rates: () => [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
        playbackRate: () => video.playbackRate,
        position: () => (video.readyState >= 1 ? video.currentTime : pendingPosition),
        duration: () => video.duration,
        playing: () => !video.paused && !video.ended,
        destroy,
      };
    },
  };
}
