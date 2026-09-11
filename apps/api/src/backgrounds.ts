import { fail, featureEnabled } from './module-support.ts';
import { productivityRooms } from '@study/rooms/server';
import { socialDirectory } from '@study/friends/server';
import { backgroundsModule } from '@study/backgrounds/server';
import type { Database } from '@study/feature-sdk';
export function backgroundsModules(
  db: Database,
  environment: Record<string, string | undefined> = {},
) {
  return [
    backgroundsModule({
      db,
      rooms: productivityRooms(db, socialDirectory(db)),
      fail,
      enabled: featureEnabled(environment, 'BACKGROUNDS_ENABLED'),
    }),
  ];
}
