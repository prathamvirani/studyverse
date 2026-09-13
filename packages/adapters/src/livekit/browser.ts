import {
  Room,
  RoomEvent,
  Track,
  TrackEvent,
  VideoQuality,
  createLocalAudioTrack,
  createLocalVideoTrack,
  createLocalScreenTracks,
} from 'livekit-client';
import type { LocalTrack, RemoteTrackPublication, TrackPublication } from 'livekit-client';
import {
  effectiveVideo,
  qualityPreset,
  mediaQualitySchema,
  mediaQualityStageSchema,
  receiveTarget,
  voiceProfile,
} from '@study/contracts';
import type { MediaQualityPreferences, MediaQualityStage } from '@study/contracts';
import {
  audioConstraints,
  captureConstraints,
  codecCapabilities,
  publishOptions,
} from './quality.ts';
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
export function createLiveKitProvider(stage: MediaQualityStage = 'basic'): RealtimeMediaProvider {
  mediaQualityStageSchema.parse(stage);
  let preferences = qualityPreset('balanced');
  const warnings = new Map<MediaSource, string>();
  const applied = new Map<MediaSource, MediaQualityPreferences>();
  let applyRevision = 0;
  let operation: Promise<void> = Promise.resolve();
  const serial = (fn: () => Promise<void>) => {
    const next = operation.then(fn);
    operation = next.catch(() => {});
    return next;
  };
  const room = new Room({ adaptiveStream: false, dynacast: true, disconnectOnPageLeave: true });
  const listeners = new Set<() => void>(),
    local = new Map<MediaSource, LocalTrack>();
  const remote = new Map<string, RemoteTrackPublication>(),
    streams = new Map<string, MediaStream>();
  const surfaces = new Map<
    string,
    { surface: ReceiveSurface; size?: { width: number; height: number } }
  >();
  const measurements = new Map<string, { bytes: number; at: number }>();
  let snapshot: MediaSnapshot = { connection: 'disconnected', tracks: [] },
    credential: MediaCredential | null = null;
  let generation = 0,
    timer: ReturnType<typeof setInterval> | undefined,
    statsBusy = false;
  const busy = new Set<MediaSource>();
  const captureSettled = new Set<() => void>();
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
              ? { ...preferences.audio, codec: 'opus' }
              : requestedVideo(source)
            : (snapshot.tracks.find((t) => t.id === p.trackSid)?.requested ?? {}),
          ...(isLocal
            ? {
                effective:
                  source === 'microphone'
                    ? { ...(applied.get(source) ?? preferences).audio, codec: 'opus' }
                    : {
                        ...effectiveVideo(
                          (applied.get(source) ?? preferences)[source],
                          source,
                          stage,
                        ),
                        fps:
                          effectiveVideo(
                            (applied.get(source) ?? preferences)[source],
                            source,
                            stage,
                          ).fps ?? 30,
                      },
                capture: captureSettings(raw),
                warning: warnings.get(source) ?? '',
              }
            : {}),
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
    for (const [id, s] of surfaces) receive(id, s.surface, s.size);
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
    const epoch = generation;
    try {
      for (const participant of [room.localParticipant, ...room.remoteParticipants.values()])
        for (const p of participant.trackPublications.values()) {
          const report = await p.track?.getRTCStatsReport().catch(() => undefined);
          if (epoch !== generation) return;
          const item = snapshot.tracks.find((t) => t.id === p.trackSid);
          if (!item) continue;
          item.actual = {};
          if (item.local) item.capture = captureSettings(p.track?.mediaStreamTrack);
          if (!report || (!item.local && surfaces.get(item.id)?.surface === 'hidden')) continue;
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
              for (const [key, field] of Object.entries({
                jitter: 'jitter',
                packetsLost: 'packetsLost',
                framesDropped: 'framesDropped',
                encodeTime: 'totalEncodeTime',
                decodeTime: 'totalDecodeTime',
              })) {
                if (Number.isFinite(stat[field])) Object.assign(actual, { [key]: stat[field] });
              }
              if (typeof stat.qualityLimitationReason === 'string')
                actual.qualityLimitation = stat.qualityLimitationReason;
              const codec = report.get(stat.codecId);
              if (codec?.mimeType && !/\/(rtx|red|ulpfec)$/i.test(codec.mimeType))
                actual.codec = codec.mimeType;
              if (stat.kind === 'audio' && codec) {
                if (Number.isFinite(codec.clockRate)) actual.sampleRate = codec.clockRate;
                if (Number.isFinite(codec.channels)) actual.channels = codec.channels;
              }
            }
            if (stat.type === 'remote-inbound-rtp') {
              if (Number.isFinite(stat.roundTripTime))
                actual.rtt = Math.max(actual.rtt ?? 0, stat.roundTripTime);
              if (Number.isFinite(stat.jitter))
                actual.jitter = Math.max(actual.jitter ?? 0, stat.jitter);
              if (Number.isFinite(stat.packetsLost))
                actual.packetsLost = (actual.packetsLost ?? 0) + stat.packetsLost;
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
  function captureSettings(raw?: MediaStreamTrack) {
    const settings = raw?.getSettings?.() ?? {};
    return Object.fromEntries(
      Object.entries({
        width: settings.width,
        height: settings.height,
        fps: settings.frameRate,
        sampleRate: settings.sampleRate,
        channels: settings.channelCount,
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
        autoGainControl: settings.autoGainControl,
      }).filter(([, v]) => v !== undefined),
    );
  }
  function requestedVideo(source: 'camera' | 'screen') {
    const { fps, ...rest } = preferences[source];
    return { ...rest, ...(fps === null ? {} : { fps }) };
  }
  function receive(id: string, surface: ReceiveSurface, size?: { width: number; height: number }) {
    surfaces.set(id, { surface, ...(size ? { size } : {}) });
    const publication = remote.get(id);
    if (!publication) return;
    publication.setSubscribed(surface !== 'hidden');
    if (publication.kind === 'video') {
      const source = publication.source === Track.Source.Camera ? 'camera' : 'screen';
      const ceiling = effectiveVideo(
        preferences[source === 'camera' ? 'cameraReceive' : 'screenReceive'],
        source,
        stage,
      );
      const target = receiveTarget(ceiling, surface, size);
      const item = snapshot.tracks.find((t) => t.id === id);
      if (item) item.requested = target;
      if (surface === 'hidden') {
        if (item) item.actual = {};
        return;
      }
      publication.setVideoQuality(surface === 'circle' ? VideoQuality.LOW : VideoQuality.HIGH);
      publication.setVideoDimensions({ width: target.width, height: target.height });
      publication.setVideoFPS?.(target.fps);
    }
  }
  async function constrain(track: LocalTrack, source: MediaSource, prefs: MediaQualityPreferences) {
    if (source !== 'microphone') {
      const requested = prefs[source];
      if (requested.codec !== 'auto' && !codecCapabilities().includes(requested.codec))
        warnings.set(source, 'Requested codec is unavailable; provider Auto negotiation selected.');
    }
    try {
      if (source === 'microphone')
        await track.mediaStreamTrack.applyConstraints(audioConstraints(prefs.audio));
      else {
        const p = effectiveVideo(prefs[source], source, stage);
        await track.mediaStreamTrack.applyConstraints(
          captureConstraints(p, prefs[source].fps === null),
        );
        track.mediaStreamTrack.contentHint = p.content;
      }
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !['OverconstrainedError', 'NotSupportedError'].includes(error.name)
      )
        throw error;
      warnings.set(
        source,
        'Capture constraints unsupported; retained source settings. Encoder ceiling still requested.',
      );
    }
  }
  async function apply(next: MediaQualityPreferences) {
    const parsed = mediaQualitySchema.parse(next);
    const revision = ++applyRevision,
      epoch = generation;
    preferences = parsed;
    return serial(async () => {
      if (busy.size) await new Promise<void>((resolve) => captureSettled.add(resolve));
      if (revision !== applyRevision || epoch !== generation) return;
      for (const source of ['microphone', 'camera', 'screen'] as const) {
        const t = local.get(source),
          previous = applied.get(source);
        if (
          !t ||
          JSON.stringify(previous?.[source === 'microphone' ? 'audio' : source]) ===
            JSON.stringify(parsed[source === 'microphone' ? 'audio' : source])
        )
          continue;
        warnings.delete(source);
        await constrain(t, source, parsed);
        if (epoch !== generation || local.get(source) !== t) {
          t.stop();
          return;
        }
        if (
          previous &&
          (source === 'microphone' ||
            (previous[source].width === parsed[source].width &&
              previous[source].height === parsed[source].height &&
              previous[source].resolution === parsed[source].resolution)) &&
          JSON.stringify(publishOptions(source, previous, stage)) ===
            JSON.stringify(publishOptions(source, parsed, stage))
        ) {
          applied.set(source, parsed);
          continue;
        }
        // Renegotiate encoding/layers on the existing capture; no device restart or display picker.
        await room.localParticipant.unpublishTrack(t, false);
        if (epoch !== generation || local.get(source) !== t) {
          t.stop();
          return;
        }
        try {
          await room.localParticipant.publishTrack(t, {
            ...publishOptions(source, parsed, stage),
            source: sourceMap[source],
          });
          applied.set(source, parsed);
        } catch {
          if (epoch !== generation || local.get(source) !== t) {
            t.stop();
            return;
          }
          const fallback = previous ?? qualityPreset('balanced');
          await constrain(t, source, fallback);
          try {
            await room.localParticipant.publishTrack(t, {
              ...publishOptions(source, fallback, stage),
              source: sourceMap[source],
            });
          } catch (error) {
            await unpublish(source).catch(() => {});
            throw error;
          }
          warnings.set(source, 'Profile negotiation failed; previous encoding retained.');
        }
        if (epoch !== generation || local.get(source) !== t) {
          t.stop();
          return;
        }
      }
      for (const [id, s] of surfaces) receive(id, s.surface, s.size);
      sync();
    });
  }
  async function unpublish(source: MediaSource) {
    const track = local.get(source);
    if (!track) return;
    local.delete(source);
    applied.delete(source);
    warnings.delete(source);
    track.stop();
    await room.localParticipant.unpublishTrack(track, true);
    sync();
  }
  return {
    quality: {
      capabilities: () => ({
        stage,
        codecs: codecCapabilities(),
        processing: Object.entries(
          globalThis.navigator?.mediaDevices?.getSupportedConstraints?.() ?? {},
        )
          .filter(([, v]) => v)
          .map(([k]) => k),
      }),
      preferences: () => structuredClone(preferences),
      apply,
    },
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
    async publish(source, deviceId, voiceMode) {
      if (snapshot.connection !== 'connected' || !credential?.sources.includes(source))
        throw new Error('Media unavailable');
      if (busy.has(source) || local.has(source)) throw new Error('Publication already active');
      busy.add(source);
      warnings.delete(source);
      if (source === 'microphone' && voiceMode) preferences.audio = voiceProfile(voiceMode);
      const prefs = structuredClone(preferences);
      const epoch = generation;
      let track: LocalTrack | undefined;
      try {
        // SDK subclass declarations mismatch exactOptionalPropertyTypes; runtime is LocalTrack.
        if (source === 'microphone')
          track = (await createLocalAudioTrack({
            ...audioConstraints(prefs.audio),
            ...(deviceId ? { deviceId } : {}),
          })) as unknown as LocalTrack;
        else {
          const p = effectiveVideo(prefs[source], source, stage);
          const resolution =
            p.resolution === 'native'
              ? {}
              : {
                  resolution: {
                    width: p.width,
                    height: p.height,
                    ...(prefs[source].fps === null ? {} : { frameRate: p.fps ?? 30 }),
                  },
                };
          if (source === 'camera') {
            try {
              track = await createLocalVideoTrack({
                ...resolution,
                ...(deviceId ? { deviceId } : {}),
              });
            } catch (e) {
              if (!(e instanceof Error) || e.name !== 'OverconstrainedError') throw e;
              track = await createLocalVideoTrack({ ...(deviceId ? { deviceId } : {}) });
              warnings.set(source, 'Requested capture unsupported; device default selected.');
            }
          } else {
            const captured = await createLocalScreenTracks({ audio: false, ...resolution });
            track = captured.find((t) => t.kind === 'video');
            for (const t of captured) if (t !== track) t.stop();
          }
          if (track) await constrain(track, source, prefs);
        }
        if (!track) throw new Error('Device unavailable');
        if (epoch !== generation) {
          track.stop();
          return;
        }
        local.set(source, track);
        track.on(TrackEvent.Ended, () => {
          if (local.get(source) === track) void unpublish(source).catch(sync);
        });
        applied.set(source, prefs);
        try {
          await room.localParticipant.publishTrack(track, {
            ...publishOptions(source, prefs, stage),
            source: sourceMap[source],
          });
        } catch (error) {
          if (epoch !== generation || source === 'microphone') throw error;
          const fallback = qualityPreset('balanced');
          await constrain(track, source, fallback);
          await room.localParticipant.publishTrack(track, {
            ...publishOptions(source, fallback, stage),
            source: sourceMap[source],
          });
          applied.set(source, fallback);
          warnings.set(source, 'Requested encoding unavailable; Balanced fallback selected.');
        }
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
        if (!busy.size) {
          for (const resolve of captureSettled) resolve();
          captureSettled.clear();
        }
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
      await serial(async () => {
        if (epoch !== generation || local.get(source) !== t) return;
        await t.restartTrack(
          source === 'camera'
            ? {
                deviceId,
                ...(preferences.camera.resolution === 'native'
                  ? {}
                  : {
                      resolution: {
                        width: effectiveVideo(preferences.camera, 'camera', stage).width,
                        height: effectiveVideo(preferences.camera, 'camera', stage).height,
                        ...(preferences.camera.fps === null
                          ? {}
                          : {
                              frameRate:
                                effectiveVideo(preferences.camera, 'camera', stage).fps ?? 30,
                            }),
                      },
                    }),
              }
            : { deviceId, ...audioConstraints(preferences.audio) },
        );
        if (epoch !== generation || local.get(source) !== t) {
          t.stop();
          return;
        }
        await constrain(t, source, preferences);
      });
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
