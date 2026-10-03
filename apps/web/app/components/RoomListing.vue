<script setup lang="ts">
import { IntegratedSearch, PageHeader, StudySelect, ContextPane } from '@study/ui';
import { roomBrowseSchema, roomBrowseInputSchema } from '@study/contracts';
import type { Room } from '@study/contracts';
import { roomOrigin } from '../lib/room-navigation';
const props = defineProps<{ scope: 'mine' | 'discover' }>();
const route = useRoute(),
  router = useRouter();
const { profile, load, api } = useAccount();
const rooms = ref<Room[]>([]),
  mine = ref<Room[]>([]),
  cursor = ref<string | null>(null),
  busy = ref(true),
  error = ref('');
const search = ref(String(route.query.search ?? '').slice(0, 80));
const sort = ref(
  roomBrowseInputSchema.shape.sort.safeParse(route.query.sort).data ?? 'recommended',
);
const filter = ref(roomBrowseInputSchema.shape.filter.safeParse(route.query.filter).data ?? 'all');
const minMembers = ref(
  /^\d{1,5}$/.test(String(route.query.minMembers ?? '')) ? String(route.query.minMembers) : '0',
);
const gridPreference = useRoomGrid();
const columns = ref(
  /^[1-8]$/.test(String(route.query.columns))
    ? String(route.query.columns)
    : route.query.columns === 'auto'
      ? 'auto'
      : gridPreference.columns.value,
);
const grid = ref<{ available: number }>();
const visibleColumns = computed({
  get: () => (Number(columns.value) <= (grid.value?.available ?? 1) ? columns.value : 'auto'),
  set: (value: string) => {
    columns.value = value;
  },
});
const columnOptions = computed(() => [
  { value: 'auto', label: 'Auto' },
  ...Array.from({ length: Math.min(8, grid.value?.available ?? 1) }, (_, n) => ({
    value: String(n + 1),
    label: `${n + 1} ${n === 0 ? 'column' : 'columns'}`,
  })),
]);
const sortOptions = computed(() => [
  { value: 'recommended', label: 'Recommended' },
  { value: 'online', label: 'Most active now' },
  { value: 'friends', label: 'Friends here' },
  { value: 'newest', label: 'Newest' },
  { value: 'largest', label: 'Largest' },
  { value: 'smallest', label: 'Smallest' },
  ...(props.scope === 'mine' ? [{ value: 'visited', label: 'Last visited' }] : []),
]);
let generation = 0,
  timer: ReturnType<typeof setTimeout> | undefined,
  ready = false,
  alive = true;
const scroll = useState<Record<string, number>>('browse-scroll', () => ({}));
async function fetchRooms(more = false) {
  const current = ++generation;
  busy.value = true;
  error.value = '';
  if (!more) {
    rooms.value = [];
    cursor.value = null;
  }
  try {
    const params = new URLSearchParams({
      scope: props.scope,
      search: search.value,
      sort: sort.value,
      filter: filter.value,
      minMembers: minMembers.value,
    });
    if (more && cursor.value) params.set('cursor', cursor.value);
    const result = await api.request(`/api/v1/rooms/browse?${params}`, roomBrowseSchema);
    if (current !== generation) return;
    rooms.value = more
      ? [...rooms.value, ...result.rooms.filter((r) => !rooms.value.some((old) => old.id === r.id))]
      : result.rooms;
    cursor.value = result.nextCursor;
  } catch {
    if (current === generation) error.value = 'Rooms could not load. Please try again.';
  } finally {
    if (current === generation) busy.value = false;
  }
}
async function apply() {
  clearTimeout(timer);
  await router.replace({
    query: {
      search: search.value || undefined,
      sort: sort.value,
      filter: filter.value,
      minMembers: minMembers.value,
      columns: columns.value,
    },
  });
  await fetchRooms();
}
watch(search, () => {
  if (ready) {
    clearTimeout(timer);
    timer = setTimeout(() => void apply(), 300);
  }
});
watch([sort, filter, minMembers], () => {
  if (ready) void apply();
});
watch(columns, () => {
  if (ready) {
    gridPreference.save(columns.value);
    void router.replace({ query: { ...route.query, columns: columns.value } });
  }
});
watch(
  () => route.query,
  (q) => {
    search.value = String(q.search ?? '').slice(0, 80);
    sort.value = roomBrowseInputSchema.shape.sort.safeParse(q.sort).data ?? 'recommended';
    filter.value = roomBrowseInputSchema.shape.filter.safeParse(q.filter).data ?? 'all';
    minMembers.value = /^\d{1,5}$/.test(String(q.minMembers ?? '')) ? String(q.minMembers) : '0';
    columns.value = /^(auto|[1-8])$/.test(String(q.columns ?? ''))
      ? String(q.columns)
      : gridPreference.columns.value;
  },
);
onCriticalPageMounted(async () => {
  if (await load()) {
    await fetchRooms();
    if (!alive) return;
    if (props.scope === 'discover') {
      try {
        mine.value = (
          await api.request('/api/v1/rooms/browse?scope=mine', roomBrowseSchema)
        ).rooms.slice(0, 2);
      } catch {
        /* The primary listing remains usable. */
      }
    }
  } else busy.value = false;
  if (!alive) return;
  ready = true;
  await nextTick();
  window.scrollTo(0, scroll.value[roomOrigin(route.fullPath)] ?? 0);
});
onUnmounted(() => {
  alive = false;
  generation++;
  clearTimeout(timer);
});
</script>
<template>
  <div class="browse-page" :class="{ 'browse-discover': scope === 'discover' }">
    <PageHeader
      :title="scope === 'mine' ? 'My Rooms' : 'Discover'"
      :description="
        scope === 'mine'
          ? 'Your familiar places. Pick a room and settle in.'
          : 'Find a public space for your next study session.'
      "
    >
      <template #actions
        ><NuxtLink v-if="profile" class="button" to="/rooms/new">Create a room</NuxtLink></template
      >
    </PageHeader>
    <template v-if="profile">
      <div class="browse-layout" :class="{ 'has-context': scope === 'discover' && mine.length }">
        <section class="browse-main">
          <div class="browse-toolbar">
            <IntegratedSearch
              v-model="search"
              label="Search rooms"
              placeholder="Search names, descriptions or tags"
              :maxlength="80"
              :busy="busy"
              @submit="apply"
            />
          </div>
          <div class="browse-filters" aria-label="Room filters">
            <div class="browse-sort-controls" aria-label="Room display">
              <StudySelect v-model="sort" label="Sort rooms" :options="sortOptions" />
              <StudySelect v-model="visibleColumns" label="Grid columns" :options="columnOptions" />
            </div>
            <div class="browse-filter-controls">
              <div class="browse-filter-chips">
                <button
                  v-for="option in [
                    { value: 'all', label: 'All rooms' },
                    { value: 'online', label: 'Online now' },
                    { value: 'friends', label: 'Friends here' },
                    { value: 'studying', label: 'Friends studying' },
                  ]"
                  :key="option.value"
                  class="secondary"
                  :aria-pressed="filter === option.value"
                  @click="filter = option.value as typeof filter"
                >
                  {{ option.label }}
                </button>
              </div>
              <StudySelect
                v-model="minMembers"
                label="Members"
                :options="[
                  { value: '0', label: 'Any size' },
                  { value: '2', label: '2+ members' },
                  { value: '5', label: '5+ members' },
                  { value: '10', label: '10+ members' },
                ]"
              />
            </div>
          </div>
          <p class="browse-explanation">
            {{
              sort === 'recommended'
                ? 'Recommended by your visits, visible friends, visible activity, then newest.'
                : 'Online counts include only presence visible to you.'
            }}
          </p>
          <p v-if="gridPreference.storageNote.value" role="status">
            {{ gridPreference.storageNote.value }}
          </p>
          <p v-if="error" class="error" role="alert">
            {{ error }} <button class="secondary" @click="fetchRooms()">Retry</button>
          </p>
          <p v-if="busy" role="status">Loading rooms…</p>
          <RoomCards ref="grid" :rooms="rooms" :columns="columns" />
          <div v-if="!rooms.length && !busy && !error && !cursor" class="empty">
            <h2>
              {{
                search
                  ? 'No matching rooms'
                  : filter === 'friends' || filter === 'studying'
                    ? 'No friends visible here right now'
                    : filter === 'online'
                      ? 'No visible activity right now'
                      : scope === 'mine'
                        ? 'Make yourself a space'
                        : 'No public rooms yet'
              }}
            </h2>
            <p>
              {{
                filter !== 'all' || search || minMembers !== '0'
                  ? 'Try another search or clear your filters.'
                  : 'Create a room, or join one with an invitation.'
              }}
            </p>
            <button
              v-if="filter !== 'all' || search || minMembers !== '0'"
              class="secondary"
              @click="
                search = '';
                filter = 'all';
                minMembers = '0';
              "
            >
              Clear filters
            </button>
            <NuxtLink v-else class="button" to="/rooms/new">Create Room</NuxtLink>
          </div>
          <button
            v-if="cursor"
            class="secondary load-more"
            :disabled="busy"
            @click="fetchRooms(true)"
          >
            Load more
          </button>
        </section>
        <ContextPane v-if="scope === 'discover' && mine.length" label="Your familiar rooms"
          ><h2>Return to a room</h2>
          <RoomCards :rooms="mine" /><NuxtLink class="action-link" to="/my-rooms"
            >All my rooms →</NuxtLink
          ></ContextPane
        >
      </div> </template
    ><SignIn v-else-if="!busy" />
  </div>
</template>
<style scoped>
.browse-page {
  position: relative;
  isolation: isolate;
}
.browse-main {
  min-width: 0;
}
.browse-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: start;
}
.browse-toolbar > :first-child {
  flex: 1 1 320px;
  max-width: none;
}
.browse-toolbar > :not(:first-child) {
  flex: 0 1 180px;
}
.browse-filters {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 16px 24px;
  margin: 1rem 0;
}
.browse-filters button[aria-pressed='true'] {
  background: var(--accent);
  color: var(--on-accent);
}
.browse-sort-controls,
.browse-filter-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
  min-width: 0;
}
.browse-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.browse-filters :deep(.ui-select) {
  min-width: 140px;
}
.browse-filters :deep(.ui-select label) {
  line-height: 20px;
  margin-bottom: 8px;
}
.browse-filters :deep(.ui-select-trigger),
.browse-filter-chips > button {
  height: 44px;
  min-height: 44px;
  padding: 0 12px;
}
@media (max-width: 640px) {
  .browse-sort-controls,
  .browse-filter-controls {
    width: 100%;
  }
  .browse-sort-controls :deep(.ui-select) {
    flex: 1;
  }
}
.browse-explanation {
  font-size: 0.8rem;
}
.load-more {
  margin-top: 1.5rem;
}
.ui-context-pane > :last-child {
  display: block;
  margin-top: 1rem;
}
@media (min-width: 1500px) {
  .has-context {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 2rem;
    align-items: start;
  }
}
@media (max-width: 1499px) {
  .ui-context-pane {
    display: none;
  }
}
</style>
