import type { PresenceView, Privacy } from '@study/contracts';
import type { Database } from './foundation.ts';
export interface ReferralAttribution {
  resolve(token: string): Promise<string | null>;
  landing(token: string, key: string): Promise<void>;
  signup(linkId: string, subjectId: string, tx: Database): Promise<void>;
  conversion(linkId: string, subjectId: string, eventKey: string): Promise<void>;
}

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
  ): Promise<{ id: string; name: string; joinable: boolean; address?: string } | null>;
}
export interface PeopleDirectory {
  search?(query: string): Promise<{ id: string; name: string; username: string }[]>;
  person(id: string): Promise<{ id: string; name: string; username?: string | null } | null>;
  byUsername?(
    username: string,
    tx?: Database,
  ): Promise<{ id: string; name: string; username: string } | null>;
}
export interface PresenceDirectory {
  view(viewer: string, target: string): Promise<PresenceView | null>;
  roomSummaries?(
    viewer: string,
  ): Promise<Record<string, { onlineCount: number; friendsHere: number; friendsStudying: number }>>;
}
/** Called only after Rooms authorizes the room; returns curated identity, never local uploads. */
export interface RoomBackgroundPreview {
  preview(roomId: string): Promise<string | null>;
}
