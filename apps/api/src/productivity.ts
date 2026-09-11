import { fail, featureEnabled } from './module-support.ts';
import { productivityRooms } from '@study/rooms/server';
import { socialDirectory } from '@study/friends/server';
import { identityAccounts } from '@study/identity/server';
import { pomodoroModule } from '@study/pomodoro/server';
import { tasksModule } from '@study/tasks/server';
import { chatModule } from '@study/chat/server';
import type { Database } from '@study/feature-sdk';
export function productivityModules(
  db: Database,
  environment: Record<string, string | undefined> = {},
) {
  const social = socialDirectory(db),
    rooms = productivityRooms(db, social),
    people = identityAccounts(db);
  const enabled = (name: string) => featureEnabled(environment, name + '_ENABLED');
  return [
    pomodoroModule({ db, rooms, fail, enabled: enabled('POMODORO') }),
    tasksModule({ db, rooms, fail, enabled: enabled('TASKS') }),
    chatModule({ db, rooms, social, people, fail, enabled: enabled('CHAT') }),
  ];
}
