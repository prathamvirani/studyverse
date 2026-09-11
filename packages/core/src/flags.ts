import type { Actor, FlagDefinition } from '@study/feature-sdk';
import { Registry } from './registry.ts';

export class FeatureFlags extends Registry<FlagDefinition> {
  constructor(private readonly environment: string) {
    super();
  }
  enabled(id: string, actor: Actor | null, scopeId?: string): boolean {
    const flag = this.get(id);
    if (!flag) return false;
    const rule = flag.rule;
    switch (rule.mode) {
      case 'disabled':
        return false;
      case 'global':
        return true;
      case 'development':
        return this.environment === 'development';
      case 'cohort':
        return actor !== null && rule.subjects.includes(actor.subjectId);
      case 'scope':
        return scopeId !== undefined && rule.scopes.includes(scopeId);
    }
  }
}
