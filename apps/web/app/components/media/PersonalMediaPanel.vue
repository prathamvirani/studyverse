<script setup lang="ts">
import { StudySelect, SettingsSheet } from '@study/ui';
import { personalKey } from '@study/personal-media/browser';
import type { PersonalMediaModel } from '../../room/personal-media-model';
import PersonalControls from './PersonalControls.vue';
const props = defineProps<{ model: PersonalMediaModel }>();
const state = props.model.state,
  link = ref(''),
  settings = ref(false),
  clearing = ref(false);
async function open() {
  if (await props.model.open(link.value)) link.value = '';
}
async function clear() {
  clearing.value = true;
  try {
    props.model.closeTile();
    await props.model.player?.clear();
  } catch {
    state.error = 'Device data could not be cleared. Please try again.';
  } finally {
    clearing.value = false;
  }
}
const onOff = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];
</script>
<template>
  <div class="personal-panel">
    <div class="personal-heading">
      <div>
        <h3>Study Player</h3>
        <small>Private · saved on this device</small>
      </div>
      <button class="secondary" @click="settings = true">Listening settings</button>
    </div>
    <form class="personal-source" @submit.prevent="open">
      <label class="ui-sr-only" for="personal-media-link">Personal media URL</label>
      <div class="ui-search-field">
        <input
          id="personal-media-link"
          v-model="link"
          type="text"
          maxlength="2048"
          required
          autocomplete="off"
          placeholder="Paste a public video link…"
          aria-label="Personal media URL"
        />
      </div>
      <button :disabled="!state.ready">Open privately</button>
    </form>
    <template v-if="state.current">
      <h4>{{ state.current.title }}</h4>
      <PersonalControls :model="model" />
      <div class="personal-actions">
        <button class="secondary" :disabled="!model.canPromote()" @click="model.promote()">
          {{ model.promotionLabel() }}</button
        ><button class="secondary" @click="model.closeTile()">Close personal player</button>
      </div>
      <small v-if="!model.canPromote()">Only supported public room media can be promoted.</small>
    </template>
    <p v-else-if="state.error" role="status">{{ state.error }}</p>
    <p v-if="state.storage === 'memory'" role="status">
      Device storage is unavailable. This session stays private, but cannot be restored after
      closing the page.
    </p>
    <section aria-label="Recent personal media" class="personal-recent">
      <h4>Recent on this device</h4>
      <p v-if="!state.data.history.length">
        Your recent videos appear here. They stay on this device.
      </p>
      <button
        v-for="entry in state.data.history"
        :key="personalKey(entry.source)"
        class="secondary recent-item"
        @click="model.open(entry.source.canonicalUrl)"
      >
        <span>{{ entry.title }}</span
        ><small
          >{{ new Date(entry.lastOpenedAt).toLocaleDateString() }} ·
          {{ Math.floor(entry.position / 60) }} min</small
        >
      </button>
    </section>
    <SettingsSheet v-model:open="settings" title="Personal listening">
      <div class="personal-settings">
        <p>
          Your player and listening history are private. Sharing one item sends only that public
          item to the existing room workflow.
        </p>
        <StudySelect
          label="Lower room music while personal media plays"
          :model-value="state.data.duckRoom ? 'on' : 'off'"
          :options="onOff"
          @update:model-value="model.player?.preferences({ duckRoom: $event === 'on' })"
        />
        <StudySelect
          label="Room music while ducked"
          :model-value="String(state.data.duckLevel)"
          :options="[
            { value: '0', label: 'Silent' },
            { value: '0.2', label: '20%' },
            { value: '0.5', label: '50%' },
          ]"
          @update:model-value="model.player?.preferences({ duckLevel: Number($event) })"
        />
        <StudySelect
          label="Lower personal media when people speak"
          :model-value="state.data.voiceDucking ? 'on' : 'off'"
          :options="onOff"
          @update:model-value="model.player?.preferences({ voiceDucking: $event === 'on' })"
        />
        <p>
          {{
            state.voiceAvailable
              ? 'Existing room voice activity is available.'
              : 'Voice activity is unavailable. Playback continues at your personal volume.'
          }}
          No extra microphone access is requested.
        </p>
        <StudySelect
          label="Remember playback progress"
          :model-value="state.data.rememberProgress ? 'on' : 'off'"
          :options="onOff"
          @update:model-value="model.player?.preferences({ rememberProgress: $event === 'on' })"
        />
        <StudySelect
          label="Remember recent media"
          :model-value="state.data.rememberHistory ? 'on' : 'off'"
          :options="onOff"
          @update:model-value="model.player?.preferences({ rememberHistory: $event === 'on' })"
        />
        <button class="danger" :disabled="clearing" @click="clear">
          Clear local personal media
        </button>
        <p>
          YouTube and Vimeo stream directly from their providers. Private/signed sources,
          authenticated portals and unsupported formats cannot play here.
        </p>
      </div>
    </SettingsSheet>
  </div>
</template>
<style scoped>
.personal-panel,
.personal-settings,
.personal-recent {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}
.personal-heading,
.personal-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
}
.personal-source {
  display: grid;
  gap: var(--space-2);
  grid-template-columns: minmax(0, 1fr);
}
.personal-source input {
  width: 100%;
  min-width: 0;
}
.personal-heading button {
  font-size: 12px;
}
.personal-panel button {
  min-height: 44px;
}
.personal-panel h3,
.personal-panel h4,
.personal-panel p,
.personal-settings p {
  margin: 0;
}
.personal-panel h4 {
  overflow-wrap: anywhere;
}
.personal-panel small,
.personal-panel p,
.personal-settings p {
  font-size: 12px;
  color: var(--text-secondary);
}
.personal-recent {
  border-top: 1px solid var(--border);
  padding-top: var(--space-3);
  max-height: 220px;
  overflow: auto;
}
.recent-item {
  display: grid;
  text-align: left;
  gap: 4px;
}
.recent-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
