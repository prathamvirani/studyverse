import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({
  room: null as unknown,
  capture: vi.fn(),
  publish: vi.fn(),
  unpublish: vi.fn(),
}));
vi.mock('livekit-client', async () => {
  const { EventEmitter } = await import('node:events');
  class Room extends EventEmitter {
    remoteParticipants = new Map();
    localParticipant = {
      identity: 'tab',
      attributes: { userId: 'user' },
      trackPublications: new Map(),
      publishTrack: async (
        t: { mediaStreamTrack: { kind: string }; on: unknown },
        options: { source: string },
      ) => {
        sdk.publish(t, options);
        this.localParticipant.trackPublications.set(options.source, {
          source: options.source,
          trackSid: options.source,
          isMuted: false,
          track: t,
        });
        this.emit('localTrackPublished');
      },
      unpublishTrack: async (t: unknown) => {
        sdk.unpublish(t);
        for (const [id, p] of this.localParticipant.trackPublications)
          if (p.track === t) this.localParticipant.trackPublications.delete(id);
        this.emit('localTrackUnpublished');
      },
    };
    constructor() {
      super();
      sdk.room = this;
    }
    async connect() {}
    async disconnect() {
      this.localParticipant.trackPublications.clear();
      this.emit('disconnected');
    }
  }
  return {
    Room,
    RoomEvent: Object.fromEntries(
      [
        'TrackSubscribed',
        'TrackUnsubscribed',
        'TrackPublished',
        'TrackUnpublished',
        'TrackMuted',
        'TrackUnmuted',
        'LocalTrackPublished',
        'LocalTrackUnpublished',
        'ParticipantDisconnected',
        'ParticipantConnected',
        'Reconnecting',
        'SignalReconnecting',
        'Reconnected',
        'Disconnected',
      ].map((s) => [s, s[0]!.toLowerCase() + s.slice(1)]),
    ),
    Track: { Source: { Microphone: 'microphone', Camera: 'camera', ScreenShare: 'screen' } },
    TrackEvent: { Ended: 'ended' },
    VideoQuality: { LOW: 'low', HIGH: 'high' },
    VideoPreset: class {
      constructor(
        public width: number,
        public height: number,
        public bitrate: number,
        public fps: number,
      ) {}
    },
    createLocalAudioTrack: sdk.capture,
    createLocalVideoTrack: sdk.capture,
    createLocalScreenTracks: async (...args: unknown[]) => [await sdk.capture(...args)],
  };
});
import { createLiveKitProvider } from '@study/adapters/livekit/browser';
import { EventEmitter } from 'node:events';
class FakeTrack extends EventEmitter {
  kind = 'video';
  mediaStreamTrack = { readyState: 'live', kind: 'video', applyConstraints: vi.fn(async () => {}) };
  stop = vi.fn(() => {
    this.mediaStreamTrack.readyState = 'ended';
  });
  mute = vi.fn(async () => {});
  unmute = vi.fn(async () => {});
  restartTrack = vi.fn(async () => {});
  getRTCStatsReport = async () => undefined;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'MediaStream',
    class {
      constructor(private tracks: unknown[]) {}
      getTracks() {
        return this.tracks;
      }
    },
  );
  sdk.capture.mockImplementation(async () => new FakeTrack());
});
afterEach(() => vi.unstubAllGlobals());
const credential = {
  url: 'wss://test.invalid',
  token: 'fixture',
  room: 'room',
  connectionId: 'tab',
  expiresAt: Date.now() + 60000,
  sources: ['microphone', 'camera', 'screen'] as ('microphone' | 'camera' | 'screen')[],
};
it('remote circles request 360p and hidden video unsubscribes instead of receiving full resolution', async () => {
  const p = createLiveKitProvider();
  await p.connect(credential);
  const publication = {
    source: 'camera',
    trackSid: 'remote-camera',
    kind: 'video',
    isMuted: false,
    setSubscribed: vi.fn(),
    setVideoQuality: vi.fn(),
    setVideoDimensions: vi.fn(),
  };
  const room = sdk.room as EventEmitter & { remoteParticipants: Map<string, unknown> };
  room.remoteParticipants.set('other', {
    identity: 'other-tab',
    attributes: { userId: 'other' },
    trackPublications: new Map([['remote-camera', publication]]),
  });
  room.emit('trackPublished');
  p.receive('remote-camera', 'circle');
  expect(publication.setVideoDimensions).toHaveBeenLastCalledWith({ width: 640, height: 360 });
  expect(publication.setVideoQuality).toHaveBeenLastCalledWith('low');
  p.receive('remote-camera', 'hidden');
  expect(publication.setSubscribed).toHaveBeenLastCalledWith(false);
  p.receive('remote-camera', 'workspace');
  expect(publication.setVideoDimensions).toHaveBeenLastCalledWith({ width: 1280, height: 720 });
  await p.disconnect();
});
it('adapter separates connect, capped capture, publication, mute, unpublish and cleanup', async () => {
  const p = createLiveKitProvider();
  await p.connect(credential);
  expect(sdk.capture).not.toHaveBeenCalled();
  await p.publish('camera');
  expect(sdk.capture).toHaveBeenCalledWith({
    resolution: { width: 1280, height: 720, frameRate: 30 },
  });
  expect(sdk.publish.mock.calls[0]![1]).toMatchObject({
    source: 'camera',
    videoEncoding: { maxBitrate: 2000000, maxFramerate: 30 },
    simulcast: true,
  });
  const track = sdk.publish.mock.calls[0]![0] as FakeTrack;
  expect(track.mediaStreamTrack.applyConstraints).toHaveBeenCalledWith({
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 30, max: 30 },
  });
  expect(p.snapshot().tracks[0]!.actual).toEqual({});
  await expect(p.publish('camera')).rejects.toThrow();
  await p.mute('camera', true);
  expect(track.mute).toHaveBeenCalled();
  await p.unpublish('camera');
  expect(track.stop).toHaveBeenCalled();
  expect(p.snapshot().tracks).toHaveLength(0);
  await p.disconnect();
});
it('capture resolving after disconnect is stopped without publishing', async () => {
  const p = createLiveKitProvider();
  await p.connect(credential);
  let resolve!: (t: FakeTrack) => void;
  sdk.capture.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const pending = p.publish('camera');
  await p.disconnect();
  const t = new FakeTrack();
  resolve(t);
  await pending;
  expect(t.stop).toHaveBeenCalled();
  expect(sdk.publish).not.toHaveBeenCalled();
  expect(p.snapshot().tracks).toHaveLength(0);
});
it('basic High voice uses bounded Opus settings without disabling echo cancellation', async () => {
  const p = createLiveKitProvider();
  await p.connect(credential);
  await p.publish('microphone', undefined, 'high');
  expect(sdk.capture).toHaveBeenCalledWith({
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: false,
  });
  expect(sdk.publish.mock.calls[0]![1]).toMatchObject({ audioPreset: { maxBitrate: 96000 } });
  expect(p.snapshot().tracks[0]!.requested.bitrate).toBe(96000);
  await p.disconnect();
});
it('the normal adapter refuses a source outside the granted capability before capture', async () => {
  const p = createLiveKitProvider();
  await p.connect({ ...credential, sources: ['microphone'] });
  await expect(p.publish('camera')).rejects.toThrow('Media unavailable');
  expect(sdk.capture).not.toHaveBeenCalled();
  await p.disconnect();
});
it('native screen cancellation is recoverable and ended events remove the workspace source', async () => {
  const p = createLiveKitProvider();
  await p.connect(credential);
  sdk.capture.mockRejectedValueOnce(new DOMException('Cancel', 'NotAllowedError'));
  await expect(p.publish('screen')).rejects.toThrow();
  expect(p.snapshot().tracks).toHaveLength(0);
  await p.publish('screen');
  expect(sdk.publish.mock.calls[0]![1]).toMatchObject({
    source: 'screen',
    videoEncoding: { maxBitrate: 4000000, maxFramerate: 30 },
    simulcast: false,
  });
  const t = sdk.publish.mock.calls[0]![0] as FakeTrack;
  t.emit('ended');
  await vi.waitFor(() => expect(p.snapshot().tracks).toHaveLength(0));
  await p.disconnect();
});
it('temporary reconnect exposes state and terminal disconnect releases all capture devices', async () => {
  const p = createLiveKitProvider();
  await p.connect(credential);
  await p.publish('microphone');
  const room = sdk.room as EventEmitter;
  room.emit('signalReconnecting');
  expect(p.snapshot().connection).toBe('reconnecting');
  room.emit('reconnected');
  room.emit('reconnecting');
  expect(p.snapshot().connection).toBe('reconnecting');
  room.emit('reconnected');
  expect(p.snapshot().connection).toBe('connected');
  room.emit('disconnected');
  expect(p.snapshot()).toEqual({ connection: 'disconnected', tracks: [] });
  expect((sdk.publish.mock.calls[0]![0] as FakeTrack).stop).toHaveBeenCalled();
  await p.disconnect();
});
