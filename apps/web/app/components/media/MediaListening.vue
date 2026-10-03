<script setup lang="ts">
import {
  SegmentedControl,
  StudySlider,
  StudySelect,
  Play,
  Pause,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  Music2,
} from '@study/ui';
import { ambienceLibrary, mediaPosition, youtubeContentId } from '@study/room-media/browser';
import type { MediaAction, MediaPlayback } from '@study/contracts';
import type { RoomMediaModel } from '../../room/room-media-model';
const props = defineProps<{ model: RoomMediaModel; openVideo: () => void }>();
function hideThumbnail(error: Event | string) {
  if (error instanceof Event && error.target instanceof HTMLImageElement)
    error.target.hidden = true;
}
const state = props.model.state;
const scope = ref('room'),
  link = ref(''),
  adding = ref(false),
  sources = ref(false),
  resolving = ref(false);
const tick = ref(0),
  seeking = ref<number>();
const kept = reactive({ room: new Set<string>(), personal: new Set<string>() });
const muted = new Map<string, number>();
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => tick.value++, 1000);
});
onUnmounted(() => clearInterval(timer));
const view = computed(() => state.view);
const index = computed(() => view.value?.state.current ?? null);
const videoId = computed(() =>
  index.value === null ? undefined : view.value?.state.queue[index.value],
);
const metadata = computed(() => (videoId.value ? state.metadata[videoId.value] : undefined));
const duration = computed(() => metadata.value?.duration ?? state.diagnostics.duration);
const position = computed(() => {
  void tick.value;
  return (
    seeking.value ?? (view.value ? mediaPosition(view.value.state, props.model.serverNow()) : 0)
  );
});
const roomMix = computed(() => state.previewMix ?? view.value?.state.mix);
const levels = computed(() =>
  scope.value === 'room' ? roomMix.value?.ambience : state.local.personal,
);
const active = computed(() =>
  ambienceLibrary.filter(
    (source) =>
      (levels.value?.[source.id] ?? 0) > 0 ||
      kept[scope.value === 'room' ? 'room' : 'personal'].has(source.id),
  ),
);
const allowed = computed(
  () => props.model.connected() && (scope.value === 'personal' || !!view.value?.canControl),
);
const queueItems = computed(
  () =>
    view.value?.state.queue.map((id, itemIndex) => ({
      id,
      index: itemIndex,
      metadata: state.metadata[id],
    })) ?? [],
);
function time(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function act(action: MediaAction) {
  return props.model.act(action, !view.value?.canControl);
}
async function enqueue(play = true) {
  const id = youtubeContentId(link.value);
  if (!id) {
    state.error = 'Use a valid YouTube or YouTube Music video link.';
    return;
  }
  resolving.value = true;
  await props.model.resolveMetadata(id);
  resolving.value = false;
  if (await act({ type: play ? 'enqueue-play' : 'enqueue', videoId: id })) {
    link.value = '';
    adding.value = false;
    if (play && view.value?.canControl) props.openVideo();
  }
}
async function playItem(itemIndex: number) {
  if (!(await act({ type: 'select', index: itemIndex }))) return;
  if (view.value?.canControl && (await act({ type: 'play' }))) props.openVideo();
}
async function playback() {
  const play = !view.value?.state.playing;
  if ((await act({ type: play ? 'play' : 'pause' })) && play && view.value?.canControl)
    props.openVideo();
}
function seek() {
  const value = seeking.value;
  seeking.value = undefined;
  if (value !== undefined) void act({ type: 'seek', position: value });
}
function channel(id: keyof MediaPlayback['mix']['ambience'], value: number) {
  if (!allowed.value) return;
  kept[scope.value === 'room' ? 'room' : 'personal'].add(id);
  if (scope.value === 'room') props.model.scheduleMix({ ambience: { [id]: value } });
  else {
    state.local.ambienceScope = 'personal';
    state.local.personal[id] = value;
    props.model.saveLocal();
  }
}
function remove(id: keyof MediaPlayback['mix']['ambience']) {
  channel(id, 0);
  kept[scope.value === 'room' ? 'room' : 'personal'].delete(id);
}
function toggleMute(id: keyof MediaPlayback['mix']['ambience']) {
  const key = `${scope.value}.${id}`,
    level = levels.value?.[id] ?? 0;
  if (level > 0) {
    muted.set(key, level);
    channel(id, 0);
  } else channel(id, muted.get(key) ?? 0.4);
}
</script>
<template>
  <div class="media-listening">
    <p v-if="state.error" role="alert">{{ state.error }}</p>
    <p v-if="!view" role="status">Connecting media…</p>
    <template v-else>
      <section v-if="videoId" class="now-playing" aria-label="Now Playing">
        <div class="media-track">
          <NuxtImg
            v-if="metadata?.thumbnail"
            :src="metadata.thumbnail"
            alt=""
            width="88"
            height="66"
            densities="1x 2x"
            format="webp"
            :quality="70"
            crossorigin="anonymous"
            referrerpolicy="no-referrer"
            @error="hideThumbnail"
          />
          <Music2 v-else :size="40" aria-hidden="true" />
          <div>
            <small>NOW PLAYING · YOUTUBE</small>
            <h3>{{ metadata?.title ?? 'Loading title…' }}</h3>
            <p v-if="metadata?.channel">{{ metadata.channel }}</p>
            <small v-if="metadata?.status === 'unavailable'">Choose another item to listen.</small>
          </div>
        </div>
        <StudySlider
          v-if="duration > 0"
          label="Playback position"
          :model-value="position"
          :min="0"
          :max="duration"
          :step="1"
          :disabled="state.busy || !model.connected()"
          @update:model-value="seeking = Number($event)"
          @change="seek"
        />
        <p class="media-time">
          {{ time(position)
          }}<span>{{ duration > 0 ? time(duration) : 'Duration unavailable' }}</span>
        </p>
        <div class="media-playback">
          <button
            aria-label="Previous video"
            :disabled="state.busy || index === null || index < 1"
            @click="index !== null && playItem(index - 1)"
          >
            <ArrowLeft :size="20" aria-hidden="true" />
          </button>
          <button
            :aria-label="`${view.canControl ? '' : 'Suggest '}${view.state.playing ? 'Pause' : 'Play'} room`"
            :disabled="state.busy || !model.connected()"
            @click="playback"
          >
            <Pause v-if="view.state.playing" :size="22" aria-hidden="true" /><Play
              v-else
              :size="22"
              aria-hidden="true"
            />
          </button>
          <button
            aria-label="Next video"
            :disabled="state.busy || index === null || index >= view.state.queue.length - 1"
            @click="index !== null && playItem(index + 1)"
          >
            <ArrowRight :size="20" aria-hidden="true" />
          </button>
          <button class="show-video" @click="openVideo">Show video</button>
        </div>
        <StudySelect
          label="Room speed"
          :model-value="String(view.state.rate)"
          :disabled="state.busy || !model.connected()"
          :options="
            [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => ({
              value: String(rate),
              label: rate + '×',
            }))
          "
          @update:model-value="act({ type: 'rate', rate: Number($event) })"
        />
      </section>
      <form v-if="!videoId || adding" class="media-url" @submit.prevent="enqueue(true)">
        <label class="sr-only" for="room-media-link">YouTube URL</label
        ><input
          id="room-media-link"
          v-model="link"
          aria-label="YouTube URL"
          placeholder="Paste a YouTube link…"
          maxlength="2048"
          required
        />
        <button :disabled="resolving || state.busy || !model.connected()">
          {{ resolving ? 'Loading…' : view.canControl ? 'Play' : 'Suggest' }}
        </button>
        <button
          v-if="videoId"
          type="button"
          :disabled="resolving || state.busy"
          @click="enqueue(false)"
        >
          Queue
        </button>
      </form>
      <button v-else class="media-add" @click="adding = true">
        <Plus :size="16" aria-hidden="true" />Add media
      </button>
      <section v-if="queueItems.length" aria-label="Up Next">
        <h3>
          Up Next <small>{{ queueItems.length }} in queue</small>
        </h3>
        <ol class="media-queue">
          <li
            v-for="item in queueItems"
            :key="item.index"
            :aria-current="item.index === index ? 'true' : undefined"
          >
            <NuxtImg
              v-if="item.metadata?.thumbnail"
              :src="item.metadata.thumbnail"
              alt=""
              width="48"
              height="36"
              densities="1x 2x"
              format="webp"
              :quality="65"
              loading="lazy"
              crossorigin="anonymous"
              referrerpolicy="no-referrer"
              @error="hideThumbnail"
            />
            <div class="queue-copy">
              <strong>{{ item.metadata?.title ?? 'Loading title…' }}</strong
              ><small
                >{{ item.index === index ? 'Now Playing · ' : '' }}YouTube{{
                  item.metadata?.duration ? ' · ' + time(item.metadata.duration) : ''
                }}</small
              >
            </div>
            <div class="queue-actions">
              <button
                :aria-label="`Play queue item ${item.index + 1}`"
                :disabled="state.busy"
                @click="playItem(item.index)"
              >
                <Play :size="15" aria-hidden="true" />
              </button>
              <button
                :aria-label="`Move queue item ${item.index + 1} up`"
                :disabled="state.busy || item.index === 0"
                @click="act({ type: 'move', from: item.index, to: item.index - 1 })"
              >
                <ArrowUp :size="15" aria-hidden="true" />
              </button>
              <button
                :aria-label="`Move queue item ${item.index + 1} down`"
                :disabled="state.busy || item.index === queueItems.length - 1"
                @click="act({ type: 'move', from: item.index, to: item.index + 1 })"
              >
                <ArrowDown :size="15" aria-hidden="true" />
              </button>
              <button
                :aria-label="`Remove queue item ${item.index + 1}`"
                :disabled="state.busy"
                @click="act({ type: 'remove', index: item.index })"
              >
                <X :size="15" aria-hidden="true" />
              </button>
            </div>
          </li>
        </ol>
      </section>
      <SegmentedControl
        v-model="scope"
        label="Media scope"
        :options="[
          { value: 'room', label: 'Room' },
          { value: 'personal', label: 'Personal' },
        ]"
      />
      <section v-if="scope === 'personal'" class="personal-mix" aria-label="Personal mix">
        <label class="checkbox-row"
          ><input v-model="state.local.muted" type="checkbox" @change="model.saveLocal()" />Mute
          room media locally</label
        >
        <p>Room music · {{ Math.round(state.local.music * 100) }}%</p>
        <StudySlider
          v-model="state.local.music"
          label="My room music level"
          :min="0"
          :max="1"
          :step="0.01"
          @input="model.saveLocal()"
        />
        <p>Ambience · {{ Math.round(state.local.ambience * 100) }}%</p>
        <StudySlider
          v-model="state.local.ambience"
          label="My ambience level"
          :min="0"
          :max="1"
          :step="0.01"
          @input="model.saveLocal()"
        />
        <StudySelect
          v-model="state.local.ambienceScope"
          label="Ambience source"
          :options="[
            { value: 'room', label: 'Room layers' },
            { value: 'personal', label: 'Personal ambience' },
          ]"
          @update:model-value="model.saveLocal()"
        />
        <p>Saved on this device. Voice levels remain separate.</p>
      </section>
      <section v-else aria-label="Room mix">
        <p>Room music · {{ Math.round((roomMix?.music ?? 0) * 100) }}%</p>
        <StudySlider
          label="Room music level"
          :model-value="roomMix?.music ?? 0"
          :min="0"
          :max="1"
          :step="0.01"
          :disabled="!allowed"
          @update:model-value="model.scheduleMix({ music: Number($event) })"
        />
        <p v-if="!view.canControl">
          A room controller changes the shared mix. You can suggest queue and playback changes.
        </p>
      </section>
      <section aria-label="Ambience" class="ambience-mixer">
        <header>
          <h3>{{ scope === 'personal' ? 'Personal ambience' : 'Room ambience' }}</h3>
          <button :disabled="!allowed" @click="sources = !sources">
            <Plus :size="16" aria-hidden="true" />Add ambience
          </button>
        </header>
        <div v-if="sources" class="ambience-sources" aria-label="Ambience sources">
          <button
            v-for="source in ambienceLibrary"
            :key="source.id"
            :disabled="!allowed"
            @click="
              channel(source.id, 0.4);
              sources = false;
              model.enableAudio();
            "
          >
            <Music2 :size="20" aria-hidden="true" /><strong>{{ source.name }}</strong
            ><small>{{ source.description }}</small>
          </button>
        </div>
        <p v-if="!active.length">Add a little atmosphere to your session.</p>
        <div v-for="source in active" :key="source.id" class="ambience-channel">
          <header>
            <strong>{{ source.name }}</strong
            ><span>{{ Math.round((levels?.[source.id] ?? 0) * 100) }}%</span
            ><button
              :aria-label="`${(levels?.[source.id] ?? 0) > 0 ? 'Mute' : 'Unmute'} ${source.name}`"
              :disabled="!allowed"
              @click="toggleMute(source.id)"
            >
              {{ (levels?.[source.id] ?? 0) > 0 ? 'Mute' : 'Muted' }}</button
            ><button
              :aria-label="`Remove ${source.name}`"
              :disabled="!allowed"
              @click="remove(source.id)"
            >
              <X :size="16" aria-hidden="true" />
            </button>
          </header>
          <StudySlider
            :label="`${scope === 'personal' ? 'My ' : 'Room '}${source.name}`"
            :model-value="levels?.[source.id] ?? 0"
            :min="0"
            :max="1"
            :step="0.01"
            :disabled="!allowed"
            @update:model-value="channel(source.id, Number($event))"
          />
        </div>
        <button v-if="active.length && !state.audioEnabled" @click="model.enableAudio()">
          Enable ambience
        </button>
      </section>
    </template>
  </div>
</template>
<style scoped>
.media-listening,
.now-playing,
.personal-mix,
.ambience-mixer {
  display: grid;
  gap: var(--space-3);
}
.media-listening > section + section {
  border-top: 1px solid var(--border);
  padding-top: var(--space-3);
}
.media-track {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.media-track > div {
  min-width: 0;
}
img {
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
h3,
p {
  margin: 0;
}
h3 {
  font-size: 14px;
}
small,
p {
  color: var(--text-secondary);
  font-size: 11px;
}
.media-track h3 {
  margin-block: 4px;
  overflow-wrap: anywhere;
}
.media-time,
.media-playback,
header,
.media-add {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.media-time {
  justify-content: space-between;
}
.media-playback {
  justify-content: center;
}
.media-playback > button {
  min-width: 44px;
  min-height: 44px;
  display: grid;
  place-items: center;
  padding: var(--space-2);
}
.media-playback > .show-video {
  margin-left: auto;
}
.media-url {
  display: flex;
  gap: var(--space-2);
}
.media-url input {
  flex: 1;
  min-width: 0;
}
.media-queue {
  list-style: none;
  padding: 0;
  margin: var(--space-2) 0 0;
  max-height: 240px;
  overflow: auto;
}
.media-queue li {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding-block: var(--space-2);
  border-bottom: 1px solid var(--border);
}
.queue-copy {
  flex: 1;
  min-width: 110px;
  display: grid;
  gap: 4px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.queue-actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
}
.queue-actions button {
  display: grid;
  place-items: center;
  padding: 0;
  width: 36px;
  height: 36px;
}
.ambience-mixer header {
  flex-wrap: wrap;
}
.ambience-mixer h3,
.ambience-channel strong {
  flex: 1;
}
.ambience-channel {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.ambience-channel button {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
}
.ambience-sources {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}
.ambience-sources button {
  display: grid;
  justify-items: start;
  text-align: left;
  gap: var(--space-2);
  min-height: 90px;
}
@media (hover: none) {
  .queue-actions button,
  .ambience-channel button {
    min-width: 44px;
    min-height: 44px;
  }
}
@media (max-width: 400px) {
  .media-track img {
    width: 64px;
    height: 48px;
  }
  .queue-actions {
    width: 100%;
    justify-content: end;
  }
}
</style>
