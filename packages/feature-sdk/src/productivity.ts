import type { Database } from './foundation.ts';
/** Rooms owns and rechecks membership and owner-block policy, optionally under transaction locks. */
export interface ProductivityRooms {
  role(
    userId: string,
    roomId: string,
    tx?: Database,
  ): Promise<'owner' | 'moderator' | 'member' | null>;
}
