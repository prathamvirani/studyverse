import { z } from 'zod';

export const youtubeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
export const ambienceIdSchema = z.enum(['rain', 'white', 'pink', 'brown']);
const level = z.number().min(0).max(1);
export const ambienceLevelsSchema = z.strictObject({
  rain: level,
  white: level,
  pink: level,
  brown: level,
});
export const roomMixSchema = z.strictObject({ music: level, ambience: ambienceLevelsSchema });
export const mediaSettingsSchema = z.strictObject({
  controls: z.enum(['everyone', 'suggestions', 'moderators', 'owner']),
  ownerAbsent: z.enum(['ffa', 'moderators', 'preserve']),
});
export const mediaPlaybackSchema = z.strictObject({
  provider: z.literal('youtube'),
  queue: z.array(youtubeIdSchema).max(50),
  current: z.number().int().min(0).max(49).nullable(),
  playing: z.boolean(),
  position: z.number().min(0).max(604800),
  rate: z.number().min(0.25).max(2),
  updatedAt: z.number().int().nonnegative(),
  mix: roomMixSchema,
});
export const mediaActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('enqueue'), videoId: youtubeIdSchema }),
  z.strictObject({ type: z.literal('remove'), index: z.number().int().min(0).max(49) }),
  z.strictObject({ type: z.literal('select'), index: z.number().int().min(0).max(49) }),
  z.strictObject({ type: z.literal('play') }),
  z.strictObject({ type: z.literal('pause') }),
  z.strictObject({ type: z.literal('seek'), position: z.number().min(0).max(604800) }),
  z.strictObject({ type: z.literal('rate'), rate: z.number().min(0.25).max(2) }),
  z.strictObject({ type: z.literal('mix'), mix: roomMixSchema }),
]);
export const mediaRoomSchema = z.strictObject({ roomId: z.uuid() });
const revision = { roomId: z.uuid(), epoch: z.uuid(), version: z.number().int().nonnegative() };
export const mediaCommandSchema = z.strictObject({ ...revision, action: mediaActionSchema });
export const mediaConfigureSchema = z.strictObject({ ...revision, settings: mediaSettingsSchema });
export const mediaReconcileSchema = z.strictObject({
  ...revision,
  decision: z.enum(['keep', 'restore']),
});
export const mediaSuggestionDecisionSchema = z.strictObject({
  ...revision,
  suggestionId: z.uuid(),
  accept: z.boolean(),
});
const person = z.strictObject({ id: z.uuid(), name: z.string().max(100) });
export const mediaViewSchema = z.strictObject({
  ...revision,
  state: mediaPlaybackSchema,
  ownerBaseline: mediaPlaybackSchema,
  settings: mediaSettingsSchema,
  ownerPresent: z.boolean(),
  temporary: z.boolean(),
  canControl: z.boolean(),
  isOwner: z.boolean(),
  controller: person.nullable(),
  changedBy: z.array(person).max(200),
  suggestions: z
    .array(z.strictObject({ id: z.uuid(), by: person, action: mediaActionSchema }))
    .max(30),
});
export const mediaClockSchema = z.strictObject({ serverNow: z.number().int().nonnegative() });
export const localRoomMixSchema = z.strictObject({
  music: level,
  ambience: level,
  muted: z.boolean(),
  layers: ambienceLevelsSchema,
  ambienceScope: z.enum(['room', 'personal']),
  personal: ambienceLevelsSchema,
});
export type MediaPlayback = z.infer<typeof mediaPlaybackSchema>;
export type MediaAction = z.infer<typeof mediaActionSchema>;
export type MediaSettings = z.infer<typeof mediaSettingsSchema>;
export type MediaView = z.infer<typeof mediaViewSchema>;
export type LocalRoomMix = z.infer<typeof localRoomMixSchema>;

/** Internal occupancy event; never a public participant projection. */
export const roomOccupancyEventSchema = z.strictObject({
  roomId: z.uuid(),
  members: z.array(z.uuid()).max(200),
});
