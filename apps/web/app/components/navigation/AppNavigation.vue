<script setup lang="ts">
import {
  GlassSurface,
  UserRound,
  Settings,
  SettingsSheet,
  SegmentedControl,
  StudySelect,
  StatusBadge,
} from '@study/ui';
const props = defineProps<{
  items: { href: string; label: string }[];
  accountItems: { href: string; label: string }[];
  name?: string;
  socialCount: number;
  appearanceSettings: ReturnType<typeof useAppearance>;
}>();
const { appearance, width, setAppearance, setWidth, storageNote } = props.appearanceSettings;
const settingsOpen = useState('appearance-sheet-open', () => false);
const popover = ref<HTMLElement>();
const profileButton = ref<HTMLButtonElement>();
const route = useRoute();
const appearanceOptions = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
const widthOptions = [
  { value: 'auto', label: 'Auto' },
  { value: 'compressed', label: 'Compressed' },
  { value: 'full', label: 'Full-width' },
];
const icons = {
  '/': 'lucide:house',
  '/home': 'lucide:house',
  '/my-rooms': 'lucide:panels-top-left',
  '/friends': 'lucide:users-round',
  '/discover': 'lucide:compass',
};
function closeProfile() {
  popover.value?.hidePopover();
}
function openSettings() {
  closeProfile();
  profileButton.value?.focus();
  settingsOpen.value = true;
}
watch(() => route.fullPath, closeProfile);
</script>
<template>
  <GlassSurface as="nav" class="app-navigation" compact aria-label="Main navigation">
    <NuxtLink
      v-for="item in items"
      :key="item.href"
      :to="item.href"
      :aria-label="item.label"
      :title="item.label"
      class="app-nav-link"
    >
      <NuxtIcon
        :name="icons[item.href as keyof typeof icons] ?? 'lucide:compass'"
        aria-hidden="true"
      />
      <span class="nav-label">{{ item.href === '/my-rooms' ? 'Rooms' : item.label }}</span>
      <span
        v-if="item.href === '/friends' && socialCount"
        class="nav-count"
        :aria-label="`${socialCount} pending invitations and requests`"
        >{{ socialCount }}</span
      >
    </NuxtLink>
    <div class="nav-profile">
      <button
        ref="profileButton"
        class="profile-trigger"
        popovertarget="app-profile"
        aria-label="Profile and settings"
        title="Profile and settings"
      >
        <span v-if="name" class="profile-initials" aria-hidden="true">{{
          name.slice(0, 2).toUpperCase()
        }}</span>
        <UserRound v-else :size="22" aria-hidden="true" />
      </button>
      <div id="app-profile" ref="popover" popover="auto" class="profile-popover">
        <p class="profile-name">{{ name ?? 'Study Space' }}</p>
        <NuxtLink
          v-for="item in accountItems"
          :key="item.href"
          :to="item.href"
          @click="closeProfile"
          ><UserRound :size="18" aria-hidden="true" />{{ item.label }}</NuxtLink
        >
        <button type="button" @click="openSettings">
          <Settings :size="18" aria-hidden="true" />Appearance & layout
        </button>
      </div>
    </div>
  </GlassSurface>
  <SettingsSheet v-model:open="settingsOpen" title="Appearance & layout">
    <section class="appearance-section">
      <h3>Appearance</h3>
      <p>Choose your light. System follows your device.</p>
      <SegmentedControl
        :model-value="appearance"
        label="Appearance"
        :options="appearanceOptions"
        @update:model-value="setAppearance"
      />
    </section>
    <GlassPreference />
    <section class="appearance-section">
      <StudySelect
        :model-value="width"
        label="Page width"
        :options="widthOptions"
        @update:model-value="setWidth"
      />
      <p class="width-description">
        {{
          width === 'auto'
            ? 'Adapts to your available space, including ultrawide displays.'
            : width === 'compressed'
              ? 'A centered desktop layout with room for multiple columns.'
              : 'Uses the available page width with comfortable edge spacing.'
        }}
      </p>
    </section>
    <StatusBadge v-if="!storageNote">Saved on this device</StatusBadge>
    <p v-if="storageNote" role="status">{{ storageNote }}</p>
  </SettingsSheet>
</template>
<style>
.app-nav-link > .iconify {
  width: 22px;
  height: 22px;
}
.app-nav-link > .iconify [stroke-width] {
  stroke-width: 1.7;
}
.app-navigation {
  position: fixed;
  z-index: 100;
  inset: 1.25rem auto 1.25rem 1.25rem;
  width: 76px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
  border-radius: var(--radius-sheet);
}
.app-nav-link {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 58px;
  border-radius: var(--radius-card);
  color: var(--text-secondary);
  text-decoration: none;
  transition:
    background var(--motion-micro) var(--ease-standard),
    color var(--motion-micro),
    transform var(--motion-standard) var(--ease-soft-spring);
}
.app-nav-link:hover,
.app-nav-link.router-link-exact-active {
  color: var(--accent);
  background: var(--accent-subtle);
}
.app-nav-link:hover {
  transform: translateY(-3px);
}
.app-nav-link:active {
  transform: scale(0.94);
}
.nav-label {
  font-size: 10px;
  font-weight: 500;
}
.nav-count {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 18px;
  padding: 2px;
  font-size: 10px;
  border-radius: var(--radius-capsule);
  background: var(--accent);
  color: var(--on-accent);
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.nav-profile {
  margin-top: auto;
  display: grid;
  place-items: center;
}
.profile-trigger {
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: var(--radius-circle);
  background: var(--accent-subtle);
  color: var(--accent);
  border: 1px solid var(--border);
}
.profile-initials {
  font-size: 0.85rem;
  font-weight: 500;
}
.profile-popover {
  position: fixed;
  inset: auto auto 1.25rem 7rem;
  margin: 0;
  width: min(280px, calc(100vw - 2rem));
  padding: 0.75rem;
  border: 1px solid var(--border-highlight);
  border-radius: var(--radius-card);
  background: var(--glass-elevated);
  color: var(--text-primary);
  box-shadow: var(--shadow-elevated);
  backdrop-filter: blur(var(--glass-blur));
}
.profile-popover:popover-open {
  animation: profile-arrive var(--motion-expressive) var(--ease-soft-spring);
  transform-origin: bottom left;
}
@keyframes profile-arrive {
  from {
    opacity: 0;
    transform: translate(-16px, 12px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .app-nav-link:hover,
  .app-nav-link:active {
    transform: none;
  }
}
.profile-popover a,
.profile-popover button {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
  min-height: 48px;
  padding: 0.75rem;
  border: 0;
  color: var(--text-primary);
  background: transparent;
  border-radius: var(--radius-sm);
  text-decoration: none;
  font-size: 0.875rem;
}
.profile-popover a:hover,
.profile-popover button:hover {
  background: var(--accent-subtle);
  filter: none;
}
.profile-name {
  padding: 0.5rem 0.75rem;
  margin: 0;
  overflow-wrap: anywhere;
  font-weight: 500;
}
.appearance-section {
  margin-bottom: var(--space-section);
}
.appearance-section p {
  font-size: 0.875rem;
}
.glass-auto {
  margin-bottom: 1rem;
}
.glass-auto span {
  font-size: 0.75rem;
  margin-left: 0.5rem;
}
.glass-auto[aria-pressed='false'] {
  background: var(--surface);
  color: var(--text-primary);
  border: 1px solid var(--border);
}
.glass-preference label,
.glass-range-labels {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.glass-preference input[type='range'] {
  width: 100%;
  min-height: 44px;
  margin: 0;
  padding: 0;
  accent-color: var(--accent);
}
.glass-range-labels {
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.width-description {
  margin: 0.75rem 0 0;
}
@media (max-width: 760px) {
  .app-navigation {
    inset: auto 0.75rem max(0.75rem, env(safe-area-inset-bottom)) 0.75rem;
    width: auto;
    max-width: 480px;
    margin-inline: auto;
    flex-direction: row;
    justify-content: space-around;
    gap: 0.2rem;
    border-radius: var(--radius-sheet);
  }
  .app-nav-link {
    flex: 1;
    min-width: 0;
    min-height: 52px;
  }
  .nav-profile {
    margin-top: 0;
    margin-left: 0.25rem;
  }
  .profile-trigger {
    width: 44px;
    height: 44px;
  }
  .profile-popover {
    inset: auto 1rem calc(6rem + env(safe-area-inset-bottom)) auto;
  }
}
</style>
