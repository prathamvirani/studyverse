<script setup lang="ts">
import { providersSchema, oauthStartResultSchema, safeReturnTo } from '@study/contracts';
import type { Provider } from '@study/contracts';
import { providerNames } from '../lib/providers';
const props = defineProps<{ returnTo?: string; inviteToken?: string }>();
const route = useRoute();
const { api, load, profile } = useAccount();
const providers = ref<Provider[]>([]),
  loading = ref(true);
const pending = ref<Provider | null>(null),
  errors = reactive<Partial<Record<Provider, string>>>({});
const error = ref('');
async function discover() {
  loading.value = true;
  error.value = '';
  try {
    await load();
    if (!profile.value)
      providers.value = await api.request('/api/v1/account/providers', providersSchema);
  } catch {
    error.value = 'Sign-in options could not load. Please try again.';
  } finally {
    loading.value = false;
  }
}
onMounted(discover);
async function signIn(provider: Provider) {
  pending.value = provider;
  errors[provider] = '';
  try {
    const result = await api.authentication('/api/v1/account/start', oauthStartResultSchema, {
      provider,
      mode: 'login',
      returnTo: safeReturnTo(props.returnTo ?? route.fullPath),
      ...(props.inviteToken ? { referralToken: props.inviteToken } : {}),
    });
    window.location.assign(result.authorizationUrl);
  } catch {
    errors[provider] =
      `${providerNames[provider]} sign-in could not start. Try again or choose another method.`;
    pending.value = null;
  }
}
</script>
<template>
  <div class="sign-in-options">
    <p v-if="loading" role="status">Loading sign-in options…</p>
    <p v-else-if="profile">
      You’re signed in. <NuxtLink class="action-link" to="/home">Continue to Home</NuxtLink>
    </p>
    <p v-else-if="!providers.length && !error" class="muted">
      Sign-in is being set up. Please check back soon.
    </p>
    <template v-if="!profile">
      <div v-for="provider in providers" :key="provider">
        <button
          class="provider-button secondary"
          :class="`provider-${provider}`"
          :disabled="pending !== null"
          :aria-busy="pending === provider"
          @click="signIn(provider)"
        >
          <ProviderLogo :provider="provider" /><span>{{
            pending === provider
              ? `Connecting to ${providerNames[provider]}…`
              : `Continue with ${providerNames[provider]}`
          }}</span>
        </button>
        <p v-if="errors[provider]" class="error" role="alert">{{ errors[provider] }}</p>
      </div>
    </template>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <button v-if="error" class="secondary" @click="discover">Try again</button>
  </div>
</template>
<style scoped>
.sign-in-options {
  display: grid;
  gap: 12px;
}
.provider-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}
.provider-google {
  background: #fff;
  color: #1f1f1f;
  border: 1px solid #747775;
}
.provider-google:hover {
  background: #f2f2f2;
}
</style>
