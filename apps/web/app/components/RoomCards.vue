<script setup lang="ts">
import type { Room } from '@study/contracts';
defineProps<{ rooms: Room[]; columns?: string }>();
const grid = ref<HTMLElement>();
const available = ref(1);
let observer: ResizeObserver | undefined;
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    available.value = Math.max(1, Math.floor(((entry?.contentRect.width ?? 280) + 20) / 300));
  });
  if (grid.value) observer.observe(grid.value);
});
onUnmounted(() => observer?.disconnect());
defineExpose({ available });
</script>
<template>
  <div
    ref="grid"
    class="room-grid"
    :data-columns="columns && Number(columns) <= available ? columns : 'auto'"
  >
    <RoomCard v-for="room in rooms" :key="room.id" :room="room" />
  </div>
</template>
<style scoped>
.room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 1.2rem;
}
.room-grid[data-columns='1'] {
  grid-template-columns: repeat(1, minmax(0, 1fr));
}
.room-grid[data-columns='2'] {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.room-grid[data-columns='3'] {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.room-grid[data-columns='4'] {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.room-grid[data-columns='5'] {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}
.room-grid[data-columns='6'] {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}
.room-grid[data-columns='7'] {
  grid-template-columns: repeat(7, minmax(0, 1fr));
}
.room-grid[data-columns='8'] {
  grid-template-columns: repeat(8, minmax(0, 1fr));
}
</style>
