<script setup lang="ts">
import type { PersonalMediaModel } from '../../room/personal-media-model';
import PersonalControls from './PersonalControls.vue';
const props = defineProps<{ model: PersonalMediaModel }>();
const host = ref<HTMLElement>();
onMounted(async () => {
  await props.model.ready;
  if (host.value) await props.model.mount(host.value);
});
onUnmounted(() => props.model.player?.detach());
</script>
<template>
  <div
    class="personal-video"
    :data-personal-playing="model.state.playing"
    :data-personal-position="model.state.position"
  >
    <div ref="host" class="personal-provider" />
    <p v-if="model.state.loading" role="status">Opening your private player…</p>
    <PersonalControls :model="model" compact />
  </div>
</template>
<style scoped>
.personal-video {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  overflow: auto;
  min-width: 0;
}
.personal-provider {
  flex: 1;
  min-height: 200px;
  min-width: 200px;
}
.personal-video p {
  font-size: 12px;
  margin: 0;
}
</style>
