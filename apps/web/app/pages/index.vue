<script setup lang="ts">
import { roomListSchema } from '@study/contracts';
import type { Room } from '@study/contracts';
const { profile, load, api } = useAccount();
const mine = ref<Room[]>([]),
  discover = ref<Room[]>([]),
  loading = ref(true),
  error = ref('');
onMounted(async () => {
  try {
    if (await load()) {
      const [a, b] = await Promise.all([
        api.request('/api/v1/rooms/mine', roomListSchema),
        api.request('/api/v1/rooms/discover', roomListSchema),
      ]);
      mine.value = a.rooms.slice(0, 3);
      discover.value = b.rooms.slice(0, 3);
    }
  } catch {
    error.value = 'Your rooms could not load. Please refresh to try again.';
  } finally {
    loading.value = false;
  }
});
</script>
<template>
  <section class="hero">
    <p class="eyebrow">A little space for you</p>
    <h1>A quiet place to focus.</h1>
    <p>
      {{
        profile
          ? `Welcome back, ${profile.displayName}. Your room is here whenever you are ready.`
          : 'Find your people, make a room, and settle into the work that matters to you.'
      }}
    </p>
    <NuxtLink v-if="profile" class="button" to="/rooms/new">Create a room</NuxtLink
    ><SignIn v-else-if="!loading" />
  </section>
  <p v-if="loading" role="status">Finding your space…</p>
  <p v-if="error" role="alert" class="error">{{ error }}</p>
  <template v-if="profile"
    ><section>
      <div class="heading-row">
        <h2>Your spaces</h2>
        <NuxtLink to="/my-rooms">All my rooms →</NuxtLink>
      </div>
      <RoomCards :rooms="mine" />
      <p v-if="!mine.length && !loading" class="empty">
        A room to return to. Create your first space or join one below.
      </p>
    </section>
    <section>
      <div class="heading-row">
        <h2>Find a place to study</h2>
        <NuxtLink to="/discover">Explore rooms →</NuxtLink>
      </div>
      <RoomCards :rooms="discover" />
      <p v-if="!discover.length && !loading" class="empty">
        No public rooms yet. Yours could be the first.
      </p>
    </section></template
  >
</template>
