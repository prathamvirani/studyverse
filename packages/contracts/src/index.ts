import { z } from 'zod';
export { z } from 'zod';
export * from './identity.ts';
export * from './social.ts';

export const PROTOCOL_VERSION = 1 as const;
export const identifier = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/)
  .max(100);
export const requestIdSchema = z.uuid();
export const errorCodeSchema = z.enum([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'INVALID_REQUEST',
  'CSRF_REJECTED',
  'ORIGIN_REJECTED',
  'RATE_LIMITED',
  'CONFLICT',
  'UNAVAILABLE',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export const errorSchema = z.strictObject({
  version: z.literal(PROTOCOL_VERSION),
  error: z.strictObject({ code: errorCodeSchema, message: z.string(), requestId: requestIdSchema }),
});
export const commandEnvelopeSchema = z.strictObject({
  version: z.literal(PROTOCOL_VERSION),
  requestId: requestIdSchema,
  command: identifier,
  payload: z.unknown(),
  csrf: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
});
export const resultEnvelopeSchema = z.strictObject({
  version: z.literal(PROTOCOL_VERSION),
  requestId: requestIdSchema,
  result: z.unknown(),
});
export const eventEnvelopeSchema = z.strictObject({
  version: z.literal(PROTOCOL_VERSION),
  eventId: z.uuid(),
  event: identifier,
  occurredAt: z.iso.datetime(),
  payload: z.unknown(),
});
export const capabilitiesSchema = z.strictObject({
  version: z.literal(PROTOCOL_VERSION),
  supportedVersions: z.array(z.number().int().positive()),
  capabilities: z.array(identifier),
});
export const csrfResponseSchema = z.strictObject({
  csrfToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const healthSchema = z.strictObject({ status: z.enum(['ok', 'unavailable']) });
export const emptySchema = z.strictObject({});
export const extensionPoints = [
  'environment',
  'homeNavigation',
  'topBar',
  'participantContextMenu',
  'participantBadge',
  'rightRail',
  'bottomDock',
  'mediaPanel',
  'workspaceTile',
  'roomMoreMenu',
  'roomSettings',
  'profileSettings',
  'notifications',
] as const;
export type ExtensionPoint = (typeof extensionPoints)[number];
export const layoutSchema = z.strictObject({
  version: z.literal(1),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().max(20_000),
  height: z.number().positive().max(20_000),
  zIndex: z.number().int().min(0).max(1_000_000),
  minimized: z.boolean(),
  fullscreen: z.boolean(),
});
export type TileLayout = z.infer<typeof layoutSchema>;

/** Capabilities describe compatibility, never authority. */
export function negotiateCapabilities(
  server: readonly string[],
  client: readonly string[],
): string[] {
  return [...new Set(client)].filter((item) => server.includes(item)).sort();
}

export * from './productivity.ts';
export * from './backgrounds.ts';
export * from './rtc.ts';
