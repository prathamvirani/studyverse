<script setup lang="ts">
import { okSchema, providerSchema } from '@study/contracts';
const route = useRoute(),
  { api, load } = useAccount();
const error = ref('');
useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }] });
onMounted(async () => {
  const provider = providerSchema.safeParse(route.params.provider);
  const params = new URLSearchParams(location.search);
  const state = params.getAll('state'),
    code = params.getAll('code');
  history.replaceState(null, '', location.pathname);
  if (!provider.success || params.has('error') || state.length !== 1 || code.length !== 1) {
    error.value = 'Sign-in was cancelled or the response was invalid. Please start again.';
    return;
  }
  try {
    await api.authentication('/api/v1/account/finish', okSchema, {
      provider: provider.data,
      state: state[0],
      code: code[0],
    });
    await load();
    await navigateTo('/account', { replace: true });
  } catch {
    error.value =
      'Unable to complete sign-in. The link may have expired, or the identity may belong to another account. Please start again.';
  }
});
</script>
<template>
  <section class="hero">
    <p class="eyebrow">Welcome back</p>
    <h1>{{ error ? 'Let’s try again.' : 'Signing you in…' }}</h1>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else role="status">Securely completing your sign-in.</p>
    <NuxtLink v-if="error" class="button" to="/">Back to Home</NuxtLink>
  </section>
</template>
