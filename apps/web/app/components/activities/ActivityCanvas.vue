<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { DrawingStroke } from '@study/contracts';
import type { ActivitiesModel } from '../../room/activities-model';
const props = defineProps<{ model: ActivitiesModel }>();
const current = computed(() => props.model.state.view?.activity);
const data = computed(() => (current.value?.data.type === 'drawing' ? current.value.data : null));
const canDraw = computed(
  () =>
    !!data.value?.prompt &&
    current.value?.state === 'active' &&
    current.value.myMode === 'participant',
);
const colors = { ink: '#18323f', coral: '#b54239', leaf: '#297743', sky: '#2769a4' };
const color = ref<DrawingStroke['color']>('ink'),
  width = ref(4),
  points = ref<{ x: number; y: number }[]>([]),
  drawing = ref(false),
  pointer = ref<number | null>(null);
const rendered = (stroke: DrawingStroke) =>
  stroke.points.map((p) => `${p.x * 640},${p.y * 400}`).join(' ');
function add(event: PointerEvent) {
  const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
  const point = {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  };
  const last = points.value.at(-1);
  if (points.value.length < 64 && (!last || Math.hypot(last.x - point.x, last.y - point.y) > 0.004))
    points.value.push(point);
}
function down(event: PointerEvent) {
  if (!canDraw.value || props.model.state.busy || drawing.value) return;
  event.preventDefault();
  drawing.value = true;
  pointer.value = event.pointerId;
  points.value = [];
  (event.currentTarget as SVGElement).setPointerCapture(event.pointerId);
  add(event);
}
function move(event: PointerEvent) {
  if (drawing.value && pointer.value === event.pointerId) add(event);
}
async function up(event: PointerEvent) {
  if (!drawing.value || pointer.value !== event.pointerId) return;
  add(event);
  drawing.value = false;
  pointer.value = null;
  const stroke: DrawingStroke = {
    color: color.value,
    width: width.value,
    points: [...points.value],
  };
  points.value = [];
  if (canDraw.value && stroke.points.length)
    await props.model.play({ type: 'stroke', strokes: [stroke] });
}
watch(
  () => `${current.value?.id}:${current.value?.round}:${current.value?.state}`,
  () => {
    points.value = [];
    drawing.value = false;
    pointer.value = null;
  },
);
</script>
<template>
  <div v-if="data" class="activity-drawing">
    <div v-if="canDraw" class="drawing-tools">
      <label
        >Ink color<select v-model="color">
          <option v-for="(_, key) in colors" :key="key" :value="key">{{ key }}</option>
        </select></label
      >
      <label
        >Line width<input
          v-model.number="width"
          aria-label="Line width"
          type="range"
          min="1"
          max="12"
      /></label>
      <button :disabled="model.state.busy" @click="model.play({ type: 'clear' })">
        Clear sketch
      </button>
    </div>
    <svg
      viewBox="0 0 640 400"
      class="drawing-board"
      :class="{ editable: canDraw }"
      role="img"
      :aria-label="
        canDraw
          ? 'Your shared sketch. Draw with a pointer.'
          : 'Shared sketch from the active drawer'
      "
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="
        points = [];
        drawing = false;
        pointer = null;
      "
    >
      <polyline
        v-for="(stroke, index) in data.strokes"
        :key="index"
        :points="rendered(stroke)"
        fill="none"
        :stroke="colors[stroke.color]"
        :stroke-width="stroke.width"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <polyline
        v-if="points.length"
        :points="rendered({ points, color, width })"
        fill="none"
        :stroke="colors[color]"
        :stroke-width="width"
        stroke-linecap="round"
      />
    </svg>
    <small v-if="canDraw"
      >Lift to share each stroke (up to 64 points). Clear when the canvas is full. Freehand drawing
      requires a pointer; all surrounding controls support a keyboard.</small
    >
  </div>
</template>
<style scoped>
.drawing-board {
  display: block;
  width: 100%;
  background: #f5f4ec;
  border: 1px solid var(--border);
  border-radius: 14px;
  aspect-ratio: 8/5;
}
.editable {
  touch-action: none;
  cursor: crosshair;
}
.drawing-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
label {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}
input {
  width: 70px;
}
small {
  display: block;
  margin-top: 0.4rem;
}
</style>
