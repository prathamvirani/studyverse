import { youtubeIdSchema, mediaMetadataSchema } from '@study/contracts';
import type { MediaMetadata } from '@study/contracts';
import type { MediaMetadataResolver } from '@study/feature-sdk';

/** Public descriptive metadata only; fixed endpoint, no user URL/credentials/media bytes. */
export function createYouTubeMetadataResolver(
  request: typeof fetch = fetch,
  now = Date.now,
): MediaMetadataResolver {
  const cache = new Map<string, { expires: number; value: MediaMetadata }>();
  const pending = new Map<string, Promise<MediaMetadata>>();
  async function load(videoId: string): Promise<MediaMetadata> {
    const fallback = (status: 'failed' | 'unavailable'): MediaMetadata => ({
      videoId,
      provider: 'youtube',
      status,
      title: status === 'unavailable' ? 'Unavailable' : 'Couldn’t load',
    });
    try {
      const url = new URL('https://www.youtube.com/oembed');
      url.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`);
      url.searchParams.set('format', 'json');
      const response = await request(url, {
        signal: AbortSignal.timeout(2500),
        redirect: 'error',
        headers: { accept: 'application/json' },
        credentials: 'omit',
      });
      if (!response.ok)
        return fallback([401, 403, 404].includes(response.status) ? 'unavailable' : 'failed');
      if (!response.body) return fallback('failed');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 32768) {
            await reader.cancel();
            return fallback('failed');
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
      const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!data || typeof data !== 'object') return fallback('failed');
      const value = data as Record<string, unknown>;
      const title = typeof value.title === 'string' ? value.title.trim().slice(0, 300) : '';
      const channel =
        typeof value.author_name === 'string' ? value.author_name.trim().slice(0, 200) : undefined;
      return mediaMetadataSchema.parse({
        videoId,
        provider: 'youtube',
        status: 'ready',
        title: title || 'Untitled',
        ...(channel ? { channel } : {}),
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      });
    } catch {
      return fallback('failed');
    }
  }
  return {
    async resolve(input) {
      const videoId = youtubeIdSchema.parse(input);
      const saved = cache.get(videoId);
      if (saved && saved.expires > now()) return structuredClone(saved.value);
      if (pending.has(videoId)) return structuredClone(await pending.get(videoId)!);
      // Bound concurrent provider requests and resident entries in this single API authority.
      if (pending.size >= 4)
        return { videoId, provider: 'youtube', status: 'failed', title: 'Couldn’t load' };
      const task = load(videoId);
      pending.set(videoId, task);
      try {
        const value = await task;
        if (cache.size >= 500) cache.delete(cache.keys().next().value!);
        cache.set(videoId, { value, expires: now() + (value.status === 'ready' ? 900000 : 60000) });
        return structuredClone(value);
      } finally {
        pending.delete(videoId);
      }
    },
  };
}
