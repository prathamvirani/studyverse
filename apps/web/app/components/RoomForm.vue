<script setup lang="ts">
import { roomSchema } from '@study/contracts';
import type { Room } from '@study/contracts';
const props = defineProps<{ room?: Room }>();
const emit = defineEmits<{ saved: [room: Room] }>();
const { api } = useAccount();
const name = ref(props.room?.name ?? ''),
  description = ref(props.room?.description ?? ''),
  tags = ref(props.room?.tags.join(', ') ?? ''),
  privacy = ref(props.room?.privacy ?? 'private');
const busy = ref(false),
  error = ref('');
async function save() {
  busy.value = true;
  error.value = '';
  try {
    const result = await api.request(
      props.room ? '/api/v1/rooms/update' : '/api/v1/rooms/create',
      roomSchema,
      {
        name: name.value,
        description: description.value,
        tags: tags.value
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        privacy: privacy.value,
        ...(props.room ? { roomId: props.room.id, version: props.room.version } : {}),
      },
    );
    emit('saved', result);
  } catch {
    error.value =
      'Unable to save. Check your fields and permissions, or reload if the room changed.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <form class="form" @submit.prevent="save">
    <label>Room name<input v-model="name" required maxlength="100" autocomplete="off" /></label
    ><label
      >Description <span class="muted">(optional)</span
      ><textarea v-model="description" maxlength="1000" /></label
    ><label
      >Tags <span class="muted">(optional)</span><input v-model="tags" maxlength="247" /><small
        >Up to 8 comma-separated tags, 30 characters each.</small
      ></label
    ><label
      >Privacy<select v-model="privacy">
        <option value="private">Private — members and invited people</option>
        <option value="unlisted">Unlisted — anyone with the room link</option>
        <option value="public">Public — listed in Discover</option></select
      ><small
        >Rooms remain available when you are offline. Changing privacy revokes existing invite
        links; existing memberships remain.</small
      ></label
    >
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <button :disabled="busy">{{ busy ? 'Saving…' : room ? 'Save changes' : 'Create room' }}</button>
  </form>
</template>
