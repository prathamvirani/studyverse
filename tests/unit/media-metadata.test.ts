import { expect, it } from 'vitest';
import { createYouTubeMetadataResolver } from '@study/adapters/youtube/server';
import { applyMediaAction, initialPlayback } from '@study/room-media/browser';
it('fixed public metadata lookup sanitizes text, ignores provider HTML/URLs, caches and refreshes', async () => {
  let now = 1000,
    calls = 0;
  const resolver = createYouTubeMetadataResolver(
    async (input, options) => {
      calls++;
      const url = new URL(String(input));
      expect(url.origin + url.pathname).toBe('https://www.youtube.com/oembed');
      expect(url.searchParams.get('url')).toBe('https://www.youtube.com/watch?v=M7lc1UVf-VE');
      expect(options?.credentials).toBe('omit');
      expect(options?.redirect).toBe('error');
      return Response.json({
        title: '  Quiet session  ',
        author_name: 'Creator',
        html: '<script>ignored</script>',
        thumbnail_url: 'https://private.example/secret',
      });
    },
    () => now,
  );
  const [a, b] = await Promise.all([
    resolver.resolve('M7lc1UVf-VE'),
    resolver.resolve('M7lc1UVf-VE'),
  ]);
  expect(a).toEqual(b);
  expect(a.title).toBe('Quiet session');
  expect(a.thumbnail).toBe('https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg');
  expect(calls).toBe(1);
  a.title = 'Changed locally';
  expect((await resolver.resolve('M7lc1UVf-VE')).title).toBe('Quiet session');
  now += 900001;
  await resolver.resolve('M7lc1UVf-VE');
  expect(calls).toBe(2);
  await expect(resolver.resolve('https://private.example/secret')).rejects.toThrow();
  expect(calls).toBe(2);
});
it('unavailable, malformed and oversized descriptive responses fall back without poisoning playback', async () => {
  for (const [response, expected] of [
    [new Response('', { status: 404 }), 'unavailable'],
    [new Response('broken'), 'failed'],
    [new Response('x'.repeat(32769)), 'failed'],
  ] as const) {
    const resolver = createYouTubeMetadataResolver(async () => response);
    expect((await resolver.resolve('abcdefghijk')).status).toBe(expected);
  }
});
it('reordering keeps the same current occurrence, play state and time anchor even with duplicate IDs', () => {
  let state = initialPlayback(1000);
  for (const videoId of ['M7lc1UVf-VE', 'abcdefghijk', 'M7lc1UVf-VE'])
    state = applyMediaAction(state, { type: 'enqueue', videoId }, 1000);
  state = applyMediaAction(state, { type: 'select', index: 2 }, 1000);
  state = applyMediaAction(state, { type: 'play' }, 1000);
  const moved = applyMediaAction(state, { type: 'move', from: 2, to: 0 }, 6000);
  expect(moved.current).toBe(0);
  expect(moved.position).toBe(5);
  expect(moved.playing).toBe(true);
  expect(moved.queue).toEqual(['M7lc1UVf-VE', 'M7lc1UVf-VE', 'abcdefghijk']);
  expect(() => applyMediaAction(moved, { type: 'move', from: 49, to: 0 }, 6000)).toThrow(
    'INVALID_REQUEST',
  );
});
