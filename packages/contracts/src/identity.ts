import { z } from 'zod';

export const providerSchema = z.enum(['google', 'microsoft', 'discord']);
export type Provider = z.infer<typeof providerSchema>;
export const onboardingSchema = z.strictObject({
  version: z.literal(1),
  identity: z.boolean(),
  appearance: z.boolean(),
  layout: z.boolean(),
});
export const usernameInputSchema = z.strictObject({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/),
});
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}
export function usernameProblem(value: string): string | null {
  if (!usernameInputSchema.safeParse({ username: value }).success)
    return 'Use 3–24 letters, numbers or underscores, starting with a letter.';
  const name = normalizeUsername(value);
  if (
    /^(admin|administrator|moderator|support|staff|official|study_?space|studyverse|security|deleted|system)(_|\d|$)/.test(
      name,
    ) ||
    [
      'root',
      'api',
      'auth',
      'account',
      'home',
      'help',
      'null',
      'undefined',
      'google',
      'discord',
      'microsoft',
      'everyone',
      'here',
    ].includes(name)
  )
    return 'This username is reserved. Please choose another.';
  return null;
}
export const usernameAvailabilitySchema = z.strictObject({ available: z.boolean() });
// An allowlist also excludes encoded separators, protocol-relative URLs and callback loops.
export const returnToSchema = z
  .string()
  .max(200)
  .regex(
    /^(?:\/home|\/account(?:#delete)?|\/my-rooms|\/discover|\/friends|\/rooms\/[a-zA-Z0-9-]{3,40}(?:\/configure|\?invite-code=[A-Za-z0-9_-]{43})?|\/invite#[A-Za-z0-9_-]{43})$/,
  );
export function safeReturnTo(value: unknown): string {
  const parsed = returnToSchema.safeParse(value);
  return parsed.success ? parsed.data : '/home';
}
export const oauthFinishResultSchema = z.strictObject({
  ok: z.literal(true),
  returnTo: returnToSchema,
});
export const onboardingStepSchema = z.strictObject({ step: z.enum(['appearance', 'layout']) });
export const deletionStatusSchema = z.strictObject({ ready: z.boolean() });
export const deleteAccountSchema = z.strictObject({ confirmation: z.literal('DELETE') });
export const accountDeletedSchema = z.strictObject({ userId: z.uuid() });
export const profileSchema = z.strictObject({
  id: z.uuid(),
  displayName: z.string().min(1).max(80),
  createdAt: z.iso.datetime(),
  username: z.string().nullable().default(null),
  onboarding: onboardingSchema.default({
    version: 1,
    identity: false,
    appearance: true,
    layout: true,
  }),
  onboardingReturnTo: returnToSchema.default('/home'),
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
  returnTo: returnToSchema.optional(),
  referralToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
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
  deviceName: z.string().max(60).default(''),
  createdAt: z.iso.datetime(),
  lastActiveAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export type SessionView = z.infer<typeof sessionViewSchema>;
export const sessionsSchema = z.array(sessionViewSchema).max(100);
export const revokeSessionSchema = z.strictObject({ sessionId: z.uuid() });
export const renameSessionSchema = revokeSessionSchema.extend({
  name: z
    .string()
    .trim()
    .max(60)
    .regex(/^[^\p{Cc}\p{Cf}]*$/u),
});
export const unlinkProviderSchema = z.strictObject({ provider: providerSchema });
export const privacySchema = z.enum(['public', 'private', 'unlisted']);
export const roomFieldsSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(1000).default(''),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  privacy: privacySchema,
});
export const roomIdSchema = z.strictObject({ roomId: z.uuid() });
const reservedRoomSlugs = new Set([
  'new',
  'configure',
  'invite',
  'admin',
  'api',
  'account',
  'settings',
  'support',
  'studyspace',
  'study-space',
  'home',
  'discover',
  'friends',
  'login',
  'logout',
]);
export const roomSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/)
  .refine(
    (s) => !reservedRoomSlugs.has(s) && !/^[a-f0-9]{12}$/.test(s),
    'This room address is reserved.',
  );
export const roomAddressSchema = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[a-zA-Z0-9-]+$/)
  .transform((s) => s.toLowerCase());
export const roomResolveSchema = z.strictObject({ address: roomAddressSchema });
export const roomSlugCheckSchema = z.strictObject({
  slug: roomSlugSchema,
  roomId: z.uuid().optional(),
});
export const roomSlugAvailabilitySchema = z.strictObject({ available: z.boolean() });
export const roomSlugUpdateSchema = z.strictObject({
  roomId: z.uuid(),
  version: z.number().int().positive(),
  slug: roomSlugSchema.nullable(),
});
export const roomUpdateSchema = roomFieldsSchema.extend({
  roomId: z.uuid(),
  version: z.number().int().positive(),
});
export const roomSchema = roomFieldsSchema.extend({
  id: z.uuid(),
  publicId: z
    .string()
    .regex(/^[a-f0-9]{12}$/)
    .optional(),
  slug: roomSlugSchema.nullable().optional(),
  ownerId: z.uuid(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  membership: z.enum(['owner', 'moderator', 'member']).nullable(),
  memberCount: z.number().int().nonnegative(),
  backgroundId: z.string().max(100).nullable().optional(),
  onlineCount: z.number().int().nonnegative().optional(),
  friendsHere: z.number().int().nonnegative().optional(),
  friendsStudying: z.number().int().nonnegative().optional(),
  lastVisitedAt: z.iso.datetime().nullable().optional(),
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
export const roomBrowseInputSchema = z.strictObject({
  scope: z.enum(['mine', 'discover']).default('discover'),
  search: z.string().max(80).default(''),
  sort: z
    .enum(['recommended', 'online', 'friends', 'newest', 'largest', 'smallest', 'visited'])
    .default('recommended'),
  filter: z.enum(['all', 'online', 'friends', 'studying']).default('all'),
  minMembers: z
    .string()
    .regex(/^\d{1,5}$/)
    .default('0'),
  cursor: z
    .string()
    .regex(/^\d{1,7}$/)
    .default('0'),
});
export const roomBrowseSchema = z.strictObject({
  rooms: z.array(roomSchema).max(50),
  nextCursor: z.string().nullable(),
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
  createdAt: z.iso.datetime().optional(),
  creatorId: z.uuid().nullable().optional(),
  token: inviteSecretSchema.nullable().optional(),
  status: z.enum(['active', 'revoked', 'expired', 'exhausted']).optional(),
  signups: z.number().int().nonnegative().optional(),
  joins: z.number().int().nonnegative().optional(),
});
export const referralLandingSchema = z.strictObject({
  token: inviteSecretSchema,
  landingId: z.uuid(),
});
export const referralConversionSchema = z.strictObject({
  linkId: z.uuid(),
  subjectId: z.uuid(),
  eventKey: z.string().min(1).max(100),
});
export const inviteCreatedSchema = inviteViewSchema.extend({ token: inviteSecretSchema });
export const invitesSchema = z.array(inviteViewSchema).max(100);
export const roomChangedSchema = z.strictObject({ roomId: z.uuid() });
