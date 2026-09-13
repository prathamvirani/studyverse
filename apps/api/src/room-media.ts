import { roomMediaModule } from '@study/room-media/server';
import { productivityRooms } from '@study/rooms/server';
import { socialDirectory } from '@study/friends/server';
import { identityAccounts } from '@study/identity/server';
import type { Database, RoomOccupancy } from '@study/feature-sdk';
import { fail, featureEnabled } from './module-support.ts';
export function roomMediaModules(
  db: Database,
  occupancy: RoomOccupancy,
  environment: Record<string, string | undefined> = {},
) {
  const social = socialDirectory(db);
  return [
    roomMediaModule({
      db,
      occupancy,
      rooms: productivityRooms(db, social),
      social,
      people: identityAccounts(db),
      fail,
      enabled:
        featureEnabled(environment, 'ROOM_MEDIA_ENABLED') &&
        featureEnabled(environment, 'SOCIAL_ENABLED'),
    }),
  ];
}
