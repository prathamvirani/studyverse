import { z } from 'zod';

export const presenceStatusSchema = z.enum([
  'online',
  'focusing',
  'break',
  'away',
  'dnd',
  'offline',
]);
export const socialPrivacySchema = z.strictObject({
  online: z.boolean(),
  room: z.boolean(),
  study: z.boolean(),
  join: z.boolean(),
  invites: z.boolean(),
});
export const socialTargetSchema = z.strictObject({ targetId: z.uuid() });
export const socialPersonSchema = z.strictObject({ id: z.uuid(), name: z.string().max(80) });
export const presenceViewSchema = socialPersonSchema.extend({
  status: presenceStatusSchema.nullable(),
  room: z
    .strictObject({ id: z.uuid(), name: z.string().max(100), joinable: z.boolean() })
    .nullable(),
});
export const friendsSnapshotSchema = z.strictObject({
  friends: z.array(presenceViewSchema).max(200),
  incoming: z.array(socialPersonSchema).max(200),
  outgoing: z.array(socialPersonSchema).max(200),
  blocked: z.array(socialPersonSchema).max(200),
  privacy: socialPrivacySchema,
});
export const presenceInputSchema = z.strictObject({
  roomId: z.uuid().nullable(),
  status: presenceStatusSchema,
  active: z.boolean(),
});
export const presenceSnapshotSchema = z.strictObject({
  participants: z.array(presenceViewSchema).max(200),
});
export const friendInviteSchema = z.strictObject({ targetId: z.uuid(), roomId: z.uuid() });
export const friendInviteIdSchema = z.strictObject({ inviteId: z.uuid() });
export const friendInvitationsSchema = z
  .array(
    z.strictObject({
      id: z.uuid(),
      roomId: z.uuid(),
      roomName: z.string().max(100),
      senderId: z.uuid(),
      expiresAt: z.iso.datetime(),
    }),
  )
  .max(100);
export type Privacy = z.infer<typeof socialPrivacySchema>;
export type PresenceStatus = z.infer<typeof presenceStatusSchema>;
export type PresenceView = z.infer<typeof presenceViewSchema>;
export type FriendsSnapshot = z.infer<typeof friendsSnapshotSchema>;
