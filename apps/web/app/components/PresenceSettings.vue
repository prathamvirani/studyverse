<script setup lang="ts">
import { socialPrivacySchema } from '@study/contracts';
import type { Privacy, PresenceStatus } from '@study/contracts';
import { StudySelect } from '@study/ui';
import { socialKey, statusLabels } from '../lib/social';
const social = inject(socialKey)!,
  { api } = useAccount();
const privacy = ref<Privacy>({
  online: true,
  room: false,
  study: true,
  join: false,
  invites: true,
});
const busy = ref(false),
  error = ref(''),
  notice = ref('');
watch(
  () => social.state.snapshot?.privacy,
  (p) => {
    if (p) privacy.value = { ...p };
  },
  { immediate: true },
);
async function savePrivacy() {
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await api.request('/api/v1/friends/privacy', socialPrivacySchema, privacy.value);
    notice.value = 'Privacy saved.';
  } catch {
    error.value = 'Privacy could not be saved.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section id="presence" class="presence-settings">
    <h2>Presence & invitation privacy</h2>
    <p>
      Choose what people outside your room can see. People studying in the same room can see its
      participants. Private and unlisted rooms are visible only to members.
    </p>
    <StudySelect
      label="Status"
      :model-value="social.state.status"
      :options="Object.entries(statusLabels).map(([value, label]) => ({ value, label }))"
      @update:model-value="social.status($event as PresenceStatus)"
    />
    <form @submit.prevent="savePrivacy">
      <label
        class="checkbox-row"
        v-for="(label, key) in {
          online: 'Show online presence',
          room: 'Show current room',
          study: 'Show study status',
          join: 'Show Join action',
          invites: 'Receive friend invitations',
        }"
        :key="key"
        ><input v-model="privacy[key]" type="checkbox" /> {{ label }}</label
      ><button :disabled="busy || !social.state.snapshot">Save privacy</button>
    </form>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </section>
</template>
<style scoped>
.presence-settings {
  margin-top: 2rem;
}
form {
  display: grid;
  gap: 0.75rem;
}
label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
input {
  width: auto;
}
button {
  justify-self: start;
}
.ui-select {
  max-width: 300px;
}
</style>
