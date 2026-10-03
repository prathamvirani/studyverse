import { z } from '@study/contracts';
import type { PreferenceDefinition } from '@study/feature-sdk';
export const arrangementSchema = z.strictObject({
  header: z.number().int().min(0).max(3).default(0),
  // Null retains the named anchor. Existing v1 preferences acquire this default on read.
  headerX: z.number().finite().min(0).max(100000).nullable().default(null),
  rail: z.enum(['left', 'right', 'top', 'bottom']).default('left'),
  points: z
    .record(
      z.string().max(40),
      z.strictObject({
        x: z.number().finite().min(0).max(100000),
        y: z.number().finite().min(0).max(100000),
      }),
    )
    .default({}),
});
export type Arrangement = z.infer<typeof arrangementSchema>;
export const defaultArrangement = (): Arrangement => ({
  header: 0,
  headerX: null,
  rail: 'left',
  points: {},
});
export function arrangementPreference(
  roomId: string,
  userId: string,
): PreferenceDefinition<Arrangement> {
  return {
    key: `room-arrangement.${userId}.${roomId}`,
    version: 1,
    schema: arrangementSchema,
    defaultValue: defaultArrangement(),
  };
}
