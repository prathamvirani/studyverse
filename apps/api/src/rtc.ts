import { identityAccounts } from '@study/identity/server';
import { randomUUID } from 'node:crypto';
import { z } from '@study/contracts';
import { AppError } from '@study/core/server';
import { fail, featureEnabled } from './module-support.ts';
import { rtcModule } from '@study/rtc/server';
import { productivityRooms } from '@study/rooms/server';
import { socialDirectory } from '@study/friends/server';
import { liveKitAuthority } from '@study/adapters/livekit/server';
import type { Database, MediaAuthority, SessionStore } from '@study/feature-sdk';
export function rtcModules(
  db: Database,
  sessions: SessionStore,
  environment: Record<string, string | undefined> = {},
) {
  const enabled = featureEnabled(environment, 'RTC_ENABLED', false);
  let authority: MediaAuthority = {
    enforcement: { scopedGrants: false },
    issue: async () => {
      throw new AppError('UNAVAILABLE');
    },
    remove: async () => {},
  };
  // Keep configured removal authority alive when admission is disabled, so previously
  // issued credentials cannot escape cleanup merely by restarting with the flag off.
  if (
    enabled ||
    environment.LIVEKIT_URL ||
    environment.LIVEKIT_API_KEY ||
    environment.LIVEKIT_API_SECRET
  ) {
    const config = z
      .strictObject({
        url: z.url(),
        serviceUrl: z.url().optional(),
        roomPrefix: z.string().optional(),
        apiKey: z.string().min(1),
        apiSecret: z.string().min(32),
      })
      .parse({
        url: environment.LIVEKIT_URL,
        serviceUrl: environment.LIVEKIT_SERVICE_URL,
        roomPrefix: environment.LIVEKIT_ROOM_PREFIX,
        apiKey: environment.LIVEKIT_API_KEY,
        apiSecret: environment.LIVEKIT_API_SECRET,
      });
    authority = liveKitAuthority(config);
  }
  return [
    rtcModule({
      authority,
      rooms: productivityRooms(db, socialDirectory(db)),
      people: identityAccounts(db),
      blocked: socialDirectory(db).blocked,
      sessions,
      enabled,
      uuid: randomUUID,
      fail,
    }),
  ];
}
