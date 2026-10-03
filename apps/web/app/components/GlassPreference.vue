<script setup lang="ts">
import { StudySlider } from '@study/ui';
const { glass, setGlass } = useAppearance();
const id = useId();
// Preserve the existing device preference and SSR mirror: stored values measure transparency.
const fill = computed(() => (glass.value === 'auto' ? 75 : 100 - glass.value));
</script>
<template>
  <section class="glass-preference">
    <h3>Glass fill opacity</h3>
    <button
      type="button"
      class="glass-auto"
      :aria-pressed="glass === 'auto'"
      @click="setGlass('auto')"
    >
      Auto <span>Recommended</span>
    </button>
    <label :for="id"
      >Manual fill <output>{{ glass === 'auto' ? 'Auto' : `${fill}%` }}</output></label
    >
    <StudySlider
      :id="id"
      aria-label="Manual fill"
      min="0"
      max="100"
      step="5"
      :model-value="fill"
      :aria-describedby="`${id}-help`"
      :aria-valuetext="
        glass === 'auto' ? 'Auto; adjust to choose manual fill opacity' : `${fill}% fill opacity`
      "
      @input="setGlass(100 - Number(($event.target as HTMLInputElement).value))"
    />
    <div class="glass-range-labels" aria-hidden="true">
      <span>Transparent fill</span><span>Solid fill</span>
    </div>
    <p :id="`${id}-help`">
      Changes preview immediately across the app. Auto adapts to your appearance and room
      background. Accessibility contrast preferences take priority.
    </p>
  </section>
</template>
