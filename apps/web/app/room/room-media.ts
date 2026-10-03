import { defineComponent, h } from 'vue';
import { layoutSchema } from '@study/contracts';
import { youtubeProvider } from '@study/adapters/youtube/browser';
import type { RoomComposition } from './composition';
import type { RealtimeClient } from '../lib/realtime';
import { createRoomMediaModel } from './room-media-model';
export function registerRoomMedia(
  composition: RoomComposition,
  roomId: string,
  userId: string,
  realtime: RealtimeClient,
) {
  const model = createRoomMediaModel(roomId, userId, realtime),
    type = 'room-media.youtube';
  composition.tiles.register(type, {
    type,
    label: 'Room YouTube',
    minimumSize: { width: 240, height: 300 },
    defaultSize: { width: 480, height: 370 },
    resizable: true,
    fullscreenable: true,
    persist: false,
    retainOnMinimize: true,
    // YouTube forbids hidden background players. Collapse the same visible embed instead.
    minimizedPresentation: { width: 280, height: 286 },
    layoutSchema,
    loadPopout: async () => {
      const C = (await import('../components/media/RoomMediaController.vue')).default;
      return defineComponent({ setup: () => () => h(C, { model }) });
    },
    load: async () => {
      const C = (await import('../components/media/RoomVideo.vue')).default;
      return defineComponent({ setup: () => () => h(C, { model, provider: youtubeProvider }) });
    },
  });
  const openVideo = () => {
    model.state.videoIntent = true;
    const tile = composition.workspace.open(type, 'room');
    composition.workspace.update(tile.id, { ...tile.layout, minimized: false });
    composition.workspace.focus(tile.id);
    composition.state.refresh();
    model.close();
  };
  composition.ui.register('room-media.dock', {
    id: 'room-media.dock',
    point: 'bottomDock',
    order: 0,
    label: 'Media',
    load: async () => {
      const C = (await import('../components/media/RoomMediaPanel.vue')).default;
      return defineComponent({ setup: () => () => h(C, { model, openVideo, ui: composition.ui }) });
    },
  });
  composition.ui.register('room-media.settings', {
    id: 'room-media.settings',
    point: 'roomSettings',
    order: 5,
    label: 'Room media settings',
    load: async () =>
      defineComponent({
        props: { category: String },
        setup: (props) => () =>
          props.category === 'Diagnostics'
            ? h('div', [
                h('h4', 'YouTube synchronization'),
                h(
                  'p',
                  `Player mounts: ${model.state.diagnostics.mounts}; provider ${model.state.diagnostics.playing ? 'playing' : 'paused'}; position ${Math.floor(model.state.diagnostics.position)}s; authority version ${model.state.view?.version ?? 'unavailable'}`,
                ),
              ])
            : props.category === 'Media & Devices'
              ? h(
                  'button',
                  {
                    onClick: () => {
                      model.state.advanced = true;
                    },
                  },
                  'Queue, mix & media permissions',
                )
              : null,
      }),
  });
  void model.init().catch(() => {
    model.state.error = 'Room media is unavailable.';
  });
  return model;
}
