<script setup lang="ts">
import { SegmentedControl } from '@study/ui';
const { appearance, setAppearance, storageNote } = useAppearance();
</script>
<template>
  <section class="room-appearance">
    <SegmentedControl
      label="Appearance"
      :model-value="appearance"
      :options="[
        { value: 'system', label: 'System' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ]"
      @update:model-value="setAppearance"
    />
    <GlassPreference />
    <p v-if="storageNote" role="status">{{ storageNote }}</p>
    <slot />
  </section>
</template>
