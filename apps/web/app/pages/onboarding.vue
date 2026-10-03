<script setup lang="ts">
import { profileSchema, safeReturnTo } from '@study/contracts';
import { GlassSurface, StatusBadge } from '@study/ui';
const { profile, load, api } = useAccount();
const { appearance, width, setAppearance, setWidth, storageNote } = useAppearance();
const username = ref(''),
  name = ref(''),
  valid = ref(false),
  busy = ref(false),
  error = ref('');
const destination = ref('/home'),
  ultrawide = ref(false);
const step = computed(() =>
  !profile.value?.onboarding.identity
    ? 'identity'
    : !profile.value.onboarding.appearance
      ? 'appearance'
      : 'layout',
);
const lightweight = computed(
  () => profile.value?.onboarding.appearance && profile.value.onboarding.layout,
);
const themes = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
const layouts = [
  { value: 'auto', label: 'Auto' },
  { value: 'compressed', label: 'Compressed' },
  { value: 'full', label: 'Full-width' },
];
onCriticalPageMounted(async () => {
  const current = await load();
  if (!current) {
    await navigateTo('/');
    return;
  }
  name.value = current.displayName;
  username.value = current.username ?? '';
  destination.value = safeReturnTo(current.onboardingReturnTo);
  ultrawide.value = window.innerWidth >= 1800 && window.innerWidth / window.innerHeight > 20 / 9;
  if (current.onboarding.identity && current.onboarding.appearance && current.onboarding.layout)
    await navigateTo(destination.value, { replace: true });
});
async function next() {
  busy.value = true;
  error.value = '';
  try {
    if (step.value === 'identity') {
      profile.value = await api.request('/api/v1/account/profile', profileSchema, {
        displayName: name.value,
      });
      profile.value = await api.request('/api/v1/account/username', profileSchema, {
        username: username.value,
      });
    } else {
      profile.value = await api.request('/api/v1/account/onboarding', profileSchema, {
        step: step.value,
      });
    }
    const progress = profile.value!.onboarding;
    if (progress.identity && progress.appearance && progress.layout)
      await navigateTo(destination.value, { replace: true });
  } catch (e) {
    error.value =
      e instanceof Error && e.message.includes('409')
        ? 'That username was just taken. Please choose another.'
        : 'We couldn’t save this step. Check your details and try again.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="onboarding-space">
    <GlassSurface v-if="profile" as="section" class="onboarding-card">
      <p class="eyebrow">Study Space · Make yourself at home</p>
      <ol v-if="!lightweight" class="step-list" aria-label="Setup progress">
        <li
          v-for="(label, key) in {
            identity: 'Identity',
            appearance: 'Appearance',
            layout: 'Layout',
          }"
          :key="key"
          :aria-current="step === key ? 'step' : undefined"
        >
          {{ label }}<span v-if="profile.onboarding[key]" class="ui-sr-only"> completed</span>
        </li>
      </ol>
      <form v-if="step === 'identity'" class="form" @submit.prevent="next">
        <h1>{{ lightweight ? 'Choose your username.' : 'What should we call you?' }}</h1>
        <p>
          {{
            lightweight
              ? 'Your account is ready. Add a public username to make it yours.'
              : 'A familiar name and a little identity of your own.'
          }}
        </p>
        <label
          >Display name<input v-model="name" required maxlength="80" autocomplete="nickname"
        /></label>
        <UsernameField v-model="username" @valid="valid = $event" />
        <button :disabled="busy || !valid || !name.trim()">
          {{ busy ? 'Saving…' : lightweight ? 'Finish setup' : 'Continue' }}
        </button>
      </form>
      <template v-else-if="step === 'appearance'">
        <h1>Choose your light.</h1>
        <p>Follow your device, or set the mood yourself.</p>
        <div class="preview-options" role="group" aria-label="Appearance">
          <button
            v-for="theme in themes"
            :key="theme.value"
            class="preview-choice secondary"
            :aria-pressed="appearance === theme.value"
            @click="setAppearance(theme.value)"
          >
            <span class="mini-theme" :class="`mini-${theme.value}`" aria-hidden="true"
              ><i /><i /><i /></span
            >{{ theme.label }}
          </button>
        </div>
        <button :disabled="busy" @click="next">Continue</button>
      </template>
      <template v-else>
        <h1>A little room to work.</h1>
        <p v-if="ultrawide">
          You’re using an ultrawide display. Choose how to use the extra space.
        </p>
        <p v-else>Choose the layout that feels right on this device.</p>
        <div
          class="preview-options"
          :class="{ 'ultrawide-previews': ultrawide }"
          role="group"
          aria-label="Page width"
        >
          <button
            v-for="layout in layouts"
            :key="layout.value"
            class="preview-choice secondary"
            :aria-pressed="width === layout.value"
            @click="setWidth(layout.value)"
          >
            <span class="mini-layout" :class="`mini-${layout.value}`" aria-hidden="true"
              ><span><i v-for="n in 6" :key="n" /></span></span
            >{{ layout.label }}
          </button>
        </div>
        <p class="muted">Change this any time in Appearance & layout.</p>
        <button :disabled="busy" @click="next">{{ busy ? 'Saving…' : 'Finish setup' }}</button>
      </template>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-if="storageNote" role="status">{{ storageNote }}</p>
      <StatusBadge v-else-if="step !== 'identity'">Preferences saved on this device</StatusBadge>
    </GlassSurface>
  </div>
</template>
<style scoped>
.onboarding-space {
  min-height: 78dvh;
  display: grid;
  place-items: center;
}
.onboarding-card {
  width: min(100%, 700px);
  padding: clamp(22px, 4vw, 44px);
}
h1 {
  font-size: clamp(1.8rem, 4vw, 2.6rem);
}
.step-list {
  display: flex;
  gap: 22px;
  padding: 0;
  list-style: none;
  margin: 0 0 32px;
  color: var(--text-muted);
  font-size: 0.85rem;
}
.step-list [aria-current] {
  color: var(--accent);
}
.preview-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 28px 0;
}
.preview-choice {
  grid-template-columns: minmax(0, 1fr);
  justify-content: stretch;
  display: grid;
  gap: 16px;
  padding: 12px;
  min-width: 0;
}
.preview-choice[aria-pressed='true'] {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.mini-theme,
.mini-layout {
  width: 100%;
  display: grid;
  height: 100px;
  border-radius: 10px;
  padding: 12px;
  gap: 7px;
  background: var(--canvas);
  border: 1px solid var(--border);
  overflow: hidden;
}
.mini-theme i {
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: 5px;
}
.mini-light {
  background: #f6f6f8;
}
.mini-light i {
  background: white;
  border-color: #ddd;
}
.mini-dark {
  background: #191a20;
}
.mini-dark i {
  background: #30323c;
  border-color: #454855;
}
.mini-system {
  background: linear-gradient(90deg, #f6f6f8 50%, #191a20 50%);
}
.mini-layout > span {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  width: 100%;
  margin: auto;
  height: 65px;
}
.mini-layout i {
  background: var(--accent-subtle);
  border: 1px solid var(--border);
  border-radius: 3px;
}
.mini-compressed > span {
  width: 65%;
}
.mini-auto > span {
  width: 85%;
}
.ultrawide-previews .mini-layout > span {
  animation: layout-preview 3s var(--ease-standard) infinite alternate;
}
@keyframes layout-preview {
  from {
    transform: scaleX(0.88);
  }
  to {
    transform: scaleX(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ultrawide-previews .mini-layout > span {
    animation: none;
  }
}
@media (max-width: 420px) {
  .preview-options {
    gap: 8px;
  }
  .preview-choice {
    padding: 8px;
    font-size: 0.8rem;
  }
  .mini-theme,
  .mini-layout {
    padding: 6px;
    height: 80px;
  }
}
.onboarding-card > .ui-badge {
  display: table;
  margin-top: 16px;
}
</style>
