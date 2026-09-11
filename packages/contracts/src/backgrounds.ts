import { z } from 'zod';
export const backgroundRoomSchema = z.strictObject({ roomId: z.uuid() });
export const backgroundStateSchema = z.strictObject({
  roomId: z.uuid(),
  assetId: z.string().max(100),
  version: z.number().int().nonnegative(),
});
export const backgroundViewSchema = z.strictObject({
  state: backgroundStateSchema,
  canControl: z.boolean(),
});
export const backgroundChangeSchema = backgroundStateSchema;
