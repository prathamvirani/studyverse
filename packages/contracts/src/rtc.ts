import { z } from 'zod';
export const mediaSourceSchema = z.enum(['microphone', 'camera', 'screen']);
export type MediaSource = z.infer<typeof mediaSourceSchema>;
export const mediaCaps = {
  microphone: { bitrate: 64_000 },
  camera: { width: 1280, height: 720, fps: 30, bitrate: 2_000_000 },
  screen: { width: 1920, height: 1080, fps: 30, bitrate: 4_000_000 },
} as const;
export const mediaJoinSchema = z.strictObject({ roomId: z.uuid() });
export const mediaLeaseSchema = z.strictObject({ roomId: z.uuid(), connectionId: z.uuid() });
export const mediaCredentialSchema = z.strictObject({
  url: z.url(),
  token: z.string().min(1).max(8192),
  room: z.string().max(200),
  connectionId: z.uuid(),
  expiresAt: z.number().int(),
  sources: z.array(mediaSourceSchema).max(3),
});
export type MediaCredential = z.infer<typeof mediaCredentialSchema>;
export const mediaAudienceSchema = z
  .array(z.strictObject({ connectionId: z.uuid(), userId: z.uuid(), name: z.string().max(100) }))
  .max(200);
