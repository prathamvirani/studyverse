<script setup lang="ts">
import { WorkspaceTileView } from '@study/ui';
import type { Workspace, TileInstance, Bounds } from '@study/core/browser';
const props = defineProps<{ workspace: Workspace; revision: number }>();
const emit = defineEmits<{ change: []; ready: [bounds: Bounds] }>();
const surface = ref<HTMLElement>();
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
    for (const item of props.workspace.values())
      props.workspace.place(item.id, {}, bounds(), false);
    emit('change');
  });
  observer.observe(surface.value!);
});
onUnmounted(() => observer?.disconnect());
function change(item: TileInstance, action: 'minimize' | 'fullscreen' | 'close' | 'restore') {
  if (action === 'close') props.workspace.close(item.id);
  else
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
      document.querySelector<HTMLElement>('[aria-label="More"]');
    target?.focus();
  });
}
function fullscreenKeys(event: KeyboardEvent, item: TileInstance) {
  if (!item.layout.fullscreen || event.key !== 'Tab') return;
  const buttons = (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
    'button:not(:disabled), a[href], input, [tabindex="0"]',
  );
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
function keyboard(event: KeyboardEvent, item: TileInstance, resize: boolean) {
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const direction = directions[event.key];
  if (!direction || item.layout.fullscreen) return;
  event.preventDefault();
  const step = event.shiftKey ? 32 : 8,
    [dx, dy] = direction;
  const minimum = props.workspace.types.get(item.type)!.minimumSize;
  props.workspace.place(
    item.id,
    resize
      ? {
          width: Math.max(minimum.width, item.layout.width + dx * step),
          height: Math.max(minimum.height, item.layout.height + dy * step),
        }
      : { x: item.layout.x + dx * step, y: item.layout.y + dy * step },
    bounds(),
    false,
  );
  emit('change');
}
function pointer(event: PointerEvent, item: TileInstance, resize: boolean) {
  if (event.button !== 0 || item.layout.fullscreen) return;
  event.preventDefault();
  const handle = event.currentTarget as HTMLElement,
    start = { ...item.layout },
    x = event.clientX,
    y = event.clientY;
  focus(item);
  handle.setPointerCapture(event.pointerId);
  const minimum = props.workspace.types.get(item.type)!.minimumSize;
  const move = (e: PointerEvent) => {
    props.workspace.place(
      item.id,
      resize
        ? {
            width: Math.max(minimum.width, start.width + e.clientX - x),
            height: Math.max(minimum.height, start.height + e.clientY - y),
          }
        : { x: start.x + e.clientX - x, y: start.y + e.clientY - y },
      bounds(),
    );
    emit('change');
  };
  const end = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
    handle.removeEventListener('lostpointercapture', end);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('lostpointercapture', end);
}
</script>
<template>
  <div ref="surface" class="workspace-surface" aria-label="Workspace">
    <article
      v-for="item in items.filter((i) => !i.layout.minimized)"
      :key="item.id"
      class="workspace-tile glass"
      :class="{ 'tile-fullscreen': item.layout.fullscreen }"
      :role="item.layout.fullscreen ? 'dialog' : undefined"
      :aria-modal="item.layout.fullscreen ? true : undefined"
      :inert="items.some((i) => i.layout.fullscreen) && !item.layout.fullscreen"
      :aria-label="workspace.types.get(item.type)!.label"
      :data-workspace-id="item.id"
      :style="{
        left: `${item.layout.x}px`,
        top: `${item.layout.y}px`,
        width: `${item.layout.width}px`,
        height: `${item.layout.height}px`,
        zIndex: item.layout.zIndex + 1,
      }"
      @pointerdown="focus(item)"
      @keydown="fullscreenKeys($event, item)"
      @keydown.esc="item.layout.fullscreen && change(item, 'fullscreen')"
    >
      <div class="tile-toolbar">
        <button
          class="tile-move"
          :aria-label="`Move ${workspace.types.get(item.type)!.label}`"
          title="Drag, or use arrow keys to move"
          @pointerdown.stop="pointer($event, item, false)"
          @keydown="keyboard($event, item, false)"
        >
          ⠿ {{ workspace.types.get(item.type)!.label }}
        </button>
        <button aria-label="Minimize tile" @click="change(item, 'minimize')">−</button>
        <button
          v-if="workspace.types.get(item.type)!.fullscreenable"
          :aria-label="item.layout.fullscreen ? 'Exit fullscreen' : 'Fullscreen tile'"
          @click="change(item, 'fullscreen')"
        >
          ⛶
        </button>
        <button aria-label="Close tile" @click="change(item, 'close')">×</button>
      </div>
      <WorkspaceTileView :registry="workspace.types" :instance="item" />
      <button
        v-if="workspace.types.get(item.type)!.resizable && !item.layout.fullscreen"
        class="tile-resize"
        aria-label="Resize tile"
        title="Drag, or use arrow keys to resize"
        @pointerdown.stop="pointer($event, item, true)"
        @keydown="keyboard($event, item, true)"
      >
        ◢
      </button>
    </article>
    <div class="workspace-restores" aria-label="Minimized tiles">
      <button
        v-for="item in items.filter((i) => i.layout.minimized)"
        :key="item.id"
        :data-restore-id="item.id"
        @click="change(item, 'restore')"
      >
        ↗ Restore {{ workspace.types.get(item.type)!.label }}
      </button>
    </div>
  </div>
</template>
