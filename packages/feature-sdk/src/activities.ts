import type { ActivityAction, ActivityOptions, ActivityView } from '@study/contracts';
import type { PreferenceDefinition } from './foundation.ts';

export interface ActivityMember {
  id: string;
  mode: 'participant' | 'spectator';
  score: number;
}
export interface ActivitySession {
  id: string;
  kind: string;
  creator: string;
  version: number;
  state: 'lobby' | 'active' | 'transition' | 'completed' | 'cancelled';
  round: number;
  deadline: number | null;
  options: ActivityOptions;
  members: ActivityMember[];
  declined: string[];
  reports: string[];
  /** Private definition-owned state, never returned directly over a transport. */
  privateState: unknown;
}
export interface ActivityDefinition {
  id: string;
  name: string;
  description: string;
  min: number;
  max: number;
  spectators: boolean;
  /** Definitions own rules; the host owns membership, permissions and serialization. */
  begin(session: ActivitySession, now: number): void;
  act(session: ActivitySession, actor: string, action: ActivityAction, now: number): void;
  tick(session: ActivitySession, now: number): void;
  left(session: ActivitySession, actor: string, now: number): void;
  project(session: ActivitySession, viewer: string): NonNullable<ActivityView['activity']>['data'];
}
export interface AudioEffects {
  enable(): Promise<void>;
  effect(frequency: number, volume: number): void;
}
export type ActivityPreference = PreferenceDefinition<{
  suggestions: boolean;
  volume: number;
  muted: boolean;
}>;
