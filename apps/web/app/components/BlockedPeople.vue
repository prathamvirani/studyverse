<script setup lang="ts">
import { okSchema } from '@study/contracts';
import { socialKey } from '../lib/social';
const social = inject(socialKey)!;
const { api } = useAccount();
const busy = ref(''),
  error = ref('');
async function unblock(id: string) {
  busy.value = id;
  error.value = '';
  try {
    await api.request('/api/v1/friends/unblock', okSchema, { targetId: id });
  } catch {
    error.value = 'This person could not be unblocked. Try again.';
  } finally {
    busy.value = '';
  }
}
</script>
<template>
  <section class="blocked-people">
    <h2>Blocked people</h2>
    <p>
      Blocking hides presence and prevents invitations in both directions. Unblocking does not
      restore friendship.
    </p>
    <p v-if="!social.state.snapshot">Loading blocked people…</p>
    <p v-else-if="!social.state.snapshot.blocked.length">No blocked people.</p>
    <div v-for="person in social.state.snapshot?.blocked" :key="person.id" class="heading-row">
      <span>{{ person.name }}</span
      ><button class="secondary" :disabled="!!busy" @click="unblock(person.id)">Unblock</button>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
