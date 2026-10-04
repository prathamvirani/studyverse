import { activitiesModule } from '@study/activities/server';
import { productivityRooms } from '@study/rooms/server';
import { socialDirectory } from '@study/friends/server';
import { identityAccounts } from '@study/identity/server';
import type { Database, RoomOccupancy } from '@study/feature-sdk';
import { fail, featureEnabled } from './module-support.ts';
export function activityModules(
  db: Database,
  occupancy: RoomOccupancy,
  environment: Record<string, string | undefined> = {},
) {
  const social = socialDirectory(db);
  return [
    activitiesModule({
      db,
      occupancy,
      social,
      rooms: productivityRooms(db, social),
      people: identityAccounts(db),
      fail,
      enabled:
        featureEnabled(environment, 'ACTIVITIES_ENABLED') &&
        featureEnabled(environment, 'SOCIAL_ENABLED'),
    }),
  ];
}
