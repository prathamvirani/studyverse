<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Settings, SettingsSheet, SegmentedControl, StudySlider } from '@study/ui';
import { createPreferenceStore } from '@study/adapters/indexeddb';
import {
  clockAppearanceSchema,
  clockAppearancePreference,
  clockGreeting,
} from '../../lib/clock-appearance';
import TimeDisplay from './TimeDisplay.vue';
const { profile } = useAccount();
const preference = clockAppearancePreference(profile.value?.id ?? 'device');
const display = ref(clockAppearanceSchema.parse({}));
const now = ref<Date>();
const settings = ref(false);
const styles = [
  { value: 'bold', label: 'Bold' },
  { value: 'light', label: 'Light' },
  { value: 'soft', label: 'Soft' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'serif', label: 'Serif' },
  { value: 'digital', label: 'Digital' },
] as const;
let store: Awaited<ReturnType<typeof createPreferenceStore>> | undefined;
let disposed = false,
  changed = false;
let queue = Promise.resolve();
let tick: ReturnType<typeof setInterval> | undefined;
watch(
  display,
  () => {
    changed = true;
    const value = clockAppearanceSchema.parse(display.value);
    queue = queue
      .then(() => store?.set(preference, value))
      .then(() => {})
      .catch(() => {});
  },
  { deep: true },
);
onMounted(() => {
  now.value = new Date();
  tick = setInterval(() => {
    now.value = new Date();
  }, 1000);
  void createPreferenceStore([preference]).then(async (created) => {
    if (disposed) {
      await created.close();
      return;
    }
    store = created;
    const saved = await created.get(preference);
    if (!disposed && !changed) display.value = saved;
    else if (!disposed) await created.set(preference, clockAppearanceSchema.parse(display.value));
  });
});
onUnmounted(() => {
  disposed = true;
  clearInterval(tick);
  void queue.finally(() => store?.close());
});
const digits = computed(() => {
  if (!now.value) return '--:--';
  const hour =
    display.value.format === '12' ? now.value.getHours() % 12 || 12 : now.value.getHours();
  return [hour, now.value.getMinutes(), ...(display.value.seconds ? [now.value.getSeconds()] : [])]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
});
const greeting = computed(() => (now.value ? clockGreeting(now.value, display.value.dynamic) : ''));
</script>
<template>
  <div
    class="room-clock"
    :data-clock-style="display.style"
    :style="{ '--clock-scale': display.scale }"
  >
    <button
      class="clock-settings-button"
      aria-label="Clock settings"
      title="Clock settings"
      @click="settings = true"
    >
      <Settings :size="16" aria-hidden="true" />
    </button>
    <small v-if="display.greeting" class="clock-greeting">{{ greeting }}</small>
    <time
      :datetime="now?.toISOString()"
      :aria-label="`Current time ${digits}${display.format === '12' && now ? (now.getHours() < 12 ? ' AM' : ' PM') : ''}`"
    >
      <TimeDisplay :text="digits" :style="display.flip ? 'flip' : 'default'" />
      <small v-if="display.format === '12' && now" class="clock-period">{{
        now.getHours() < 12 ? 'AM' : 'PM'
      }}</small>
    </time>
    <small v-if="now" class="clock-date">{{
      now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
    }}</small>
    <SettingsSheet v-model:open="settings" title="Clock settings">
      <div class="clock-options">
        <SegmentedControl
          v-model="display.format"
          label="Clock format"
          :options="[
            { value: '12', label: '12-hour' },
            { value: '24', label: '24-hour' },
          ]"
        />
        <label class="checkbox-row"
          ><input v-model="display.seconds" type="checkbox" />Show seconds</label
        >
        <label class="checkbox-row"
          ><input v-model="display.flip" type="checkbox" />Flip clock</label
        >
        <label class="checkbox-row"
          ><input v-model="display.greeting" type="checkbox" />Show greeting</label
        >
        <label class="checkbox-row"
          ><input v-model="display.dynamic" type="checkbox" :disabled="!display.greeting" />Dynamic
          greeting</label
        >
        <fieldset class="clock-style-options">
          <legend>Clock style</legend>
          <button
            v-for="choice in styles"
            :key="choice.value"
            type="button"
            :data-clock-style="choice.value"
            :aria-pressed="display.style === choice.value"
            @click="display.style = choice.value"
          >
            <span class="clock-style-preview" aria-hidden="true">09:41</span
            ><span>{{ choice.label }}</span>
          </button>
        </fieldset>
        <StudySlider
          v-model="display.scale"
          label="Clock scale"
          :min="0.7"
          :max="1.6"
          :step="0.1"
        />
        <p>Clock appearance is saved on this device. It follows your local time.</p>
      </div>
    </SettingsSheet>
  </div>
</template>
<style scoped>
.room-clock {
  position: relative;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
  padding: var(--space-2);
  container-type: inline-size;
}
.room-clock time {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.15em;
  font-size: clamp(20px, calc(14cqi * var(--clock-scale)), 80px);
  font-weight: 600;
  white-space: nowrap;
  max-width: 100%;
}
.clock-settings-button {
  position: absolute;
  top: 0;
  right: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  display: grid;
  place-items: center;
  background: transparent;
  border: 0;
}
.clock-greeting,
.clock-date {
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 400;
}
.clock-period {
  font-family: var(--font-ui);
  font-size: 0.25em;
}
.room-clock[data-clock-style='light'] > time,
button[data-clock-style='light'] > .clock-style-preview {
  font-weight: 300;
}
.room-clock[data-clock-style='soft'] > time,
button[data-clock-style='soft'] > .clock-style-preview {
  font-weight: 500;
  letter-spacing: -0.04em;
}
.room-clock[data-clock-style='minimal'] > time,
button[data-clock-style='minimal'] > .clock-style-preview {
  font-weight: 400;
  letter-spacing: -0.06em;
}
.room-clock[data-clock-style='serif'] > time,
button[data-clock-style='serif'] > .clock-style-preview {
  font-family: var(--font-display);
  font-weight: 400;
}
.room-clock[data-clock-style='digital'] > time,
button[data-clock-style='digital'] > .clock-style-preview {
  font-family: ui-monospace, monospace;
  font-weight: 400;
}
.clock-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  text-align: left;
}
.clock-options fieldset.clock-style-options {
  border: 0;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}
.clock-style-options legend {
  padding: 0;
  margin-bottom: var(--space-3);
}
.clock-style-options button {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  min-height: 80px;
}
.clock-style-options button[aria-pressed='true'] {
  border-color: var(--accent);
  background: var(--accent-subtle);
}
.clock-style-preview {
  font-family: var(--font-ui);
  font-size: 26px;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 400px) {
  .clock-options fieldset.clock-style-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
