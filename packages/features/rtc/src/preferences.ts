import { mediaPreferencesSchema, qualityPreset } from '@study/contracts';
import type { PreferenceDefinition } from '@study/feature-sdk';
import type { z } from '@study/contracts';
export function mediaPreference(
  userId: string,
): PreferenceDefinition<z.infer<typeof mediaPreferencesSchema>> {
  return {
    key: `rtc.quality.${userId}`,
    version: 1,
    schema: mediaPreferencesSchema,
    defaultValue: { current: qualityPreset('balanced'), saved: [] },
  };
}
