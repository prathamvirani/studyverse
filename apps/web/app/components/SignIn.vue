<script setup lang="ts">
import { providersSchema, oauthStartResultSchema } from '@study/contracts';
import type { Provider } from '@study/contracts';
const { api } = useAccount();
const providers = ref<Provider[]>([]),
  loading = ref(true),
  busy = ref(false),
  error = ref('');
onMounted(async () => {
  try {
    providers.value = await api.request('/api/v1/account/providers', providersSchema);
  } catch {
    error.value = 'Sign-in is unavailable. Please try again shortly.';
  } finally {
    loading.value = false;
  }
});
async function signIn(provider: Provider) {
  busy.value = true;
  error.value = '';
  try {
    const result = await api.authentication('/api/v1/account/start', oauthStartResultSchema, {
      provider,
      mode: 'login',
    });
    window.location.assign(result.authorizationUrl);
  } catch {
    error.value = 'Unable to start sign-in. Please try again.';
    busy.value = false;
  }
}
</script>
<template>
  <div>
    <p v-if="loading" role="status">Loading sign-in options…</p>
    <p v-else-if="!providers.length && !error" class="muted">
      Sign-in is being set up. Please check back soon.
    </p>
    <div class="actions">
      <button
        v-for="provider in providers"
        :key="provider"
        :disabled="busy"
        class="secondary"
        @click="signIn(provider)"
      >
        Continue with {{ provider[0]!.toUpperCase() + provider.slice(1) }}
      </button>
    </div>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </div>
</template>
