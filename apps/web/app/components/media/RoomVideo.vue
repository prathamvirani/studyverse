<script setup lang="ts">
import type { SharedVideoProvider, SharedVideoPlayer } from '@study/feature-sdk';
import { correctMediaDrift, effectiveMix, mediaPosition } from '@study/room-media/browser';
import type { RoomMediaModel } from '../../room/room-media-model';
const props = defineProps<{ model: RoomMediaModel; provider: SharedVideoProvider }>();
const host = ref<HTMLElement>(),
  message = ref('Press Enable YouTube to connect to the provider.'),
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
  if (!view || document.hidden || suspended || !props.model.clockReady()) {
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
    player.volume(effectiveMix(view.state.mix, props.model.state.local).music);
    correctMediaDrift(
      player,
      view.state,
      props.model.serverNow(),
      changed || version !== view.version,
    );
    version = view.version;
    observedPlaying.value = player.playing();
    observedPosition.value = player.position();
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
    message.value = 'Add a room video before enabling YouTube.';
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
          message.value =
            'Playback was blocked. Press Resume YouTube, or use the player Play button.';
          suspended = true;
        },
        ended: () => {
          message.value = 'Video ended. A room controller can select the next queue item.';
          suspended = true;
        },
      },
      initialId,
    );
    if (disposed) {
      result.destroy();
      return;
    }
    player = result;
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
  () => props.model.state.view?.state.current,
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
onMounted(() => {
  timer = setInterval(sync, 3000);
  document.addEventListener('visibilitychange', sync);
});
onUnmounted(() => {
  disposed = true;
  clearInterval(timer);
  document.removeEventListener('visibilitychange', sync);
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
    <button :disabled="loading" @click="enable">
      {{ loading ? 'Connecting…' : enabled ? 'Resume YouTube' : 'Enable YouTube' }}
    </button>
    <small v-if="enabled"
      >YouTube: {{ observedPlaying ? 'Playing' : 'Paused or buffering' }} ·
      {{ Math.floor(observedPosition) }}s</small
    >
    <small
      >Room playback · Streams directly from YouTube. Closing, minimizing or hiding this page pauses
      your player.</small
    >
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
