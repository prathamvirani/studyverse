<script setup lang="ts">
import {
  WorkspaceTileView,
  Grip,
  Minus,
  Maximize,
  X,
  Timer,
  ListChecks,
  MessageCircle,
  Clock,
  PictureInPicture2,
  PanelsRightBottom,
} from '@study/ui';
import { createApp, shallowReactive, watch } from 'vue';
import type { Component } from 'vue';
import { layoutGesture, avoidOverlap, rectanglesOverlap } from '@study/core/browser';
import type { WorkspacePopouts } from '../../lib/workspace-popouts';
import type { ResizeEdge } from '@study/core/browser';
import type { Workspace, TileInstance, Bounds, Rectangle } from '@study/core/browser';
import { useContextTargets } from '../../composables/useContextActions';
const props = defineProps<{
  workspace: Workspace;
  revision: number;
  rearrange?: boolean;
  popouts: WorkspacePopouts;
  obstacles?: Rectangle[];
}>();
const emit = defineEmits<{
  change: [];
  ready: [bounds: Bounds];
  bounds: [bounds: Bounds];
  notice: [message: string];
}>();
const surface = ref<HTMLElement>();
const restores = ref<HTMLElement>();
const restoreRect = ref<Rectangle>();
const occupied = computed(() => [
  ...(props.obstacles ?? []),
  ...(restoreRect.value ? [restoreRect.value] : []),
]);
function measureRestores() {
  const node = restores.value,
    root = surface.value;
  if (!node || !root) return;
  const box = node.getBoundingClientRect(),
    origin = root.getBoundingClientRect();
  restoreRect.value = node.childElementCount
    ? { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height }
    : undefined;
}
const headers = shallowReactive<Record<string, HTMLElement>>({});
function headerRef(id: string, node: unknown) {
  if (node instanceof HTMLElement) headers[id] = node;
}
function avoidChrome(item: TileInstance, allowFit = false) {
  if (item.layout.fullscreen || item.layout.minimized || popouts.find(item.id)) return;
  let free = avoidOverlap(item.layout, occupied.value, bounds());
  if (!free && allowFit) {
    const width = props.workspace.snapSlots(bounds(), occupied.value)[0]?.width;
    if (
      width &&
      width < item.layout.width &&
      width >= props.workspace.types.get(item.type)!.minimumSize.width
    )
      free = avoidOverlap({ ...item.layout, width }, occupied.value, bounds());
  }
  if (free)
    props.workspace.place(item.id, { x: free.x, y: free.y, width: free.width }, bounds(), false);
}
watch(
  () => JSON.stringify(occupied.value),
  () => {
    props.workspace.reflow(bounds(), occupied.value);
    slots.value = props.workspace.snapSlots(bounds(), occupied.value);
    for (const item of props.workspace.values()) avoidChrome(item, true);
    emit('change');
  },
);
watch(
  () => {
    void props.revision;
    return props.workspace
      .values()
      .map((item) => item.id)
      .join('|');
  },
  () => {
    for (const item of props.workspace.values()) avoidChrome(item);
    emit('change');
  },
);
const popouts = props.popouts;
const menus = useContextTargets();
const icons = {
  'pomodoro.panel': Timer,
  'tasks.panel': ListChecks,
  'chat.panel': MessageCircle,
  'clock.panel': Clock,
};
let disposed = false;
const controllers = new Map<string, HTMLElement>();
async function popout(item: TileInstance, utilityOnly = false) {
  const definition = props.workspace.types.get(item.type)!;
  let node =
    controllers.get(item.id) ??
    popouts.find(item.id) ??
    surface.value?.querySelector<HTMLElement>(`[data-workspace-id="${CSS.escape(item.id)}"]`);
  if (definition.loadPopout && !controllers.has(item.id)) {
    if (!popouts.reserve({ id: item.id, label: definition.label + ' controls' })) {
      emit(
        'notice',
        `Could not open ${definition.label} controls. Allow Study Space popups and try again.`,
      );
      return;
    }
    let renderer;
    try {
      renderer = await definition.loadPopout();
    } catch {
      popouts.release(item.id);
      emit('notice', `Could not load ${definition.label} controls. Please try again.`);
      return;
    }
    if (disposed || !props.workspace.values().some((i) => i.id === item.id)) {
      popouts.release(item.id);
      return;
    }
    node = document.createElement('article');
    node.className = 'workspace-tile glass';
    node.dataset.workspaceId = item.id;
    node.dataset.popoutId = item.id;
    node.setAttribute('aria-label', definition.label + ' controls');
    const returning = document.createElement('button');
    returning.textContent = 'Return controls to room';
    returning.addEventListener('click', () => popouts.restore(node!));
    node.append(returning);
    const content = document.createElement('div');
    content.style.cssText = 'flex:1;min-height:0;overflow:auto';
    node.append(content);
    const app = createApp(renderer as Component);
    app.mount(content);
    controllers.set(item.id, node);
    const detachMenu = menus.host?.contribute(node, () => cardActions(item));
    node.addEventListener(
      'popout-return',
      () => {
        app.unmount();
        detachMenu?.();
        controllers.delete(item.id);
      },
      { once: true },
    );
  }
  if (node && !(await popouts.open([node], utilityOnly)) && controllers.has(item.id))
    node.dispatchEvent(new Event('popout-return'));
}
async function popoutAll() {
  await nextTick();
  for (const item of items.value.filter(
    (i) =>
      (!i.layout.minimized || !!props.workspace.types.get(i.type)?.minimizedPresentation) &&
      popouts.reserved(i.id),
  ))
    await popout(item, true);
}
function returnTile(event: Event) {
  popouts.restore((event.currentTarget as HTMLElement).closest<HTMLElement>('.workspace-tile')!);
}
defineExpose({ popoutAll });
let cleanupGesture: (() => void) | undefined;
const dragging = ref(''),
  snapPreview = ref(-1),
  showTargets = ref(false);
const slots = ref(props.workspace.snapSlots({ width: 600, height: 400 }));
const previewTarget = computed(() => {
  // The observed surface size also invalidates preview geometry on resize/zoom.
  void slots.value;
  return props.workspace.snapTarget(dragging.value, snapPreview.value, bounds(), occupied.value);
});
const items = computed(() => {
  void props.revision;
  return props.workspace.values();
});
const bounds = () => ({
  width: surface.value?.clientWidth || 600,
  height: surface.value?.clientHeight || 400,
});
let observer: ResizeObserver | undefined;
onMounted(() => {
  emit('ready', bounds());
  observer = new ResizeObserver(() => {
    measureRestores();
    props.workspace.reflow(bounds(), occupied.value);
    for (const item of props.workspace.values()) avoidChrome(item, true);
    slots.value = props.workspace.snapSlots(bounds(), occupied.value);
    emit('bounds', bounds());
    emit('change');
  });
  observer.observe(surface.value!);
  observer.observe(restores.value!);
});
onUnmounted(() => {
  disposed = true;
  observer?.disconnect();
  cleanupGesture?.();
});
function change(item: TileInstance, action: 'minimize' | 'fullscreen' | 'close' | 'restore') {
  if (action === 'close' && props.workspace.types.get(item.type)?.minimizedPresentation)
    action = 'minimize';
  if (action === 'minimize') {
    const node = controllers.get(item.id) ?? popouts.find(item.id);
    if (node) popouts.restore(node);
  }
  if (action === 'close') {
    const node = controllers.get(item.id) ?? popouts.find(item.id);
    if (node) popouts.restore(node);
    props.workspace.close(item.id);
  } else
    props.workspace.update(item.id, {
      ...item.layout,
      minimized: action === 'minimize',
      fullscreen: action === 'fullscreen' ? !item.layout.fullscreen : false,
    });
  emit('change');
  nextTick(() => {
    const target =
      surface.value?.querySelector<HTMLElement>(`[data-restore-id=${CSS.escape(item.id)}]`) ??
      surface.value?.querySelector<HTMLElement>(
        `[data-workspace-id=${CSS.escape(item.id)}] .tile-move`,
      ) ??
      surface.value?.querySelector<HTMLElement>('.tile-move') ??
      document.querySelector<HTMLElement>('button[aria-label="More"]');
    target?.focus();
  });
}
function cardActions(item: TileInstance) {
  return [
    { id: 'tile.minimize', label: 'Minimize', run: () => change(item, 'minimize') },
    { id: 'tile.popout', label: 'Pop out', run: () => popout(item) },
    { id: 'tile.front', label: 'Bring to front', run: () => focus(item) },
    {
      id: 'tile.reset',
      label: 'Reset position',
      run: () => {
        props.workspace.unsnap(item.id);
        props.workspace.place(item.id, { x: 0, y: 0 }, bounds(), false);
        emit('change');
      },
    },
    {
      id: 'tile.close',
      label: props.workspace.types.get(item.type)?.minimizedPresentation
        ? 'Collapse player'
        : 'Hide',
      run: () => change(item, 'close'),
    },
  ];
}
function tileStyle(item: TileInstance) {
  const compact =
    item.layout.minimized && props.workspace.types.get(item.type)?.minimizedPresentation;
  const size = compact || item.layout;
  return {
    left: `${Math.min(item.layout.x, Math.max(0, bounds().width - size.width))}px`,
    top: `${Math.min(item.layout.y, Math.max(0, bounds().height - size.height))}px`,
    width: `${size.width}px`,
    height: `${size.height}px`,
    zIndex: item.layout.zIndex + 1,
  };
}
function fullscreenKeys(event: KeyboardEvent, item: TileInstance) {
  if (!item.layout.fullscreen || event.key !== 'Tab') return;
  const buttons = [
    ...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    ),
  ].filter((el) => el.getClientRects().length && !el.closest('[inert]'));
  const first = buttons[0],
    last = buttons[buttons.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
function focus(item: TileInstance) {
  props.workspace.focus(item.id);
  emit('change');
}
function resizeWithChrome(
  item: TileInstance,
  start: TileInstance['layout'],
  edge: ResizeEdge,
  dx: number,
  dy: number,
) {
  props.workspace.resize(item.id, start, edge, dx, dy, bounds());
  // Shorten only the active edges; never shift their opposite anchors.
  if (occupied.value.some((o) => rectanglesOverlap(item.layout, o))) {
    let low = 0,
      high = 1;
    for (let n = 0; n < 20; n++) {
      const fraction = (low + high) / 2;
      props.workspace.resize(item.id, start, edge, dx * fraction, dy * fraction, bounds());
      if (occupied.value.some((o) => rectanglesOverlap(item.layout, o))) high = fraction;
      else low = fraction;
    }
    props.workspace.resize(item.id, start, edge, dx * low, dy * low, bounds());
  }
}
function keyboard(event: KeyboardEvent, item: TileInstance, resize: boolean) {
  if (popouts.find(item.id)) return;
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const direction = directions[event.key];
  if (!direction || item.layout.fullscreen) return;
  event.preventDefault();
  props.workspace.unsnap(item.id);
  const step = event.shiftKey ? 32 : 8,
    [dx, dy] = direction;
  if (resize) resizeWithChrome(item, { ...item.layout }, 'se', dx * step, dy * step);
  else
    props.workspace.place(
      item.id,
      { x: item.layout.x + dx * step, y: item.layout.y + dy * step },
      bounds(),
      false,
    );
  if (!resize) avoidChrome(item);
  emit('change');
}
function pointer(event: PointerEvent, item: TileInstance, edge: ResizeEdge | false) {
  if (popouts.find(item.id)) return;
  if (event.button !== 0 || item.layout.fullscreen) return;
  const start = { ...item.layout };
  focus(item);
  dragging.value = item.id;
  props.workspace.unsnap(item.id);
  cleanupGesture?.();
  cleanupGesture = layoutGesture(
    event,
    (dx, dy, e) => {
      const box = surface.value!.getBoundingClientRect();
      showTargets.value =
        !edge &&
        slots.value.length > 0 &&
        !!props.workspace.types.get(item.type)?.workspaceCard &&
        e.clientX > box.left + (box.width * 2) / 3;
      snapPreview.value = showTargets.value
        ? slots.value
            .map((rect, index) => ({
              index,
              distance: Math.abs(e.clientY - box.top - rect.y - rect.height / 2),
            }))
            .sort((a, b) => a.distance - b.distance)[0]!.index
        : -1;
      if (edge) resizeWithChrome(item, start, edge, dx, dy);
      else props.workspace.place(item.id, { x: start.x + dx, y: start.y + dy }, bounds());
      if (!edge) avoidChrome(item);
      emit('change');
    },
    (e) => {
      if (e.type === 'pointerup' && snapPreview.value >= 0)
        props.workspace.snap(item.id, snapPreview.value, bounds(), occupied.value);
      avoidChrome(item);
      dragging.value = '';
      showTargets.value = false;
      snapPreview.value = -1;
      emit('change');
    },
  );
}
</script>
<template>
  <div ref="surface" class="workspace-surface" aria-label="Workspace">
    <div
      v-if="showTargets && snapPreview >= 0 && previewTarget"
      class="snap-targets"
      aria-hidden="true"
    >
      <div
        class="snap-target snap-preview room-snap-preview"
        :style="{
          left: `${previewTarget.rect.x}px`,
          top: `${previewTarget.rect.y}px`,
          width: `${previewTarget.rect.width}px`,
          height: `${previewTarget.rect.height}px`,
        }"
      />
    </div>
    <article
      :ref="(node) => menus.bind(item.id, node, () => cardActions(item))"
      v-for="item in items"
      :hidden="item.layout.minimized && !workspace.types.get(item.type)!.minimizedPresentation"
      :key="item.id"
      class="workspace-tile glass"
      :class="{
        'tile-fullscreen': item.layout.fullscreen,
        'tile-dragging': dragging === item.id,
        'tile-snapped': workspace.snaps.has(item.id),
        'workspace-card': workspace.types.get(item.type)!.workspaceCard,
        'tile-collapsed-presentation':
          item.layout.minimized && !!workspace.types.get(item.type)!.minimizedPresentation,
      }"
      :data-card-type="workspace.types.get(item.type)!.workspaceCard ? item.type : undefined"
      :role="item.layout.fullscreen ? 'dialog' : undefined"
      :aria-modal="item.layout.fullscreen ? true : undefined"
      :inert="items.some((i) => i.layout.fullscreen) && !item.layout.fullscreen"
      :aria-label="workspace.types.get(item.type)!.label"
      :data-workspace-id="item.id"
      :style="tileStyle(item)"
      @pointerdown="focus(item)"
      @focusin="focus(item)"
      @keydown="fullscreenKeys($event, item)"
      @keydown.esc="
        item.layout.fullscreen && ($event.stopPropagation(), change(item, 'fullscreen'))
      "
    >
      <div class="tile-toolbar">
        <button
          v-if="item.layout.minimized && workspace.types.get(item.type)!.minimizedPresentation"
          class="tile-open-player"
          @click="change(item, 'restore')"
        >
          Open player
        </button>
        <button
          class="tile-move"
          :aria-label="`Move ${workspace.types.get(item.type)!.label}`"
          title="Drag, or use arrow keys to move"
          @pointerdown.stop="pointer($event, item, false)"
          @keydown="keyboard($event, item, false)"
        >
          <Grip :size="14" class="inline-drag-icon" aria-hidden="true" />
          {{ workspace.types.get(item.type)!.label }}
        </button>
        <div class="tile-header-contribution" :ref="(node) => headerRef(item.id, node)" />
        <div class="tile-utilities">
          <button
            :aria-label="`Pop out ${workspace.types.get(item.type)!.label}`"
            title="Pop out"
            @click.stop="popout(item)"
          >
            <PictureInPicture2 :size="15" />
          </button>
          <button class="tile-return" aria-label="Return tool to room" @click="returnTile">
            Return
          </button>
          <button
            v-if="workspace.types.get(item.type)!.workspaceCard"
            :aria-label="workspace.snaps.has(item.id) ? 'Unsnap card' : 'Snap card'"
            title="Snap or unsnap card"
            @click="
              workspace.snaps.has(item.id)
                ? workspace.unsnap(item.id)
                : workspace.snap(item.id, 0, bounds(), occupied);
              emit('change');
            "
          >
            <PanelsRightBottom :size="14" />
          </button>
          <button aria-label="Minimize tile" title="Minimize" @click="change(item, 'minimize')">
            <Minus :size="14" />
          </button>
          <button
            v-if="workspace.types.get(item.type)!.fullscreenable"
            :aria-label="item.layout.fullscreen ? 'Exit fullscreen' : 'Fullscreen tile'"
            @click="change(item, 'fullscreen')"
          >
            <Maximize :size="14" />
          </button>
          <button aria-label="Close tile" title="Hide" @click="change(item, 'close')">
            <X :size="14" />
          </button>
        </div>
      </div>
      <WorkspaceTileView
        :registry="workspace.types"
        :instance="item"
        :revision="revision"
        :header-target="headers[item.id]"
      />
      <button
        v-for="edge in workspace.types.get(item.type)!.resizable &&
        !item.layout.fullscreen &&
        !item.layout.minimized
          ? (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const)
          : []"
        :key="edge"
        class="tile-resize"
        :class="`resize-${edge}`"
        :aria-label="edge === 'se' ? 'Resize tile' : `Resize ${edge} edge`"
        :tabindex="edge === 'se' ? 0 : -1"
        @pointerdown.stop="pointer($event, item, edge)"
        @keydown="keyboard($event, item, true)"
      ></button>
    </article>
    <div
      ref="restores"
      class="workspace-restores"
      aria-label="Minimized tiles"
      :inert="items.some((i) => i.layout.fullscreen)"
    >
      <button
        v-for="item in items.filter((i) => i.layout.minimized)"
        :key="item.id"
        :data-restore-id="item.id"
        :aria-label="`Restore ${workspace.types.get(item.type)!.label}`"
        @click="change(item, 'restore')"
      >
        <component
          :is="icons[item.type as keyof typeof icons] ?? PanelsRightBottom"
          :size="18"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>

<style>
.popout-stage {
  position: relative !important;
  inset: auto !important;
  width: 100vw !important;
  height: 100dvh !important;
  min-height: 0;
  overflow: hidden !important;
  padding: 6px !important;
  margin: 0 !important;
  display: flex;
  flex-direction: column;
  container: companion / size;
  background: var(--canvas);
}
.popout-stage .workspace-tile {
  position: relative !important;
  left: auto !important;
  top: auto !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0;
  transform: none !important;
}
.popout-stage .tile-resize {
  display: none !important;
}
.popout-stage .tile-toolbar .tile-move {
  cursor: default;
}
.popout-stage .inline-drag-icon {
  display: none;
}
.tile-toolbar .inline-drag-icon {
  opacity: 0;
  transform: translateX(-3px);
  transition:
    opacity var(--motion-micro),
    transform var(--motion-micro);
}
.room-shell[data-rearrange='true'] .workspace-tile:is(:hover, :focus-within) .inline-drag-icon {
  opacity: 1;
  transform: none;
}
.tile-move {
  cursor: grab;
}
.tile-move:active {
  cursor: grabbing;
}
.room-shell.popout-stage .participant-rail,
.room-shell.popout-stage .room-dock {
  position: relative !important;
  inset: auto !important;
  transform: none !important;
  width: 100% !important;
  max-width: none;
  visibility: visible !important;
  transition: none;
}
.room-shell.popout-stage .participant-rail {
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
  align-content: start;
  align-items: start;
  justify-items: center;
  height: 100% !important;
  overflow: auto !important;
  padding: var(--space-3);
  gap: var(--space-4);
}
.room-shell.popout-stage .participant-entry {
  width: 100%;
  min-width: 0;
}
.room-shell.popout-stage .participant-circle {
  width: clamp(52px, 15cqw, 100px);
  height: clamp(52px, 15cqw, 100px);
}
.room-shell.popout-stage .participant-entry small {
  font-size: 12px;
}
.room-shell.popout-stage .room-object-grip {
  display: none;
}
.room-shell.popout-stage .room-dock {
  height: auto !important;
  flex: 0;
  overflow: visible !important;
  padding: var(--space-2);
}
.room-shell.popout-stage:has(.room-dock) {
  justify-content: center;
}
.room-shell.popout-stage .room-dock [data-extension-point='bottomDock'] {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}
@container companion (max-width: 420px) {
  .room-shell.popout-stage .room-dock [data-extension-point='bottomDock'] {
    flex-direction: column;
    align-items: stretch;
  }
  .room-shell.popout-stage .room-dock button {
    width: 100%;
  }
  .room-shell.popout-stage:has(.room-dock) {
    justify-content: flex-start;
    overflow-y: auto !important;
  }
}
@container companion (max-height: 240px) {
  .popout-stage .chat-panel > small {
    display: none;
  }
}

.workspace-tile[hidden] {
  display: none !important;
}
.tile-collapsed-presentation .tile-toolbar > :not(.tile-open-player) {
  display: none;
}
.tile-collapsed-presentation .tile-toolbar {
  min-height: 38px;
}
.tile-open-player {
  width: 100%;
}
.workspace-tile .tile-resize {
  position: absolute;
  z-index: 5;
  padding: 0;
  min-width: 0;
  min-height: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  opacity: 1;
  inset: auto;
}
.workspace-tile .tile-resize.resize-n,
.workspace-tile .tile-resize.resize-s {
  left: 12px;
  right: 12px;
  width: auto;
  height: 5px;
  cursor: ns-resize;
}
.workspace-tile .tile-resize.resize-n {
  top: 0;
  bottom: auto;
}
.workspace-tile .tile-resize.resize-s {
  bottom: 0;
  top: auto;
}
.workspace-tile .tile-resize.resize-e,
.workspace-tile .tile-resize.resize-w {
  top: 12px;
  bottom: 12px;
  width: 5px;
  height: auto;
  cursor: ew-resize;
}
.workspace-tile .tile-resize.resize-e {
  right: 0;
  left: auto;
}
.workspace-tile .tile-resize.resize-w {
  left: 0;
  right: auto;
}
.workspace-tile .tile-resize.resize-ne,
.workspace-tile .tile-resize.resize-nw,
.workspace-tile .tile-resize.resize-se,
.workspace-tile .tile-resize.resize-sw {
  width: 10px;
  height: 10px;
}
.workspace-tile .tile-resize.resize-ne {
  right: 0;
  top: 0;
  bottom: auto;
  cursor: nesw-resize;
}
.workspace-tile .tile-resize.resize-nw {
  left: 0;
  top: 0;
  bottom: auto;
  cursor: nwse-resize;
}
.workspace-tile .tile-resize.resize-se {
  right: 0;
  bottom: 0;
  cursor: nwse-resize;
}
.workspace-tile .tile-resize.resize-sw {
  left: 0;
  bottom: 0;
  cursor: nesw-resize;
}
.tile-toolbar {
  margin: 7px 7px 0;
}
.tile-return {
  display: none !important;
}
.popout-stage .tile-return {
  display: inline-flex !important;
}
.room-shell .workspace-restores {
  z-index: 50;
  position: fixed;
  left: auto;
  right: 12px;
  top: 64px;
  bottom: auto;
  width: auto;
  display: flex;
  gap: 4px;
  border-radius: 999px;
  background: var(--glass);
  padding: 4px;
}
.room-shell .workspace-restores:empty {
  display: none;
}
.room-shell .workspace-restores button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
}

.tile-header-contribution:empty {
  display: none;
}
.tile-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  margin: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--text-primary) 12%, transparent);
}
.tile-toolbar .tile-move {
  flex: 1;
  min-width: 0;
  padding: 4px 0;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
}
.tile-utilities {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.tile-utilities > button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  min-width: 26px;
  min-height: 28px;
  color: var(--text-secondary);
}
.tile-toolbar:has(.tile-header-contribution:not(:empty)) {
  flex-wrap: wrap;
  row-gap: 0;
}
.tile-header-contribution {
  flex: 0 0 auto;
}
.tile-toolbar:has(.tile-header-contribution:not(:empty)) .tile-utilities {
  flex-basis: 100%;
}
@container workspace-card (min-width: 560px) {
  .tile-toolbar:has(.tile-header-contribution:not(:empty)) {
    flex-wrap: nowrap;
  }
  .tile-toolbar:has(.tile-header-contribution:not(:empty)) .tile-utilities {
    flex-basis: auto;
  }
}
.workspace-card {
  container: workspace-card / size;
}
.workspace-card > [data-tile-id] {
  overflow-x: hidden;
  min-width: 0;
}
.workspace-tile .tile-resize:is(:hover, :focus-visible, :active) {
  background: color-mix(in srgb, var(--accent) 35%, transparent);
}
@container workspace-card (max-height: 260px) {
  .pomodoro-timer > small,
  .timer-footer small {
    font-size: 9px;
    letter-spacing: 0;
  }
  .timer-main {
    margin-block: 4px;
    gap: 4px;
  }
  .timer-digits {
    font-size: 26px;
  }
  .timer-footer {
    margin-top: 4px;
    gap: 2px;
  }
}
</style>
