/** Progressive controls for the owning visible personal player. Installs no renderer or audio graph. */
export function personalMediaSession(actions: {
  play(): void;
  pause(): void;
  seek(position: number): void;
}) {
  const session = navigator.mediaSession;
  let installed = false,
    lastTitle = '',
    lastPosition = -1;
  const supported: MediaSessionAction[] = [
    'play',
    'pause',
    'seekto',
    'seekbackward',
    'seekforward',
  ];
  const safe = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
    try {
      session?.setActionHandler(action, handler);
    } catch {
      /* Browser-specific actions are optional. */
    }
  };
  function clear() {
    if (!installed) return;
    for (const action of supported) safe(action, null);
    session.metadata = null;
    session.playbackState = 'none';
    installed = false;
    lastTitle = '';
    lastPosition = -1;
  }
  return {
    clear,
    update(state: {
      attached: boolean;
      playing: boolean;
      position: number;
      duration: number;
      title: string;
      rate: number;
    }) {
      if (!session) return;
      if (!state.attached) {
        clear();
        return;
      }
      if (!installed) {
        safe('play', () => actions.play());
        safe('pause', () => actions.pause());
        safe('seekto', (details) => {
          if (details.seekTime !== undefined) actions.seek(details.seekTime);
        });
        safe('seekbackward', (details) =>
          actions.seek(Math.max(0, lastPosition - (details.seekOffset ?? 10))),
        );
        safe('seekforward', (details) => actions.seek(lastPosition + (details.seekOffset ?? 10)));
        installed = true;
      }
      if (state.title !== lastTitle && typeof MediaMetadata !== 'undefined') {
        session.metadata = new MediaMetadata({ title: state.title });
        lastTitle = state.title;
      }
      session.playbackState = state.playing ? 'playing' : 'paused';
      if (
        Number.isFinite(state.duration) &&
        state.duration > 0 &&
        Math.abs(state.position - lastPosition) >= 1
      ) {
        try {
          session.setPositionState({
            duration: state.duration,
            position: Math.max(0, Math.min(state.duration, state.position)),
            playbackRate: state.rate,
          });
        } catch {
          /* Optional. */
        }
        lastPosition = state.position;
      }
    },
  };
}
