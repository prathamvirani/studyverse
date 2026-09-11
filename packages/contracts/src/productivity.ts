import { z } from 'zod';
export const productivityRoomSchema = z.strictObject({ roomId: z.uuid() });
export const timerConfigSchema = z.strictObject({
  focusSeconds: z.number().int().min(60).max(10800),
  shortBreakSeconds: z.number().int().min(60).max(3600),
  longBreakSeconds: z.number().int().min(60).max(7200),
  cycles: z.number().int().min(1).max(12),
});
export const timerTimingSchema = z.strictObject({
  version: z.number().int().nonnegative(),
  config: timerConfigSchema,
  phase: z.enum(['focus', 'shortBreak', 'longBreak']),
  cycle: z.number().int().min(1),
  running: z.boolean(),
  remainingMs: z.number().nonnegative(),
  anchorAt: z.number().nonnegative(),
});
export const timerStateSchema = timerTimingSchema.extend({ roomId: z.uuid() });
export const personalTimerStateSchema = timerTimingSchema.extend({ scope: z.literal('personal') });
export const personalTimerViewSchema = z.strictObject({
  state: personalTimerStateSchema,
  canControl: z.literal(true),
});
export type TimerTiming = z.infer<typeof timerTimingSchema>;
export type PersonalTimerState = z.infer<typeof personalTimerStateSchema>;
export const timerViewSchema = z.strictObject({ state: timerStateSchema, canControl: z.boolean() });
export const timerCommandSchema = z.strictObject({
  roomId: z.uuid(),
  version: z.number().int().nonnegative(),
  action: z.enum(['start', 'pause', 'resume', 'reset', 'skip', 'configure']),
  config: timerConfigSchema.optional(),
});
export const personalTimerCommandSchema = timerCommandSchema.omit({ roomId: true });
export const clockSchema = z.strictObject({ serverNow: z.number() });
export const taskScopeSchema = z.discriminatedUnion('scope', [
  z.strictObject({ scope: z.literal('personal') }),
  z.strictObject({ scope: z.literal('shared'), roomId: z.uuid() }),
]);
const taskFields = {
  id: z.uuid(),
  title: z.string().trim().min(1).max(300),
  completed: z.boolean(),
  position: z.number().int().min(0).max(1000000),
  version: z.number().int().positive(),
  createdBy: z.uuid(),
  canEdit: z.boolean(),
};
export const taskSchema = z.strictObject(taskFields);
export const tasksViewSchema = z.strictObject({
  scope: taskScopeSchema,
  tasks: z.array(taskSchema).max(200),
  limit: z.literal(200),
});
export const taskCreateSchema = z.strictObject({
  scope: taskScopeSchema,
  requestId: z.uuid(),
  title: taskFields.title,
});
export const taskUpdateSchema = z.strictObject({
  scope: taskScopeSchema,
  id: z.uuid(),
  version: taskFields.version,
  title: taskFields.title,
  completed: z.boolean(),
  position: taskFields.position,
});
export const taskDeleteSchema = z.strictObject({
  scope: taskScopeSchema,
  id: z.uuid(),
  version: taskFields.version,
});
export const chatMessageSchema = z.strictObject({
  id: z.uuid(),
  sequence: z.string().regex(/^\d+$/),
  authorId: z.uuid(),
  authorName: z.string(),
  text: z.string().max(2000),
  createdAt: z.string(),
  deleted: z.boolean(),
  canDelete: z.boolean(),
});
export const chatViewSchema = z.strictObject({
  messages: z.array(chatMessageSchema).max(100),
  hasMore: z.boolean(),
  nextBefore: z.string().nullable(),
});
export const chatHistorySchema = z.strictObject({
  roomId: z.uuid(),
  before: z
    .string()
    .regex(/^\d{1,18}$/)
    .optional(),
});
export const chatSendSchema = z.strictObject({
  roomId: z.uuid(),
  requestId: z.uuid(),
  text: z.string().trim().min(1).max(2000),
});
export const chatDeleteSchema = z.strictObject({ roomId: z.uuid(), id: z.uuid() });
export type TimerState = z.infer<typeof timerStateSchema>;
export type TaskScope = z.infer<typeof taskScopeSchema>;

export const taskMoveSchema = z.strictObject({
  scope: taskScopeSchema,
  id: z.uuid(),
  version: z.number().int().positive(),
  direction: z.enum(['up', 'down']),
});
