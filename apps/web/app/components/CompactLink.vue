<script setup lang="ts">
import { Copy, Share2, Check } from '@study/ui';
const props = defineProps<{ value: string; label: string; actionsOnly?: boolean }>();
const message = ref('');
const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
onUnmounted(() => clearTimeout(copiedTimer));
const copyLabel = computed(() =>
  props.label.toLowerCase().includes('invite') ? 'Copy invite link' : 'Copy room link',
);
const canShare = ref(false);
onMounted(() => {
  canShare.value = typeof navigator.share === 'function';
});
const full = computed(() =>
  import.meta.client ? new URL(props.value, location.origin).href : props.value,
);
async function copy() {
  try {
    await navigator.clipboard.writeText(full.value);
    message.value = 'Copied.';
    copied.value = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied.value = false), 2000);
  } catch {
    message.value = 'Copy is unavailable. Select the link to copy it.';
  }
}
async function share() {
  try {
    await navigator.share({ url: full.value });
  } catch {
    /* Native cancellation is expected. */
  }
}
</script>
<template>
  <div class="compact-link" :aria-label="label">
    <div class="link-field" :class="{ 'actions-only': actionsOnly }">
      <input
        v-if="!actionsOnly"
        :value="full"
        readonly
        :aria-label="label"
        :title="full"
        @focus="($event.target as HTMLInputElement).select()"
      />
      <button
        class="secondary"
        type="button"
        :aria-label="copyLabel"
        :title="copyLabel"
        @click="copy"
      >
        <Check v-if="copied" :size="16" aria-hidden="true" /><Copy
          v-else
          :size="16"
          aria-hidden="true"
        /><span v-if="actionsOnly">Copy</span>
      </button>
      <button
        v-if="canShare"
        class="secondary"
        type="button"
        :aria-label="`Share ${label.toLowerCase().includes('invite') ? 'invite link' : 'room link'}`"
        title="Share link"
        @click="share"
      >
        <Share2 :size="16" aria-hidden="true" /><span v-if="actionsOnly">Share</span>
      </button>
    </div>
    <small class="ui-sr-only" role="status">{{ message }}</small>
  </div>
</template>
<style scoped>
.compact-link {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  max-width: 100%;
}
.link-field {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  overflow: hidden;
}
.link-field.actions-only {
  border: 0;
  background: transparent;
  width: auto;
  gap: var(--space-2);
}
.link-field input {
  flex: 1;
  min-width: 0;
  width: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  padding: var(--space-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.875rem;
  user-select: all;
}
.compact-link small {
  flex-basis: 100%;
}
.compact-link button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  min-width: 44px;
  flex-shrink: 0;
  border: 0;
  background: transparent;
}
</style>
