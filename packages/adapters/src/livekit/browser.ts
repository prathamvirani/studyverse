import {
  Room,
  RoomEvent,
  Track,
  TrackEvent,
  VideoQuality,
  VideoPreset,
  createLocalAudioTrack,
  createLocalVideoTrack,
  createLocalScreenTracks,
} from 'livekit-client';
import type { LocalTrack, RemoteTrackPublication, TrackPublication } from 'livekit-client';
import { mediaCaps } from '@study/contracts';
import type { MediaCredential, MediaSource } from '@study/contracts';
import type {
  MediaSnapshot,
  MediaTrack,
  RealtimeMediaProvider,
  ReceiveSurface,
} from '@study/feature-sdk';

const sourceMap = {
  microphone: Track.Source.Microphone,
  camera: Track.Source.Camera,
  screen: Track.Source.ScreenShare,
};
const sourceOf = (p: TrackPublication): MediaSource | undefined =>
  (Object.keys(sourceMap) as MediaSource[]).find((s) => sourceMap[s] === p.source);
const constraints = (s: 'camera' | 'screen') => ({
  width: { ideal: mediaCaps[s].width, max: mediaCaps[s].width },
  height: { ideal: mediaCaps[s].height, max: mediaCaps[s].height },
  frameRate: { ideal: 30, max: 30 },
});

export function createLiveKitProvider(): RealtimeMediaProvider {
  const room = new Room({ adaptiveStream: false, dynacast: true, disconnectOnPageLeave: true });
  const listeners = new Set<() => void>(),
    local = new Map<MediaSource, LocalTrack>();
  const remote = new Map<string, RemoteTrackPublication>(),
    streams = new Map<string, MediaStream>();
  const surfaces = new Map<string, ReceiveSurface>();
  const measurements = new Map<string, { bytes: number; at: number }>();
  let snapshot: MediaSnapshot = { connection: 'disconnected', tracks: [] },
    credential: MediaCredential | null = null;
  let generation = 0,
    timer: ReturnType<typeof setInterval> | undefined,
    statsBusy = false;
  const busy = new Set<MediaSource>();
  let voice: 'standard' | 'high' = 'standard';
  const changed = () => {
    for (const f of listeners) f();
  };
  function sync() {
    const tracks: MediaTrack[] = [];
    remote.clear();
    for (const participant of [room.localParticipant, ...room.remoteParticipants.values()]) {
      for (const p of participant.trackPublications.values()) {
        const source = sourceOf(p);
        if (!source) continue;
        const isLocal = participant === room.localParticipant;
        if (!isLocal) remote.set(p.trackSid, p as RemoteTrackPublication);
        const raw = p.track?.mediaStreamTrack;
        if (isLocal && raw?.readyState === 'ended') continue;
        if (raw && raw.readyState !== 'ended' && streams.get(p.trackSid)?.getTracks()[0] !== raw)
          streams.set(p.trackSid, new MediaStream([raw]));
        if (!raw || raw.readyState === 'ended') streams.delete(p.trackSid);
        tracks.push({
          id: p.trackSid,
          participantId: participant.identity,
          userId: '', // Application directory resolves opaque connection identities.
          local: isLocal,
          source,
          muted: p.isMuted || raw?.readyState === 'ended',
          stream: streams.get(p.trackSid) ?? null,
          requested: isLocal
            ? source === 'microphone'
              ? { bitrate: voice === 'high' ? 96000 : 64000 }
              : { ...mediaCaps[source] }
            : {},
          actual: snapshot.tracks.find((t) => t.id === p.trackSid)?.actual ?? {},
        });
      }
    }
    for (const id of streams.keys()) if (!tracks.some((t) => t.id === id)) streams.delete(id);
    for (const id of surfaces.keys()) if (!tracks.some((t) => t.id === id)) surfaces.delete(id);
    snapshot = { ...snapshot, tracks };
    changed();
  }
  for (const event of [
    RoomEvent.TrackSubscribed,
    RoomEvent.TrackUnsubscribed,
    RoomEvent.TrackPublished,
    RoomEvent.TrackUnpublished,
    RoomEvent.TrackMuted,
    RoomEvent.TrackUnmuted,
    RoomEvent.LocalTrackPublished,
    RoomEvent.LocalTrackUnpublished,
    RoomEvent.ParticipantDisconnected,
    RoomEvent.ParticipantConnected,
  ])
    room.on(event, sync);
  for (const event of [RoomEvent.Reconnecting, RoomEvent.SignalReconnecting])
    room.on(event, () => {
      snapshot = { ...snapshot, connection: 'reconnecting' };
      changed();
    });
  room.on(RoomEvent.Reconnected, () => {
    snapshot = { ...snapshot, connection: 'connected' };
    sync();
    for (const [id, s] of surfaces) receive(id, s);
  });
  room.on(RoomEvent.Disconnected, () => {
    generation++;
    credential = null;
    clearInterval(timer);
    for (const t of local.values()) t.stop();
    local.clear();
    streams.clear();
    measurements.clear();
    remote.clear();
    surfaces.clear();
    snapshot = { connection: 'disconnected', tracks: [] };
    changed();
  });
  async function stats() {
    if (statsBusy) return;
    statsBusy = true;
    try {
      for (const participant of [room.localParticipant, ...room.remoteParticipants.values()])
        for (const p of participant.trackPublications.values()) {
          const report = await p.track?.getRTCStatsReport();
          const item = snapshot.tracks.find((t) => t.id === p.trackSid);
          if (!item || !report) continue;
          const actual: MediaTrack['actual'] = {};
          report.forEach((stat) => {
            if (stat.type === 'outbound-rtp' || stat.type === 'inbound-rtp') {
              if (Number.isFinite(stat.frameWidth))
                actual.width = Math.max(actual.width ?? 0, stat.frameWidth);
              if (Number.isFinite(stat.frameHeight))
                actual.height = Math.max(actual.height ?? 0, stat.frameHeight);
              if (Number.isFinite(stat.framesPerSecond))
                actual.fps = Math.max(actual.fps ?? 0, stat.framesPerSecond);
              const key = `${p.trackSid}:${stat.id}`,
                bytes = stat.bytesSent ?? stat.bytesReceived;
              const previous = measurements.get(key);
              if (Number.isFinite(bytes) && Number.isFinite(stat.timestamp)) {
                if (previous && stat.timestamp > previous.at && bytes >= previous.bytes)
                  actual.bitrate =
                    (actual.bitrate ?? 0) +
                    Math.round(((bytes - previous.bytes) * 8000) / (stat.timestamp - previous.at));
                measurements.set(key, { bytes, at: stat.timestamp });
              }
              const codec = report.get(stat.codecId);
              if (codec?.mimeType) actual.codec = codec.mimeType;
            }
          });
          item.actual = actual;
        }
      for (const key of measurements.keys())
        if (!snapshot.tracks.some((t) => key.startsWith(`${t.id}:`))) measurements.delete(key);
      changed();
    } catch {
      /* unavailable stats are unknown, never substitute requested values */
    } finally {
      statsBusy = false;
    }
  }
  function receive(id: string, surface: ReceiveSurface) {
    surfaces.set(id, surface);
    const publication = remote.get(id);
    if (!publication) return;
    publication.setSubscribed(surface !== 'hidden');
    if (publication.kind === 'video') {
      publication.setVideoQuality(surface === 'circle' ? VideoQuality.LOW : VideoQuality.HIGH);
      publication.setVideoDimensions(
        surface === 'circle'
          ? { width: 640, height: 360 }
          : publication.source === Track.Source.Camera
            ? { width: 1280, height: 720 }
            : { width: 1920, height: 1080 },
      );
    }
  }
  async function unpublish(source: MediaSource) {
    const track = local.get(source);
    if (!track) return;
    local.delete(source);
    track.stop();
    await room.localParticipant.unpublishTrack(track, true);
    sync();
  }
  return {
    snapshot: () => snapshot,
    listen(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async connect(c) {
      if (snapshot.connection !== 'disconnected')
        throw new Error('Media connection already active');
      credential = c;
      const epoch = ++generation;
      snapshot = { connection: 'connecting', tracks: [] };
      changed();
      try {
        await room.connect(c.url, c.token, { autoSubscribe: false });
        if (epoch !== generation) {
          await room.disconnect(true);
          return;
        }
        snapshot = { connection: 'connected', tracks: [] };
        sync();
        timer = setInterval(() => {
          void stats();
        }, 3000);
      } catch (error) {
        snapshot = { connection: 'disconnected', tracks: [] };
        changed();
        throw error;
      }
    },
    async disconnect() {
      generation++;
      credential = null;
      clearInterval(timer);
      for (const t of local.values()) t.stop();
      local.clear();
      await room.disconnect(true);
      streams.clear();
      remote.clear();
      surfaces.clear();
      snapshot = { connection: 'disconnected', tracks: [] };
      changed();
    },
    async publish(source, deviceId, voiceMode = 'standard') {
      if (snapshot.connection !== 'connected' || !credential?.sources.includes(source))
        throw new Error('Media unavailable');
      if (busy.has(source) || local.has(source)) throw new Error('Publication already active');
      busy.add(source);
      if (source === 'microphone') voice = voiceMode;
      const epoch = generation;
      let track: LocalTrack | undefined;
      try {
        // SDK subclass declaration is incompatible with exactOptionalPropertyTypes; runtime is LocalTrack.
        if (source === 'microphone')
          track = (await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: voice === 'standard',
            autoGainControl: voice === 'standard',
            ...(deviceId ? { deviceId } : {}),
          })) as unknown as LocalTrack;
        else if (source === 'camera') {
          track = await createLocalVideoTrack({
            resolution: { width: 1280, height: 720, frameRate: 30 },
            ...(deviceId ? { deviceId } : {}),
          });
          await track.mediaStreamTrack.applyConstraints(constraints('camera'));
        } else {
          const captured = await createLocalScreenTracks({
            audio: false,
            resolution: { width: 1920, height: 1080, frameRate: 30 },
          });
          track = captured.find((t) => t.kind === 'video');
          for (const t of captured) if (t !== track) t.stop();
          await track?.mediaStreamTrack.applyConstraints(constraints('screen'));
        }
        if (!track) throw new Error('Device unavailable');
        if (epoch !== generation) {
          track.stop();
          return;
        }
        local.set(source, track);
        track.on(TrackEvent.Ended, () => {
          void unpublish(source).catch(sync);
        });
        await room.localParticipant.publishTrack(track, {
          source: sourceMap[source],
          audioPreset: { maxBitrate: voice === 'high' ? 96_000 : 64_000 },
          ...(source === 'microphone'
            ? {}
            : {
                videoEncoding: { maxBitrate: mediaCaps[source].bitrate, maxFramerate: 30 },
                simulcast: source === 'camera',
                videoSimulcastLayers:
                  source === 'camera' ? [new VideoPreset(640, 360, 400_000, 30)] : [],
              }),
        });
        if (epoch !== generation) {
          await unpublish(source);
          return;
        }
        sync();
      } catch (error) {
        track?.stop();
        if (track) await room.localParticipant.unpublishTrack(track, true).catch(() => {});
        local.delete(source);
        sync();
        throw error;
      } finally {
        busy.delete(source);
      }
    },
    unpublish,
    async mute(source, muted) {
      const t = local.get(source);
      if (!t) throw new Error('No active track');
      if (muted) await t.mute();
      else await t.unmute();
      sync();
    },
    async switchDevice(source, deviceId) {
      const t = local.get(source);
      if (!t) throw new Error('No active track');
      const epoch = generation;
      await t.restartTrack(
        source === 'camera'
          ? { deviceId, resolution: { width: 1280, height: 720, frameRate: 30 } }
          : {
              deviceId,
              echoCancellation: true,
              noiseSuppression: voice === 'standard',
              autoGainControl: voice === 'standard',
            },
      );
      if (epoch !== generation) {
        t.stop();
        return;
      }
      if (source === 'camera') await t.mediaStreamTrack.applyConstraints(constraints('camera'));
      sync();
    },
    receive,
    async devices() {
      return navigator.mediaDevices
        ? Array.from(await navigator.mediaDevices.enumerateDevices())
        : [];
    },
  };
}
