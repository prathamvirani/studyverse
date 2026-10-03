import { z } from '@study/contracts';
import type { PreferenceDefinition } from '@study/feature-sdk';

export const appearancePreference = {
  key: 'app.appearance',
  version: 1,
  defaultValue: 'system',
  schema: z.enum(['system', 'light', 'dark']),
} satisfies PreferenceDefinition<string>;
export const layoutWidthPreference = {
  key: 'app.layout-width',
  version: 1,
  defaultValue: 'auto',
  schema: z.enum(['auto', 'compressed', 'full']),
} satisfies PreferenceDefinition<string>;
export const glassTransparencyPreference = {
  key: 'app.glass-transparency',
  version: 1,
  defaultValue: 'auto' as const,
  schema: z.union([z.literal('auto'), z.number().int().min(0).max(100).multipleOf(5)]),
} satisfies PreferenceDefinition<'auto' | number>;
export type GlassTransparency = z.infer<typeof glassTransparencyPreference.schema>;
export type Appearance = z.infer<typeof appearancePreference.schema>;
export type LayoutWidth = z.infer<typeof layoutWidthPreference.schema>;

/** The SSR mirror contains only bounded presentation values, never identity or private data. */
export function readPresentationPreference<T>(
  definition: PreferenceDefinition<T>,
  record: unknown,
): T {
  const envelope = z
    .object({ version: z.number().int(), value: z.unknown() })
    .strict()
    .safeParse(record);
  if (!envelope.success || envelope.data.version !== definition.version)
    return definition.defaultValue;
  return definition.schema.safeParse(envelope.data.value).data ?? definition.defaultValue;
}
