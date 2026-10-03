<script setup lang="ts">
import type { Room } from '@study/contracts';
import { Settings, StatusBadge } from '@study/ui';
import { curatedProvider } from '@study/backgrounds/browser';
import { memberLabel, roomOrigin, titleCase, roomAddress } from '../lib/room-navigation';
import { safeAppPath } from '../lib/app-history';
import { copyAppLink, shareAppLink } from '../lib/context-link';
const props = defineProps<{ room: Room; preview?: boolean }>();
const route = useRoute();
const entry = useRoomEntry();
const { profile } = useAccount();
const card = ref<HTMLElement>();
useContextActions(card, () => {
  if (props.preview) return [];
  const path = `/rooms/${roomAddress(props.room)}`;
  const configure = () => navigateTo({ path: `${path}/configure`, query: { from: origin.value } });
  return [
    { id: 'room.open', label: 'Open room', run: decide },
    {
      id: 'room.new-tab',
      label: 'Open in new tab',
      run: () =>
        window.open(
          `${path}?preview=1&from=${encodeURIComponent(origin.value)}`,
          '_blank',
          'noopener',
        ),
    },
    { id: 'room.copy', label: 'Copy room link', run: () => copyAppLink(path) },
    { id: 'room.share', label: 'Share room', run: () => shareAppLink(path, props.room.name) },
    ...(props.room.ownerId === profile.value?.id
      ? [
          { id: 'room.settings', label: 'Settings', run: configure },
          { id: 'room.invite', label: 'Invite people', run: configure },
        ]
      : []),
  ];
});
const failed = ref(false);
const revealed = ref(false);
const thumbnail = computed(
  () => curatedProvider.assets().find((a) => a.id === props.room.backgroundId)?.thumbnail,
);
watch(thumbnail, () => {
  failed.value = false;
  revealed.value = false;
});
const origin = computed(() => safeAppPath(route.fullPath) ?? roomOrigin(route.fullPath));
const scroll = useState<Record<string, number>>('browse-scroll', () => ({}));
function remember() {
  scroll.value[origin.value] = window.scrollY;
}
function decide() {
  remember();
  void entry.open(props.room, origin.value);
}
function space(event: KeyboardEvent) {
  if (event.key !== ' ') return;
  event.preventDefault();
  remember();
  void navigateTo({
    path: `/rooms/${roomAddress(props.room)}/configure`,
    query: { from: origin.value },
  });
}
</script>
<template>
  <article ref="card" class="room-card" :class="{ 'room-card-preview': preview }">
    <NuxtImg
      v-if="thumbnail && !failed"
      class="room-card-background"
      :class="{ revealed }"
      :src="thumbnail"
      width="320"
      height="180"
      sizes="100vw sm:50vw lg:33vw"
      densities="1x 2x"
      format="webp"
      :quality="70"
      alt=""
      loading="lazy"
      decoding="async"
      @load="revealed = true"
      @error="failed = true"
    />
    <div class="room-card-content">
      <div class="room-card-badges">
        <StatusBadge>{{ titleCase(room.privacy) }}</StatusBadge
        ><StatusBadge v-if="room.membership">{{ titleCase(room.membership) }}</StatusBadge>
      </div>
      <h3>
        <span v-if="preview">{{ room.name || 'Your room' }}</span
        ><button v-else class="room-card-title" type="button" @click="decide">
          {{ room.name }}
        </button>
      </h3>
      <p v-if="room.description" class="room-card-description">{{ room.description }}</p>
      <p class="room-card-counts">
        <span>{{ memberLabel(room.memberCount) }}</span
        ><span v-if="room.onlineCount !== undefined" title="Only presence visible to you is counted"
          >{{ room.onlineCount }} online <small>· visible to you</small></span
        >
      </p>
      <div v-if="room.tags.length" class="room-card-tags">
        <span v-for="tag in room.tags.slice(0, 3)" :key="tag">{{ tag }}</span>
      </div>
      <button v-if="!preview" class="room-card-open action-link" type="button" @click="decide">
        Open room <span aria-hidden="true">↗</span>
      </button>
    </div>
    <NuxtLink
      v-if="!preview"
      class="room-card-settings"
      :aria-label="`Settings for ${room.name}`"
      :to="{ path: `/rooms/${roomAddress(room)}/configure`, query: { from: origin } }"
      @click.stop="remember"
      @keydown.stop="space($event)"
      ><Settings :size="18" aria-hidden="true"
    /></NuxtLink>
  </article>
</template>
<style scoped>
.room-card {
  position: relative;
  isolation: isolate;
  min-width: 0;
  border-radius: var(--radius-card);
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-surface);
  overflow: hidden;
  transition:
    border-color 140ms,
    box-shadow 140ms;
}
.room-card:hover,
.room-card:focus-within {
  border-color: var(--accent);
}
.room-card-background {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
  inset: 0;
  z-index: -2;
  opacity: 0;
  transition: opacity 280ms ease-out;
}
.room-card-background.revealed {
  opacity: 0.19;
}
.room-card-content {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.25rem;
  min-height: 255px;
}
.room-card-content h3,
.room-card-content p {
  margin: 0;
}
.room-card-content h3 {
  font-size: 1.2rem;
  padding-right: 0.5rem;
  overflow-wrap: anywhere;
}
.room-card-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding-right: 2.2rem;
}
.room-card-title {
  text-decoration: none;
  background: transparent;
  border: 0;
  padding: 0;
  min-height: 0;
  font: inherit;
  color: inherit;
  text-align: left;
}
.room-card-title::after {
  content: '';
  position: absolute;
  inset: 0;
}
.room-card-title:focus-visible::after {
  outline: 3px solid var(--focus-ring);
  outline-offset: -4px;
  border-radius: var(--radius-card);
}
.room-card-description {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.room-card-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 1rem;
  font-size: 0.85rem;
}
.room-card-counts small {
  font-size: 0.75rem;
}
.room-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.75rem;
}
.room-card-open {
  position: relative;
  z-index: 1;
  width: fit-content;
  min-height: 44px;
  background: transparent;
  border: 0;
  color: var(--accent);
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.85rem;
  font-weight: 500;
}
.room-card-settings {
  position: absolute;
  z-index: 2;
  right: 0.65rem;
  top: 0.65rem;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 50%;
}
.room-card-settings:hover {
  background: var(--surface);
}
@media (prefers-reduced-motion: reduce) {
  .room-card-background,
  .room-card {
    transition: none;
  }
}
@media (prefers-contrast: more), (prefers-reduced-transparency: reduce), (forced-colors: active) {
  .room-card-background {
    display: none;
  }
}
</style>
