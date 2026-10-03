<script setup lang="ts">
import { SettingsSheet } from '@study/ui';
import { deletionStatusSchema, oauthStartResultSchema, okSchema } from '@study/contracts';
import type { Provider } from '@study/contracts';
import { providerNames } from '../lib/providers';
import { clearAccountLocal } from '../lib/clear-account-local';
defineProps<{ providers: Provider[] }>();
const { api, profile } = useAccount();
const route = useRoute(),
  open = ref(false),
  ready = ref(false),
  confirmation = ref(''),
  busy = ref(false),
  error = ref('');
async function inspect() {
  try {
    ready.value = (
      await api.request('/api/v1/account/deletion-status', deletionStatusSchema)
    ).ready;
  } catch {
    ready.value = false;
  }
}
onMounted(async () => {
  if (route.hash === '#delete') {
    open.value = true;
    await inspect();
  }
});
async function begin(provider: Provider) {
  busy.value = true;
  error.value = '';
  try {
    const result = await api.authentication('/api/v1/account/start', oauthStartResultSchema, {
      provider,
      mode: 'reauthenticate',
      returnTo: '/account#delete',
    });
    location.assign(result.authorizationUrl);
  } catch {
    error.value = 'Reauthentication could not start. Please try again.';
    busy.value = false;
  }
}
async function remove() {
  if (confirmation.value !== 'DELETE' || !profile.value) return;
  busy.value = true;
  error.value = '';
  const id = profile.value.id;
  try {
    await api.authentication('/api/v1/account/delete-account', okSchema, {
      confirmation: confirmation.value,
    });
  } catch {
    ready.value = false;
    busy.value = false;
    error.value = 'Deletion was not confirmed. Reauthenticate and try again.';
    return;
  }
  profile.value = null;
  api.clear();
  try {
    await clearAccountLocal(id);
  } catch {
    location.assign('/?deleted=local-cleanup');
    return;
  }
  location.assign('/?deleted=done');
}
</script>
<template>
  <section class="card danger-zone">
    <p class="eyebrow">Permanent changes</p>
    <h2>Danger Zone</h2>
    <p>Delete your account and its data. This cannot be undone.</p>
    <button
      class="danger"
      @click="
        open = true;
        inspect();
      "
    >
      Delete account
    </button>
  </section>
  <SettingsSheet v-model:open="open" title="Delete your account">
    <p>
      Your owned rooms and everything in them will be deleted, including other members’ shared
      content. Your messages and tasks in other rooms, personal tasks and timers, invitations,
      friendships and sign-in methods will also be deleted.
    </p>
    <p>
      Other people’s rooms and their contributions remain. All your devices are signed out and media
      access is revoked. This browser’s Study Space preferences and your imported backgrounds are
      cleared. Other devices’ local files must be cleared on those devices.
    </p>
    <template v-if="!ready">
      <h3>First, verify it’s you</h3>
      <p>Continue with a connected account. This verification lasts five minutes.</p>
      <button
        v-for="provider in providers"
        :key="provider"
        class="secondary reauth-button"
        :disabled="busy"
        @click="begin(provider)"
      >
        <ProviderLogo :provider="provider" />Reauthenticate with {{ providerNames[provider] }}
      </button>
    </template>
    <form v-else class="form" @submit.prevent="remove">
      <p class="success">Reauthentication complete. Review the consequences before continuing.</p>
      <label
        >Type DELETE to confirm<input v-model="confirmation" autocomplete="off" spellcheck="false"
      /></label>
      <button class="danger" :disabled="busy || confirmation !== 'DELETE'">
        {{ busy ? 'Deleting…' : 'Permanently delete my account' }}
      </button>
    </form>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </SettingsSheet>
</template>
<style scoped>
.danger-zone {
  border-color: var(--danger);
}
.reauth-button {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}
</style>
