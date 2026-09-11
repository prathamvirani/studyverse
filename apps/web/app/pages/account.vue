<script setup lang="ts">
import {
  profileSchema,
  sessionsSchema,
  identityListSchema,
  providersSchema,
  oauthStartResultSchema,
  okSchema,
} from '@study/contracts';
import type { Provider, z } from '@study/contracts';
const { profile, load, api } = useAccount();
const devices = ref<z.infer<typeof sessionsSchema>>([]),
  identities = ref<z.infer<typeof identityListSchema>>([]),
  providers = ref<Provider[]>([]),
  name = ref(''),
  error = ref(''),
  message = ref(''),
  busy = ref(true);
async function reload() {
  if (await load()) {
    name.value = profile.value!.displayName;
    const [s, i, p] = await Promise.all([
      api.request('/api/v1/account/sessions', sessionsSchema),
      api.request('/api/v1/account/identities', identityListSchema),
      api.request('/api/v1/account/providers', providersSchema),
    ]);
    devices.value = s;
    identities.value = i;
    providers.value = p;
  }
}
onMounted(async () => {
  try {
    await reload();
  } catch {
    error.value = 'Account details could not load. Please refresh.';
  } finally {
    busy.value = false;
  }
});
async function run(work: () => Promise<void>) {
  busy.value = true;
  error.value = '';
  message.value = '';
  try {
    await work();
  } catch {
    error.value =
      'Unable to complete this action. For linking, reauthenticate first, then try again.';
  } finally {
    busy.value = false;
  }
}
async function save() {
  await run(async () => {
    profile.value = await api.request('/api/v1/account/profile', profileSchema, {
      displayName: name.value,
    });
    message.value = 'Profile saved.';
  });
}
async function begin(provider: Provider, mode: 'link' | 'reauthenticate') {
  await run(async () => {
    const result = await api.authentication('/api/v1/account/start', oauthStartResultSchema, {
      provider,
      mode,
    });
    location.assign(result.authorizationUrl);
  });
}
async function revoke(sessionId: string) {
  await run(async () => {
    await api.request('/api/v1/account/revoke', okSchema, { sessionId });
    await reload();
  });
}
async function others() {
  await run(async () => {
    await api.request('/api/v1/account/revoke-others', okSchema, {});
    await reload();
    message.value = 'Other devices signed out.';
  });
}
async function logout(all = false) {
  await run(async () => {
    await api.authentication(
      all ? '/api/v1/account/revoke-all' : '/api/v1/account/logout',
      okSchema,
      {},
    );
    profile.value = null;
    await navigateTo('/');
  });
}
</script>
<template>
  <p class="eyebrow">Your space, your account</p>
  <h1>Account & devices</h1>
  <p v-if="busy" role="status">Updating account…</p>
  <p v-if="error" role="alert" class="error">{{ error }}</p>
  <p v-if="message" role="status" class="success">{{ message }}</p>
  <SignIn v-if="!profile && !busy" /><template v-if="profile"
    ><section class="card">
      <h2>Profile</h2>
      <form class="form" @submit.prevent="save">
        <label
          >Display name<input
            v-model="name"
            required
            maxlength="80"
            autocomplete="nickname" /></label
        ><button :disabled="busy">Save profile</button>
      </form>
    </section>
    <section>
      <h2>Sign-in methods</h2>
      <p>
        Accounts are linked only when you explicitly choose to link them. Reauthenticate with an
        existing method before linking.
      </p>
      <div class="actions">
        <button
          v-for="identity in identities"
          :key="identity.provider"
          :disabled="busy"
          class="secondary"
          @click="begin(identity.provider, 'reauthenticate')"
        >
          Reauthenticate with {{ identity.provider }}
        </button>
      </div>
      <div class="actions" style="margin-top: 1rem">
        <button
          v-for="provider in providers.filter((p) => !identities.some((i) => i.provider === p))"
          :key="provider"
          :disabled="busy"
          class="secondary"
          @click="begin(provider, 'link')"
        >
          Link {{ provider }}
        </button>
      </div>
    </section>
    <section>
      <div class="heading-row">
        <h2>Signed-in devices</h2>
        <button :disabled="busy" class="secondary" @click="others">Sign out other devices</button>
      </div>
      <p class="muted">
        Device labels come from the browser and are informational. Last activity reflects session
        renewal.
      </p>
      <article v-for="device in devices" :key="device.id" class="card device">
        <div>
          <strong>{{ device.current ? 'This device' : 'Other device' }}</strong>
          <p class="device-label">{{ device.deviceLabel }}</p>
          <p class="muted">Last active {{ new Date(device.lastActiveAt).toLocaleString() }}</p>
        </div>
        <button v-if="!device.current" :disabled="busy" class="danger" @click="revoke(device.id)">
          Sign out device
        </button>
      </article>
    </section>
    <div class="actions">
      <button :disabled="busy" class="secondary" @click="logout()">Sign out</button
      ><button :disabled="busy" class="danger" @click="logout(true)">Sign out all devices</button>
    </div></template
  >
</template>
