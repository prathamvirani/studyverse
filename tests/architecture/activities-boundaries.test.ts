import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { createRoomComposition } from '../../apps/web/app/room/composition.ts';
import { registerActivities } from '../../apps/web/app/room/activities.ts';
it('disabled browser feature registers no owner, contribution, event listener or renderer', () => {
  const composition = createRoomComposition('Tester', () => {});
  const before = { ui: composition.ui.keys(), tiles: composition.tiles.keys() };
  const result = registerActivities(
    composition,
    crypto.randomUUID(),
    crypto.randomUUID(),
    {} as never,
    {} as never,
    false,
  );
  expect(result).toBeUndefined();
  expect(composition.ui.keys()).toEqual(before.ui);
  expect(composition.tiles.keys()).toEqual(before.tiles);
});
it('room and unrelated features preserve the generic activity boundary', async () => {
  for (const file of [
    'apps/web/app/components/room/RoomShell.vue',
    'apps/web/app/components/room/WorkspaceHost.vue',
    'apps/web/app/room/productivity.ts',
    'packages/features/pomodoro/src/browser.ts',
    'packages/features/pomodoro/src/server.ts',
    'packages/features/presence/src/server.ts',
    'packages/features/chat/src/server.ts',
    'apps/api/src/server.ts',
  ]) {
    const source = await readFile(file, 'utf8');
    expect(source, file).not.toMatch(
      /(?:import|from).*(@study\/activities|activities\/|letter-lantern|sketch-circle)/,
    );
  }
  for (const file of [
    'packages/features/activities/src/server.ts',
    'apps/web/app/room/activities-model.ts',
  ]) {
    expect(await readFile(file, 'utf8')).not.toMatch(
      /@study\/(pomodoro|presence|chat)\/(?:server|browser)/,
    );
  }
  expect(await readFile('apps/web/app/room/productivity.ts', 'utf8')).toContain(
    'timer.break.started',
  );
  expect(await readFile('apps/web/app/room/activities-model.ts', 'utf8')).toContain(
    "events.subscribe('timer.break.started'",
  );
});
