<script setup lang="ts">
import { SettingsSheet, UiExtensionHost, ArrowLeft } from '@study/ui';
import type { UiRegistry } from '@study/core/browser';
import RoomAppearance from './RoomAppearance.vue';
import PlatformCapabilities from '../PlatformCapabilities.vue';
const props = defineProps<{ open: boolean; ui: UiRegistry }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();
const category = ref('Media & Devices'),
  drilled = ref(false);
const categories = [
  'Media & Devices',
  'Quality',
  'Audio',
  'Camera',
  'Appearance',
  'Room & Privacy',
  'Notifications',
  'Diagnostics',
];
watch(
  () => props.open,
  (open) => {
    if (open) drilled.value = false;
  },
);
function select(value: string) {
  category.value = value;
  drilled.value = true;
  nextTick(() => document.getElementById('room-settings-category')?.focus());
}
function back() {
  drilled.value = false;
  nextTick(() => document.querySelector<HTMLElement>('.room-settings nav button')?.focus());
}
</script>
<template>
  <SettingsSheet
    id="room-more"
    :open="open"
    title="Room Settings"
    class="room-settings"
    :class="{ 'settings-drilled': drilled }"
    @update:open="emit('update:open', $event)"
  >
    <template #categories>
      <button
        v-for="item in categories"
        :key="item"
        :aria-current="category === item ? 'page' : undefined"
        @click="select(item)"
      >
        {{ item }}
      </button>
    </template>
    <button class="settings-back" @click="back"><ArrowLeft :size="16" /> Categories</button>
    <h3 id="room-settings-category" tabindex="-1">{{ category }}</h3>
    <RoomAppearance v-if="category === 'Appearance'"><slot name="appearance" /></RoomAppearance>
    <template v-else-if="category === 'Room & Privacy'">
      <p>
        Active authorized participants are visible to fellow room members. Account privacy controls
        disclosure of your status and current room outside this room. Blocks remain enforced.
      </p>
      <NuxtLink class="action-link" to="/account#presence">Account presence & privacy</NuxtLink>
      <UiExtensionHost :registry="ui" point="roomMoreMenu" :context="{ category, open }" />
    </template>
    <p v-else-if="category === 'Notifications'">
      Room notices appear while you study. Optional Pomodoro alerts are configured in Timer
      settings.
    </p>
    <template v-else>
      <PlatformCapabilities v-if="category === 'Diagnostics'" />
      <UiExtensionHost :registry="ui" point="roomSettings" :context="{ category, open }" />
      <UiExtensionHost
        v-if="category === 'Media & Devices'"
        :registry="ui"
        point="roomMoreMenu"
        :context="{ category, open }"
      />
    </template>
  </SettingsSheet>
</template>
