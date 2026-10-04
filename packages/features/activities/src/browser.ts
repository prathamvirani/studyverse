import { z } from '@study/contracts';
import type { ActivityDefinition, ActivityPreference } from '@study/feature-sdk';
export class ActivityRegistry {
  private definitions = new Map<string, ActivityDefinition>();
  register(definition: ActivityDefinition) {
    if (
      !/^[a-z][a-z0-9.-]{1,40}$/.test(definition.id) ||
      this.definitions.has(definition.id) ||
      definition.min < 1 ||
      definition.max > 12 ||
      definition.min > definition.max
    )
      throw new Error('Invalid or duplicate activity');
    this.definitions.set(definition.id, definition);
  }
  get(id: string) {
    return this.definitions.get(id);
  }
  catalog() {
    return [...this.definitions.values()].map(
      ({ id, name, description, min, max, spectators }) => ({
        id,
        name,
        description,
        min,
        max,
        spectators,
      }),
    );
  }
}
export const activityPreferenceSchema = z.strictObject({
  suggestions: z.boolean(),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
});
export function activityPreference(userId: string): ActivityPreference {
  return {
    key: `activities.preferences.${userId}`,
    version: 1,
    schema: activityPreferenceSchema,
    defaultValue: { suggestions: true, volume: 0.15, muted: true },
  };
}
export function shouldSuggest(
  preference: { suggestions: boolean },
  boundary: string,
  previous: string | null,
) {
  return preference.suggestions && boundary !== previous;
}
