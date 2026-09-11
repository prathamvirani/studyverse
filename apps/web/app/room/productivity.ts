import { defineComponent, h } from 'vue';
import type { UiRegistry } from '@study/core/browser';
import { createRealtimeClient } from '../lib/realtime';
export function registerProductivity(
  ui: UiRegistry,
  roomId: string,
  realtime = createRealtimeClient(),
) {
  const panels = [
    ['pomodoro', 'Pomodoro', () => import('../components/productivity/PomodoroPanel.vue')],
    ['tasks', 'Tasks', () => import('../components/productivity/TasksPanel.vue')],
    ['chat', 'Chat', () => import('../components/productivity/ChatPanel.vue')],
  ] as const;
  panels.forEach(([id, label, load], index) =>
    ui.register(id + '.panel', {
      id: id + '.panel',
      point: 'rightRail',
      order: (index + 1) * 10,
      label,
      load: async () => {
        const Component = (await load()).default;
        return defineComponent({ setup: () => () => h(Component, { roomId, realtime }) });
      },
    }),
  );
  realtime.start();
  return () => realtime.stop();
}
