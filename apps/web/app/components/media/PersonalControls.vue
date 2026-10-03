<script setup lang="ts">
import { StudySlider, StudySelect, Play, Pause } from '@study/ui';
import type { PersonalMediaModel } from '../../room/personal-media-model';
const props = defineProps<{ model: PersonalMediaModel; compact?: boolean }>();
const state = props.model.state;
const seeking = ref<number>();
function time(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function seek() {
  if (seeking.value !== undefined) props.model.player?.seek(seeking.value);
  seeking.value = undefined;
}
</script>
<template>
  <section class="personal-controls" :class="{ compact }" aria-label="Personal playback controls">
    <div class="personal-transport">
      <button
        :aria-label="state.playing ? 'Pause personal' : 'Play personal'"
        :disabled="state.loading || !state.current"
        @click="state.playing ? model.player?.pause() : model.play()"
      >
        <Pause v-if="state.playing" :size="20" aria-hidden="true" /><Play
          v-else
          :size="20"
          aria-hidden="true"
        />
        <span>{{ state.playing ? 'Pause' : 'Play' }}</span>
      </button>
      <small
        >{{ time(state.position) }} / {{ state.duration > 0 ? time(state.duration) : '—' }}</small
      >
      <button v-if="!compact" class="secondary" @click="model.openTile()">
        Show personal video
      </button>
    </div>
    <div v-if="state.resumePrompt && !compact" class="personal-resume">
      <p>Resume from {{ time(state.position) }}?</p>
      <button @click="model.play()">Resume</button
      ><button class="secondary" @click="model.play(true)">Start over</button>
    </div>
    <StudySlider
      v-if="state.duration > 0 && state.canSeek"
      label="Personal playback position"
      :model-value="seeking ?? state.position"
      :min="0"
      :max="state.duration"
      :step="1"
      :disabled="state.loading"
      @update:model-value="seeking = Number($event)"
      @change="seek"
    />
    <div class="personal-volume">
      <StudySlider
        label="Personal volume"
        :model-value="state.data.volume"
        :min="0"
        :max="1"
        :step="0.01"
        @update:model-value="model.player?.preferences({ volume: Number($event) })"
      />
      <button
        :aria-pressed="state.data.muted"
        :aria-label="state.data.muted ? 'Unmute personal' : 'Mute personal'"
        @click="model.player?.preferences({ muted: !state.data.muted })"
      >
        {{ state.data.muted ? 'Unmute' : 'Mute' }}
      </button>
    </div>
    <StudySelect
      v-if="!compact && state.rates.length > 1"
      label="Personal speed"
      :model-value="String(state.current?.rate ?? 1)"
      :options="state.rates.map((rate) => ({ value: String(rate), label: rate + '×' }))"
      @update:model-value="model.player?.rate(Number($event))"
    />
    <p v-if="state.error" role="status">{{ state.error }}</p>
  </section>
</template>
<style scoped>
.personal-controls {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}
.personal-transport,
.personal-volume,
.personal-resume {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.personal-volume > :first-child {
  flex: 1;
  min-width: 120px;
}
.personal-controls button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
}
.personal-transport small {
  margin-left: auto;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
p {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}
.personal-resume p {
  flex-basis: 100%;
}
.compact {
  gap: 4px;
}
.compact :deep(.ui-slider) {
  margin: 0;
}
</style>
