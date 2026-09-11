<script setup lang="ts">
const { profile, load } = useAccount();
const loading = ref(true);
onMounted(async () => {
  await load();
  loading.value = false;
});
</script>
<template>
  <p class="eyebrow">Make it yours</p>
  <h1>Create a room</h1>
  <p>A lasting space for your next study session.</p>
  <p v-if="loading" role="status">Loading…</p>
  <RoomForm v-else-if="profile" @saved="(room) => navigateTo(`/rooms/${room.id}`)" /><SignIn
    v-else
  />
</template>
