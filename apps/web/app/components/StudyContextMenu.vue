<script setup lang="ts">
import {
  MenuRow,
  ArrowLeft,
  ArrowRight,
  Settings,
  Copy,
  Share2,
  Trash2,
  Grip,
  PictureInPicture2,
  Minus,
  Maximize,
  Plus,
  Ellipsis,
  UsersRound,
  Image,
  Music2,
  PanelsRightBottom,
} from '@study/ui';
function actionIcon(id: string) {
  if (id.endsWith('back')) return ArrowLeft;
  if (id.endsWith('forward')) return ArrowRight;
  if (id.includes('appearance') || id.includes('settings')) return Settings;
  if (id.includes('copy')) return Copy;
  if (id.includes('share')) return Share2;
  if (id.includes('remove') || id.includes('block') || id.includes('delete')) return Trash2;
  if (id.includes('rearrange')) return Grip;
  if (id.includes('popout')) return PictureInPicture2;
  if (id.includes('minimize')) return Minus;
  if (id.includes('front')) return Maximize;
  if (id.includes('invite')) return Plus;
  if (id.includes('friend')) return UsersRound;
  if (id.includes('background')) return Image;
  if (id.includes('media')) return Music2;
  if (id.includes('reset') || id.includes('restore')) return PanelsRightBottom;
  return Ellipsis;
}
import { contextMenuKey } from '../lib/context-menu';
const host = inject(contextMenuKey)!;
const panel = ref<HTMLElement>();
const current = host.opening;
async function position() {
  await nextTick();
  const open = current.value,
    node = panel.value;
  if (!open || !node) return;
  if (typeof node.showPopover === 'function') node.showPopover();
  const viewport = open.doc.defaultView!;
  node.style.maxHeight = `${viewport.innerHeight - 16}px`;
  node.style.left = `${Math.max(8, Math.min(open.x, viewport.innerWidth - node.offsetWidth - 8))}px`;
  node.style.top = `${Math.max(8, Math.min(open.y, viewport.innerHeight - node.offsetHeight - 8))}px`;
  node.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
}
watch(current, position);
function keyboard(event: KeyboardEvent) {
  const items = [
    ...panel.value!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
  ];
  const active = current.value!.doc.activeElement;
  const index = items.indexOf(active as HTMLButtonElement);
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  } else if (event.key === 'Tab') host.close(false);
}
</script>
<template>
  <Teleport v-if="current" :to="current.doc.body">
    <div
      ref="panel"
      class="study-context-menu ui-overlay-popover"
      data-open="true"
      popover="manual"
      role="menu"
      aria-label="Study Space actions"
      @keydown="keyboard"
    >
      <MenuRow
        v-for="action in current.actions"
        :key="action.id"
        role="menuitem"
        tabindex="-1"
        :class="{ danger: action.danger }"
        :disabled="action.disabled"
        @click="host.activate(action)"
      >
        <component :is="actionIcon(action.id)" :size="16" aria-hidden="true" />
        <span>{{ action.label }}</span>
      </MenuRow>
      <small>Right-click again for browser actions</small>
    </div>
  </Teleport>
  <div v-if="host.note.value" class="context-menu-note" role="status">
    {{ host.note.value
    }}<button class="secondary" aria-label="Dismiss action message" @click="host.note.value = ''">
      Close
    </button>
  </div>
</template>
<style>
.study-context-menu {
  width: min(244px, calc(100vw - 16px));
  padding: 6px;
  overflow-y: auto;
}
.study-context-menu .ui-menu-row {
  font-size: 13px;
}
.study-context-menu small {
  display: block;
  padding: 8px 12px;
  font-size: 11px;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  margin-top: var(--space-1);
}
.context-menu-note {
  position: fixed;
  z-index: 1300;
  bottom: 24px;
  left: 24px;
  padding: 16px;
  max-width: min(440px, calc(100vw - 48px));
  background: var(--surface-elevated);
  border-radius: var(--radius-card);
}
</style>
