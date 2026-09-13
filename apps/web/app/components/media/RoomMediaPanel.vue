<script setup lang="ts">
import { ambienceLibrary, youtubeContentId } from '@study/room-media/browser';
import type { MediaAction, MediaSettings } from '@study/contracts';
import type { RoomMediaModel } from '../../room/room-media-model';
const props = defineProps<{ model: RoomMediaModel; openVideo: () => void }>(),
  state = props.model.state;
const dialog = ref<HTMLDialogElement>(),
  link = ref(''),
  seek = ref(0),
  review = ref(false),
  suggest = ref(false);
const settings = ref<MediaSettings>({ controls: 'owner', ownerAbsent: 'preserve' });
const mix = ref({ music: 0.6, ambience: { rain: 0, white: 0, pink: 0, brown: 0 } });
watch(
  () => state.view,
  (v) => {
    if (v) {
      settings.value = structuredClone(toRaw(v.settings));
      mix.value = structuredClone(toRaw(v.state.mix));
    }
  },
);
watch(
  () => state.open,
  async (open) => {
    await nextTick();
    if (open) dialog.value?.showModal();
    else dialog.value?.close();
  },
);
function action(value: MediaAction) {
  return props.model.act(value, suggest.value || !state.view?.canControl);
}
async function enqueue() {
  const videoId = youtubeContentId(link.value);
  if (!videoId) {
    state.error = 'Use a valid YouTube or YouTube Music video link or an 11-character video ID.';
    return;
  }
  await action({ type: 'enqueue', videoId });
  if (!state.error) link.value = '';
}
function describe(a: MediaAction) {
  if (a.type === 'enqueue') return `Add ${a.videoId}`;
  if (a.type === 'mix')
    return (
      `Mix: music ${Math.round(a.mix.music * 100)}%; ` +
      ambienceLibrary.map((x) => `${x.name} ${Math.round(a.mix.ambience[x.id] * 100)}%`).join(', ')
    );
  if (a.type === 'seek') return `Seek to ${a.position}s`;
  if (a.type === 'rate') return `Speed ${a.rate}×`;
  if (a.type === 'select' || a.type === 'remove') return `${a.type} queue item ${a.index + 1}`;
  return a.type;
}
</script>
<template>
  <button
    aria-label="Media"
    :aria-expanded="state.open"
    aria-controls="room-media-panel"
    @click="state.open = true"
  >
    <span aria-hidden="true" class="dock-icon">♫</span
    ><small>{{ state.view?.isOwner && state.view?.temporary ? 'Media · Review' : 'Media' }}</small>
  </button>
  <Teleport to=".room-shell">
    <dialog
      id="room-media-panel"
      ref="dialog"
      class="room-media-panel glass"
      aria-labelledby="room-media-heading"
      @cancel.prevent="model.close()"
      @click="$event.target === dialog && model.close()"
    >
      <header>
        <div>
          <small>SHARED STUDY SPACE</small>
          <h2 id="room-media-heading">Room media</h2>
        </div>
        <button aria-label="Close media" @click="model.close()">×</button>
      </header>
      <p v-if="state.error" role="alert">{{ state.error }}</p>
      <p v-if="!state.view" role="status">Room media is connecting or unavailable.</p>
      <template v-else>
        <p class="media-meta">
          {{
            state.view.canControl
              ? 'You can control room playback.'
              : 'Suggest a change for a controller to review.'
          }}
          {{ state.view.controller ? `Last controlled by ${state.view.controller.name}.` : '' }}
        </p>
        <section v-if="state.view.temporary && state.view.isOwner" aria-label="Owner mix review">
          <strong
            >Room mix changed{{
              state.view.ownerPresent ? ' while you were away or by a participant' : ''
            }}.</strong
          >
          <p>
            {{ state.view.changedBy.map((p) => p.name).join(', ') || 'A participant' }} changed the
            session mix.
          </p>
          <div class="media-actions">
            <button
              :disabled="state.busy"
              @click="model.command('reconcile', { decision: 'keep' })"
            >
              Keep current</button
            ><button
              :disabled="state.busy"
              @click="model.command('reconcile', { decision: 'restore' })"
            >
              Restore mine</button
            ><button @click="review = !review">Review changes</button>
          </div>
          <div v-if="review" class="media-review">
            <div
              v-for="entry in [
                { name: 'Owner baseline', value: state.view.ownerBaseline },
                { name: 'Current room', value: state.view.state },
              ]"
              :key="entry.name"
            >
              <h4>{{ entry.name }}</h4>
              <p>
                {{ entry.value.playing ? 'Playing' : 'Paused' }} ·
                {{ entry.value.position.toFixed(0) }}s · {{ entry.value.rate }}×
              </p>
              <p>Queue: {{ entry.value.queue.join(', ') || 'Empty' }}</p>
              <p>Music {{ Math.round(entry.value.mix.music * 100) }}%</p>
              <p v-for="a in ambienceLibrary" :key="a.id">
                {{ a.name }} {{ Math.round(entry.value.mix.ambience[a.id] * 100) }}%
              </p>
            </div>
          </div>
        </section>
        <fieldset :disabled="state.busy">
          <legend>Shared YouTube & queue</legend>
          <label v-if="state.view.canControl"
            ><input v-model="suggest" type="checkbox" /> Suggest changes instead of applying</label
          >
          <form class="media-add" @submit.prevent="enqueue">
            <label
              >YouTube video or Music link<input
                v-model="link"
                maxlength="2048"
                placeholder="https://www.youtube.com/watch?v=…"
                required /></label
            ><button>
              {{ suggest || !state.view.canControl ? 'Suggest video' : 'Add to room' }}
            </button>
          </form>
          <ol class="media-queue">
            <li v-for="(id, index) in state.view.state.queue" :key="index">
              <span>{{ state.view.state.current === index ? '▶ ' : '' }}{{ id }}</span
              ><button @click="action({ type: 'select', index })">
                {{ state.view.canControl && !suggest ? 'Select' : 'Suggest select' }}</button
              ><button
                :aria-label="`Remove queue item ${index + 1}`"
                @click="action({ type: 'remove', index })"
              >
                Remove
              </button>
            </li>
          </ol>
          <div class="media-actions">
            <button
              :disabled="state.view.state.current === null"
              @click="action({ type: state.view.state.playing ? 'pause' : 'play' })"
            >
              {{ suggest || !state.view.canControl ? 'Suggest ' : ''
              }}{{ state.view.state.playing ? 'Pause' : 'Play' }} room</button
            ><button @click="openVideo">Open YouTube tile</button>
          </div>
          <form class="media-actions" @submit.prevent="action({ type: 'seek', position: seek })">
            <label
              >Seek seconds<input
                v-model.number="seek"
                type="number"
                min="0"
                max="604800"
                required /></label
            ><button>Apply seek</button>
          </form>
          <label
            >Room speed<select
              :value="state.view.state.rate"
              @change="
                action({ type: 'rate', rate: Number(($event.target as HTMLSelectElement).value) })
              "
            >
              <option
                v-for="rate in [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]"
                :key="rate"
                :value="rate"
              >
                {{ rate }}×
              </option>
            </select></label
          >
          <small
            >Provider restrictions, ads, buffering and autoplay can affect each listener.
            Unavailable items can be removed or skipped by a controller.</small
          >
        </fieldset>
        <fieldset :disabled="state.busy">
          <legend>Shared mix & ambience</legend>
          <label
            >Room music {{ Math.round(mix.music * 100) }}%<input
              v-model.number="mix.music"
              type="range"
              min="0"
              max="1"
              step="0.01"
          /></label>
          <label v-for="a in ambienceLibrary" :key="a.id"
            >{{ a.name }} {{ Math.round(mix.ambience[a.id] * 100) }}%<input
              v-model.number="mix.ambience[a.id]"
              type="range"
              min="0"
              max="1"
              step="0.01"
          /></label>
          <button @click="action({ type: 'mix', mix: toRaw(mix) })">
            {{ suggest || !state.view.canControl ? 'Suggest shared mix' : 'Apply shared mix' }}
          </button>
          <small
            >Original procedural sounds. Independent layers; sample alignment is unnecessary.</small
          >
        </fieldset>
        <fieldset>
          <legend>Only on this device</legend>
          <label
            ><input v-model="state.local.muted" type="checkbox" @change="model.saveLocal()" /> Mute
            room media locally</label
          >
          <label
            >My room music level<input
              v-model.number="state.local.music"
              type="range"
              min="0"
              max="1"
              step="0.01"
              @input="model.saveLocal()"
          /></label>
          <label
            >My ambience level<input
              v-model.number="state.local.ambience"
              type="range"
              min="0"
              max="1"
              step="0.01"
              @input="model.saveLocal()"
          /></label>
          <label
            >Ambience source<select v-model="state.local.ambienceScope" @change="model.saveLocal()">
              <option value="room">Room layers</option>
              <option value="personal">Personal ambience</option>
            </select></label
          >
          <label v-for="a in ambienceLibrary" :key="a.id"
            >My {{ a.name
            }}<input
              v-if="state.local.ambienceScope === 'personal'"
              v-model.number="state.local.personal[a.id]"
              type="range"
              min="0"
              max="1"
              step="0.01"
              @input="model.saveLocal()" /><input
              v-else
              v-model.number="state.local.layers[a.id]"
              type="range"
              min="0"
              max="1"
              step="0.01"
              @input="model.saveLocal()"
          /></label>
          <button v-if="!state.audioEnabled" @click="model.enableAudio()">Enable ambience</button
          ><small
            >These levels and personal ambience stay on this device. Voice controls remain
            separate.</small
          >
        </fieldset>
        <details>
          <summary>Suggestions ({{ state.view.suggestions.length }})</summary>
          <p v-if="!state.view.suggestions.length">No pending suggestions.</p>
          <div v-for="item in state.view.suggestions" :key="item.id">
            <p>{{ item.by.name }}: {{ describe(item.action) }}</p>
            <div v-if="state.view.canControl" class="media-actions">
              <button
                :disabled="state.busy"
                @click="model.command('suggestion-decide', { suggestionId: item.id, accept: true })"
              >
                Accept</button
              ><button
                :disabled="state.busy"
                @click="
                  model.command('suggestion-decide', { suggestionId: item.id, accept: false })
                "
              >
                Dismiss
              </button>
            </div>
          </div>
        </details>
        <details v-if="state.view.isOwner">
          <summary>Room media permissions</summary>
          <label
            >While owner is present<select v-model="settings.controls">
              <option value="everyone">Everyone controls</option>
              <option value="suggestions">Suggestions only</option>
              <option value="moderators">Moderators</option>
              <option value="owner">Owner only</option>
            </select></label
          ><label
            >While owner is absent<select v-model="settings.ownerAbsent">
              <option value="ffa">Temporary free-for-all</option>
              <option value="moderators">Moderators only</option>
              <option value="preserve">Preserve normal permissions</option>
            </select></label
          ><button
            :disabled="state.busy"
            @click="model.command('configure', { settings: toRaw(settings) })"
          >
            Save media permissions</button
          ><small
            >Only the owner can change permanent media permissions. Temporary changes reset when
            everyone leaves.</small
          >
        </details>
      </template>
    </dialog>
  </Teleport>
</template>
<style scoped>
.room-media-panel {
  width: min(520px, calc(100vw - 24px));
  max-height: calc(100dvh - 100px);
  padding: 1rem;
  color: var(--room-text, #edf4f1);
  overflow: auto;
  border: 1px solid #ffffff30;
  border-radius: 18px;
}
header,
.media-actions,
.media-add,
.media-queue li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
header {
  justify-content: space-between;
}
h2 {
  margin: 0.2rem 0;
}
fieldset,
section,
details {
  border: 1px solid #ffffff26;
  border-radius: 10px;
  padding: 0.8rem;
  margin: 0.8rem 0;
  min-width: 0;
}
label,
small {
  display: block;
}
label {
  margin: 0.6rem 0;
  font-size: 0.85rem;
}
small,
.media-meta {
  font-size: 0.75rem;
  opacity: 0.8;
}
input:not([type='checkbox']),
select {
  width: 100%;
  min-width: 0;
}
input[type='checkbox'] {
  width: auto;
}
.media-add label {
  flex: 1;
  min-width: 180px;
}
.media-queue {
  padding-left: 1.25rem;
  max-height: 160px;
  overflow: auto;
}
.media-queue li {
  margin: 0.4rem 0;
  font-size: 0.8rem;
}
.media-review {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}
button {
  font-size: 0.8rem;
}
.media-actions {
  margin: 0.5rem 0;
}
dialog::backdrop {
  background: #07121488;
}
@media (max-width: 400px) {
  .media-review {
    grid-template-columns: 1fr;
  }
  .room-media-panel {
    padding: 0.65rem;
  }
}
</style>
