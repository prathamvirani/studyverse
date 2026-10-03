import { contextMenuKey } from '../lib/context-menu';
import type { ContextAction } from '../lib/context-menu';
import type { Ref } from 'vue';
import { inject, watch, onUnmounted } from 'vue';
export function useContextActions(
  target: Ref<HTMLElement | undefined>,
  actions: () => ContextAction[],
) {
  const host = inject(contextMenuKey, undefined);
  let remove: (() => void) | undefined;
  watch(
    target,
    (node) => {
      remove?.();
      remove = node ? host?.contribute(node, actions) : undefined;
    },
    { flush: 'post' },
  );
  onUnmounted(() => remove?.());
  return host;
}
export function useContextTargets() {
  const host = inject(contextMenuKey, undefined);
  const removes = new Map<string, () => void>();
  function bind(id: string, value: unknown, actions: () => ContextAction[]) {
    removes.get(id)?.();
    removes.delete(id);
    const node = value as HTMLElement | null;
    if (node?.nodeType === 1 && host) removes.set(id, host.contribute(node, actions));
  }
  onUnmounted(() => {
    for (const remove of removes.values()) remove();
  });
  return { bind, host };
}
