<script setup lang="ts">
import { roomSchema, roomFieldsSchema } from '@study/contracts';
import type { Room } from '@study/contracts';
const props = defineProps<{ room?: Room }>();
const emit = defineEmits<{ saved: [room: Room] }>();
const { api } = useAccount();
const name = ref(props.room?.name ?? ''),
  description = ref(props.room?.description ?? ''),
  tags = ref(props.room?.tags.join(', ') ?? ''),
  privacy = ref(props.room?.privacy ?? 'private');
const preview = computed<Room>(() => ({
  id: props.room?.id ?? '00000000-0000-4000-8000-000000000000',
  ownerId: props.room?.ownerId ?? '00000000-0000-4000-8000-000000000000',
  name: name.value,
  description: description.value,
  privacy: privacy.value,
  tags: tags.value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean),
  version: props.room?.version ?? 1,
  createdAt: props.room?.createdAt ?? new Date(0).toISOString(),
  membership: 'owner',
  memberCount: props.room?.memberCount ?? 1,
  backgroundId: props.room?.backgroundId ?? null,
}));
const busy = ref(false),
  error = ref('');
async function save() {
  const validation = roomFieldsSchema.safeParse({
    name: name.value,
    description: description.value,
    privacy: privacy.value,
    tags: preview.value.tags,
  });
  if (!validation.success) {
    error.value = validation.error.issues.map((i) => i.message).join(' ');
    return;
  }
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
  <div class="room-form-layout">
    <form class="form room-form" @submit.prevent="save">
      <label>Room name<input v-model="name" required maxlength="100" autocomplete="off" /></label
      ><label
        >Description <span class="muted">(optional)</span
        ><textarea v-model="description" maxlength="1000" /></label
      ><label
        >Tags <span class="muted">(optional)</span><input v-model="tags" maxlength="247" /><small
          >Up to 8 comma-separated tags, 30 characters each.</small
        ></label
      >
      <fieldset>
        <legend>Privacy</legend>
        <div class="privacy-options">
          <label
            v-for="option in [
              { value: 'private', title: 'Private', text: 'Members and invited people' },
              { value: 'unlisted', title: 'Unlisted', text: 'Anyone with the room link' },
              { value: 'public', title: 'Public', text: 'Listed in Discover' },
            ]"
            :key="option.value"
            class="privacy-option"
            :class="{ selected: privacy === option.value }"
            ><input v-model="privacy" type="radio" name="room-privacy" :value="option.value" /><span
              ><strong>{{ option.title }}</strong
              ><small>{{ option.text }}</small></span
            ></label
          >
        </div>
        <p class="muted">
          Available even when the owner is away. Changing privacy revokes existing invite links;
          existing memberships remain.
        </p>
      </fieldset>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <button :disabled="busy">
        {{ busy ? 'Saving…' : room ? 'Save changes' : 'Create room' }}
      </button>
    </form>
    <aside aria-label="Room preview">
      <h2>Your room at a glance</h2>
      <RoomCard :room="preview" preview />
      <p class="muted">
        Choose a room background after entering. Personal backgrounds stay on your device.
      </p>
    </aside>
  </div>
</template>

<style scoped>
.room-form-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr);
  gap: 2rem;
  align-items: start;
}
.room-form {
  max-width: none;
  padding: 1.5rem;
  background: var(--surface);
  border-radius: var(--radius-card);
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
legend {
  font-weight: 500;
  margin-bottom: 0.75rem;
}
.privacy-options {
  display: grid;
  gap: 0.75rem;
}
.privacy-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 1rem;
  cursor: pointer;
}
.privacy-option.selected {
  border-color: var(--accent);
  background: var(--accent-subtle);
}
.privacy-option input {
  width: auto;
  margin: 0;
}
.privacy-option small {
  display: block;
}
.privacy-option strong {
  font-weight: 500;
}
fieldset p,
aside p {
  font-size: 0.85rem;
  margin-top: 1rem;
}
@media (max-width: 1000px) {
  .room-form-layout {
    grid-template-columns: 1fr;
  }
  aside {
    max-width: 500px;
  }
}
</style>
