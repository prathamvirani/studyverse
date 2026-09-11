import { defineComponent, h } from 'vue';
import type { UiRegistry } from '@study/core/browser';
import type { RealtimeClient } from '../lib/realtime';
import { createBackgroundModel } from './background-model';
export function registerBackgrounds(
  ui: UiRegistry,
  roomId: string,
  userId: string,
  realtime: RealtimeClient,
) {
  const model = createBackgroundModel(roomId, userId, realtime);
  ui.register('backgrounds.environment', {
    id: 'backgrounds.environment',
    point: 'environment',
    order: 0,
    label: 'Visual environment',
    load: async () => {
      const C = (await import('../components/backgrounds/EnvironmentSurface.vue')).default;
      return defineComponent({ setup: () => () => h(C, { model }) });
    },
  });
  ui.register('backgrounds.dock', {
    id: 'backgrounds.dock',
    point: 'bottomDock',
    order: 1,
    label: 'Background',
    load: async () => {
      const C = (await import('../components/backgrounds/BackgroundSelector.vue')).default;
      return defineComponent({ setup: () => () => h(C, { model }) });
    },
  });
  return model;
}
