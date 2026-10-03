<script setup lang="ts">
import { roomAddress } from '../../lib/room-navigation';
import { PageHeader } from '@study/ui';
const { profile, load } = useAccount();
const loading = ref(true);
onCriticalPageMounted(async () => {
  await load();
  loading.value = false;
});
</script>
<template>
  <PageHeader title="Create a room" description="A lasting space for your next study session." />
  <p v-if="loading" role="status">Loading…</p>
  <RoomForm
    v-else-if="profile"
    @saved="(room) => navigateTo(`/rooms/${roomAddress(room)}/configure`)"
  /><SignIn v-else />
</template>
