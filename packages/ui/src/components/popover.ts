import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { PropType } from 'vue';
const openPanels = new WeakMap<Document, HTMLElement[]>();

/** One anchored top-layer overlay for selects and contextual actions, including inside dialogs. */
export const OverlayPopover = defineComponent({
  inheritAttrs: false,
  props: {
    open: Boolean,
    anchor: Object as PropType<HTMLElement | undefined>,
    label: String,
    role: { type: String, default: 'region' },
    focus: Boolean,
    matchAnchorWidth: { type: Boolean, default: true },
    align: { type: String as PropType<'start' | 'end'>, default: 'start' },
    as: { type: String, default: 'div' },
  },
  emits: ['update:open'],
  setup(p, { emit, slots, attrs }) {
    const panel = ref<HTMLElement>();
    let observer: ResizeObserver | undefined;
    let owner: Document | undefined;
    function attach(doc: Document) {
      if (owner === doc) return;
      owner?.removeEventListener('pointerdown', outside);
      owner?.removeEventListener('keydown', keys, true);
      owner?.removeEventListener('scroll', position, true);
      owner?.defaultView?.removeEventListener('resize', position);
      if (owner && panel.value) removePanel(owner);
      owner = doc;
      owner.addEventListener('pointerdown', outside);
      owner.addEventListener('keydown', keys, true);
      owner.addEventListener('scroll', position, true);
      owner.defaultView?.addEventListener('resize', position);
    }
    function position() {
      const el = panel.value,
        anchor = p.anchor;
      if (!el || !anchor || !p.open) return;
      const box = anchor.getBoundingClientRect();
      const viewport = anchor.ownerDocument.defaultView!;
      el.style.minWidth = p.matchAnchorWidth
        ? `${Math.min(box.width, viewport.innerWidth - 16)}px`
        : '';
      el.style.maxWidth = `${viewport.innerWidth - 16}px`;
      el.style.maxHeight = `${Math.max(80, viewport.innerHeight - 16)}px`;
      const height = el.offsetHeight,
        width = el.offsetWidth;
      const below = viewport.innerHeight - box.bottom - 8;
      const above = box.top - 8;
      const up = height > below && above > below;
      el.style.maxHeight = `${Math.max(60, up ? above : below)}px`;
      const left = p.align === 'end' ? box.right - width : box.left;
      el.style.left = `${Math.max(8, Math.min(left, viewport.innerWidth - width - 8))}px`;
      el.style.top = `${Math.max(8, up ? box.top - Math.min(height, above) - 6 : box.bottom + 6)}px`;
    }
    function close(restore = true) {
      if (owner) removePanel(owner);
      emit('update:open', false);
      if (restore) p.anchor?.focus({ preventScroll: true });
    }
    async function sync() {
      await nextTick();
      const el = panel.value;
      if (!el) return;
      attach(el.ownerDocument);
      if (p.open) {
        const stack = openPanels.get(el.ownerDocument) ?? [];
        if (!stack.includes(el)) stack.push(el);
        openPanels.set(el.ownerDocument, stack);
        if (typeof el.showPopover === 'function' && !el.matches(':popover-open')) el.showPopover();
        el.dataset.open = 'true';
        position();
        if (p.focus) el.querySelector<HTMLElement>('button, input, [tabindex="0"]')?.focus();
      } else {
        removePanel(el.ownerDocument);
        delete el.dataset.open;
        if (typeof el.hidePopover === 'function' && el.matches(':popover-open')) el.hidePopover();
      }
    }
    function outside(e: PointerEvent) {
      const node = e.target as Node;
      if (p.open && !panel.value?.contains(node) && !p.anchor?.contains(node)) close(false);
    }
    function keys(e: KeyboardEvent) {
      if (!p.open || e.key !== 'Escape' || !owner || openPanels.get(owner)?.at(-1) !== panel.value)
        return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
    function removePanel(doc: Document) {
      openPanels.set(
        doc,
        (openPanels.get(doc) ?? []).filter((el) => el !== panel.value),
      );
    }
    watch([() => p.open, () => p.anchor], sync, { flush: 'post' });
    onMounted(() => {
      attach(panel.value?.ownerDocument ?? document);
      observer = new ResizeObserver(position);
      if (panel.value) observer.observe(panel.value);
      void sync();
    });
    onBeforeUnmount(() => {
      observer?.disconnect();
      if (owner) removePanel(owner);
      owner?.removeEventListener('pointerdown', outside);
      owner?.removeEventListener('keydown', keys, true);
      owner?.defaultView?.removeEventListener('resize', position);
      owner?.removeEventListener('scroll', position, true);
    });
    return () =>
      h(
        p.as,
        {
          ...attrs,
          ref: panel,
          popover: 'manual',
          role: p.role,
          'aria-label': p.label,
          class: ['ui-overlay-popover', attrs.class],
        },
        slots.default?.(),
      );
  },
});
