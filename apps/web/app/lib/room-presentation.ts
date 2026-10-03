import { z } from '@study/contracts';
import type { PreferenceDefinition } from '@study/feature-sdk';

export const presentationSchema = z.strictObject({
  preset: z.enum(['standard', 'minimal', 'ambient', 'projector', 'custom']),
  header: z.boolean(),
  participants: z.boolean(),
  atmosphere: z.boolean(),
  dock: z.boolean(),
});
export type Presentation = z.infer<typeof presentationSchema>;
export const standardPresentation: Presentation = {
  preset: 'standard',
  header: true,
  participants: true,
  atmosphere: true,
  dock: true,
};
export function presentationPreference(
  room: string,
  user: string,
): PreferenceDefinition<Presentation> {
  return {
    key: `room-presentation.${user}.${room}`,
    version: 1,
    schema: presentationSchema,
    defaultValue: standardPresentation,
  };
}
export function presentationPreset(preset: Presentation['preset']): Presentation {
  return {
    preset,
    header: preset === 'standard' || preset === 'custom',
    participants: preset === 'standard' || preset === 'custom',
    atmosphere: preset !== 'projector',
    dock: preset === 'standard' || preset === 'custom',
  };
}
