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
    supportsAV1: () => true,
    supportsVP9: () => true,
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
import { qualityPreset, voiceProfile } from '@study/contracts';
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

it('advanced codec requests use advertised support and actual remains unknown before RTP', async () => {
  vi.stubGlobal('RTCRtpSender', {
    getCapabilities: () => ({ codecs: [{ mimeType: 'video/VP8' }] }),
  });
  const p = createLiveKitProvider('d');
  const q = qualityPreset('high');
  q.camera.codec = 'av1';
  q.camera.fps = 250;
  await p.quality!.apply(q);
  await p.connect(credential);
  await p.publish('camera');
  expect(p.quality!.capabilities().codecs).toEqual(['vp8']);
  expect(sdk.publish.mock.calls[0]![1].videoCodec).toBeUndefined();
  expect(p.snapshot().tracks[0]!.requested).toMatchObject({ codec: 'av1', fps: 250 });
  expect(p.snapshot().tracks[0]!.actual).toEqual({});
  expect(p.snapshot().tracks[0]!.warning).toContain('unavailable');
  await p.disconnect();
});
it('SVC is mapped for supported VP9, and screen encoding uses its own SDK option', async () => {
  vi.stubGlobal('RTCRtpSender', {
    getCapabilities: () => ({ codecs: [{ mimeType: 'video/VP9' }] }),
  });
  const p = createLiveKitProvider('b');
  const q = qualityPreset('high');
  Object.assign(q.screen, { codec: 'vp9', layers: 'svc', width: 2560, height: 1440 });
  await p.quality!.apply(q);
  await p.connect(credential);
  await p.publish('screen');
  expect(sdk.publish.mock.calls[0]![1]).toMatchObject({
    videoCodec: 'vp9',
    scalabilityMode: 'L3T3_KEY',
    simulcast: false,
    screenShareEncoding: { maxFramerate: 60, maxBitrate: 6_000_000 },
  });
  await p.disconnect();
});
it('profile changes retain the capture device and coalesce pending revisions', async () => {
  const p = createLiveKitProvider('a');
  await p.connect(credential);
  await p.publish('camera');
  const t = sdk.publish.mock.calls[0]![0] as FakeTrack;
  const first = p.quality!.apply(qualityPreset('data-saver'));
  const second = p.quality!.apply(qualityPreset('high'));
  await Promise.all([first, second]);
  expect(sdk.capture).toHaveBeenCalledTimes(1);
  expect(t.restartTrack).not.toHaveBeenCalled();
  expect(t.stop).not.toHaveBeenCalled();
  expect(p.snapshot().tracks[0]!.effective).toMatchObject({ width: 1920, height: 1080, fps: 60 });
  await p.switchDevice('camera', 'second');
  expect(t.restartTrack).toHaveBeenCalledWith({
    deviceId: 'second',
    resolution: { width: 1920, height: 1080, frameRate: 60 },
  });
  await p.disconnect();
});
it('processing-only changes apply in place and Studio Voice does not promise capture fidelity', async () => {
  const p = createLiveKitProvider();
  const q = qualityPreset('balanced');
  q.audio = voiceProfile('studio');
  await p.quality!.apply(q);
  await p.connect(credential);
  await p.publish('microphone');
  expect(sdk.capture).toHaveBeenCalledWith({
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    sampleRate: 48000,
    voiceIsolation: false,
    channelCount: 1,
  });
  const t = sdk.publish.mock.calls[0]![0] as FakeTrack;
  q.audio.echoCancellation = true;
  await p.quality!.apply(q);
  expect(sdk.publish).toHaveBeenCalledTimes(1);
  expect(t.mediaStreamTrack.applyConstraints).toHaveBeenCalledWith(
    expect.objectContaining({ echoCancellation: true }),
  );
  expect(p.snapshot().tracks[0]!.capture).toEqual({});
  await p.disconnect();
});
it('disconnect during a quality apply cannot republish or revive capture', async () => {
  const p = createLiveKitProvider('a');
  await p.connect(credential);
  await p.publish('camera');
  const t = sdk.publish.mock.calls[0]![0] as FakeTrack;
  let release!: () => void;
  t.mediaStreamTrack.applyConstraints.mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        release = r;
      }),
  );
  const pending = p.quality!.apply(qualityPreset('high'));
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  await p.disconnect();
  release();
  await pending;
  expect(sdk.publish).toHaveBeenCalledTimes(1);
  expect(t.stop).toHaveBeenCalled();
  expect(p.snapshot().tracks).toEqual([]);
});
it('an apply racing acquisition waits and finishes with the newest profile', async () => {
  const p = createLiveKitProvider('a');
  await p.connect(credential);
  let release!: (t: FakeTrack) => void;
  sdk.capture.mockImplementationOnce(
    () =>
      new Promise((r) => {
        release = r;
      }),
  );
  const capture = p.publish('camera');
  const apply = p.quality!.apply(qualityPreset('high'));
  release(new FakeTrack());
  await Promise.all([capture, apply]);
  expect(p.snapshot().tracks[0]!.effective).toMatchObject({ width: 1920, height: 1080 });
  await p.disconnect();
});
it('overconstrained quality retains capture and reports a fallback honestly', async () => {
  const p = createLiveKitProvider('d');
  await p.connect(credential);
  await p.publish('camera');
  const t = sdk.publish.mock.calls[0]![0] as FakeTrack;
  t.mediaStreamTrack.applyConstraints.mockRejectedValueOnce(
    new DOMException('unsupported', 'OverconstrainedError'),
  );
  await p.quality!.apply(qualityPreset('high'));
  expect(p.snapshot().tracks[0]!.warning).toContain('unsupported');
  expect(t.stop).not.toHaveBeenCalled();
  await p.disconnect();
});

it('stats use observed RTP deltas, never requested FPS or bitrate, and stale reads clear to unknown', async () => {
  vi.useFakeTimers();
  const p = createLiveKitProvider('a');
  try {
    await p.quality!.apply(qualityPreset('high'));
    await p.connect(credential);
    await p.publish('camera');
    const t = sdk.publish.mock.calls[0]![0] as FakeTrack;
    let sample = 0;
    t.getRTCStatsReport = vi.fn(
      async () =>
        new Map([
          [
            'out',
            {
              id: 'out',
              type: 'outbound-rtp',
              frameWidth: 640,
              frameHeight: 360,
              framesPerSecond: 12,
              bytesSent: ++sample * 1000,
              timestamp: sample * 3000,
              codecId: 'codec',
            },
          ],
          ['codec', { mimeType: 'video/VP8' }],
        ]),
    ) as unknown as typeof t.getRTCStatsReport;
    await vi.advanceTimersByTimeAsync(6000);
    expect(p.snapshot().tracks[0]!.actual).toMatchObject({
      width: 640,
      height: 360,
      fps: 12,
      bitrate: 2667,
      codec: 'video/VP8',
    });
    expect(p.snapshot().tracks[0]!.requested).toMatchObject({
      width: 1920,
      fps: 60,
      bitrate: 5_000_000,
    });
    t.getRTCStatsReport = async () => undefined;
    await vi.advanceTimersByTimeAsync(3000);
    expect(p.snapshot().tracks[0]!.actual).toEqual({});
  } finally {
    await p.disconnect();
    vi.useRealTimers();
  }
});

it('Native/Auto capture omits ideal FPS rather than silently asking for the highest experimental rate', async () => {
  const p = createLiveKitProvider('d');
  const q = qualityPreset('balanced');
  q.camera.resolution = 'native';
  q.camera.fps = null;
  await p.quality!.apply(q);
  await p.connect(credential);
  await p.publish('camera');
  expect(sdk.capture).toHaveBeenCalledWith({});
  const t = sdk.publish.mock.calls[0]![0] as FakeTrack;
  expect(t.mediaStreamTrack.applyConstraints).toHaveBeenCalledWith({
    width: { max: 7680 },
    height: { max: 4320 },
    frameRate: { max: 250 },
  });
  expect(p.snapshot().tracks[0]!.requested.fps).toBeUndefined();
  await p.disconnect();
});
