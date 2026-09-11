import type { PresenceView, Privacy } from '@study/contracts';
import type { Database } from './foundation.ts';

export interface SocialDirectory {
  blocked(a: string, b: string, db?: Database): Promise<boolean>;
  friends(a: string, b: string, db?: Database): Promise<boolean>;
  privacy(id: string, db?: Database): Promise<Privacy>;
}
export interface RoomDirectory {
  revokeInvites?(a: string, b: string, db: Database): Promise<void>;
  member(userId: string, roomId: string): Promise<boolean>;
  shared(a: string, b: string): Promise<boolean>;
  current(
    viewer: string,
    roomId: string,
  ): Promise<{ id: string; name: string; joinable: boolean } | null>;
}
export interface PeopleDirectory {
  person(id: string): Promise<{ id: string; name: string } | null>;
}
export interface PresenceDirectory {
  view(viewer: string, target: string): Promise<PresenceView | null>;
}
