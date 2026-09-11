import { backgroundsDefinition } from '@study/backgrounds/server';
import { pomodoroDefinition } from '@study/pomodoro/server';
import { tasksDefinition } from '@study/tasks/server';
import { chatDefinition } from '@study/chat/server';
import { readFile } from 'node:fs/promises';
import { identityDefinition } from '@study/identity/server';
import { roomsDefinition } from '@study/rooms/server';
import { friendsDefinition } from '@study/friends/server';
import { migrationManifest } from './migration-manifest.ts';

export async function applicationMigrationManifest() {
  const modules = await Promise.all(
    [
      identityDefinition,
      roomsDefinition,
      friendsDefinition,
      pomodoroDefinition,
      tasksDefinition,
      chatDefinition,
      backgroundsDefinition,
    ].map(async (definition) => ({
      ...definition,
      migrations: [
        {
          owner: definition.id,
          id: `0001_${definition.id}`,
          sql: await readFile(
            `packages/features/${definition.id}/migrations/0001_${definition.id}.sql`,
            'utf8',
          ),
        },
        ...(['pomodoro', 'tasks'].includes(definition.id)
          ? [
              {
                owner: definition.id,
                id: definition.id === 'pomodoro' ? '0002_personal_timers' : '0002_separate_scopes',
                sql: await readFile(
                  `packages/features/${definition.id}/migrations/${definition.id === 'pomodoro' ? '0002_personal_timers' : '0002_separate_scopes'}.sql`,
                  'utf8',
                ),
              },
            ]
          : []),
        ...(definition.id === 'rooms'
          ? [
              {
                owner: 'rooms',
                id: '0002_friend_invites',
                sql: await readFile(
                  'packages/features/rooms/migrations/0002_friend_invites.sql',
                  'utf8',
                ),
              },
            ]
          : []),
      ],
    })),
  );
  return migrationManifest(modules);
}
