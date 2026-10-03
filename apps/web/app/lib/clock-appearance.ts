import { z } from '@study/contracts';
import type { PreferenceDefinition } from '@study/feature-sdk';

export const clockAppearanceSchema = z.strictObject({
  format: z.enum(['12', '24']).default('24'),
  seconds: z.boolean().default(false),
  flip: z.boolean().default(false),
  greeting: z.boolean().default(true),
  dynamic: z.boolean().default(true),
  style: z.enum(['bold', 'light', 'soft', 'minimal', 'serif', 'digital']).default('bold'),
  scale: z.number().min(0.7).max(1.6).default(1),
});
export function clockAppearancePreference(
  userId: string,
): PreferenceDefinition<z.infer<typeof clockAppearanceSchema>> {
  return {
    key: `clock-display.${userId}`,
    version: 1,
    schema: clockAppearanceSchema,
    defaultValue: clockAppearanceSchema.parse({}),
  };
}
const greetings = [
  ['A quiet start.', 'Take the morning gently.', 'A little space to begin.'],
  ['Good morning.', 'Make room for a little progress.', 'One small step at a time.'],
  ['Good afternoon.', 'Settle into your rhythm.', 'A moment to refocus.'],
  ['Good evening.', 'Let the day slow down.', 'The quiet hours are yours.'],
] as const;
export function clockGreeting(date: Date, dynamic: boolean) {
  const hour = date.getHours();
  const bucket = hour < 5 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3;
  const pool = greetings[bucket]!;
  return pool[dynamic ? Math.floor(date.getMinutes() / 5) % pool.length : 0]!;
}
