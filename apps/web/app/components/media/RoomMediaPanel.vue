<script setup lang="ts">
import {
  Music2,
  Settings,
  OverlayPopover,
  SettingsSheet,
  StudySelect,
  SegmentedControl,
  UiExtensionHost,
} from '@study/ui';
import type { UiRegistry } from '@study/core/browser';
import { ambienceLibrary } from '@study/room-media/browser';
import type { MediaAction, MediaSettings } from '@study/contracts';
import type { RoomMediaModel } from '../../room/room-media-model';
import MediaListening from './MediaListening.vue';
const props = defineProps<{ model: RoomMediaModel; openVideo: () => void; ui?: UiRegistry }>();
const scope = ref('room');
const state = props.model.state;
const anchor = ref<HTMLButtonElement>();
const review = ref(false),
  seek = ref(0);
const settings = ref<MediaSettings>({ controls: 'owner', ownerAbsent: 'preserve' });
watch(
  () => state.view?.settings,
  (value) => {
    if (value) settings.value = structuredClone(toRaw(value));
  },
  { immediate: true },
);
function describe(action: MediaAction) {
  if ('videoId' in action) return `Add ${state.metadata[action.videoId]?.title ?? 'YouTube video'}`;
  if (action.type === 'mix') return 'Change the room mix';
  if (action.type === 'seek') return 'Change playback position';
  if (action.type === 'rate') return `Speed ${action.rate}×`;
  if (action.type === 'move') return `Move queue item ${action.from + 1} to ${action.to + 1}`;
  if ('index' in action)
    return `${action.type === 'remove' ? 'Remove' : 'Play'} queue item ${action.index + 1}`;
  return action.type === 'play' ? 'Play room' : 'Pause room';
}
</script>
<template>
  <button
    ref="anchor"
    aria-label="Media"
    :aria-expanded="state.open"
    @click="state.open = !state.open"
  >
    <Music2 :size="21" aria-hidden="true" /><small>{{
      state.view?.isOwner && state.view.temporary ? 'Media · Review' : 'Media'
    }}</small>
  </button>
  <OverlayPopover
    :open="state.open"
    :anchor="anchor"
    label="Media"
    focus
    @update:open="state.open = $event"
  >
    <section class="media-compact">
      <header>
        <h2>Media</h2>
        <button
          aria-label="Media settings"
          @click="
            state.open = false;
            state.advanced = true;
          "
        >
          <Settings :size="18" aria-hidden="true" />
        </button>
      </header>
      <SegmentedControl
        v-if="ui?.at('mediaPanel').length"
        v-model="scope"
        label="Media scope"
        :options="[
          { value: 'room', label: 'Room media' },
          { value: 'personal', label: 'Study Player' },
        ]"
      />
      <MediaListening v-if="scope === 'room'" :model="model" :open-video="openVideo" />
      <UiExtensionHost v-else-if="ui" :registry="ui" point="mediaPanel" />
    </section>
  </OverlayPopover>
  <SettingsSheet
    v-model:open="state.advanced"
    title="Media settings"
    @update:open="!$event && anchor?.focus({ preventScroll: true })"
  >
    <p v-if="state.error" role="alert">{{ state.error }}</p>
    <p v-if="!state.view" role="status">Room media is connecting or unavailable.</p>
    <div v-else class="media-settings">
      <p>
        {{
          state.view.canControl
            ? 'You can control room playback.'
            : 'Suggest a change for a controller to review.'
        }}
        {{ state.view.controller ? `Last controlled by ${state.view.controller.name}.` : '' }}
      </p>
      <section v-if="state.view.temporary && state.view.isOwner" aria-label="Owner mix review">
        <h3>Room mix changed</h3>
        <p>
          {{ state.view.changedBy.map((person) => person.name).join(', ') || 'A participant' }}
          changed the session mix.
        </p>
        <div class="media-actions">
          <button :disabled="state.busy" @click="model.command('reconcile', { decision: 'keep' })">
            Keep current
          </button>
          <button
            :disabled="state.busy"
            @click="model.command('reconcile', { decision: 'restore' })"
          >
            Restore mine
          </button>
          <button @click="review = !review">Review changes</button>
        </div>
        <div v-if="review" class="media-review">
          <section
            v-for="entry in [
              { name: 'Owner baseline', value: state.view.ownerBaseline },
              { name: 'Current room', value: state.view.state },
            ]"
            :key="entry.name"
          >
            <h4>{{ entry.name }}</h4>
            <p>{{ entry.value.playing ? 'Playing' : 'Paused' }} · {{ entry.value.rate }}×</p>
            <p v-for="(id, index) in entry.value.queue" :key="index">
              {{ state.metadata[id]?.title ?? 'YouTube video' }}
            </p>
            <p>Music {{ Math.round(entry.value.mix.music * 100) }}%</p>
            <p v-for="source in ambienceLibrary" :key="source.id">
              {{ source.name }} {{ Math.round(entry.value.mix.ambience[source.id] * 100) }}%
            </p>
          </section>
        </div>
      </section>
      <details>
        <summary>Suggestions ({{ state.view.suggestions.length }})</summary>
        <p v-if="!state.view.suggestions.length">No pending suggestions.</p>
        <section v-for="item in state.view.suggestions" :key="item.id">
          <p>{{ item.by.name }}: {{ describe(item.action) }}</p>
          <div v-if="state.view.canControl" class="media-actions">
            <button
              :disabled="state.busy"
              @click="model.command('suggestion-decide', { suggestionId: item.id, accept: true })"
            >
              Accept
            </button>
            <button
              :disabled="state.busy"
              @click="model.command('suggestion-decide', { suggestionId: item.id, accept: false })"
            >
              Dismiss
            </button>
          </div>
        </section>
      </details>
      <details v-if="state.view.isOwner">
        <summary>Room media permissions</summary>
        <StudySelect
          label="While owner is present"
          v-model="settings.controls"
          :options="[
            { value: 'everyone', label: 'Everyone controls' },
            { value: 'suggestions', label: 'Suggestions only' },
            { value: 'moderators', label: 'Moderators' },
            { value: 'owner', label: 'Owner only' },
          ]"
        />
        <StudySelect
          label="While owner is absent"
          v-model="settings.ownerAbsent"
          :options="[
            { value: 'ffa', label: 'Temporary free-for-all' },
            { value: 'moderators', label: 'Moderators only' },
            { value: 'preserve', label: 'Preserve normal permissions' },
          ]"
        />
        <button
          :disabled="state.busy || !model.connected()"
          @click="model.command('configure', { settings: toRaw(settings) })"
        >
          Save media permissions
        </button>
        <p>
          Temporary changes reset when everyone leaves. Only the owner changes permanent
          permissions.
        </p>
      </details>
      <details>
        <summary>Playback diagnostics</summary>
        <p>
          Provider {{ state.diagnostics.playing ? 'playing' : 'paused' }} ·
          {{ state.diagnostics.mounts }} player mount(s). Authority version
          {{ state.view.version }}.
        </p>
        <form
          class="media-actions"
          @submit.prevent="model.act({ type: 'seek', position: seek }, !state.view.canControl)"
        >
          <label
            >Seek seconds<input
              v-model.number="seek"
              type="number"
              min="0"
              max="604800"
              required /></label
          ><button :disabled="state.busy">Apply seek</button>
        </form>
        <p>
          YouTube streams directly to each listener. Ads, live content, publisher restrictions,
          buffering and autoplay may affect playback.
        </p>
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer"
          >YouTube terms</a
        >
      </details>
    </div>
  </SettingsSheet>
</template>
<style scoped>
.media-compact {
  width: min(400px, calc(100vw - 40px));
  max-height: min(650px, calc(100dvh - 140px));
  overflow: auto;
  padding: var(--space-2);
}
header,
.media-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
header {
  justify-content: space-between;
  margin-bottom: var(--space-3);
}
h2,
h3,
h4,
p {
  margin: 0;
}
.media-settings,
.media-settings section,
.media-settings details {
  display: grid;
  gap: var(--space-3);
}
.media-settings details {
  border-top: 1px solid var(--border);
  padding-top: var(--space-4);
}
.media-settings summary {
  cursor: pointer;
  padding-block: var(--space-2);
}
.media-settings p {
  font-size: 13px;
  color: var(--text-secondary);
}
.media-review {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.media-actions label {
  min-width: 0;
  flex: 1;
}
.media-actions input {
  width: 100%;
}
header button {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  padding: 0;
}
@media (max-width: 400px) {
  .media-review {
    grid-template-columns: 1fr;
  }
}
</style>
