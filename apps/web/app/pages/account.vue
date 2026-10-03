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
import { PageHeader, StatusBadge, SettingsSheet } from '@study/ui';
import { providerNames } from '../lib/providers';
import { deviceSummary } from '../lib/device-summary';
const { profile, load, api } = useAccount();
const devices = ref<z.infer<typeof sessionsSchema>>([]),
  identities = ref<z.infer<typeof identityListSchema>>([]),
  providers = ref<Provider[]>([]);
const name = ref(''),
  username = ref(''),
  usernameValid = ref(false),
  error = ref(''),
  message = ref(''),
  busy = ref(true);
const labels = reactive<Record<string, string>>({});
const appearanceOpen = useState('appearance-sheet-open', () => false);
const confirmationOpen = ref(false),
  confirmationTitle = ref(''),
  confirmationText = ref('');
let confirmedAction: (() => Promise<void>) | undefined;
const connected = (p: Provider) => identities.value.some((i) => i.provider === p);
const methods = computed(() => [
  ...new Set([...providers.value, ...identities.value.map((i) => i.provider)]),
]);
async function reload() {
  if (await load()) {
    name.value = profile.value!.displayName;
    username.value = profile.value!.username ?? '';
    const [s, i, p] = await Promise.all([
      api.request('/api/v1/account/sessions', sessionsSchema),
      api.request('/api/v1/account/identities', identityListSchema),
      api.request('/api/v1/account/providers', providersSchema),
    ]);
    devices.value = s;
    identities.value = i;
    providers.value = p;
    for (const device of s) labels[device.id] = device.deviceName;
  }
}
onCriticalPageMounted(async () => {
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
  } catch (e) {
    error.value =
      e instanceof Error && e.message.includes('429')
        ? 'Username changes are limited to once every 7 days. Try again later.'
        : e instanceof Error && e.message.includes('409')
          ? 'This change conflicts with your current account. The username may be taken, or this may be your last available sign-in method.'
          : 'Unable to complete this action. For sign-in changes, reauthenticate first and try again.';
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
async function saveUsername() {
  await run(async () => {
    profile.value = await api.request('/api/v1/account/username', profileSchema, {
      username: username.value,
    });
    username.value = profile.value.username!;
    message.value = 'Username saved.';
  });
}
async function begin(provider: Provider, mode: 'link' | 'reauthenticate') {
  await run(async () => {
    const result = await api.authentication('/api/v1/account/start', oauthStartResultSchema, {
      provider,
      mode,
      returnTo: '/account',
    });
    location.assign(result.authorizationUrl);
  });
}
function confirm(title: string, text: string, work: () => Promise<void>) {
  confirmationTitle.value = title;
  confirmationText.value = text;
  confirmedAction = work;
  confirmationOpen.value = true;
}
async function confirmAction() {
  const action = confirmedAction;
  confirmationOpen.value = false;
  if (action) await run(action);
}
async function revoke(sessionId: string) {
  await api.request('/api/v1/account/revoke', okSchema, { sessionId });
  await reload();
}
async function logout(all = false) {
  await api.authentication(
    all ? '/api/v1/account/revoke-all' : '/api/v1/account/logout',
    okSchema,
    {},
  );
  profile.value = null;
  await navigateTo('/');
}
async function others() {
  await api.request('/api/v1/account/revoke-others', okSchema, {});
  await reload();
  message.value = 'Other devices signed out.';
}
async function rename(sessionId: string) {
  await run(async () => {
    await api.request('/api/v1/account/rename-session', okSchema, {
      sessionId,
      name: labels[sessionId],
    });
    await reload();
    message.value = 'Device name saved.';
  });
}
async function unlink(provider: Provider) {
  await api.request('/api/v1/account/unlink', okSchema, { provider });
  await reload();
  message.value = 'Sign-in method disconnected.';
}
</script>
<template>
  <PageHeader
    title="Account & devices"
    description="Your identity, your preferences, your peace of mind."
  />
  <p v-if="busy" role="status">Updating account…</p>
  <p v-if="error" role="alert" class="error">{{ error }}</p>
  <p v-if="message" role="status" class="account-notice">{{ message }}</p>
  <SignIn v-if="!profile && !busy" />
  <div v-if="profile" class="account-grid">
    <section class="card profile-section">
      <h2>Profile</h2>
      <p>Your display name can be shared by others.</p>
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
    <section class="card">
      <h2>Username</h2>
      <p>
        Your unique name in Study Space. Your account identity stays the same when you change it.
      </p>
      <form class="form" @submit.prevent="saveUsername">
        <UsernameField v-model="username" @valid="usernameValid = $event" /><button
          :disabled="busy || !usernameValid"
        >
          Save username
        </button>
      </form>
    </section>
    <section class="card methods-section">
      <h2>Sign-in methods</h2>
      <p>Reauthenticate with a connected method before linking or disconnecting an account.</p>
      <article v-for="provider in methods" :key="provider" class="provider-row">
        <ProviderLogo :provider="provider" />
        <div class="provider-info">
          <strong>{{ providerNames[provider] }}</strong
          ><StatusBadge>{{ connected(provider) ? 'Connected' : 'Not connected' }}</StatusBadge>
        </div>
        <div class="method-actions">
          <button
            class="secondary"
            :disabled="busy || !providers.includes(provider)"
            :aria-label="`${connected(provider) ? 'Reauthenticate with' : 'Link'} ${providerNames[provider]}`"
            @click="begin(provider, connected(provider) ? 'reauthenticate' : 'link')"
          >
            {{ connected(provider) ? 'Reauthenticate' : 'Link' }}
          </button>
          <button
            v-if="
              connected(provider) &&
              identities.some((i) => i.provider !== provider && providers.includes(i.provider))
            "
            class="secondary"
            :disabled="busy"
            :aria-label="`Disconnect ${providerNames[provider]}`"
            @click="
              confirm(
                `Disconnect ${providerNames[provider]}?`,
                'You will need another connected method to sign in.',
                () => unlink(provider),
              )
            "
          >
            Disconnect
          </button>
        </div>
      </article>
    </section>
    <section class="card devices-section">
      <div class="heading-row">
        <h2>Signed-in devices</h2>
        <button
          class="secondary"
          :disabled="busy"
          @click="
            confirm('Sign out other devices?', 'Your current session will stay signed in.', others)
          "
        >
          Sign out other devices
        </button>
      </div>
      <p class="muted">
        Browser details are estimates reported by each device. Names are personal labels and do not
        change access.
      </p>
      <div class="device-grid">
        <article v-for="device in devices" :key="device.id" class="device-card">
          <div class="heading-row">
            <h3>{{ device.deviceName || deviceSummary(device.deviceLabel) }}</h3>
            <StatusBadge v-if="device.current">This device</StatusBadge>
          </div>
          <p v-if="device.deviceName">{{ deviceSummary(device.deviceLabel) }}</p>
          <p class="muted">Last active {{ new Date(device.lastActiveAt).toLocaleString() }}</p>
          <details>
            <summary>Device details & name</summary>
            <form class="form" @submit.prevent="rename(device.id)">
              <label
                >Device name<input
                  v-model="labels[device.id]"
                  maxlength="60"
                  placeholder="My laptop" /></label
              ><button class="secondary" :disabled="busy">Save device name</button>
            </form>
            <details>
              <summary>Technical details</summary>
              <p class="raw-ua">{{ device.deviceLabel }}</p>
            </details>
          </details>
          <button
            class="secondary device-signout"
            :disabled="busy"
            @click="
              device.current
                ? run(() => logout())
                : confirm('Sign out device?', 'This device will need to sign in again.', () =>
                    revoke(device.id),
                  )
            "
          >
            {{ device.current ? 'Sign out this session' : 'Sign out device' }}
          </button>
        </article>
      </div>
    </section>
    <section class="card">
      <h2>Appearance</h2>
      <p>Find your light, choose a comfortable page width, and adjust glass transparency.</p>
      <button class="secondary" @click="appearanceOpen = true">Appearance & layout</button>
    </section>
    <section class="card"><PresenceSettings /></section>
    <section class="card"><BlockedPeople /></section>
    <section class="card">
      <h2>Leaving for now?</h2>
      <p>Sign out here, or end every session across your devices.</p>
      <div class="actions">
        <button class="secondary" :disabled="busy" @click="run(() => logout())">Sign out</button
        ><button
          class="secondary"
          :disabled="busy"
          @click="
            confirm(
              'Sign out all devices?',
              'This includes your current session. You can sign in again any time.',
              () => logout(true),
            )
          "
        >
          Sign out all devices
        </button>
      </div>
    </section>
    <DeleteAccount
      :providers="identities.map((i) => i.provider).filter((p) => providers.includes(p))"
    />
  </div>
  <SettingsSheet v-model:open="confirmationOpen" :title="confirmationTitle"
    ><p>{{ confirmationText }}</p>
    <button class="danger" @click="confirmAction">Confirm</button></SettingsSheet
  >
</template>
<style scoped>
.account-grid :deep(.presence-settings) {
  margin-top: 0;
}
.account-grid {
  columns: 2;
  column-gap: 24px;
}
.account-grid > section {
  break-inside: avoid;
  margin: 0 0 24px;
  padding: clamp(20px, 2.5vw, 32px);
}
.account-notice {
  color: var(--success);
  font-size: 0.875rem;
}
.provider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 0;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.provider-row:last-child {
  border: 0;
  padding-bottom: 0;
}
.provider-info {
  justify-items: start;
  display: grid;
  gap: 8px;
  flex: 1;
}
.method-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 24px;
}
.device-card {
  min-width: 0;
  padding: 20px;
  background: var(--surface-elevated);
  border-radius: var(--radius-card);
}
.device-card h3 {
  margin: 0;
  overflow-wrap: anywhere;
}
.device-card .heading-row {
  align-items: start;
}
.raw-ua {
  overflow-wrap: anywhere;
  font-size: 0.8rem;
}
summary {
  cursor: pointer;
  padding: 8px 0;
  color: var(--text-secondary);
}
.device-signout {
  margin-top: 16px;
}
.privacy-heading {
  margin-top: 32px;
}
@media (max-width: 850px) {
  .account-grid {
    columns: 1;
  }
  .devices-section {
    grid-column: auto;
  }
}
</style>
