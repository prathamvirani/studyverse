import { defineComponent, h } from 'vue';
import { layoutSchema } from '@study/contracts';
import type { AudioEffects } from '@study/feature-sdk';
import type { RoomComposition } from './composition.ts';
import type { RealtimeClient } from '../lib/realtime.ts';
import { createActivitiesModel } from './activities-model.ts';
export function registerActivities(
  composition: RoomComposition,
  roomId: string,
  userId: string,
  realtime: RealtimeClient,
  audio: AudioEffects,
  enabled = true,
) {
  if (!enabled) return undefined;
  const model = createActivitiesModel(roomId, userId, realtime, composition.events, audio),
    disposes: (() => void)[] = [];
  const renderer = async () => {
    const C = (await import('../components/activities/ActivityPanel.vue')).default;
    return defineComponent({ setup: () => () => h(C, { model }) });
  };
  disposes.push(
    composition.tiles.register('activities.panel', {
      type: 'activities.panel',
      label: 'Break activities',
      defaultSize: { width: 440, height: 470 },
      minimumSize: { width: 220, height: 300 },
      resizable: true,
      fullscreenable: true,
      workspaceCard: true,
      openByDefault: false,
      persist: false,
      layoutSchema,
      load: renderer,
    }),
  );
  const open = () => {
    model.state.suggestion = false;
    const tile =
      composition.workspace.values().find((item) => item.type === 'activities.panel') ??
      composition.workspace.open('activities.panel', 'room');
    composition.workspace.update(tile.id, { ...tile.layout, minimized: false });
    composition.workspace.focus(tile.id);
    composition.state.refresh();
    composition.state.more = false;
    composition.state.closeSettings();
  };
  disposes.push(
    composition.ui.register('activities.open', {
      id: 'activities.open',
      point: 'roomMoreMenu',
      order: 30,
      label: 'Break activities',
      load: async () =>
        defineComponent({ setup: () => () => h('button', { onClick: open }, 'Break activities') }),
    }),
  );
  disposes.push(
    composition.ui.register('activities.suggestion', {
      id: 'activities.suggestion',
      point: 'notifications',
      order: 20,
      label: 'Optional break activity',
      load: async () => {
        const C = (await import('../components/activities/ActivitySuggestion.vue')).default;
        return defineComponent({ setup: () => () => h(C, { model, open }) });
      },
    }),
  );
  disposes.push(
    composition.ui.register('activities.mixer', {
      id: 'activities.mixer',
      point: 'mediaMixer',
      order: 30,
      label: 'Activity SFX',
      load: async () => {
        const C = (await import('../components/activities/ActivityPreferences.vue')).default;
        return defineComponent({ setup: () => () => h(C, { model }) });
      },
    }),
  );
  return {
    model,
    open,
    dispose() {
      model.dispose();
      for (const dispose of disposes) dispose();
    },
  };
}
