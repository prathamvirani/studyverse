<script setup lang="ts">
// The owner supplies this phrase set. Keep the accepted copy until additional phrases are approved.
const phrases = ['Where will you study today?'];
const index = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  if (phrases.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches)
    timer = setInterval(() => {
      index.value = (index.value + 1) % phrases.length;
    }, 8000);
});
onUnmounted(() => clearInterval(timer));
</script>
<template>
  <span class="home-headline">{{ phrases[index] }}</span>
</template>
<style scoped>
.home-headline {
  display: inline-block;
  min-height: 1.2em;
}
</style>
