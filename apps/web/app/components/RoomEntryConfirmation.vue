<script setup lang="ts">
import { SettingsSheet, StatusBadge } from '@study/ui';
import { roomEntryBundles, nextEntryBundle } from '../lib/room-entry-copy';
import { memberLabel, titleCase, roomAddress } from '../lib/room-navigation';
const entry = useRoomEntry();
const step = ref<'enter' | 'leave'>('enter');
const promptIndex = useState('room-entry-prompt-index', () => -1);
const bundle = computed(() => roomEntryBundles[Math.max(0, promptIndex.value)]!);
const copy = computed(() => (step.value === 'enter' ? bundle.value : bundle.value.secondary));
const ready = computed(
  () =>
    !!entry.state.value.room &&
    entry.state.value.preparedRoomId === entry.state.value.room.id &&
    route.path === `/rooms/${roomAddress(entry.state.value.room)}` &&
    !motion.value.active,
);
const motion = useRouteMotionState();
const route = useRoute();
const { profile } = useAccount();
watch(
  () => profile.value?.id,
  () => {
    entry.close(false);
    entry.state.value.confirmed = null;
  },
);
watch(
  () => entry.state.value.room,
  (room) => {
    if (!room) return;
    step.value = 'enter';
    promptIndex.value = nextEntryBundle(promptIndex.value);
  },
);
watch(
  () => route.path,
  (path) => {
    const selected = entry.state.value.room;
    if (selected && path !== `/rooms/${roomAddress(selected)}`) entry.close(false);
  },
);
function reconsider() {
  step.value = 'leave';
}
</script>
<template>
  <SettingsSheet
    class="room-entry-confirmation"
    :open="ready"
    title="Open room"
    @update:open="entry.close()"
  >
    <template v-if="entry.state.value.room">
      <div class="entry-context">
        <h3>{{ entry.state.value.room.name }}</h3>
        <p>
          <StatusBadge>{{ titleCase(entry.state.value.room.privacy) }}</StatusBadge
          ><span>{{ memberLabel(entry.state.value.room.memberCount) }}</span>
        </p>
      </div>
      <p class="entry-prompt" :data-step="step">{{ copy.question }}</p>
      <p class="entry-error" role="status">{{ entry.state.value.error }}</p>
      <div class="entry-actions">
        <template v-if="step === 'enter'">
          <button
            :disabled="entry.state.value.pending"
            aria-label="Join room"
            @click="entry.commit"
          >
            {{ entry.state.value.pending ? 'Opening room…' : copy.yes }}
          </button>
          <button
            class="secondary"
            aria-label="Cancel room entry"
            :disabled="entry.state.value.pending"
            @click="reconsider"
          >
            {{ copy.no }}
          </button>
        </template>
        <template v-else>
          <button aria-label="Return to room entry" @click="step = 'enter'">{{ copy.yes }}</button>
          <button class="secondary" aria-label="Cancel room entry" @click="entry.close()">
            {{ copy.no }}
          </button>
        </template>
      </div>
    </template>
  </SettingsSheet>
  <p v-if="entry.state.value.error && !entry.state.value.room" class="entry-notice" role="alert">
    {{ entry.state.value.error
    }}<button class="secondary" aria-label="Dismiss room entry error" @click="entry.close(false)">
      Close
    </button>
  </p>
</template>
<style>
.entry-notice {
  position: fixed;
  z-index: 1200;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 16px;
  background: var(--surface-elevated);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-elevated);
}
.room-entry-confirmation::backdrop {
  background: rgb(4 15 26 / 48%);
  backdrop-filter: blur(5px);
}
.room-entry-confirmation.ui-settings-sheet {
  width: min(420px, calc(100vw - 32px));
}
.room-entry-confirmation .ui-sheet-body {
  padding: 0;
}
.room-entry-confirmation .ui-sheet-content {
  padding: 24px;
}
.entry-context h3 {
  margin-bottom: 12px;
  overflow-wrap: anywhere;
}
.entry-context p {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 14px;
}
.entry-prompt {
  display: flex;
  align-items: center;
  min-height: 60px;
  margin: 12px 0 0;
  font-size: 20px;
  line-height: 1.4;
}
.entry-error {
  min-height: 42px;
  margin: 0;
  font-size: 13px;
  color: var(--danger);
}
.entry-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.entry-actions button {
  min-height: 44px;
}
</style>
