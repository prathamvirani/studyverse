<script setup lang="ts">
import { StudySelect } from '@study/ui';
import { roomSchema } from '@study/contracts';
import type { Room } from '@study/contracts';
import { roomAddress } from '../../lib/room-navigation';
const props = defineProps<{ room: Room; userId: string; saved: (room: Room) => void }>();
const { api } = useAccount();
const name = ref(props.room.name),
  privacy = ref(props.room.privacy),
  busy = ref(false),
  error = ref('');
watch(
  () => props.room,
  (room) => {
    if (!busy.value) {
      name.value = room.name;
      privacy.value = room.privacy;
    }
  },
);
async function save() {
  busy.value = true;
  error.value = '';
  try {
    props.saved(
      await api.request('/api/v1/rooms/update', roomSchema, {
        roomId: props.room.id,
        version: props.room.version,
        name: name.value,
        privacy: privacy.value,
        tags: props.room.tags,
        description: props.room.description,
      }),
    );
  } catch {
    error.value = 'This room changed or could not be saved. Try again.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <form v-if="room.ownerId === userId" class="quick-identity form" @submit.prevent="save">
    <label>Room name<input v-model="name" required maxlength="100" /></label>
    <StudySelect
      v-model="privacy"
      label="Room privacy"
      :options="
        ['Public', 'Unlisted', 'Private'].map((label) => ({ label, value: label.toLowerCase() }))
      "
    />
    <button :disabled="busy">Save room</button>
    <p v-if="error" role="alert">{{ error }}</p>
  </form>
  <template v-else
    ><strong>{{ room.name }}</strong>
    <p>{{ room.privacy }}</p></template
  >
  <NuxtLink class="action-link" :to="`/rooms/${roomAddress(room)}/configure`"
    >Configure room</NuxtLink
  >
</template>
<style scoped>
.quick-identity {
  width: min(280px, calc(100vw - 48px));
}
.quick-identity > button {
  margin-top: 12px;
}
</style>
