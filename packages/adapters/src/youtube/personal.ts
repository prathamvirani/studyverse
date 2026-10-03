import { youtubeContentId } from '@study/contracts';
import type { PersonalMediaAdapter } from '@study/feature-sdk';
import { youtubeProvider } from './browser.ts';

export const personalYoutubeAdapter: PersonalMediaAdapter = {
  id: 'youtube',
  label: 'YouTube',
  capabilities: {
    embed: true,
    personal: true,
    roomSync: true,
    seek: true,
    play: true,
    pause: true,
  },
  match(input) {
    const id = youtubeContentId(input);
    return id
      ? {
          provider: 'youtube',
          contentId: id,
          canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
        }
      : null;
  },
  async resolveMetadata(source) {
    // Explicitly selected public identity goes directly to its provider, never the room/API.
    try {
      const response = await fetch(
        'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(source.canonicalUrl),
        {
          credentials: 'omit',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
          signal: AbortSignal.timeout(2500),
        },
      );
      if (!response.ok || Number(response.headers.get('content-length')) > 32768)
        throw new Error('Unavailable');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Unavailable');
      let text = '',
        bytes = 0;
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > 32768) throw new Error('Unavailable');
          text += decoder.decode(value, { stream: true });
        }
      } finally {
        await reader.cancel();
      }
      const data = JSON.parse(text);
      return {
        title: typeof data.title === 'string' ? data.title.slice(0, 200) : 'YouTube study video',
      };
    } catch {
      return { title: 'YouTube study video' };
    }
  },
  mount: (host, events, source) =>
    youtubeProvider.mount(host, events, source.contentId, {
      signal: events.signal,
      title: 'Personal YouTube player',
    }),
  roomItem: (source) => ({ videoId: source.contentId }),
};
