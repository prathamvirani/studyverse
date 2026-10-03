import { shallowRef } from 'vue';
import type { InjectionKey } from 'vue';
export interface ContextAction {
  id: string;
  label: string;
  run: () => unknown | Promise<unknown>;
  disabled?: boolean;
  danger?: boolean;
}
export interface ContextOpening {
  x: number;
  y: number;
  doc: Document;
  target: HTMLElement;
  actions: ContextAction[];
}
export const contextMenuKey: InjectionKey<ReturnType<typeof createContextMenu>> =
  Symbol('study-context-menu');

/** One event owner across the app and adopted companion documents. */
export function createContextMenu(general: () => ContextAction[]) {
  const opening = shallowRef<ContextOpening | null>(null),
    note = shallowRef('');
  const contributions = new WeakMap<HTMLElement, () => ContextAction[]>();
  const documents = new Map<Document, () => void>();
  function close(restore = true) {
    const target = opening.value?.target;
    opening.value = null;
    if (restore && target?.isConnected) target.focus({ preventScroll: true });
  }
  function contribute(node: HTMLElement, actions: () => ContextAction[]) {
    contributions.set(node, actions);
    return () => contributions.delete(node);
  }
  function editing(target: HTMLElement, doc: Document): ContextAction[] | null {
    const field = target.closest('input,textarea,[contenteditable="true"]') as
      HTMLInputElement | HTMLTextAreaElement | HTMLElement | null;
    const documentSelection = doc.getSelection();
    const selection = documentSelection?.toString() ?? '';
    const range = documentSelection?.rangeCount
      ? documentSelection.getRangeAt(0).cloneRange()
      : null;
    if (!field && !selection) return null;
    const textual =
      field?.tagName === 'INPUT' || field?.tagName === 'TEXTAREA'
        ? (field as HTMLInputElement | HTMLTextAreaElement)
        : null;
    const start = textual?.selectionStart ?? 0,
      end = textual?.selectionEnd ?? 0;
    const selected = textual ? textual.value.slice(start, end) : selection;
    const clipboard = doc.defaultView!.navigator.clipboard;
    const writable = !!field && !(textual?.readOnly || textual?.disabled);
    function replace(value: string) {
      field?.focus();
      if (textual) {
        textual.setRangeText(value, start, end, 'end');
        textual.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        if (range) {
          documentSelection?.removeAllRanges();
          documentSelection?.addRange(range);
        }
        doc.execCommand('insertText', false, value);
      }
    }
    return [
      ...(field
        ? [
            {
              id: 'edit.cut',
              label: 'Cut',
              disabled: !writable || !selected || !clipboard?.writeText,
              run: async () => {
                await clipboard.writeText(selected);
                replace('');
              },
            },
          ]
        : []),
      {
        id: 'edit.copy',
        label: 'Copy',
        disabled: !selected || !clipboard?.writeText,
        run: () => clipboard.writeText(selected),
      },
      ...(field
        ? [
            {
              id: 'edit.paste',
              label: 'Paste',
              disabled: !writable || !clipboard?.readText,
              run: async () => replace(await clipboard.readText()),
            },
          ]
        : []),
      {
        id: 'edit.select-all',
        label: 'Select all',
        run: () => {
          field?.focus();
          if (textual) textual.select();
          else doc.execCommand('selectAll');
        },
      },
    ];
  }
  function show(target: HTMLElement, doc: Document, x: number, y: number) {
    const input = target.closest('input') as HTMLInputElement | null;
    // Browsers own editors whose selection APIs are unavailable (number, date, email, etc.).
    if (input && !['text', 'search', 'url', 'tel', 'password', ''].includes(input.type))
      return false;
    let actions = editing(target, doc);
    if (!actions) {
      let element: HTMLElement | null = target;
      while (element && !contributions.has(element)) element = element.parentElement;
      actions = element ? contributions.get(element)!() : general();
      if (!actions.length) actions = general();
    }
    if (!actions.length) return false;
    const focused =
      target.closest<HTMLElement>('button,a[href],input,textarea,[tabindex]') ??
      (doc.activeElement !== doc.body ? (doc.activeElement as HTMLElement) : target);
    opening.value = { target: focused, doc, x, y, actions };
    return true;
  }
  function attach(doc: Document) {
    if (documents.has(doc)) return () => {};
    const context = (event: MouseEvent) => {
      // Do not cancel this second event: the browser's native menu is the escape hatch.
      if (opening.value) {
        close(false);
        return;
      }
      const target = event.target as HTMLElement;
      if (target?.nodeType === 1 && show(target, doc, event.clientX, event.clientY))
        event.preventDefault();
    };
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && opening.value) {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
        const target = doc.activeElement as HTMLElement;
        if (!target) return;
        const rect = target.getBoundingClientRect();
        if (show(target, doc, rect.left + Math.min(24, rect.width / 2), rect.bottom))
          event.preventDefault();
      }
    };
    const outside = (event: PointerEvent) => {
      if (event.button === 2) return;
      if (opening.value && !(event.target as HTMLElement).closest('.study-context-menu'))
        close(false);
    };
    doc.addEventListener('contextmenu', context);
    doc.addEventListener('keydown', keys, true);
    doc.addEventListener('pointerdown', outside);
    const detach = () => {
      doc.removeEventListener('contextmenu', context);
      doc.removeEventListener('keydown', keys, true);
      doc.removeEventListener('pointerdown', outside);
      documents.delete(doc);
      if (opening.value?.doc === doc) close(false);
    };
    documents.set(doc, detach);
    return detach;
  }
  async function activate(action: ContextAction) {
    if (action.disabled) return;
    close();
    try {
      await action.run();
    } catch {
      note.value =
        'That action could not complete. For text editing, right-click twice to use your browser’s menu.';
    }
  }
  return {
    opening,
    note,
    close,
    contribute,
    attach,
    activate,
    dispose: () => {
      close(false);
      for (const detach of [...documents.values()]) detach();
    },
  };
}
