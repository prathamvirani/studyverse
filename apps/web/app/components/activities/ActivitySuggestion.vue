<script setup lang="ts">
import type { ActivitiesModel } from '../../room/activities-model';
defineProps<{ model: ActivitiesModel; open: () => void }>();
</script>
<template>
  <aside
    v-if="model.state.suggestion"
    class="activity-suggestion"
    aria-label="Optional break suggestion"
    role="status"
  >
    <p>Want a quick break activity?</p>
    <button @click="open">Explore activities</button>
    <button @click="model.state.suggestion = false">Not now</button>
    <button aria-label="Dismiss activity suggestion" @click="model.state.suggestion = false">
      ×
    </button>
  </aside>
</template>
<style scoped>
.activity-suggestion {
  position: fixed;
  left: max(100px, calc((100vw - 360px) / 2), env(safe-area-inset-left));
  bottom: 90px;
  z-index: 85;
  max-width: min(360px, calc(100vw - 116px));
  padding: 0.8rem;
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}
p {
  margin: 0 0 0.5rem;
}
button {
  margin: 0.2rem;
}
@media (pointer: coarse), (max-width: 700px) {
  .activity-suggestion button {
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
