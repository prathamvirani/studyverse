<script setup lang="ts">
definePageMeta({ alias: ['/home'] });
import { roomBrowseSchema } from '@study/contracts';
import type { Room } from '@study/contracts';
import { PageHeader, ContextPane } from '@study/ui';
import { socialKey } from '../lib/social';
const { profile, load, api } = useAccount();
const social = inject(socialKey)!;
const mine = ref<Room[]>([]),
  discover = ref<Room[]>([]),
  loading = ref(true),
  error = ref('');
const friends = computed(() =>
  [...(social.state.snapshot?.friends ?? [])]
    .sort((a, b) => {
      const score = (person: typeof a) =>
        (person.room && mine.value.some((r) => r.id === person.room?.id) ? 2 : 0) +
        (person.status && person.status !== 'offline' ? 1 : 0);
      return score(b) - score(a) || a.name.localeCompare(b.name);
    })
    .slice(0, 8),
);
onCriticalPageMounted(async () => {
  try {
    if (await load()) {
      const [a, b] = await Promise.all([
        api.request('/api/v1/rooms/browse?scope=mine', roomBrowseSchema),
        api.request('/api/v1/rooms/browse?scope=discover', roomBrowseSchema),
      ]);
      mine.value = a.rooms;
      discover.value = b.rooms.filter((r) => !mine.value.some((own) => own.id === r.id));
    }
  } catch {
    error.value = 'Your rooms could not load. Please refresh to try again.';
  } finally {
    loading.value = false;
  }
});
</script>
<template>
  <AuthWelcome v-if="!profile && !loading" />
  <p v-if="loading" role="status">Finding your space…</p>
  <p v-if="error" role="alert" class="error">{{ error }}</p>
  <template v-if="profile">
    <PageHeader
      title="Where will you study today?"
      :description="`Welcome back, ${profile.displayName}.`"
      ><template #title><HomeHeadline /></template
      ><template #actions
        ><NuxtLink class="button" to="/rooms/new">Create a room</NuxtLink></template
      ></PageHeader
    >
    <div class="home-layout">
      <ContextPane label="Friends"
        ><div class="heading-row">
          <h2>Friends</h2>
          <NuxtLink class="action-link" to="/friends">See all</NuxtLink>
        </div>
        <p v-if="!social.state.snapshot">
          {{ social.state.connected ? 'Loading friends…' : 'Reconnecting…' }}
        </p>
        <p v-else-if="!friends.length">
          A little company helps. Meet someone in a room and add them as a friend.
        </p>
        <FriendContext v-for="person in friends" :key="person.id" :person="person" :rooms="mine" />
        <NuxtLink class="home-add action-link" to="/friends">Find a study friend →</NuxtLink>
      </ContextPane>
      <div class="home-rooms">
        <section>
          <div class="heading-row">
            <h2>My Rooms</h2>
            <NuxtLink class="action-link" to="/my-rooms">All my rooms →</NuxtLink>
          </div>
          <RoomCards :rooms="mine.slice(0, 8)" />
          <div v-if="!mine.length && !loading" class="empty">
            <h3>A room to return to</h3>
            <p>Create your first space or join a public room below.</p>
            <NuxtLink class="button" to="/rooms/new">Create Room</NuxtLink>
          </div>
        </section>
        <section>
          <div class="heading-row">
            <h2>Public Rooms</h2>
            <NuxtLink class="action-link" to="/discover">Explore rooms →</NuxtLink>
          </div>
          <RoomCards :rooms="discover.slice(0, 8)" />
          <p v-if="!discover.length && !loading" class="empty">
            No new public rooms to explore yet.
          </p>
        </section>
      </div>
    </div>
  </template>
</template>
<style scoped>
.home-layout {
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}
.home-rooms {
  min-width: 0;
}
.home-rooms section + section {
  margin-top: 2.5rem;
}
.home-friend {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.8rem 0;
  text-decoration: none;
  border-bottom: 1px solid var(--border);
  overflow-wrap: anywhere;
}
.home-friend small {
  display: block;
  color: var(--text-secondary);
  line-height: 1.5;
}
.home-friend strong {
  font-weight: 500;
}
.home-avatar {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--accent-subtle);
  color: var(--accent);
}
.home-add {
  display: inline-flex;
  margin-top: 1.5rem;
}
@media (max-width: 1000px) {
  .home-layout {
    grid-template-columns: 1fr;
  }
  .home-layout aside {
    order: 0;
  }
}
</style>
