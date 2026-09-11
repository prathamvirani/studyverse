<script setup lang="ts">
import type { BackgroundModel } from '../../room/background-model';
const props = defineProps<{ model: BackgroundModel }>(),
  state = props.model.state;
const dialog = ref<HTMLDialogElement>(),
  filter = ref('All'),
  scope = ref('personal');
const categories = [
  'All',
  'Favorites',
  ...new Set(props.model.catalog.assets().map((a) => a.category)),
  'Custom',
];
const items = computed(() =>
  props.model.catalog
    .assets()
    .filter(
      (a) =>
        filter.value === 'All' ||
        filter.value === a.category ||
        (filter.value === 'Favorites' && state.favorites.includes(a.id)),
    ),
);
const customs = computed(() =>
  state.customs.filter(
    (a) =>
      filter.value === 'All' ||
      filter.value === 'Custom' ||
      (filter.value === 'Favorites' && state.favorites.includes(a.id)),
  ),
);
watch(
  () => state.open,
  async (open) => {
    await nextTick();
    if (open) {
      void props.model.browse();
      dialog.value?.showModal();
      dialog.value?.querySelector<HTMLButtonElement>('button')?.focus();
    } else dialog.value?.close();
  },
);
async function choose(id: string) {
  if (scope.value === 'room') await props.model.roomDefault(id);
  else await props.model.select(id);
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) await props.model.upload(file);
  input.value = '';
}
</script>
<template>
  <button
    aria-label="Background"
    :aria-expanded="state.open"
    aria-controls="background-selector"
    @click="state.open = true"
  >
    <span aria-hidden="true" class="dock-icon">▧</span><small>Background</small>
  </button>
  <Teleport to=".room-shell">
    <dialog
      id="background-selector"
      ref="dialog"
      class="background-selector glass"
      aria-labelledby="background-heading"
      @cancel.prevent="model.close()"
      @click="$event.target === dialog && model.close()"
    >
      <header>
        <div>
          <small>MAKE YOURSELF AT HOME</small>
          <h2 id="background-heading">Backgrounds</h2>
        </div>
        <button aria-label="Close backgrounds" @click="model.close()">×</button>
      </header>
      <p v-if="!state.available" role="status">
        {{
          state.ready
            ? 'Backgrounds are unavailable. Check your connection or feature access.'
            : 'Loading backgrounds…'
        }}
      </p>
      <template v-else>
        <div class="background-tools">
          <label
            >Apply to<select v-model="scope" aria-label="Background scope">
              <option value="personal">My device</option>
              <option v-if="state.canControl" value="room">Room default</option>
            </select></label
          ><button :aria-pressed="state.paused" @click="model.pause()">
            {{ state.paused ? 'Resume motion' : 'Pause motion' }}
          </button>
        </div>
        <p class="background-hint">
          {{
            scope === 'room'
              ? 'Owner setting · members can keep a personal override.'
              : 'Your view only. Images and favorites stay on this device.'
          }}
        </p>
        <div class="background-filters" role="group" aria-label="Background categories">
          <button
            v-for="category in categories"
            :key="category"
            :aria-pressed="filter === category"
            @click="filter = category"
          >
            {{ category }}
          </button>
        </div>
        <div class="background-grid">
          <article v-for="a in items" :key="a.id" class="background-card">
            <button
              class="background-pick"
              :aria-label="'Select ' + a.title"
              :aria-pressed="(state.selected ?? state.roomAsset) === a.id"
              :disabled="state.busy"
              @click="choose(a.id)"
            >
              <img
                :src="a.thumbnail"
                alt=""
                width="320"
                height="180"
                loading="lazy"
                decoding="async"
              /><span>{{ a.title }}</span
              ><small>{{ a.kind === 'loop' ? 'Gentle loop' : 'Still image' }}</small>
            </button>
            <button
              class="background-star"
              :aria-label="'Favorite ' + a.title"
              :aria-pressed="state.favorites.includes(a.id)"
              @click="model.favorite(a.id)"
            >
              {{ state.favorites.includes(a.id) ? '★' : '☆' }}
            </button>
          </article>
          <article v-for="a in customs" :key="a.id" class="background-card">
            <button
              class="background-pick"
              aria-label="Select custom image"
              :aria-pressed="state.selected === a.id"
              :disabled="scope === 'room' || state.busy"
              @click="choose(a.id)"
            >
              <img :src="a.preview" alt="" width="320" height="180" loading="lazy" /><span>{{
                a.title
              }}</span
              ><small>Private · {{ a.durations.length > 1 ? 'Animated' : 'Still image' }}</small>
            </button>
            <div class="custom-actions">
              <button
                :aria-label="'Favorite ' + a.id"
                :aria-pressed="state.favorites.includes(a.id)"
                @click="model.favorite(a.id)"
              >
                ☆</button
              ><button aria-label="Remove custom image" @click="model.remove(a.id)">Remove</button>
            </div>
          </article>
        </div>
        <p v-if="!items.length && !customs.length">No backgrounds here yet.</p>
        <footer>
          <button
            :disabled="state.busy"
            @click="
              scope = 'personal';
              model.select(null);
            "
          >
            Use room background</button
          ><label class="background-upload"
            >{{ state.busy ? 'Processing…' : '＋ Add your image'
            }}<input
              aria-label="Upload custom background"
              type="file"
              accept="image/png,image/jpeg,image/gif"
              :disabled="state.busy || scope === 'room'"
              @change="upload"
          /></label>
        </footer>
        <p class="background-hint">
          PNG, JPEG or GIF · up to 5 MB · 8 device images. Custom images cannot be shared with the
          room. Motion freezes with reduced motion or data saving.
        </p>
      </template>
      <p v-if="state.error" role="alert">{{ state.error }}</p>
    </dialog>
  </Teleport>
</template>
<style>
.room-shell .background-selector {
  position: fixed;
  inset: auto 0 90px;
  margin: 0 auto;
  width: min(620px, calc(100vw - 28px));
  max-height: min(720px, calc(100dvh - 125px));
  padding: 20px;
  color: #f4eee0;
  overflow: auto;
  background: #20343cf2;
  border: 1px solid #eee4c140;
  box-shadow: 0 24px 80px #07121980;
}
.background-selector::backdrop {
  background: #07121924;
}
.background-selector header,
.background-selector footer,
.background-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.background-selector header h2 {
  margin: 5px 0 12px;
  font-size: 24px;
  font-weight: 500;
}
.background-selector header small {
  font-size: 10px;
  letter-spacing: 0.14em;
  color: #c0cdbd;
}
.background-tools label {
  display: flex;
  align-items: center;
  gap: 10px;
}
.background-tools select {
  width: auto;
  margin: 0;
  padding: 8px;
  background: #304a50;
  color: inherit;
  border: 1px solid #ffffff30;
  border-radius: 8px;
}
.background-selector .background-hint {
  font-size: 11px;
  line-height: 1.5;
  margin: 10px 0;
  color: #c3cec8;
}
.background-filters {
  display: flex;
  gap: 4px;
  overflow: auto;
  padding: 6px 0 12px;
}
.background-filters button {
  white-space: nowrap;
  flex: none;
}
.background-selector button[aria-pressed='true'] {
  border-color: #ead09b;
  background: #e8d4a91c;
}
.background-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.background-card {
  position: relative;
  min-width: 0;
  background: #142b3240;
  border-radius: 12px;
  overflow: hidden;
}
.room-shell .background-pick {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0 0 10px;
  overflow: hidden;
  border-radius: 12px;
}
.background-pick img {
  width: 100%;
  height: auto;
  aspect-ratio: 16/9;
  object-fit: cover;
}
.background-pick span {
  padding: 10px 12px 3px;
  font-size: 13px;
}
.background-pick small {
  padding: 0 12px;
  color: #bfcdc7;
  font-size: 10px;
}
.room-shell .background-star {
  position: absolute;
  top: 6px;
  right: 6px;
  background: #152932d9;
  font-size: 20px;
  padding: 3px 8px;
}
.background-upload {
  position: relative;
  border: 1px solid #ead09b66;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  font-size: 12px;
}
.background-selector footer {
  padding: 0;
  border: 0;
  color: inherit;
  text-align: left;
}
.background-upload input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
}
.background-upload:focus-within {
  outline: 2px solid #f4d496;
  outline-offset: 3px;
}
.custom-actions {
  display: flex;
  justify-content: space-between;
}
@media (max-width: 480px) {
  .room-shell .background-selector {
    padding: 14px;
    bottom: 82px;
    max-height: calc(100dvh - 105px);
  }
  .background-grid {
    gap: 8px;
  }
  .background-tools {
    gap: 6px;
    font-size: 12px;
  }
}
</style>
