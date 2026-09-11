import type { MediaCredential, MediaSource } from '@study/contracts';
import type { MediaSnapshot, RealtimeMediaProvider } from '@study/feature-sdk';
export function cameraLocation(on: boolean, expanded: boolean) {
  return !on ? 'none' : expanded ? 'workspace' : 'circle';
}
export function mediaError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError')
    return 'Permission denied or selection cancelled. Retry only when you are ready.';
  if (name === 'NotFoundError' || name === 'NotReadableError')
    return 'Device unavailable or in use. Check the device and retry.';
  if (name === 'OverconstrainedError') return 'This device cannot use the basic media profile.';
  return 'Media unavailable. Check your connection and room access, then retry.';
}
/** No capture in start/connect. Every acquisition follows a deliberate activation. */
export function createMediaSession(
  provider: RealtimeMediaProvider,
  control: {
    join(): Promise<MediaCredential>;
    renew(c: MediaCredential): Promise<void>;
    leave(c: MediaCredential): Promise<void>;
  },
  changed: () => void,
) {
  const state: {
    snapshot: MediaSnapshot;
    error: string;
    busy: Set<MediaSource>;
    devices: MediaDeviceInfo[];
    voice: 'standard' | 'high';
  } = { snapshot: provider.snapshot(), error: '', busy: new Set(), devices: [], voice: 'standard' };
  let credential: MediaCredential | null = null,
    generation = 0,
    disposed = false;
  let connecting: Promise<void> | null = null,
    renewal: ReturnType<typeof setInterval> | undefined,
    renewing = false;
  const stopListening = provider.listen(() => {
    state.snapshot = provider.snapshot();
    if (state.snapshot.connection === 'disconnected' && credential) {
      const previous = credential;
      credential = null;
      generation++;
      clearInterval(renewal);
      void control.leave(previous).catch(() => {});
    }
    changed();
  });
  async function disconnect() {
    generation++;
    clearInterval(renewal);
    const previous = credential;
    credential = null;
    await provider.disconnect();
    if (previous) await control.leave(previous).catch(() => {});
  }
  async function connect() {
    if (disposed) throw new Error('Disposed');
    if (state.snapshot.connection === 'connected') return;
    if (connecting) return connecting;
    const epoch = generation;
    connecting = (async () => {
      const next = await control.join();
      if (epoch !== generation || disposed) {
        await control.leave(next).catch(() => {});
        return;
      }
      credential = next;
      await provider.connect(next);
      if (epoch !== generation || disposed) {
        await disconnect();
        return;
      }
      clearInterval(renewal);
      renewal = setInterval(() => {
        if (renewing || !credential) return;
        renewing = true;
        const renewedGeneration = generation;
        void control
          .renew(credential)
          .catch(async () => {
            if (renewedGeneration !== generation || disposed) return;
            state.error = 'Room or session access lost. Media stopped.';
            await disconnect();
            changed();
          })
          .finally(() => {
            renewing = false;
          });
      }, 10_000);
    })().finally(() => {
      connecting = null;
    });
    return connecting;
  }
  async function refreshDevices() {
    state.devices = await provider.devices().catch(() => []);
    changed();
  }
  return {
    state,
    provider,
    async connect(silent = false) {
      try {
        await connect();
      } catch (e) {
        if (!silent) state.error = mediaError(e);
        await disconnect();
        changed();
      }
    },
    async toggle(source: MediaSource) {
      if (disposed || state.busy.has(source)) return;
      state.busy.add(source);
      state.error = '';
      changed();
      const epoch = generation;
      try {
        const active = state.snapshot.tracks.find((t) => t.local && t.source === source);
        if (active) await provider.unpublish(source);
        else if (source === 'screen' && state.snapshot.connection !== 'connected') {
          await connect();
          if (!disposed && epoch === generation)
            state.error = 'Media connected. Select Screen Share again to choose a screen.';
        } else {
          // Preserve transient user activation for the browser's display picker.
          if (state.snapshot.connection !== 'connected') await connect();
          if (!disposed && epoch === generation) {
            if (source === 'microphone') await provider.publish(source, undefined, state.voice);
            else await provider.publish(source);
          }
        }
        await refreshDevices();
      } catch (e) {
        state.error = mediaError(e);
      } finally {
        state.busy.delete(source);
        changed();
      }
    },
    async mute(muted: boolean) {
      try {
        await provider.mute('microphone', muted);
      } catch (e) {
        state.error = mediaError(e);
        changed();
      }
    },
    async switchDevice(source: 'microphone' | 'camera', id: string) {
      if (disposed || state.busy.has(source)) return;
      state.busy.add(source);
      changed();
      try {
        await provider.switchDevice(source, id);
        await refreshDevices();
      } catch (e) {
        state.error = mediaError(e);
      } finally {
        state.busy.delete(source);
        changed();
      }
    },
    refreshDevices,
    voice(mode: 'standard' | 'high') {
      if (
        state.snapshot.tracks.some((t) => t.local && t.source === 'microphone') ||
        state.busy.has('microphone')
      )
        return;
      state.voice = mode;
      changed();
    },
    async dispose() {
      disposed = true;
      stopListening();
      await disconnect();
      state.snapshot = { connection: 'disconnected', tracks: [] };
      state.devices = [];
      state.busy.clear();
    },
  };
}
