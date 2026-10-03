import { defineComponent, h } from 'vue';
import { layoutSchema } from '@study/contracts';
import type { UiRegistry, TileRegistry } from '@study/core/browser';
import { createRealtimeClient } from '../lib/realtime';
export function registerProductivity(
  ui: UiRegistry,
  roomId: string,
  realtime = createRealtimeClient(),
  tiles?: TileRegistry,
) {
  const panels = [
    ['pomodoro', 'Pomodoro', () => import('../components/productivity/PomodoroPanel.vue')],
    ['tasks', 'Tasks', () => import('../components/productivity/TasksPanel.vue')],
    ['chat', 'Chat', () => import('../components/productivity/ChatPanel.vue')],
  ] as const;
  panels.forEach(([id, label, load], index) => {
    const renderer = async () => {
      const Component = (await load()).default;
      return defineComponent({ setup: () => () => h(Component, { roomId, realtime }) });
    };
    if (tiles)
      tiles.register(id + '.panel', {
        type: id + '.panel',
        label,
        load: renderer,
        workspaceCard: true,
        defaultSize: { width: 320, height: 300 },
        minimumSize: { width: 220, height: id === 'pomodoro' ? 260 : 200 },
        resizable: true,
        fullscreenable: true,
        layoutSchema,
      });
    else
      ui.register(id + '.panel', {
        id: id + '.panel',
        point: 'rightRail',
        order: (index + 1) * 10,
        label,
        load: renderer,
      });
  });
  tiles?.register('clock.panel', {
    type: 'clock.panel',
    label: 'Clock',
    workspaceCard: true,
    defaultSize: { width: 320, height: 180 },
    minimumSize: { width: 200, height: 160 },
    resizable: true,
    fullscreenable: true,
    layoutSchema,
    load: async () => (await import('../components/productivity/ClockPanel.vue')).default,
  });
  realtime.start();
  return () => realtime.stop();
}
