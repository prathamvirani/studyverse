<script setup lang="ts">
import { roomListSchema } from '@study/contracts';
import type { Room } from '@study/contracts';
const props = defineProps<{ scope: 'mine' | 'discover' }>();
const { profile, load, api } = useAccount();
const rooms = ref<Room[]>([]),
  cursor = ref<string | null>(null),
  search = ref(''),
  busy = ref(true),
  error = ref('');
async function fetchRooms(more = false) {
  busy.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({ search: search.value });
    if (more && cursor.value) params.set('cursor', cursor.value);
    const result = await api.request(`/api/v1/rooms/${props.scope}?${params}`, roomListSchema);
    rooms.value = more ? [...rooms.value, ...result.rooms] : result.rooms;
    cursor.value = result.nextCursor;
  } catch {
    error.value = 'Rooms could not load. Please try again.';
  } finally {
    busy.value = false;
  }
}
onMounted(async () => {
  if (await load()) await fetchRooms();
  else busy.value = false;
});
</script>
<template>
  <p class="eyebrow">{{ scope === 'mine' ? 'Spaces to return to' : 'Study, together' }}</p>
  <div class="heading-row">
    <h1>{{ scope === 'mine' ? 'My Rooms' : 'Discover' }}</h1>
    <NuxtLink v-if="profile" class="button" to="/rooms/new">Create a room</NuxtLink>
  </div>
  <p>
    {{
      scope === 'mine'
        ? 'Rooms you own and rooms you have joined.'
        : 'Public spaces, open whenever you are ready. Counts show members, not live activity.'
    }}
  </p>
  <template v-if="profile"
    ><form @submit.prevent="fetchRooms()">
      <label for="search">Search rooms</label
      ><input id="search" v-model="search" class="search" maxlength="80" type="search" /><button
        :disabled="busy"
        type="submit"
        class="secondary"
      >
        Search
      </button>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="busy" role="status">Loading rooms…</p>
    <section style="margin-top: 1.5rem">
      <RoomCards :rooms="rooms" />
      <p v-if="!rooms.length && !busy" class="empty">No rooms found.</p>
    </section>
    <button v-if="cursor" class="secondary" :disabled="busy" @click="fetchRooms(true)">
      Load more
    </button></template
  ><SignIn v-else-if="!busy" />
</template>
