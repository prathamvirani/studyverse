import { fail } from './module-support.ts';
import { identityAccounts } from '@study/identity/server';
import { roomDirectory } from '@study/rooms/server';
import { friendsModule, socialDirectory } from '@study/friends/server';
import { createPresence } from '@study/presence/server';
import type { Database, EphemeralStore, SessionStore } from '@study/feature-sdk';
export function socialComposition(
  db: Database,
  store: EphemeralStore,
  sessions: SessionStore,
  enabled = true,
) {
  const people = identityAccounts(db),
    social = socialDirectory(db),
    rooms = roomDirectory(db, social);
  const presence = createPresence({ store, sessions, people, social, rooms, fail, enabled });
  const modules = [
    friendsModule({ db, people, social, rooms, fail, enabled, presence: presence.directory }),
    presence.module,
  ];
  return { modules, occupancy: presence.occupancy };
}

export function socialModules(...args: Parameters<typeof socialComposition>) {
  return socialComposition(...args).modules;
}
