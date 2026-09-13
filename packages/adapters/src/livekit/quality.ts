import { VideoPreset, supportsAV1, supportsVP9 } from 'livekit-client';
import type { TrackPublishOptions } from 'livekit-client';
import { effectiveVideo } from '@study/contracts';
import type {
  MediaQualityPreferences,
  MediaQualityStage,
  VideoQualityRequest,
} from '@study/contracts';

export function codecCapabilities(): string[] {
  const codecs = globalThis.RTCRtpSender?.getCapabilities?.('video')?.codecs ?? [];
  return ['vp8', 'h264', 'vp9', 'av1'].filter(
    (c) =>
      codecs.some((v) => v.mimeType.toLowerCase() === `video/${c}`) &&
      (c !== 'av1' || supportsAV1()) &&
      (c !== 'vp9' || supportsVP9()),
  );
}
export function captureConstraints(
  p: VideoQualityRequest,
  automaticFps = false,
): MediaTrackConstraints {
  return {
    width: { ...(p.resolution === 'fixed' ? { ideal: p.width } : {}), max: p.width },
    height: { ...(p.resolution === 'fixed' ? { ideal: p.height } : {}), max: p.height },
    frameRate: { ...(p.fps ? { ...(automaticFps ? {} : { ideal: p.fps }), max: p.fps } : {}) },
    ...(!p.preserveAspectRatio ? { resizeMode: 'crop-and-scale' } : {}),
  };
}
export function publishOptions(
  source: 'camera' | 'screen' | 'microphone',
  prefs: MediaQualityPreferences,
  stage: MediaQualityStage,
): TrackPublishOptions {
  if (source === 'microphone')
    return {
      audioPreset: { maxBitrate: prefs.audio.bitrate },
      dtx: prefs.audio.dtx,
      forceStereo: prefs.audio.channels === 2,
    };
  const p = effectiveVideo(prefs[source], source, stage);
  const codecs = codecCapabilities();
  const codec = p.codec !== 'auto' && codecs.includes(p.codec) ? p.codec : undefined;
  const svc = codec === 'vp9' || codec === 'av1';
  const layers = p.layers !== 'off' && (p.layers !== 'auto' || source === 'camera');
  const encoding = { maxBitrate: p.bitrate, maxFramerate: p.fps ?? 30 };
  const low = new VideoPreset(
    Math.min(640, p.width),
    Math.min(360, p.height),
    Math.min(400_000, p.bitrate),
    Math.min(30, p.fps ?? 30),
  );
  return {
    ...(codec ? { videoCodec: codec } : {}),
    backupCodec: true,
    videoEncoding: encoding,
    screenShareEncoding: encoding,
    simulcast: layers && !svc,
    ...(svc ? { scalabilityMode: layers ? 'L3T3_KEY' : 'L1T3' } : {}),
    videoSimulcastLayers: layers ? [low] : [],
    screenShareSimulcastLayers: layers ? [low] : [],
    degradationPreference:
      p.priority === 'quality'
        ? 'maintain-resolution'
        : p.priority === 'latency'
          ? 'maintain-framerate'
          : 'balanced',
  };
}
export function audioConstraints(p: MediaQualityPreferences['audio']) {
  return {
    echoCancellation: p.echoCancellation,
    noiseSuppression: p.noiseSuppression,
    autoGainControl: p.autoGainControl,
    ...(p.mode === 'studio' ? { voiceIsolation: false } : {}),
    ...(p.mode === 'studio'
      ? { sampleRate: 48000, channelCount: p.channels }
      : p.channels === 2
        ? { channelCount: 2 }
        : {}),
  };
}
