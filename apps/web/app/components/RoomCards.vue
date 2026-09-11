<script setup lang="ts">
import type { Room } from '@study/contracts';
defineProps<{ rooms: Room[] }>();
</script>
<template>
  <div class="grid">
    <article v-for="room in rooms" :key="room.id" class="card">
      <span class="tag">{{ room.privacy }}</span
      ><span v-if="room.membership" class="tag">{{ room.membership }}</span>
      <h3>{{ room.name }}</h3>
      <p v-if="room.description">{{ room.description }}</p>
      <p class="muted">
        {{ room.memberCount }} {{ room.memberCount === 1 ? 'member' : 'members' }} · Available any
        time
      </p>
      <p v-if="room.tags.length">
        <span v-for="tag in room.tags" :key="tag" class="tag">{{ tag }}</span>
      </p>
      <NuxtLink class="button secondary" :to="`/rooms/${room.id}`">{{
        room.membership ? 'Open room' : 'View room'
      }}</NuxtLink>
    </article>
  </div>
</template>
