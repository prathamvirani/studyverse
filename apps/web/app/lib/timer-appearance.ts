import { z } from '@study/contracts';
import type { PreferenceDefinition } from '@study/feature-sdk';
export const timerAppearanceSchema = z.strictObject({
  style: z.enum(['default', 'flip', 'bar', 'gauge', 'dots', 'pie']).default('default'),
  progress: z.boolean().default(true),
  notifications: z.boolean().default(false),
  sound: z.enum(['none', 'soft', 'bell']).default('none'),
  volume: z.number().min(0).max(1).default(0.3),
  scale: z.number().min(0.7).max(1.4).default(1),
  alertRuntime: z.enum(['fixed', 'dismiss']).default('fixed'),
  alertSeconds: z.number().int().min(2).max(30).default(4),
});
export function timerAppearancePreference(
  userId: string,
): PreferenceDefinition<z.infer<typeof timerAppearanceSchema>> {
  return {
    key: `timer-display.${userId}`,
    version: 1,
    schema: timerAppearanceSchema,
    defaultValue: timerAppearanceSchema.parse({}),
  };
}
