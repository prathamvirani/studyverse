<script setup lang="ts">
import { roomSchema } from '@study/contracts';
const { profile, load, api } = useAccount();
const token = ref(''),
  busy = ref(true),
  error = ref('');
onMounted(async () => {
  token.value = location.hash.slice(1);
  history.replaceState(null, '', '/invite');
  await load();
  busy.value = false;
});
async function redeem() {
  busy.value = true;
  error.value = '';
  try {
    const room = await api.request('/api/v1/rooms/invite-redeem', roomSchema, {
      token: token.value,
    });
    token.value = '';
    await navigateTo(`/rooms/${room.id}`);
  } catch {
    error.value = 'This invite is invalid, expired, revoked or fully used.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="hero">
    <p class="eyebrow">A space is waiting</p>
    <h1>You’re invited.</h1>
    <p v-if="!profile">
      Sign in, then reopen your invite link to join. Invite details stay private until you redeem
      it.
    </p>
    <SignIn v-if="!profile && !busy" /><template v-if="profile"
      ><p>Accept this invitation to become a room member.</p>
      <button :disabled="busy || !token" @click="redeem">Accept invitation</button></template
    >
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </section>
</template>
