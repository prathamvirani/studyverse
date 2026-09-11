<script setup lang="ts">
import { shouldAnimate } from '@study/backgrounds/browser';
import type { BackgroundModel } from '../../room/background-model';
const props = defineProps<{ model: BackgroundModel }>();
const state = props.model.state;
const hidden = ref(true),
  reduced = ref(true),
  saving = ref(false),
  frame = ref(0),
  urls = ref<string[]>([]),
  failed = ref(false);
const asset = computed(() =>
  props.model.catalog.resolve(state.available ? (state.selected ?? state.roomAsset) : ''),
);
const running = computed(
  () =>
    state.available &&
    shouldAnimate({
      hidden: hidden.value,
      reduced: reduced.value,
      saving: saving.value,
      paused: state.paused,
    }),
);
const source = computed(() =>
  failed.value
    ? '/backgrounds/quiet-hours.webp'
    : state.available && urls.value.length
      ? urls.value[frame.value]
      : asset.value.source,
);
let timer: ReturnType<typeof setTimeout> | undefined;
let media: MediaQueryList | undefined;
const visibility = () => {
  hidden.value = document.hidden;
};
const motion = () => {
  reduced.value = media?.matches ?? true;
};
type Connection = EventTarget & { saveData?: boolean };
let connection: Connection | undefined;
const power = () => {
  saving.value = connection?.saveData ?? false;
};
function schedule() {
  clearTimeout(timer);
  frame.value = 0;
  if (!running.value || urls.value.length < 2) return;
  const next = () => {
    timer = setTimeout(() => {
      frame.value = (frame.value + 1) % urls.value.length;
      next();
    }, state.custom?.durations[frame.value] ?? 100);
  };
  next();
}
watch(
  () => state.custom,
  (custom) => {
    for (const url of urls.value) URL.revokeObjectURL(url);
    urls.value = custom?.frames.map((b) => URL.createObjectURL(b)) ?? [];
    failed.value = false;
    schedule();
  },
);
watch([running, asset], () => {
  failed.value = false;
  schedule();
});
onMounted(() => {
  media = matchMedia('(prefers-reduced-motion: reduce)');
  motion();
  visibility();
  connection = (navigator as unknown as { connection?: Connection }).connection;
  power();
  media.addEventListener('change', motion);
  document.addEventListener('visibilitychange', visibility);
  connection?.addEventListener('change', power);
  void props.model.init();
});
onUnmounted(() => {
  clearTimeout(timer);
  media?.removeEventListener('change', motion);
  document.removeEventListener('visibilitychange', visibility);
  connection?.removeEventListener('change', power);
  for (const url of urls.value) URL.revokeObjectURL(url);
  props.model.dispose();
});
</script>
<template>
  <div
    class="environment-surface"
    aria-hidden="true"
    :data-background="state.available ? (state.selected ?? asset.id) : 'quiet-hours'"
    :data-motion="running ? 'playing' : 'frozen'"
  >
    <img
      :src="source"
      alt=""
      width="1920"
      height="1080"
      decoding="async"
      fetchpriority="high"
      @error="
        failed = true;
        state.error = 'Image unavailable. Using a safe default.';
      "
    />
    <div
      v-if="!state.custom && asset.effect && running"
      class="environment-effect"
      :class="asset.effect"
    ></div>
    <div class="environment-shade"></div>
  </div>
</template>
<style>
.environment-surface {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #20343c;
}
.environment-surface > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.environment-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #071c2738, #17292c05 60%, #071c2744);
}
.environment-effect {
  position: absolute;
  inset: -120px;
  pointer-events: none;
  will-change: transform;
  opacity: 0.18;
}
.environment-effect.rain {
  background-image: repeating-linear-gradient(
    105deg,
    transparent 0 78px,
    #e5eef0 79px 80px,
    transparent 81px 160px
  );
  background-size: 160px 120px;
  mask-image: linear-gradient(transparent, #0009 20%, #000 70%, transparent);
  animation: environment-rain 12s linear infinite;
}
.environment-effect.stars {
  background:
    radial-gradient(ellipse at 20% 35%, #c9b5e944, transparent 45%),
    radial-gradient(ellipse at 70% 20%, #95c7d766, transparent 45%);
  animation: environment-drift 32s ease-in-out infinite alternate;
  opacity: 0.25;
}
@keyframes environment-rain {
  to {
    transform: translate(0, 120px);
  }
}
@keyframes environment-drift {
  to {
    transform: translate(80px, 20px);
    opacity: 0.1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .environment-effect {
    display: none;
  }
}
</style>
