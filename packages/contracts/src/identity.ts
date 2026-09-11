import { z } from 'zod';

export const providerSchema = z.enum(['google', 'microsoft', 'discord']);
export type Provider = z.infer<typeof providerSchema>;
export const profileSchema = z.strictObject({
  id: z.uuid(),
  displayName: z.string().min(1).max(80),
  createdAt: z.iso.datetime(),
});
export const profileUpdateSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(80),
});
export const okSchema = z.strictObject({ ok: z.literal(true) });
export const providersSchema = z.array(providerSchema);
export const identityListSchema = z.array(
  z.strictObject({ provider: providerSchema, linkedAt: z.iso.datetime() }),
);
export const oauthStartSchema = z.strictObject({
  provider: providerSchema,
  mode: z.enum(['login', 'link', 'reauthenticate']),
});
export const oauthStartResultSchema = z.strictObject({ authorizationUrl: z.url() });
export const oauthFinishSchema = z.strictObject({
  provider: providerSchema,
  state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code: z.string().min(1).max(4096),
});
export const sessionViewSchema = z.strictObject({
  id: z.uuid(),
  current: z.boolean(),
  deviceLabel: z.string().max(120),
  createdAt: z.iso.datetime(),
  lastActiveAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export type SessionView = z.infer<typeof sessionViewSchema>;
export const sessionsSchema = z.array(sessionViewSchema).max(100);
export const revokeSessionSchema = z.strictObject({ sessionId: z.uuid() });
export const privacySchema = z.enum(['public', 'private', 'unlisted']);
export const roomFieldsSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(1000).default(''),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  privacy: privacySchema,
});
export const roomIdSchema = z.strictObject({ roomId: z.uuid() });
export const roomUpdateSchema = roomFieldsSchema.extend({
  roomId: z.uuid(),
  version: z.number().int().positive(),
});
export const roomSchema = roomFieldsSchema.extend({
  id: z.uuid(),
  ownerId: z.uuid(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  membership: z.enum(['owner', 'moderator', 'member']).nullable(),
  memberCount: z.number().int().nonnegative(),
});
export type Room = z.infer<typeof roomSchema>;
export type RoomFields = z.infer<typeof roomFieldsSchema>;
export const roomListSchema = z.strictObject({
  rooms: z.array(roomSchema).max(50),
  nextCursor: z.uuid().nullable(),
});
export const roomListInputSchema = z.strictObject({
  cursor: z.uuid().optional(),
  search: z.string().max(80).default(''),
});
export const inviteCreateSchema = z.strictObject({
  roomId: z.uuid(),
  expiresInHours: z.number().int().min(1).max(168),
  maxUses: z.number().int().min(1).max(100),
});
export const inviteSecretSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const inviteRedeemSchema = z.strictObject({ token: inviteSecretSchema });
export const inviteRevokeSchema = z.strictObject({ roomId: z.uuid(), inviteId: z.uuid() });
export const inviteViewSchema = z.strictObject({
  id: z.uuid(),
  expiresAt: z.iso.datetime(),
  maxUses: z.number().int(),
  uses: z.number().int(),
  revoked: z.boolean(),
});
export const inviteCreatedSchema = inviteViewSchema.extend({ token: inviteSecretSchema });
export const invitesSchema = z.array(inviteViewSchema).max(100);
export const roomChangedSchema = z.strictObject({ roomId: z.uuid() });
