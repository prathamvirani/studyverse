<script setup lang="ts">
import type { ActivitiesModel } from '../../room/activities-model';
const props = defineProps<{ model: ActivitiesModel }>();
function update(key: 'suggestions' | 'muted' | 'volume', value: boolean | number) {
  props.model.preferences({ ...props.model.state.preferences, [key]: value });
}
</script>
<template>
  <section class="activity-preferences" aria-label="Activity preferences">
    <h3>Activity SFX</h3>
    <label
      ><input
        type="checkbox"
        :checked="model.state.preferences.muted"
        @change="update('muted', ($event.target as HTMLInputElement).checked)"
      />Mute activity sounds</label
    >
    <label
      >Activity SFX volume<input
        aria-label="Activity SFX volume"
        type="range"
        min="0"
        max="1"
        step="0.05"
        :value="model.state.preferences.volume"
        @input="update('volume', Number(($event.target as HTMLInputElement).value))"
    /></label>
    <button @click="model.preview()">Preview activity sound</button>
    <label
      ><input
        type="checkbox"
        :checked="model.state.preferences.suggestions"
        @change="update('suggestions', ($event.target as HTMLInputElement).checked)"
      />Suggest activities during breaks</label
    >
    <p class="muted">Saved on this device. Playing is always optional.</p>
  </section>
</template>
<style scoped>
.activity-preferences {
  display: grid;
  gap: 0.7rem;
}
label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
input[type='range'] {
  flex: 1;
  min-width: 100px;
}
</style>
