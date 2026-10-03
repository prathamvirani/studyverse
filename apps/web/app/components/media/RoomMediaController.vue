<script setup lang="ts">
import type { RoomMediaModel } from '../../room/room-media-model';
import { StudySlider } from '@study/ui';
const props = defineProps<{ model: RoomMediaModel }>();
const position = ref(0);
const track = computed(() => {
  const state = props.model.state.view?.state;
  return state?.current === null
    ? undefined
    : props.model.state.metadata[state?.queue[state?.current ?? -1] ?? ''];
});
function time(value: number) {
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}
</script>
<template>
  <section class="media-controller">
    <h2>Room media</h2>
    <p>{{ track?.title ?? 'Room playback' }}</p>
    <small>YouTube · Player stays in the room</small>
    <template v-if="model.state.view">
      <button
        :disabled="!model.state.view.canControl || model.state.busy || !model.connected()"
        @click="model.act({ type: model.state.view.state.playing ? 'pause' : 'play' })"
      >
        {{ model.state.view.state.playing ? 'Pause' : 'Play' }}
      </button>
      <form @submit.prevent="model.act({ type: 'seek', position })">
        <StudySlider
          v-model="position"
          label="Playback position"
          :min="0"
          :max="(track?.duration ?? model.state.diagnostics.duration) || 604800"
          :step="1"
          :disabled="!model.state.view.canControl || model.state.busy || !model.connected()"
        />
        <small>{{ time(position) }}</small>
        <button :disabled="!model.state.view.canControl || model.state.busy || !model.connected()">
          Seek
        </button>
      </form>
    </template>
    <p v-if="model.state.error" role="alert">{{ model.state.error }}</p>
  </section>
</template>
<style scoped>
.media-controller {
  padding: 16px;
  display: grid;
  gap: 12px;
}
.media-controller h2,
.media-controller p {
  margin: 0;
}
.media-controller form,
.media-controller label {
  display: grid;
  gap: 8px;
}
</style>
