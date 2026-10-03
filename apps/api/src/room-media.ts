import { roomMediaModule } from '@study/room-media/server';
import { productivityRooms } from '@study/rooms/server';
import { socialDirectory } from '@study/friends/server';
import { identityAccounts } from '@study/identity/server';
import type { Database, RoomOccupancy, MediaMetadataResolver } from '@study/feature-sdk';
import { createYouTubeMetadataResolver } from '@study/adapters/youtube/server';
import { fail, featureEnabled } from './module-support.ts';
export function roomMediaModules(
  db: Database,
  occupancy: RoomOccupancy,
  environment: Record<string, string | undefined> = {},
  accountEvents = false,
  metadata: MediaMetadataResolver = createYouTubeMetadataResolver(),
) {
  const social = socialDirectory(db);
  return [
    roomMediaModule({
      db,
      metadata,
      accountEvents,
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
