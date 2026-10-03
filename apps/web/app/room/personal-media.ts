import { defineComponent, h } from 'vue';
import { layoutSchema } from '@study/contracts';
import { personalYoutubeAdapter } from '@study/adapters/youtube/personal';
import { personalVimeoAdapter } from '@study/adapters/vimeo/browser';
import { directMediaAdapter } from '@study/adapters/direct-media/browser';
import type { RoomComposition } from './composition';
import type { RoomMediaModel } from './room-media-model';
import { createPersonalMediaModel } from './personal-media-model';
import { personalMediaSession } from '../lib/personal-media-session';

export function registerPersonalMedia(
  composition: RoomComposition,
  userId: string,
  room: RoomMediaModel,
  activity: () => { available: boolean; speaking: boolean },
  enabled = true,
) {
  if (!enabled) return undefined;
  const model = createPersonalMediaModel(
      userId,
      [personalYoutubeAdapter, personalVimeoAdapter, directMediaAdapter(location.origin)],
      (gain) => {
        room.state.duckMusicGain = gain;
      },
    ),
    type = 'personal-media.player';
  let disposed = false,
    restored = false;
  composition.tiles.register(type, {
    type,
    label: 'Personal Study Player',
    minimumSize: { width: 240, height: 370 },
    defaultSize: { width: 520, height: 450 },
    resizable: true,
    fullscreenable: true,
    persist: false,
    retainOnMinimize: true,
    minimizedPresentation: { width: 280, height: 370 },
    layoutSchema,
    onLayoutChange(_id, layout) {
      if (restored) model.player?.tile(layout);
    },
    onClose() {
      model.cancelPlay();
      model.player?.detach();
    },
    load: async () => {
      const C = (await import('../components/media/PersonalVideo.vue')).default;
      return defineComponent({ setup: () => () => h(C, { model }) });
    },
    loadPopout: async () => {
      const C = (await import('../components/media/PersonalControls.vue')).default;
      return defineComponent({ setup: () => () => h(C, { model }) });
    },
  });
  model.openTile = () => {
    if (disposed || !model.state.current) return;
    const tile = composition.workspace.open(type, 'private');
    if (!restored && model.state.data.tile) {
      const layout = model.state.data.tile;
      // Host reflow then constrains restored coordinates against its actual viewport/obstacles.
      composition.workspace.update(tile.id, {
        ...layout,
        width: Math.max(240, layout.width),
        height: Math.max(370, layout.height),
        minimized: false,
        fullscreen: false,
      });
    }
    restored = true;
    composition.workspace.update(tile.id, { ...tile.layout, minimized: false });
    // An explicit open uses the existing fullscreen presentation on compact phones.
    if (window.innerWidth <= 360)
      composition.workspace.update(tile.id, { ...tile.layout, fullscreen: true });
    composition.workspace.focus(tile.id);
    composition.state.refresh();
    room.close();
  };
  model.closeTile = () => {
    model.cancelPlay();
    const tile = composition.workspace.values().find((item) => item.type === type);
    if (tile) composition.workspace.close(tile.id);
    composition.state.refresh();
  };
  model.canPromote = () => !!model.player?.roomItem() && !!room.state.view && room.connected();
  model.promotionLabel = () => (room.state.view?.canControl ? 'Play for room' : 'Suggest to room');
  model.promote = async () => {
    const item = model.player?.roomItem();
    if (!item || !model.canPromote()) return false;
    // Existing server membership/roles/version/epoch/strict schema remain the authority.
    const accepted = await room.act(
      { type: 'enqueue-play', videoId: item.videoId },
      !room.state.view?.canControl,
    );
    if (!accepted)
      model.state.error =
        'The room could not accept this item. Your access or its state may have changed.';
    return accepted;
  };
  composition.ui.register('personal-media.panel', {
    id: 'personal-media.panel',
    point: 'mediaPanel',
    order: 0,
    label: 'Personal media',
    load: async () => {
      const C = (await import('../components/media/PersonalMediaPanel.vue')).default;
      return defineComponent({ setup: () => () => h(C, { model }) });
    },
  });
  const platform = personalMediaSession({
    play: () => model.play(),
    pause: () => model.player?.pause(),
    seek: (position) => model.player?.seek(position),
  });
  const tick = () => {
    const voice = activity();
    model.player?.activity(voice.available, voice.speaking);
    model.player?.tick();
    platform.update({
      attached: model.state.attached,
      playing: model.state.playing,
      position: model.state.position,
      duration: model.state.duration,
      title: model.state.current?.title ?? 'Study Player',
      rate: model.state.current?.rate ?? 1,
    });
  };
  const timer = setInterval(tick, 200);
  const hide = () => {
    if (document.visibilityState === 'hidden') {
      model.player?.pause();
      void model.player?.flush();
    }
  };
  const finalProgress = () => {
    model.player?.pause();
    void model.player?.flush();
  };
  document.addEventListener('visibilitychange', hide);
  window.addEventListener('pagehide', finalProgress);
  return {
    model,
    async dispose() {
      if (disposed) return;
      disposed = true;
      clearInterval(timer);
      platform.clear();
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', finalProgress);
      model.closeTile();
      await model.dispose();
      room.state.duckMusicGain = 1;
    },
  };
}
