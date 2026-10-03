<script setup lang="ts">
import { computed } from 'vue';
const props = withDefaults(
  defineProps<{ text: string; style?: string; progress?: number; animate?: boolean }>(),
  { style: 'default', progress: 0, animate: true },
);
const glyphs: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  ':': ['0', '1', '1', '0', '1', '1', '0'],
};
const dots = computed(() => {
  let x = 0;
  const points: { x: number; y: number }[] = [];
  for (const letter of props.text) {
    const rows = glyphs[letter];
    if (!rows) continue;
    rows.forEach((row, y) =>
      [...row].forEach((on, column) => {
        if (on === '1') points.push({ x: x + column + 1, y: y + 1 });
      }),
    );
    x += rows[0]!.length + 1;
  }
  return { points, width: x + 1 };
});
</script>
<template>
  <span
    class="time-display"
    :data-style="style"
    :aria-label="text"
    :style="{ '--display-progress': `${Math.max(0, Math.min(1, progress)) * 360}deg` }"
  >
    <svg
      v-if="style === 'dots'"
      class="matrix-digits"
      :viewBox="`0 0 ${dots.width} 9`"
      aria-hidden="true"
    >
      <circle
        v-for="(dot, i) in dots.points"
        :key="i"
        :cx="dot.x"
        :cy="dot.y"
        r="0.34"
        fill="currentColor"
      />
    </svg>
    <span v-else-if="style === 'flip'" class="flip-digits" aria-hidden="true">
      <span
        v-for="(digit, i) in text"
        :key="i"
        :class="['flip-digit', { 'flip-separator': digit === ':' }]"
      >
        <span :key="digit" :class="{ 'flip-change': animate && digit !== ':' }">{{ digit }}</span>
      </span>
    </span>
    <span v-else aria-hidden="true">{{ text }}</span>
    <span v-if="style === 'bar'" class="display-bar" aria-hidden="true"
      ><span :style="{ width: `${progress * 100}%` }"
    /></span>
    <span v-if="style === 'dots'" class="ui-sr-only">{{ text }}</span>
  </span>
</template>
<style scoped>
.time-display {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}
.flip-digits {
  display: inline-flex;
  justify-content: center;
  gap: 0.035em;
}
.flip-digit {
  position: relative;
  border-radius: 0.12em;
  padding: 0.08em;
  background: linear-gradient(
    to bottom,
    var(--surface-elevated) 49%,
    var(--border) 50%,
    var(--surface) 51%
  );
}
.flip-digit > span {
  display: block;
}
.flip-separator {
  background: transparent;
  padding-inline: 0;
}
.flip-change {
  animation: digit-settle var(--motion-standard) var(--ease-enter);
}
@keyframes digit-settle {
  from {
    transform: perspective(160px) rotateX(-35deg);
    opacity: 0.5;
  }
  to {
    transform: perspective(160px) rotateX(0);
    opacity: 1;
  }
}
.matrix-digits {
  width: 100%;
  min-width: 3.8em;
  height: 1.25em;
}
.time-display[data-style='gauge'] {
  border: 0.07em solid transparent;
  border-radius: 50%;
  padding: 0.26em 0.16em;
  background:
    linear-gradient(var(--surface), var(--surface)) padding-box,
    conic-gradient(var(--accent) var(--display-progress), var(--border) 0) border-box;
}
.time-display[data-style='pie'] {
  border-radius: 50%;
  padding: 0.3em 0.18em;
  background: conic-gradient(var(--accent-subtle) var(--display-progress), transparent 0);
}
.display-bar {
  display: block;
  height: 0.12em;
  margin-top: 0.2em;
  border-radius: 1em;
  background: var(--border);
  overflow: hidden;
}
.display-bar > span {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width var(--motion-quick);
}
@media (prefers-reduced-motion: reduce) {
  .flip-change {
    animation: none;
  }
  .display-bar > span {
    transition: none;
  }
}
</style>
