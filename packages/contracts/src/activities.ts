import { z } from 'zod';

export const activityRoomSchema = z.strictObject({ roomId: z.uuid() });
export const activitySettingsSchema = z.strictObject({
  start: z.enum(['owner', 'moderators', 'everyone', 'suggestions']),
  ownerAbsent: z.enum(['preserve', 'moderators', 'everyone']),
});
export const activityOptionsSchema = z.strictObject({
  rounds: z.number().int().min(1).max(3),
  seconds: z.number().int().min(30).max(180),
  friendsOnly: z.boolean(),
  prompts: z
    .array(
      z
        .string()
        .trim()
        .min(3)
        .max(20)
        .regex(/^[a-zA-Z]+(?: +[a-zA-Z]+)*$/),
    )
    .min(1)
    .max(20)
    .optional(),
});
export const activityStartSchema = activityRoomSchema.extend({
  kind: z.string().regex(/^[a-z][a-z0-9.-]{1,40}$/),
  requestId: z.uuid(),
  options: activityOptionsSchema,
});
export const activityRevisionSchema = activityRoomSchema.extend({
  activityId: z.uuid(),
  version: z.number().int().nonnegative(),
  round: z.number().int().min(0).max(60),
  requestId: z.uuid(),
});
export const activityMemberSchema = activityRevisionSchema.extend({
  action: z.enum(['join', 'decline', 'spectate', 'leave', 'begin', 'cancel', 'report']),
});
export const drawingPointSchema = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export const drawingStrokeSchema = z.strictObject({
  color: z.enum(['ink', 'coral', 'leaf', 'sky']),
  width: z.number().int().min(1).max(12),
  points: z.array(drawingPointSchema).min(1).max(64),
});
export const activityActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('clear') }),
  z.strictObject({ type: z.literal('guess'), guess: z.string().min(1).max(32) }),
  z.strictObject({
    type: z.literal('stroke'),
    strokes: z.array(drawingStrokeSchema).min(1).max(4),
  }),
]);
export const activityPlaySchema = activityRevisionSchema.extend({ action: activityActionSchema });
export const activityConfigureSchema = activityRoomSchema.extend({
  settings: activitySettingsSchema,
});
export const wordResultSchema = z.strictObject({
  guess: z
    .string()
    .length(5)
    .regex(/^[A-Z]+$/),
  evaluation: z.array(z.enum(['exact', 'near', 'absent'])).length(5),
  by: z.uuid(),
});
export const activityDataSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('word'),
    guesses: z.array(wordResultSchema).max(6),
    solved: z.boolean(),
    reveal: z.string().length(5).optional(),
  }),
  z.strictObject({
    type: z.literal('drawing'),
    drawer: z.uuid().nullable(),
    prompt: z.string().max(20).optional(),
    reveal: z.string().max(20).optional(),
    letters: z.number().int().max(20),
    strokes: z.array(drawingStrokeSchema).max(40),
    accepted: z.array(z.uuid()).max(12),
    guesses: z
      .array(z.strictObject({ by: z.uuid(), text: z.string().max(32), correct: z.boolean() }))
      .max(20),
  }),
]);
export const activityViewSchema = activityRoomSchema.extend({
  settings: activitySettingsSchema,
  canStart: z.boolean(),
  isOwner: z.boolean(),
  catalog: z
    .array(
      z.strictObject({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        min: z.number(),
        max: z.number(),
        spectators: z.boolean(),
      }),
    )
    .max(20),
  activity: z
    .strictObject({
      id: z.uuid(),
      kind: z.string(),
      creator: z.uuid(),
      version: z.number().int(),
      state: z.enum(['lobby', 'active', 'transition', 'completed', 'cancelled']),
      round: z.number().int(),
      deadline: z.number().nullable(),
      members: z
        .array(
          z.strictObject({
            id: z.uuid(),
            name: z.string().max(100),
            mode: z.enum(['participant', 'spectator']),
            score: z.number().int().min(0).max(100000),
          }),
        )
        .max(24),
      myMode: z.enum(['participant', 'spectator', 'declined', 'none']),
      canManage: z.boolean(),
      reports: z.number().int().nonnegative(),
      data: activityDataSchema,
    })
    .nullable(),
});
export const breakStartedSchema = z.strictObject({
  roomId: z.uuid(),
  scope: z.enum(['personal', 'shared']),
  boundary: z.string().max(120),
});
export type ActivityView = z.infer<typeof activityViewSchema>;
export type ActivityAction = z.infer<typeof activityActionSchema>;
export type ActivityOptions = z.infer<typeof activityOptionsSchema>;
export type ActivitySettings = z.infer<typeof activitySettingsSchema>;
export type DrawingStroke = z.infer<typeof drawingStrokeSchema>;
