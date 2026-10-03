<script setup lang="ts">
import { Loader, ArrowLeft } from '@study/ui';
import { waitForCriticalFrame } from './lib/critical-frame';
import AppNavigation from './components/navigation/AppNavigation.vue';
import { UiRegistry } from '@study/core/browser';
import { identityUi } from '@study/identity/browser';
import { roomsUi } from '@study/rooms/browser';
import { friendsUi } from '@study/friends/browser';
import { createSocialClient, socialKey } from './lib/social';
import { createContextMenu, contextMenuKey } from './lib/context-menu';
import { copyAppLink, shareAppLink } from './lib/context-link';
import { safeAppPath } from './lib/app-history';
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
    point: item.point,
    ...((await item.load()) as { href: string }),
  })),
);
const mainNavigation = [
  { href: '/home', label: 'Home' },
  ...navigation
    .filter((item) => item.point === 'homeNavigation')
    .sort(
      (a, b) =>
        ['/my-rooms', '/friends', '/discover'].indexOf(a.href) -
        ['/my-rooms', '/friends', '/discover'].indexOf(b.href),
    ),
];
const accountNavigation = navigation.filter((item) => item.point === 'profileSettings');
const appearanceSettings = useAppearance();
const { width } = appearanceSettings;
const router = useRouter();
const appHistory = import.meta.client ? installAppHistory() : useAppHistory();
const motion = useRouteMotionState();
const pageKey = computed(() => router.currentRoute.value.path);
const nuxt = useNuxtApp();
const departing = ref(false);
const returnPath = ref('/');
let targetPath = '';
let preparation: AbortController | undefined;
let departure: Animation | undefined;
let readinessPass = 0;
function resetMotion() {
  preparation?.abort();
  departure?.cancel();
  readinessPass++;
  departing.value = false;
  motion.value = {
    generation: motion.value.generation + 1,
    pending: 0,
    mounted: true,
    active: false,
  };
}
function cancelNavigation() {
  // A cover may paint one frame before route commit. A duplicate-location
  // cancellation in that frame must still retire the pending attempt.
  if (router.currentRoute.value.fullPath === returnPath.value) resetMotion();
  void router.replace(returnPath.value);
}
async function finishMotion() {
  if (!motion.value.active || departing.value || !motion.value.mounted || motion.value.pending)
    return;
  const generation = motion.value.generation;
  const pass = ++readinessPass;
  const signal = preparation!.signal;
  await nextTick();
  const main = document.getElementById('main');
  if (main) await waitForCriticalFrame(main, signal);
  if (
    signal.aborted ||
    pass !== readinessPass ||
    generation !== motion.value.generation ||
    motion.value.pending
  )
    return;
  motion.value.active = false;
  await nextTick();
  if (generation === motion.value.generation && !main?.contains(document.activeElement))
    main?.focus({ preventScroll: true });
}
if (import.meta.client) {
  const onEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && motion.value.active) cancelNavigation();
  };
  window.addEventListener('keydown', onEscape);
  const attempts = new WeakMap<object, number>();
  const removeBefore = router.beforeEach(async (to, from) => {
    if (to.path === from.path) return;
    const alreadyCovered = motion.value.active && !departing.value;
    if (!motion.value.active) returnPath.value = from.fullPath;
    preparation?.abort();
    departure?.cancel();
    preparation = new AbortController();
    const generation = motion.value.generation + 1;
    attempts.set(to, generation);
    targetPath = to.path;
    motion.value = { generation, pending: 0, mounted: false, active: true };
    departing.value = !alreadyCovered;
    await nextTick();
    const cover = document.querySelector('.route-veil');
    if (cover && !alreadyCovered && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      departure = cover.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 150,
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        fill: 'forwards',
      });
      await departure.finished.catch(() => {});
    }
    if (generation !== motion.value.generation) return;
    departing.value = false;
    await nextTick();
    // Commit the opaque surface before permitting the destination to mount.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (generation === motion.value.generation) departure?.cancel();
  });
  const removeAfter = router.afterEach((to, _from, failure) => {
    // A retired/duplicated navigation must not uncover a newer pending destination.
    if (failure && attempts.get(to) === motion.value.generation) resetMotion();
  });
  const removeError = router.onError((_error, to) => {
    if (attempts.get(to) === motion.value.generation) resetMotion();
  });
  const removeFinish = nuxt.hook('page:finish', async () => {
    const generation = motion.value.generation;
    await nextTick();
    if (
      generation !== motion.value.generation ||
      router.currentRoute.value.path !== targetPath ||
      departing.value
    )
      return;
    motion.value.mounted = true;
    void finishMotion();
  });
  watch(
    () => motion.value.pending,
    () => {
      void finishMotion();
    },
  );
  onUnmounted(() => {
    window.removeEventListener('keydown', onEscape);
    removeBefore();
    removeAfter();
    removeError();
    removeFinish();
    resetMotion();
  });
}
const { profile, load, renew } = useAccount();
const onboarding = computed(
  () => !!profile.value && !Object.values(profile.value.onboarding).every(Boolean),
);
const focusedAccountFlow = computed(
  () =>
    !profile.value ||
    router.currentRoute.value.path === '/onboarding' ||
    router.currentRoute.value.path.startsWith('/auth/'),
);
watch([profile, () => router.currentRoute.value.fullPath], () => {
  if (
    import.meta.client &&
    onboarding.value &&
    !['/onboarding', '/account'].includes(router.currentRoute.value.path) &&
    !router.currentRoute.value.path.startsWith('/auth/')
  )
    void navigateTo('/onboarding', { replace: true });
});
const ambientComposition = computed(() => {
  const path = router.currentRoute.value.path;
  return path.endsWith('/configure')
    ? 'configure'
    : path === '/' || path === '/home'
      ? 'home'
      : (path.split('/')[1] ?? 'app');
});
const immersive = useState('immersive-room', () => false);
const appearanceSheet = useState('appearance-sheet-open', () => false);
const contextMenu = createContextMenu(() => {
  const path = safeAppPath(router.currentRoute.value.fullPath) ?? '/home';
  return [
    ...(appHistory.back.value
      ? [{ id: 'app.back', label: 'Back', run: () => appHistory.go(-1) }]
      : []),
    ...(appHistory.forward.value
      ? [{ id: 'app.forward', label: 'Forward', run: () => appHistory.go(1) }]
      : []),
    ...(!immersive.value && profile.value
      ? [
          {
            id: 'app.appearance',
            label: 'Appearance',
            run: () => {
              appearanceSheet.value = true;
            },
          },
        ]
      : []),
    { id: 'app.copy', label: 'Copy page link', run: () => copyAppLink(path) },
    { id: 'app.share', label: 'Share page', run: () => shareAppLink(path) },
  ];
});
provide(contextMenuKey, contextMenu);
onMounted(() => contextMenu.attach(document));
onUnmounted(contextMenu.dispose);
watch(
  () => router.currentRoute.value.fullPath,
  () => contextMenu.close(false),
);
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
    try {
      if (await load()) await renew();
    } catch {
      /* Page-owned read exposes retry; outages are not signed-out proof. */
    }
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
  <div
    class="app-shell"
    :class="{
      'is-immersive': immersive,
      'focused-account-flow': focusedAccountFlow,
      'route-covered': motion.active && !departing,
    }"
  >
    <div
      v-if="!immersive && profile"
      class="app-ambient"
      :data-composition="ambientComposition"
      aria-hidden="true"
    />
    <RoomEntryConfirmation />
    <StudyContextMenu />
    <a class="skip" href="#main">Skip to content</a>
    <AppNavigation
      v-if="!immersive && !focusedAccountFlow"
      :items="mainNavigation"
      :account-items="accountNavigation"
      :name="profile?.displayName"
      :social-count="socialCount"
      :appearance-settings="appearanceSettings"
    />
    <main
      id="main"
      tabindex="-1"
      :class="{
        'immersive-main': immersive,
        'route-preparing': motion.active && !departing,
      }"
      :inert="motion.active"
      :aria-busy="motion.active"
      :data-width="width"
    >
      <div
        v-if="!immersive && !focusedAccountFlow"
        class="shell-brand-row"
        :class="{ 'has-back': appHistory.back.value }"
      >
        <button
          v-if="appHistory.back.value"
          class="shell-back secondary"
          aria-label="Back"
          title="Back"
          @click="appHistory.go(-1)"
        >
          <ArrowLeft :size="20" aria-hidden="true" />
        </button>
        <NuxtLink class="shell-brand" to="/home" aria-label="Study Space Home"
          >Study Space</NuxtLink
        >
      </div>
      <!-- A keyed host disposes the previous page before mounting the next. Never retain room trees for animation. -->
      <NuxtPage :key="pageKey" :keepalive="false" :transition="false" />
    </main>
    <footer v-if="!immersive" class="app-footer">
      A little space. A little progress. Together.
    </footer>
    <Transition
      name="route-veil"
      :enter="false"
      @before-enter="(el) => el.removeAttribute('aria-hidden')"
      @before-leave="(el) => el.setAttribute('aria-hidden', 'true')"
    >
      <div
        v-if="motion.active"
        class="route-veil"
        :class="{ 'route-veil-pending': departing }"
        aria-label="Loading page"
      >
        <Loader label="Loading page" size="navigation" />
      </div>
    </Transition>
  </div>
</template>

<style>
:root {
  font-family: var(--font-ui);
  background: var(--canvas);
  color: var(--text-primary);
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
.app-shell {
  min-height: 100dvh;
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  padding-left: 112px;
}
.app-shell.is-immersive {
  padding: 0;
}
main {
  width: 100%;
  max-width: none;
  margin: 0 auto;
  padding: var(--space-page);
  flex: 1;
  min-width: 0;
}
main:focus {
  outline: none;
}
[data-layout-width='auto'] main:not(.immersive-main) {
  width: 96%;
}
[data-layout-width='compressed'] main:not(.immersive-main) {
  max-width: 1560px;
}
.immersive-main {
  width: 100%;
  padding: 0;
  max-width: none;
}
.app-footer {
  padding: 1.5rem var(--space-page);
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-muted);
}
.route-preparing {
  visibility: hidden;
}
.route-covered .app-navigation,
.route-covered .app-footer,
.route-covered .skip {
  visibility: hidden;
}
.route-veil {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  /* Opaque material, independent of glass; fades run only before mount and after readiness. */
  background: var(--canvas);
  opacity: 1;
  color: var(--text-primary);
}
.route-veil-leave-active {
  pointer-events: none;
  transition: opacity 200ms var(--ease-standard);
}
.route-veil-leave-from {
  opacity: 1;
}
.route-veil-leave-to {
  opacity: 0;
}
@media (max-width: 760px) {
  .app-shell {
    padding-left: 0;
    padding-bottom: calc(6.5rem + env(safe-area-inset-bottom));
  }
  .app-shell.is-immersive {
    padding-bottom: 0;
  }
  [data-layout-width] main:not(.immersive-main) {
    width: 100%;
  }
}
h1,
h2,
h3,
p {
  margin-top: 0;
}
h1 {
  font-family: var(--font-ui);
  font-weight: 500;
  font-size: clamp(2rem, 3vw, 3rem);
  line-height: 1.08;
  letter-spacing: -0.04em;
  margin-bottom: 1.1rem;
}
h2 {
  font-size: 1.3rem;
  font-weight: 500;
}
h3 {
  font-weight: 500;
  font-size: 1.1rem;
}
p {
  line-height: 1.7;
  color: var(--text-secondary);
}
.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-secondary);
}
.hero {
  padding: clamp(1.5rem, 4vw, 3rem);
  border-radius: 24px;
  background: var(--surface);
  margin-bottom: 2.5rem;
}
.hero h1 {
  font-family: var(--font-display);
  font-weight: 400;
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
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  padding: var(--space-card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-surface);
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
  background: var(--accent-subtle);
  font-size: 0.72rem;
  margin-right: 0.3rem;
}
.muted {
  font-size: 0.85rem;
  color: var(--text-muted);
}
.empty {
  border: 1px dashed var(--border);
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
  font-weight: 500;
  border-radius: 10px;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: var(--on-accent);
  padding: 0.75rem 1.1rem;
  text-decoration: none;
  cursor: pointer;
  line-height: 1.3;
}
button:hover,
.button:hover {
  background: var(--accent-hover);
  color: var(--on-accent);
}
button:disabled {
  opacity: 0.55;
  cursor: default;
}
.secondary {
  background: transparent;
  color: var(--accent);
  border-color: var(--border);
}
.danger {
  color: var(--danger);
  background: transparent;
  border-color: var(--border);
}
button:active,
.button:active {
  background: var(--accent-pressed);
  color: var(--on-accent);
}
strong {
  font-weight: 600;
}
.tag,
input[type='number'],
.room-video small,
.media-review p {
  font-variant-numeric: tabular-nums;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}
.error {
  background: var(--danger-subtle);
  border-radius: 10px;
  padding: 1rem;
  color: var(--danger);
}
.success {
  background: var(--success-subtle);
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
  background: var(--surface-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border);
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
  color: var(--text-muted);
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
  background: var(--surface);
}
:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 4px;
}
.skip {
  position: absolute;
  top: -100px;
}
.skip:focus {
  top: 0;
  background: var(--surface-elevated);
  padding: 1rem;
  z-index: 10;
}
@media (max-width: 640px) {
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

<style>
.app-shell.focused-account-flow {
  padding-left: 0;
  padding-bottom: 0;
}
.shell-brand {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-bottom: 1.5rem;
  padding: 8px 12px;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.03em;
}
.shell-brand-row {
  position: relative;
  min-height: 60px;
  margin-bottom: 1.5rem;
}
.shell-brand-row .shell-brand {
  margin-bottom: 0;
  transform: translateX(0);
  transition: transform var(--motion-quick) var(--ease-soft-spring);
}
.shell-brand-row.has-back .shell-brand {
  transform: translateX(52px);
}
.shell-back {
  position: absolute;
  left: 4px;
  top: 8px;
  width: 44px;
  height: 44px;
  min-height: 44px;
  padding: 0;
  border-radius: 50%;
}
</style>

<style>
.app-ambient {
  --bloom-x: 50%;
  --bloom-y: 25%;
  --bloom-blue: 119 164 241;
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 68vw 70vh at var(--bloom-x) var(--bloom-y),
      rgb(var(--bloom-blue) / 17%),
      rgb(var(--bloom-blue) / 6%) 45%,
      transparent 78%
    ),
    radial-gradient(ellipse 90vw 100vh at 70% 65%, rgb(105 146 213 / 5%), transparent 80%),
    var(--canvas);
}
.app-ambient[data-composition='home'] {
  --bloom-x: 44%;
  --bloom-y: 22%;
}
.app-ambient[data-composition='friends'] {
  --bloom-x: 58%;
  --bloom-y: 32%;
}
.app-ambient[data-composition='account'] {
  --bloom-x: 62%;
  --bloom-y: 20%;
}
.app-ambient[data-composition='my-rooms'] {
  --bloom-x: 48%;
  --bloom-y: 30%;
}
.app-ambient[data-composition='configure'] {
  --bloom-x: 40%;
  --bloom-y: 24%;
}
:root[data-appearance='dark'] .app-ambient {
  --bloom-blue: 67 114 203;
}
@media (prefers-contrast: more), (forced-colors: active) {
  .app-ambient {
    background: var(--canvas);
  }
}
</style>

<style>
@media (prefers-color-scheme: dark) {
  :root[data-appearance='system'] .app-ambient {
    --bloom-blue: 67 114 203;
  }
}
</style>
