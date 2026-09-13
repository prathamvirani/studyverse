import { z } from 'zod';

export const videoQualitySchema = z.strictObject({
  resolution: z.enum(['fixed', 'native']),
  width: z.number().int().min(160).max(7680),
  height: z.number().int().min(90).max(4320),
  fps: z.number().min(1).max(250).nullable(),
  bitrate: z.number().int().min(100_000).max(50_000_000),
  codec: z.enum(['auto', 'av1', 'vp9', 'h264', 'vp8']),
  priority: z.enum(['balanced', 'quality', 'latency']),
  layers: z.enum(['auto', 'off', 'simulcast', 'svc']),
  content: z.enum(['motion', 'detail', 'text']),
  preserveAspectRatio: z.boolean(),
});
export const audioQualitySchema = z.strictObject({
  mode: z.enum(['standard', 'high', 'studio']),
  echoCancellation: z.boolean(),
  noiseSuppression: z.boolean(),
  autoGainControl: z.boolean(),
  bitrate: z.number().int().min(16_000).max(256_000),
  channels: z.union([z.literal(1), z.literal(2)]),
  dtx: z.boolean(),
});
export const mediaQualitySchema = z.strictObject({
  mode: z.enum(['basic', 'advanced']),
  camera: videoQualitySchema,
  screen: videoQualitySchema,
  cameraReceive: videoQualitySchema,
  screenReceive: videoQualitySchema,
  audio: audioQualitySchema,
});
export type VideoQualityRequest = z.infer<typeof videoQualitySchema>;
export type AudioQualityRequest = z.infer<typeof audioQualitySchema>;
export type MediaQualityPreferences = z.infer<typeof mediaQualitySchema>;
export type MediaQualityStage = 'basic' | 'a' | 'b' | 'c' | 'd';
export const mediaQualityStageSchema = z.enum(['basic', 'a', 'b', 'c', 'd']);
export function voiceProfile(mode: AudioQualityRequest['mode']): AudioQualityRequest {
  return {
    mode,
    echoCancellation: mode !== 'studio',
    noiseSuppression: mode === 'standard',
    autoGainControl: mode === 'standard',
    bitrate: mode === 'studio' ? 128_000 : mode === 'high' ? 96_000 : 64_000,
    channels: 1,
    dtx: mode !== 'studio',
  };
}
export function qualityPreset(name: 'balanced' | 'data-saver' | 'high'): MediaQualityPreferences {
  const camera: VideoQualityRequest = {
    resolution: 'fixed',
    width: 1280,
    height: 720,
    fps: 30,
    bitrate: 2_000_000,
    codec: 'auto',
    priority: 'balanced',
    layers: 'auto',
    content: 'motion',
    preserveAspectRatio: true,
  };
  const screen = {
    ...camera,
    width: 1920,
    height: 1080,
    bitrate: 4_000_000,
    content: 'detail' as const,
  };
  if (name === 'data-saver') {
    Object.assign(camera, { width: 640, height: 360, fps: 24, bitrate: 400_000 });
    Object.assign(screen, { width: 1280, height: 720, fps: 15, bitrate: 1_000_000 });
  } else if (name === 'high') {
    Object.assign(camera, { width: 1920, height: 1080, fps: 60, bitrate: 5_000_000 });
    Object.assign(screen, { fps: 60, bitrate: 6_000_000 });
  }
  return {
    mode: name === 'high' ? 'advanced' : 'basic',
    camera,
    screen,
    cameraReceive: { ...camera },
    screenReceive: { ...screen },
    audio: voiceProfile('standard'),
  };
}
/** Deployment resource policy, never an identity or source grant. Native uses the stage as a ceiling. */
export function effectiveVideo(
  request: VideoQualityRequest,
  source: 'camera' | 'screen',
  stage: MediaQualityStage,
): VideoQualityRequest {
  const p = videoQualitySchema.parse(request);
  const limits =
    stage === 'basic'
      ? source === 'camera'
        ? [1280, 720, 30, 2_000_000]
        : [1920, 1080, 30, 4_000_000]
      : stage === 'a'
        ? [1920, 1080, 60, 8_000_000]
        : stage === 'b'
          ? [2560, 1440, 60, 12_000_000]
          : stage === 'c'
            ? [7680, 4320, 60, 30_000_000]
            : [7680, 4320, 250, 50_000_000];
  const native = p.resolution === 'native';
  const scale = Math.min(1, limits[0]! / p.width, limits[1]! / p.height);
  return {
    ...p,
    width: native ? limits[0]! : Math.floor(p.width * scale),
    height: native ? limits[1]! : Math.floor(p.height * scale),
    fps: Math.min(p.fps ?? limits[2]!, limits[2]!),
    bitrate: Math.min(p.bitrate, limits[3]!),
  };
}
export function receiveTarget(
  p: VideoQualityRequest,
  surface: 'circle' | 'workspace' | 'hidden',
  size?: { width: number; height: number },
) {
  if (surface === 'hidden') return { width: 0, height: 0, fps: 0 };
  const width = surface === 'circle' ? 640 : Math.max(1, size?.width ?? p.width);
  const height = surface === 'circle' ? 360 : Math.max(1, size?.height ?? p.height);
  return {
    width: Math.min(p.width, Math.ceil(width)),
    height: Math.min(p.height, Math.ceil(height)),
    fps: p.fps ?? 30,
  };
}
export const mediaPreferencesSchema = z.strictObject({
  current: mediaQualitySchema,
  saved: z
    .array(z.strictObject({ name: z.string().trim().min(1).max(40), quality: mediaQualitySchema }))
    .max(12),
});
