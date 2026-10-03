import { expect, it, vi } from 'vitest';
import { correctMediaDrift, initialPlayback } from '@study/room-media/browser';
it('does not repeatedly seek a paused authority during local native playback', () => {
  const seek = vi.fn(),
    pause = vi.fn();
  const player = {
    position: () => 3,
    playing: () => true,
    seek,
    pause,
    rate: vi.fn(),
    play: vi.fn(),
    cue: vi.fn(),
    volume: vi.fn(),
    destroy: vi.fn(),
  };
  const state = { ...initialPlayback(0), queue: ['M7lc1UVf-VE'], current: 0, playing: false };
  correctMediaDrift(player, state, 3000);
  correctMediaDrift(player, state, 6000);
  expect(seek).not.toHaveBeenCalled();
});
