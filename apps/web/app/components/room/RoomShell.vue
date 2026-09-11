<script setup lang="ts">
import { UiExtensionHost } from '@study/ui';
import { workspacePreference } from '@study/core/browser';
import type { Workspace, UiRegistry, Bounds } from '@study/core/browser';
import { createPreferenceStore } from '@study/adapters/indexeddb';
import type { PreferenceStore } from '@study/feature-sdk';
import type { Component } from 'vue';
import WorkspaceHost from './WorkspaceHost.vue';
const props = defineProps<{
  room: { id: string; name: string; privacy: string };
  ui: UiRegistry;
  workspace: Workspace;
  participants: {
    id: string;
    name: string;
    initials: string;
    status: string;
    camera: boolean;
    expanded: boolean;
  }[];
  cameraRenderer: Component;
  roomState: { notice: string; more: boolean; refresh: () => void };
}>();
const emit = defineEmits<{ leave: []; invite: [] }>();
const revision = ref(0),
  railOpen = ref(true),
  dimmed = ref(false),
  panelStates = ref<Record<string, boolean>>({}),
  selected = ref('');
const more = ref<HTMLElement>(),
  participantMenu = ref<HTMLElement>();
const fullscreen = computed(() => {
  void revision.value;
  return props.workspace.values().some((item) => item.layout.fullscreen && !item.layout.minimized);
});
let store: PreferenceStore | undefined,
  disposed = false,
  loaded = false;
let saveQueue = Promise.resolve();
const preference = workspacePreference(props.room.id);
function refresh() {
  revision.value++;
  if (loaded && store) {
    const snapshot = {
      panels: { ...panelStates.value, rail: railOpen.value },
      dimmed: dimmed.value,
      tiles: props.workspace.snapshot(),
    };
    saveQueue = saveQueue
      .then(() => store!.set(preference, snapshot))
      .catch(() => {
        props.roomState.notice = 'Layout could not be saved. You can keep using this room.';
      });
  }
}
props.roomState.refresh = refresh;
async function ready(bounds: Bounds) {
  store = await createPreferenceStore([preference]);
  if (disposed) {
    await store.close();
    return;
  }
  const saved = await store.get(preference);
  if (disposed) return;
  panelStates.value = saved.panels;
  railOpen.value = saved.panels.rail ?? window.innerWidth > 760;
  dimmed.value = saved.dimmed;
  props.workspace.recover(saved, bounds);
  loaded = true;
  refresh();
}
watch([railOpen, dimmed], refresh);
watch(
  () => props.roomState.more,
  async (value) => {
    if (value) {
      await nextTick();
      more.value?.querySelector('button')?.focus();
    }
  },
);
async function openParticipant(id: string) {
  selected.value = selected.value === id ? '' : id;
  await nextTick();
  participantMenu.value?.querySelector('button')?.focus();
}
function closeMenus() {
  const id = selected.value;
  selected.value = '';
  if (props.roomState.more) {
    props.roomState.more = false;
    document.querySelector<HTMLElement>('[aria-label="More"]')?.focus();
  } else if (id) document.getElementById(`participant-${id}`)?.focus();
}
function outside(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest('.participant-rail') && selected.value) selected.value = '';
  if (!target.closest('.more-popover, .room-dock')) props.roomState.more = false;
}
onMounted(() => document.addEventListener('pointerdown', outside));
onUnmounted(() => {
  disposed = true;
  document.removeEventListener('pointerdown', outside);
  props.roomState.refresh = () => {};
  for (const item of props.workspace.values()) props.workspace.close(item.id);
  void saveQueue.finally(() => store?.close());
});
</script>
<template>
  <div
    class="room-shell"
    :class="{ 'room-dimmed': dimmed, 'rail-collapsed': !railOpen }"
    @keydown.esc="closeMenus"
  >
    <div
      class="room-scene"
      :class="{ 'has-environment': ui.at('environment').length > 0 }"
      aria-hidden="true"
    >
      <UiExtensionHost :registry="ui" point="environment" />
    </div>
    <header class="room-top glass" :inert="fullscreen">
      <button aria-label="Back to room details" @click="emit('leave')">←</button>
      <div class="room-title">
        <h1>{{ room.name }}</h1>
        <span>{{ room.privacy }} room</span>
      </div>
      <button class="invite-button" @click="emit('invite')">＋ Invite</button>
      <UiExtensionHost :registry="ui" point="topBar" />
    </header>
    <aside :inert="fullscreen" class="participant-rail glass" aria-label="Participants">
      <div v-for="p in participants" :key="p.id" class="participant-entry">
        <button
          :id="`participant-${p.id}`"
          class="participant-circle"
          :aria-label="`${p.name}, ${p.status}. Participant controls`"
          :aria-expanded="selected === p.id"
          :title="`${p.name} · ${p.status}`"
          @click="openParticipant(p.id)"
          @contextmenu.prevent="openParticipant(p.id)"
        >
          <component :is="cameraRenderer" v-if="p.camera && !p.expanded" :participant-id="p.id" />
          <span v-else class="participant-avatar" :data-avatar="p.id">{{ p.initials }}</span>
          <span class="participant-status" :data-status="p.status" aria-hidden="true"></span
          ><span class="participant-affordance" aria-hidden="true">•••</span>
        </button>
        <small>{{ p.id === 'self' ? 'You' : p.name.split(' ·')[0] }}</small>
        <UiExtensionHost
          :registry="ui"
          point="participantBadge"
          :context="{ participantId: p.id }"
        />
      </div>
      <span class="participant-count">{{ participants.length }}</span>
      <div
        v-if="selected"
        ref="participantMenu"
        class="participant-popover glass"
        role="region"
        aria-label="Participant controls"
      >
        <button class="popover-close" aria-label="Close participant controls" @click="closeMenus">
          ×
        </button>
        <UiExtensionHost
          :registry="ui"
          point="participantContextMenu"
          :context="{ participantId: selected }"
        />
      </div>
    </aside>
    <WorkspaceHost :workspace="workspace" :revision="revision" @change="refresh" @ready="ready" />
    <button
      class="rail-toggle glass"
      :inert="fullscreen"
      :aria-expanded="railOpen"
      aria-controls="productivity-rail"
      @click="railOpen = !railOpen"
    >
      {{ railOpen ? 'Hide panels →' : '← Study panels' }}
    </button>
    <aside
      v-show="railOpen"
      id="productivity-rail"
      :inert="fullscreen"
      class="productivity-rail glass"
      aria-label="Study panels"
    >
      <details
        v-for="item in ui.at('rightRail')"
        :key="item.id"
        :open="panelStates[item.id] !== false"
        @toggle="
          panelStates[item.id] = ($event.target as HTMLDetailsElement).open;
          refresh();
        "
      >
        <summary>{{ item.label }}<span aria-hidden="true">⌄</span></summary>
        <UiExtensionHost
          v-if="panelStates[item.id] !== false"
          :registry="ui"
          point="rightRail"
          :only-id="item.id"
        />
      </details>
    </aside>
    <div class="scene-caption" aria-hidden="true">
      <span>THE QUIET HOURS</span>
      <p>Make yourself a little space.</p>
    </div>
    <div
      v-if="roomState.more"
      id="room-more"
      ref="more"
      class="more-popover glass"
      :inert="fullscreen"
      role="region"
      aria-label="More room options"
    >
      <button aria-label="Close more options" @click="closeMenus">×</button>
      <UiExtensionHost :registry="ui" point="roomMoreMenu" />
      <UiExtensionHost :registry="ui" point="roomSettings" />
      <label><input v-model="dimmed" type="checkbox" /> Dim this room on my device</label>
    </div>
    <div v-if="roomState.notice" class="room-notice glass" :inert="fullscreen" role="status">
      {{ roomState.notice
      }}<button aria-label="Dismiss notice" @click="roomState.notice = ''">×</button>
    </div>
    <nav :inert="fullscreen" class="room-dock glass" aria-label="Room controls">
      <UiExtensionHost :registry="ui" point="bottomDock" />
    </nav>
    <p class="room-device-note">Devices off by default</p>
  </div>
</template>
<style src="../../room/room.css"></style>
