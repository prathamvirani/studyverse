<script setup lang="ts">
import type { Provider } from '@study/contracts';
defineProps<{ provider: Provider }>();
</script>
<template>
  <span class="provider-mark" :class="provider" aria-hidden="true">
    <img
      v-if="provider !== 'microsoft'"
      :src="provider === 'google' ? '/brands/google.png' : '/brands/discord.svg'"
      alt=""
      width="20"
      height="20"
    />
    <span v-else>⊞</span>
  </span>
</template>
<style scoped>
.provider-mark {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex: none;
}
.provider-mark img {
  object-fit: contain;
}
.google {
  background: #fff;
}
.discord {
  background: #5865f2;
}
</style>
