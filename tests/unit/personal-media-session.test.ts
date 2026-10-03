import { afterEach, expect, it, vi } from 'vitest';
import { personalMediaSession } from '../../apps/web/app/lib/personal-media-session.ts';

afterEach(() => vi.unstubAllGlobals());
it('routes optional platform controls to one owner and releases every action on detach', () => {
  const handlers = new Map<MediaSessionAction, MediaSessionActionHandler | null>();
  const session = {
    metadata: null,
    playbackState: 'none',
    setActionHandler: (action: MediaSessionAction, handler: MediaSessionActionHandler | null) =>
      handlers.set(action, handler),
    setPositionState: vi.fn(),
  };
  vi.stubGlobal('navigator', { mediaSession: session });
  vi.stubGlobal(
    'MediaMetadata',
    class {
      constructor(public values: MediaMetadataInit) {}
    },
  );
  const actions = { play: vi.fn(), pause: vi.fn(), seek: vi.fn() },
    platform = personalMediaSession(actions);
  const state = {
    attached: true,
    playing: false,
    position: 35,
    duration: 100,
    title: 'Lecture',
    rate: 1.5,
  };
  platform.update(state);
  handlers.get('play')?.({ action: 'play' });
  handlers.get('pause')?.({ action: 'pause' });
  handlers.get('seekto')?.({ action: 'seekto', seekTime: 42 });
  handlers.get('seekbackward')?.({ action: 'seekbackward' });
  expect(actions.play).toHaveBeenCalledOnce();
  expect(actions.pause).toHaveBeenCalledOnce();
  expect(actions.seek.mock.calls).toEqual([[42], [25]]);
  expect(session.setPositionState).toHaveBeenCalledWith({
    duration: 100,
    position: 35,
    playbackRate: 1.5,
  });
  platform.update({ ...state, position: 35.2 });
  expect(session.setPositionState).toHaveBeenCalledOnce();
  platform.update({ ...state, attached: false });
  expect([...handlers.values()]).toEqual([null, null, null, null, null]);
  expect(session.metadata).toBeNull();
  expect(session.playbackState).toBe('none');
});
it('does not require MediaSession support', () => {
  vi.stubGlobal('navigator', {});
  const platform = personalMediaSession({ play() {}, pause() {}, seek() {} });
  expect(() =>
    platform.update({
      attached: true,
      playing: true,
      position: 1,
      duration: NaN,
      title: 'Lecture',
      rate: 1,
    }),
  ).not.toThrow();
  platform.clear();
});
