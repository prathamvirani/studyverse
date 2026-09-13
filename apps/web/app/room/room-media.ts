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
    layoutSchema,
    load: async () => {
      const C = (await import('../components/media/RoomVideo.vue')).default;
      return defineComponent({ setup: () => () => h(C, { model, provider: youtubeProvider }) });
    },
  });
  const openVideo = () => {
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
      return defineComponent({ setup: () => () => h(C, { model, openVideo }) });
    },
  });
  void model.init().catch(() => {
    model.state.error = 'Room media is unavailable.';
  });
  return model;
}
