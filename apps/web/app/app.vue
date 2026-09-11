<script setup lang="ts">
import { UiRegistry } from '@study/core/browser';
import { identityUi } from '@study/identity/browser';
import { roomsUi } from '@study/rooms/browser';
import { friendsUi } from '@study/friends/browser';
import { createSocialClient, socialKey } from './lib/social';
const social = createSocialClient();
provide(socialKey, social);
const socialCount = computed(
  () => (social.state.snapshot?.incoming.length ?? 0) + social.state.invitations.length,
);
const registry = new UiRegistry();
for (const item of [...identityUi, ...roomsUi, ...friendsUi]) registry.register(item.id, item);
const navigation = await Promise.all(
  [...registry.at('homeNavigation'), ...registry.at('profileSettings')].map(async (item) => ({
    label: item.label,
    ...((await item.load()) as { href: string }),
  })),
);
const { profile, load, renew } = useAccount();
const immersive = useState('immersive-room', () => false);
let accountReady = false;
watch(profile, (value) => {
  if (import.meta.client && accountReady) {
    if (value) social.start();
    else social.stop();
  }
});
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(async () => {
  if (!location.pathname.startsWith('/auth/callback/')) {
    if (await load()) await renew();
  }
  accountReady = true;
  if (profile.value) social.start();
  timer = setInterval(
    () => {
      if (profile.value && document.visibilityState === 'visible') void renew();
    },
    15 * 60 * 1000,
  );
});
onUnmounted(() => {
  clearInterval(timer);
  social.stop();
});
</script>

<template>
  <div>
    <a class="skip" href="#main">Skip to content</a>
    <header v-if="!immersive" class="site-header">
      <NuxtLink to="/" class="brand"><span aria-hidden="true">◒</span> study space</NuxtLink>
      <nav aria-label="Main navigation">
        <NuxtLink to="/">Home</NuxtLink>
        <NuxtLink v-for="item in navigation" :key="item.href" :to="item.href"
          >{{ item.label
          }}<span v-if="item.href === '/friends' && socialCount" aria-live="polite">
            ({{ socialCount }})</span
          ></NuxtLink
        >
      </nav>
      <span class="account-name">{{ profile?.displayName ?? 'Make room for focus' }}</span>
    </header>
    <main id="main" :class="{ 'immersive-main': immersive }"><NuxtPage /></main>
    <footer v-if="!immersive">A little space. A little progress. Together.</footer>
  </div>
</template>

<style>
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  background: #f5f3eb;
  color: #263d31;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
}
a {
  color: inherit;
  text-underline-offset: 4px;
}
.site-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2rem;
  padding: 1.4rem clamp(1.2rem, 5vw, 5rem);
  border-bottom: 1px solid #d9dfd3;
}
.brand {
  font-size: 1.2rem;
  font-weight: 700;
  text-decoration: none;
  letter-spacing: -0.04em;
  white-space: nowrap;
}
.brand span {
  color: #65816b;
  padding-right: 0.4rem;
  font-size: 1.5rem;
}
nav {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  font-size: 0.88rem;
}
nav a {
  text-decoration: none;
  padding: 0.4rem 0;
}
nav a.router-link-exact-active {
  border-bottom: 2px solid #577760;
}
.account-name {
  margin-left: auto;
  font-size: 0.8rem;
  color: #5b6b5f;
}
main {
  max-width: 1260px;
  margin: auto;
  padding: clamp(1.2rem, 5vw, 4rem);
  min-height: 75vh;
}
.immersive-main {
  padding: 0;
  max-width: none;
}
footer {
  padding: 2rem;
  text-align: center;
  font-size: 0.8rem;
  color: #617267;
  border-top: 1px solid #d9dfd3;
}
h1,
h2,
h3,
p {
  margin-top: 0;
}
h1 {
  font-family: Georgia, serif;
  font-weight: 400;
  font-size: clamp(2.5rem, 5vw, 4.6rem);
  line-height: 1.08;
  letter-spacing: -0.04em;
  margin-bottom: 1.1rem;
}
h2 {
  font-size: 1.3rem;
  font-weight: 550;
}
h3 {
  font-size: 1.1rem;
}
p {
  line-height: 1.7;
  color: #586b5d;
}
.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.72rem;
  font-weight: 700;
  color: #647f67;
}
.hero {
  padding: clamp(1.5rem, 4vw, 3rem);
  border-radius: 24px;
  background: #e5eadb;
  margin-bottom: 2.5rem;
}
.hero p {
  max-width: 60ch;
}
.heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.heading-row h2 {
  margin: 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 1.2rem;
}
.card {
  background: #fffef9;
  border: 1px solid #dce1d4;
  padding: 1.5rem;
  border-radius: 16px;
}
.card h3 {
  margin: 0.9rem 0;
}
.card p {
  font-size: 0.88rem;
  overflow-wrap: anywhere;
}
.tag {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  border-radius: 30px;
  background: #eaf0e4;
  font-size: 0.72rem;
  margin-right: 0.3rem;
}
.muted {
  font-size: 0.85rem;
  color: #617267;
}
.empty {
  border: 1px dashed #bbc8b6;
  padding: 2rem;
  border-radius: 16px;
}
section {
  margin-bottom: 2.5rem;
}
button,
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 550;
  border-radius: 10px;
  border: 1px solid #345b43;
  background: #345b43;
  color: #fff;
  padding: 0.75rem 1.1rem;
  text-decoration: none;
  cursor: pointer;
  line-height: 1.3;
}
button:hover,
.button:hover {
  filter: brightness(1.1);
}
button:disabled {
  opacity: 0.55;
  cursor: wait;
}
.secondary {
  background: transparent;
  color: #345b43;
  border-color: #bccaba;
}
.danger {
  color: #923f31;
  background: transparent;
  border-color: #d6bcb6;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}
.error {
  background: #f8e6dc;
  border-radius: 10px;
  padding: 1rem;
  color: #823b2b;
}
.success {
  background: #e4eddb;
  padding: 1rem;
  border-radius: 10px;
}
.form {
  max-width: 650px;
}
.form label {
  display: block;
  font-size: 0.9rem;
  margin-bottom: 1.2rem;
}
.form input,
.form textarea,
.form select,
input.search {
  display: block;
  width: 100%;
  background: #fffef9;
  color: #263d31;
  border: 1px solid #b9c7b3;
  border-radius: 9px;
  padding: 0.8rem;
  margin-top: 0.5rem;
  font: inherit;
}
.form textarea {
  min-height: 100px;
  resize: vertical;
}
input.search {
  max-width: 500px;
  margin-bottom: 1.5rem;
}
.form small {
  display: block;
  margin-top: 0.5rem;
  color: #617267;
  line-height: 1.5;
}
.device {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.7rem;
}
.device p {
  margin: 0.5rem 0 0;
}
.device-label {
  overflow-wrap: anywhere;
  font-size: 0.85rem;
}
.link-output {
  overflow-wrap: anywhere;
  padding: 1rem;
  background: #eef2e6;
}
:focus-visible {
  outline: 3px solid #ad793b;
  outline-offset: 4px;
}
.skip {
  position: absolute;
  top: -100px;
}
.skip:focus {
  top: 0;
  background: white;
  padding: 1rem;
  z-index: 10;
}
@media (max-width: 640px) {
  .site-header {
    gap: 1rem;
  }
  .account-name {
    display: none;
  }
  nav {
    gap: 1rem;
  }
  .device {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>
