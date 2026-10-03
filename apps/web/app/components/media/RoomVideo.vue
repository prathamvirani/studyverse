<script setup lang="ts">
import type { SharedVideoProvider, SharedVideoPlayer } from '@study/feature-sdk';
import { correctMediaDrift, effectiveMix, mediaPosition } from '@study/room-media/browser';
import type { RoomMediaModel } from '../../room/room-media-model';
import { useDocumentVisibility } from '@vueuse/core';
const props = defineProps<{ model: RoomMediaModel; provider: SharedVideoProvider }>();
const visibility = useDocumentVisibility();
const host = ref<HTMLElement>(),
  message = ref(''),
  enabled = ref(false),
  loading = ref(false),
  observedPlaying = ref(false),
  observedPosition = ref(0);
let player: SharedVideoPlayer | undefined,
  timer: ReturnType<typeof setInterval> | undefined,
  disposed = false,
  content = '',
  version = -1,
  suspended = false;
function sync() {
  const view = props.model.state.view;
  if (!player) return;
  if (!view || visibility.value !== 'visible' || suspended || !props.model.clockReady()) {
    player.pause();
    observedPlaying.value = false;
    return;
  }
  const id = view.state.current === null ? null : view.state.queue[view.state.current];
  if (!id) {
    player.pause();
    observedPlaying.value = false;
    return;
  }
  try {
    const changed = content !== id;
    if (changed) {
      content = id;
      player.cue(id, mediaPosition(view.state, props.model.serverNow()));
      message.value = '';
    }
    player.volume(
      effectiveMix(props.model.state.previewMix ?? view.state.mix, props.model.state.local).music *
        props.model.state.duckMusicGain,
    );
    correctMediaDrift(
      player,
      view.state,
      props.model.serverNow(),
      changed || version !== view.version,
    );
    version = view.version;
    observedPlaying.value = player.playing();
    observedPosition.value = player.position();
    Object.assign(props.model.state.diagnostics, {
      playing: observedPlaying.value,
      position: observedPosition.value,
      duration: player.duration?.() ?? 0,
    });
  } catch {
    message.value = 'YouTube is unavailable. Retry or choose another video.';
    suspended = true;
  }
}
async function enable() {
  if (loading.value) return;
  suspended = false;
  if (player) {
    sync();
    return;
  }
  const view = props.model.state.view;
  const initialId =
    view?.state.current === null ? undefined : view?.state.queue[view?.state.current ?? -1];
  if (!initialId) {
    message.value = 'Add a room video first.';
    return;
  }
  loading.value = true;
  try {
    const result = await props.provider.mount(
      host.value!,
      {
        error: (text) => {
          message.value = text;
          suspended = true;
        },
        blocked: () => {
          message.value = 'Playback needs your permission. Press Play.';
          suspended = true;
        },
        ended: () => {
          message.value = 'Video ended. A room controller can select the next queue item.';
          suspended = true;
        },
        playback: (playing) => {
          const current = props.model.state.view;
          if (!current || playing === current.state.playing || props.model.state.busy) return;
          if (current.canControl) void props.model.act({ type: playing ? 'play' : 'pause' });
          else if (playing && !current.state.playing) {
            player?.pause();
            message.value = 'A room controller has paused playback.';
          }
        },
      },
      initialId,
    );
    if (disposed) {
      result.destroy();
      return;
    }
    player = result;
    props.model.state.diagnostics.mounts++;
    enabled.value = true;
    message.value = '';
    sync();
  } catch (e) {
    if (!disposed) message.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
watch(
  () => {
    const state = props.model.state.view?.state;
    return state?.current === null ? null : state?.queue[state?.current ?? -1];
  },
  () => {
    suspended = false;
    content = '';
  },
);
watch(
  () => props.model.state.view?.version,
  () => {
    suspended = false;
    sync();
  },
);
watch(() => props.model.state.local, sync, { deep: true });
watch(() => props.model.state.previewMix, sync, { deep: true });
watch(() => props.model.state.duckMusicGain, sync);
watch(visibility, sync, { flush: 'sync' });
onMounted(() => {
  if (props.model.state.videoIntent) void enable();
  timer = setInterval(sync, 3000);
});
onUnmounted(() => {
  disposed = true;
  clearInterval(timer);
  player?.destroy();
});
</script>
<template>
  <div
    class="room-video"
    :data-player-state="observedPlaying ? 'playing' : 'paused'"
    :data-player-position="observedPosition"
  >
    <div ref="host" class="youtube-host" />
    <p v-if="message" role="status">{{ message }}</p>
    <button v-if="!enabled || suspended" :disabled="loading || !model.connected()" @click="enable">
      {{ loading ? 'Connecting…' : 'Play' }}
    </button>
  </div>
</template>
<style scoped>
.room-video {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  overflow: auto;
  padding: 0.5rem;
}
.youtube-host {
  min-height: 200px;
  flex: 1;
}
p,
small {
  margin: 0;
  font-size: 0.75rem;
}
button {
  align-self: flex-start;
}
</style>
