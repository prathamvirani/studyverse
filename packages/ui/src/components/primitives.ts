import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
  useAttrs,
} from 'vue';
import type { PropType } from 'vue';
import { ArrowRight, Check, ChevronDown, Search, X } from '@lucide/vue';
import { OverlayPopover } from './popover.ts';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
const optionsProp = { type: Array as PropType<readonly SelectOption[]>, required: true } as const;
const icon = (component: typeof Search) => h(component, { size: 18, 'aria-hidden': true });

export const MenuRow = defineComponent({
  props: { active: Boolean },
  setup:
    (p, { slots }) =>
    () =>
      h(
        'button',
        { type: 'button', class: 'ui-menu-row', 'data-active': p.active || undefined },
        slots.default?.(),
      ),
});

/** Native keyboard/pointer semantics with a track matching the thumb's center travel. */
export const StudySlider = defineComponent({
  inheritAttrs: false,
  props: {
    modelValue: { type: Number, default: 0 },
    min: { type: [Number, String], default: 0 },
    max: { type: [Number, String], default: 100 },
    step: { type: [Number, String], default: 1 },
    label: String,
  },
  emits: ['update:modelValue', 'input'],
  setup(p, { emit }) {
    const attrs = useAttrs();
    const progress = computed(() =>
      Math.max(0, Math.min(1, (p.modelValue - Number(p.min)) / (Number(p.max) - Number(p.min)))),
    );
    const surface = ref<HTMLElement>();
    const paint = () =>
      surface.value?.style.setProperty('--slider-fill', `${progress.value * 100}%`);
    onMounted(paint);
    watch(progress, paint, { flush: 'post' });
    return () =>
      h('span', { class: 'ui-slider', ref: surface }, [
        h('span', { class: 'ui-slider-track', 'aria-hidden': true }),
        h('input', {
          ...attrs,
          type: 'range',
          min: p.min,
          max: p.max,
          step: p.step,
          value: p.modelValue,
          'aria-label': p.label ?? attrs['aria-label'],
          onInput: (event: Event) => {
            emit('update:modelValue', Number((event.target as HTMLInputElement).value));
            emit('input', event);
          },
        }),
      ]);
  },
});

export const GlassSurface = defineComponent({
  props: { as: { type: String, default: 'div' }, elevated: Boolean, compact: Boolean },
  setup:
    (p, { slots }) =>
    () =>
      h(
        p.as,
        { class: ['ui-glass', { 'ui-glass-elevated': p.elevated, 'ui-compact': p.compact }] },
        slots.default?.(),
      ),
});
export const PageHeader = defineComponent({
  props: { title: { type: String, required: true }, description: String },
  setup:
    (p, { slots }) =>
    () =>
      h('header', { class: 'ui-page-header' }, [
        h('div', [h('h1', slots.title?.() ?? p.title), p.description && h('p', p.description)]),
        slots.actions && h('div', { class: 'actions' }, slots.actions()),
      ]),
});
export const ContextPane = defineComponent({
  props: { label: { type: String, required: true } },
  setup:
    (p, { slots }) =>
    () =>
      h('aside', { class: 'ui-context-pane', 'aria-label': p.label }, slots.default?.()),
});
export const StatusBadge = defineComponent({
  props: {
    tone: {
      type: String as PropType<'neutral' | 'success' | 'warning' | 'danger'>,
      default: 'neutral',
    },
  },
  setup:
    (p, { slots }) =>
    () =>
      h('span', { class: ['ui-badge', `ui-badge-${p.tone}`] }, slots.default?.()),
});
export const Loader = defineComponent({
  props: {
    label: { type: String, default: 'Loading…' },
    size: { type: String as PropType<'inline' | 'panel' | 'navigation'>, default: 'inline' },
  },
  setup: (p) => () =>
    h('span', { class: ['ui-loader', `ui-loader-${p.size}`], role: 'status' }, [
      h('span', { class: 'ui-loader-ring', 'aria-hidden': true }),
      h('span', { class: 'ui-sr-only' }, p.label),
    ]),
});
export const IconButton = defineComponent({
  props: {
    label: { type: String, required: true },
    disabled: Boolean,
    busy: Boolean,
    pressed: { type: Boolean, default: undefined },
  },
  setup:
    (p, { slots }) =>
    () =>
      h(
        'button',
        {
          type: 'button',
          class: 'ui-icon-button',
          title: p.label,
          'aria-label': p.label,
          'aria-pressed': p.pressed,
          'aria-busy': p.busy,
          disabled: p.disabled || p.busy,
        },
        p.busy ? h(Loader, { label: p.label }) : slots.default?.(),
      ),
});

export const IntegratedSearch = defineComponent({
  props: {
    modelValue: { type: String, required: true },
    label: { type: String, required: true },
    placeholder: String,
    maxlength: Number,
    disabled: Boolean,
    busy: Boolean,
    error: String,
    submitLabel: { type: String, default: 'Search' },
    showSubmit: { type: Boolean, default: true },
  },
  emits: ['update:modelValue', 'submit', 'clear'],
  setup(p, { emit }) {
    const id = useId(),
      field = ref<HTMLInputElement>();
    return () =>
      h(
        'form',
        {
          class: 'ui-search',
          role: 'search',
          'aria-label': p.label,
          onSubmit: (e: Event) => {
            e.preventDefault();
            if (!p.disabled && !p.busy) emit('submit', p.modelValue);
          },
        },
        [
          h('label', { for: id }, p.label),
          h('div', { class: 'ui-search-field', 'aria-busy': p.busy }, [
            icon(Search),
            h('input', {
              ref: field,
              id,
              type: 'search',
              value: p.modelValue,
              placeholder: p.placeholder,
              maxlength: p.maxlength,
              disabled: p.disabled,
              'aria-invalid': !!p.error,
              'aria-describedby': p.error ? `${id}-error` : undefined,
              onInput: (e: Event) =>
                emit('update:modelValue', (e.target as HTMLInputElement).value),
            }),
            p.busy && h(Loader, { label: 'Searching…' }),
            p.modelValue &&
              h(
                IconButton,
                {
                  label: `Clear ${p.label.toLowerCase()}`,
                  disabled: p.disabled,
                  onClick: () => {
                    emit('update:modelValue', '');
                    emit('clear');
                    field.value?.focus();
                  },
                },
                () => icon(X),
              ),
            p.showSubmit &&
              h(
                'button',
                {
                  class: 'ui-icon-button',
                  type: 'submit',
                  title: p.submitLabel,
                  'aria-label': p.submitLabel,
                  disabled: p.disabled || p.busy,
                },
                icon(ArrowRight),
              ),
          ]),
          p.error && h('p', { id: `${id}-error`, class: 'ui-field-error', role: 'alert' }, p.error),
        ],
      );
  },
});

export const SegmentedControl = defineComponent({
  props: {
    modelValue: { type: String, required: true },
    label: { type: String, required: true },
    options: optionsProp,
    disabled: Boolean,
  },
  emits: ['update:modelValue'],
  setup(p, { emit }) {
    const group = ref<HTMLElement>();
    function placeHighlight() {
      // CSSOM writes are allowed by the strict CSP; SSR style attributes are not.
      group.value?.style.setProperty('--segment-count', String(Math.max(1, p.options.length)));
      group.value?.style.setProperty(
        '--segment-index',
        String(
          Math.max(
            0,
            p.options.findIndex((o) => o.value === p.modelValue),
          ),
        ),
      );
    }
    onMounted(placeHighlight);
    watch([() => p.modelValue, () => p.options], placeHighlight, { flush: 'post' });
    function key(e: KeyboardEvent, i: number) {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key))
        return;
      e.preventDefault();
      const indices = p.options.flatMap((o, n) => (o.disabled ? [] : [n]));
      if (!indices.length || p.disabled) return;
      const position = indices.indexOf(i),
        step = ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1;
      const next =
        e.key === 'Home'
          ? indices[0]
          : e.key === 'End'
            ? indices.at(-1)
            : indices[(position + step + indices.length) % indices.length];
      if (next === undefined) return;
      emit('update:modelValue', p.options[next]!.value);
      group.value?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
    }
    return () =>
      h(
        'div',
        {
          ref: group,
          role: 'radiogroup',
          'aria-label': p.label,
          class: 'ui-segments',
        },
        [
          h('span', { class: 'ui-segment-highlight', 'aria-hidden': true }),
          ...p.options.map((o, i) =>
            h(
              'button',
              {
                type: 'button',
                role: 'radio',
                'aria-checked': o.value === p.modelValue,
                disabled: p.disabled || o.disabled,
                tabindex:
                  o.value === p.modelValue ||
                  (!p.options.some((x) => x.value === p.modelValue && !x.disabled) &&
                    i === p.options.findIndex((x) => !x.disabled))
                    ? 0
                    : -1,
                onClick: () => emit('update:modelValue', o.value),
                onKeydown: (e: KeyboardEvent) => key(e, i),
              },
              o.label,
            ),
          ),
        ],
      );
  },
});

export const StudySelect = defineComponent({
  props: {
    modelValue: { type: String, required: true },
    label: { type: String, required: true },
    options: optionsProp,
    disabled: Boolean,
    error: String,
    placeholder: { type: String, default: 'Choose an option' },
  },
  emits: ['update:modelValue'],
  setup(p, { emit }) {
    const id = useId(),
      root = ref<HTMLElement>(),
      trigger = ref<HTMLButtonElement>();
    const open = ref(false),
      active = ref(-1);
    let prefix = '',
      typedAt = 0;
    const enabled = computed(() => p.options.flatMap((o, i) => (o.disabled ? [] : [i])));
    function close(restore = false) {
      open.value = false;
      if (restore) trigger.value?.focus();
    }
    function reveal() {
      if (p.disabled) return;
      open.value = true;
      active.value = p.options.findIndex((o) => o.value === p.modelValue && !o.disabled);
      if (active.value < 0) active.value = enabled.value[0] ?? -1;
    }
    function scrollActive() {
      nextTick(() =>
        document.getElementById(`${id}-${active.value}`)?.scrollIntoView({ block: 'nearest' }),
      );
    }
    function choose(i: number) {
      const option = p.options[i];
      if (p.disabled || !option || option.disabled) return;
      emit('update:modelValue', option.value);
      close(true);
    }
    function key(e: KeyboardEvent) {
      if (p.disabled) return;
      if (e.key === 'Tab') {
        close();
        return;
      }
      if (e.key === 'Escape') {
        if (open.value) {
          e.preventDefault();
          e.stopPropagation();
          close(true);
        }
        return;
      }
      if (['Enter', ' '].includes(e.key)) {
        e.preventDefault();
        if (open.value) choose(active.value);
        else reveal();
        return;
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const wasOpen = open.value;
        if (!wasOpen) reveal();
        const list = enabled.value,
          pos = list.indexOf(active.value);
        if (e.key === 'Home') active.value = list[0] ?? -1;
        else if (e.key === 'End') active.value = list.at(-1) ?? -1;
        else if (wasOpen)
          active.value =
            list[(pos + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length] ?? -1;
        scrollActive();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!open.value) reveal();
        const now = Date.now();
        prefix = now - typedAt > 700 ? e.key : prefix + e.key;
        typedAt = now;
        const query = [...prefix].every((c) => c.toLowerCase() === e.key.toLowerCase())
          ? e.key
          : prefix;
        const list = enabled.value,
          pos = list.indexOf(active.value);
        const ordered = [...list.slice(pos + 1), ...list.slice(0, pos + 1)];
        const found = ordered.find((i) =>
          p.options[i]!.label.toLocaleLowerCase().startsWith(query.toLocaleLowerCase()),
        );
        if (found !== undefined) active.value = found;
        scrollActive();
      }
    }
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.value?.contains(e.target)) close();
    };
    onMounted(() => document.addEventListener('pointerdown', outside));
    onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
    watch(
      () => p.disabled,
      (value) => {
        if (value) close();
      },
    );
    watch(
      () => p.options,
      () => {
        if (open.value) reveal();
      },
    );
    return () =>
      h(
        'div',
        {
          ref: root,
          class: 'ui-select',
          onFocusout: (e: FocusEvent) => {
            if (!(e.relatedTarget instanceof Node) || !root.value?.contains(e.relatedTarget))
              close();
          },
        },
        [
          h('label', { id: `${id}-label`, for: id }, p.label),
          h(
            'button',
            {
              id,
              ref: trigger,
              type: 'button',
              role: 'combobox',
              class: 'ui-select-trigger',
              'aria-labelledby': `${id}-label`,
              'aria-expanded': open.value,
              'aria-controls': `${id}-list`,
              'aria-haspopup': 'listbox',
              'aria-activedescendant':
                open.value && active.value >= 0 ? `${id}-${active.value}` : undefined,
              'aria-invalid': !!p.error,
              'aria-describedby': p.error ? `${id}-error` : undefined,
              disabled: p.disabled,
              onKeydown: key,
              onClick: () => (open.value ? close() : reveal()),
            },
            [
              h('span', p.options.find((o) => o.value === p.modelValue)?.label ?? p.placeholder),
              icon(ChevronDown),
            ],
          ),
          h(
            OverlayPopover,
            {
              as: 'ul',
              open: open.value,
              anchor: trigger.value,
              'onUpdate:open': (value: boolean) => {
                open.value = value;
              },
              id: `${id}-list`,
              role: 'listbox',
              'aria-labelledby': `${id}-label`,
              class: 'ui-select-list',
            },
            {
              default: () =>
                p.options.map((o, i) =>
                  h(
                    'li',
                    {
                      id: `${id}-${i}`,
                      role: 'option',
                      'aria-selected': o.value === p.modelValue,
                      'aria-disabled': !!o.disabled,
                      class: { 'is-active': i === active.value },
                      onPointerdown: (e: PointerEvent) => e.preventDefault(),
                      onClick: () => choose(i),
                      onPointermove: () => {
                        if (!o.disabled) active.value = i;
                      },
                    },
                    [h('span', o.label), o.value === p.modelValue && icon(Check)],
                  ),
                ),
            },
          ),
          p.error && h('p', { id: `${id}-error`, class: 'ui-field-error', role: 'alert' }, p.error),
        ],
      );
  },
});

/** Native modal top layer preserves inertness, Tab containment and Escape behavior. */
export const SettingsSheet = defineComponent({
  props: { open: Boolean, title: { type: String, required: true } },
  emits: ['update:open'],
  setup(p, { slots, emit }) {
    const id = useId(),
      dialog = ref<HTMLDialogElement>();
    let opener: HTMLElement | null = null,
      mounted = false;
    function restore() {
      if (opener?.isConnected) opener.focus();
      opener = null;
    }
    function sync() {
      if (!mounted || !dialog.value) return;
      if (p.open && !dialog.value.open) {
        const active = dialog.value.ownerDocument.activeElement;
        opener = active instanceof HTMLElement ? active : null;
        dialog.value.showModal();
      } else if (!p.open && dialog.value.open) {
        dialog.value.close();
        restore();
      }
    }
    onMounted(() => {
      mounted = true;
      sync();
    });
    watch(() => p.open, sync, { flush: 'post' });
    onBeforeUnmount(() => {
      dialog.value?.close();
      restore();
    });
    return () =>
      h(
        'dialog',
        {
          ref: dialog,
          class: 'ui-settings-sheet',
          'aria-labelledby': id,
          onCancel: (e: Event) => {
            e.preventDefault();
            emit('update:open', false);
          },
          onClose: () => {
            if (dialog.value?.open) return;
            if (p.open) emit('update:open', false);
            restore();
          },
          onKeydown: (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;
            const controls = [
              ...(dialog.value?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
              ) ?? []),
            ].filter((el) => el.getClientRects().length && !el.closest('[inert]'));
            const first = controls[0],
              last = controls.at(-1);
            if (e.shiftKey && dialog.value?.ownerDocument.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && dialog.value?.ownerDocument.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          },
          onClick: (e: MouseEvent) => {
            const box = dialog.value?.getBoundingClientRect();
            if (
              e.target === dialog.value &&
              box &&
              (e.clientX < box.left ||
                e.clientX > box.right ||
                e.clientY < box.top ||
                e.clientY > box.bottom)
            )
              emit('update:open', false);
          },
        },
        [
          h('header', { class: 'ui-sheet-heading' }, [
            h('h2', { id }, p.title),
            h(
              IconButton,
              {
                label: `Close ${p.title.toLowerCase()}`,
                onClick: () => emit('update:open', false),
              },
              () => icon(X),
            ),
          ]),
          h('div', { class: ['ui-sheet-body', { 'has-categories': !!slots.categories }] }, [
            slots.categories &&
              h('nav', { 'aria-label': `${p.title} categories` }, slots.categories()),
            h('div', { class: 'ui-sheet-content' }, slots.default?.()),
          ]),
        ],
      );
  },
});
