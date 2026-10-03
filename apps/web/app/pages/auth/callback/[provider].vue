<script setup lang="ts">
import { oauthFinishResultSchema, providerSchema, safeReturnTo } from '@study/contracts';
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
    const result = await api.authentication('/api/v1/account/finish', oauthFinishResultSchema, {
      provider: provider.data,
      state: state[0],
      code: code[0],
    });
    await load();
    await navigateTo(safeReturnTo(result.returnTo), { replace: true });
  } catch {
    error.value =
      'Unable to complete sign-in. The link may have expired, or the identity may belong to another account. Please start again.';
  }
});
</script>
<template>
  <section class="callback-card card">
    <p class="eyebrow">Welcome back</p>
    <h1>{{ error ? 'Let’s try again.' : 'Signing you in…' }}</h1>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else role="status">Securely completing your sign-in.</p>
    <NuxtLink v-if="error" class="button" to="/">Back to Home</NuxtLink>
  </section>
</template>

<style scoped>
.callback-card {
  max-width: 560px;
  margin: 12dvh auto;
}
</style>
