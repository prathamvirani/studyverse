import { ref } from 'vue';
export interface CompanionSpec {
  id: string;
  label: string;
  width?: number;
  height?: number;
}
interface Companion {
  window: Window;
  stage: HTMLElement;
  node?: HTMLElement;
  parent?: Node | null;
  next?: Node | null;
  observer: MutationObserver;
  detach?: () => void;
  sheets: Set<CSSStyleSheet>;
}
/** Adopt one existing view per window. All application/session/capture owners remain in the opener. */
export function workspacePopouts(
  notice: (message: string) => void,
  attach?: (doc: Document) => () => void,
) {
  const windows = new Map<string, Companion>();
  const count = ref(0);
  let disposed = false,
    nextId = 0;
  let namespace = '',
    watchingOwner = false;
  function watchOwner() {
    if (watchingOwner) return;
    watchingOwner = true;
    window.addEventListener('pagehide', close);
  }
  const identities = new WeakMap<HTMLElement, string>();
  function copyStyles(doc: Document, copied: Set<CSSStyleSheet>) {
    const nonce = document.querySelector<HTMLElement>('style[nonce],link[nonce]')?.nonce ?? '';
    for (const sheet of document.styleSheets) {
      if (copied.has(sheet)) continue;
      try {
        const css = [...sheet.cssRules]
          .map((rule) => rule.cssText)
          .join('\n')
          .replace(
            /url\((['"]?)([^'")]+)\1\)/g,
            (_match, _quote, value: string) =>
              `url("${new URL(value, sheet.href ?? document.baseURI).href}")`,
          );
        const style = doc.createElement('style');
        style.nonce = nonce;
        style.textContent = css;
        doc.head.append(style);
        copied.add(sheet);
      } catch {
        // Retain the normal link path for unreadable cross-origin stylesheets.
        if (sheet.ownerNode instanceof HTMLLinkElement) {
          const link = sheet.ownerNode.cloneNode(true) as HTMLLinkElement;
          link.href = sheet.ownerNode.href;
          link.nonce = sheet.ownerNode.nonce;
          doc.head.append(link);
          copied.add(sheet);
        }
      }
    }
  }
  function identity(node: HTMLElement) {
    const stable = node.dataset.workspaceId ?? node.dataset.popoutId;
    if (stable) return stable;
    if (!identities.has(node)) identities.set(node, `companion-${++nextId}`);
    return identities.get(node)!;
  }
  function presentation(node: HTMLElement) {
    for (const host of node.querySelectorAll<HTMLElement>('[data-media-host]'))
      host.dispatchEvent(new Event('room-presentation-changed'));
  }
  function restoreId(id: string, closeWindow = true) {
    const companion = windows.get(id);
    if (!companion) return;
    windows.delete(id);
    count.value = windows.size;
    const node = companion.node;
    if (node) {
      delete node.dataset.poppedOut;
      if (companion.parent?.isConnected)
        companion.parent.insertBefore(
          node,
          companion.next?.parentNode === companion.parent ? companion.next : null,
        );
      else {
        node.remove();
        node.dispatchEvent(new Event('popout-return'));
      }
      presentation(node);
    }
    companion.observer.disconnect();
    companion.detach?.();
    if (closeWindow && !companion.window.closed) companion.window.close();
  }
  function stage(spec: CompanionSpec, popup: Window) {
    watchOwner();
    const doc = popup.document;
    doc.title = `Study Space · ${spec.label}`;
    const sheets = new Set<CSSStyleSheet>();
    copyStyles(doc, sheets);
    const room = document.querySelector<HTMLElement>('.room-shell');
    const root = doc.createElement('main');
    root.className = 'room-shell popout-stage';
    root.setAttribute('aria-label', spec.label);
    root.dataset.companionId = spec.id;
    const sync = () => {
      for (const attribute of document.documentElement.attributes)
        doc.documentElement.setAttribute(attribute.name, attribute.value);
      if (room) {
        const style = getComputedStyle(room);
        for (const name of style)
          if (name.startsWith('--')) root.style.setProperty(name, style.getPropertyValue(name));
      }
    };
    sync();
    doc.body.append(root);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true });
    if (room)
      observer.observe(room, {
        attributes: true,
        subtree: true,
        attributeFilter: ['data-material'],
      });
    const companion: Companion = {
      window: popup,
      stage: root,
      observer,
      sheets,
      ...(attach ? { detach: attach(doc) } : {}),
    };
    windows.set(spec.id, companion);
    count.value = windows.size;
    popup.addEventListener('pagehide', () => restoreId(spec.id, false), { once: true });
    return companion;
  }
  function reserve(spec: CompanionSpec) {
    if (disposed) return false;
    const existing = windows.get(spec.id);
    if (existing && !existing.window.closed) return true;
    if (existing) restoreId(spec.id, false);
    namespace ||= crypto.randomUUID();
    const popup = window.open(
      '',
      `study-space-${namespace}-${spec.id.replace(/[^a-z0-9-]/gi, '-').slice(0, 120)}`,
      `popup,width=${spec.width ?? 420},height=${spec.height ?? 520}`,
    );
    if (!popup) return false;
    stage(spec, popup);
    return true;
  }
  function reserveAll(specs: CompanionSpec[]) {
    const blocked: string[] = [];
    for (const spec of specs) if (!reserve(spec)) blocked.push(spec.label);
    if (blocked.length)
      notice(
        `Could not open: ${blocked.join(', ')}. Allow Study Space popups and try again; these tools remain in the room.`,
      );
    return blocked;
  }
  async function open(nodes: HTMLElement[], utilityOnly = false) {
    if (disposed || !nodes.length) return false;
    let success = true;
    for (const node of nodes) {
      const id = identity(node),
        label = node.getAttribute('aria-label') ?? 'Room tool';
      let companion = windows.get(id);
      if (companion?.window.closed) {
        restoreId(id, false);
        companion = undefined;
      }
      if (companion?.node) {
        companion.window.focus();
        continue;
      }
      if (!companion) {
        const size = node.classList.contains('room-dock')
          ? {
              width: Math.max(520, node.offsetWidth + 12),
              height: Math.max(100, node.offsetHeight + 12),
            }
          : { width: 420, height: 520 };
        const pip = (
          window as Window & {
            documentPictureInPicture?: {
              requestWindow(options: { width: number; height: number }): Promise<Window>;
            };
          }
        ).documentPictureInPicture;
        if (!utilityOnly && nodes.length === 1 && !windows.size && pip) {
          try {
            const popup = await pip.requestWindow(size);
            if (disposed) {
              popup.close();
              return false;
            }
            companion = stage({ id, label }, popup);
          } catch {
            /* Utility-window fallback uses the same ownership path. */
          }
        }
        if (!companion && reserve({ id, label, ...size })) companion = windows.get(id);
      }
      if (!companion) {
        notice(`Could not open ${label}. Allow Study Space popups and try again.`);
        success = false;
        continue;
      }
      if (disposed) {
        restoreId(id);
        success = false;
        continue;
      }
      companion.node = node;
      copyStyles(companion.window.document, companion.sheets);
      companion.parent = node.parentNode;
      companion.next = node.nextSibling;
      node.dataset.poppedOut = 'true';
      companion.stage.append(node);
      presentation(node);
      companion.window.focus();
    }
    return success;
  }
  function restore(node: HTMLElement) {
    restoreId(identity(node));
  }
  function restoreAll() {
    for (const id of [...windows.keys()]) restoreId(id);
  }
  function close() {
    disposed = true;
    if (watchingOwner) {
      window.removeEventListener('pagehide', close);
      watchingOwner = false;
    }
    restoreAll();
  }
  return {
    count,
    open,
    reserve,
    reserveAll,
    restore,
    restoreAll,
    reserved: (id: string) => !!windows.get(id) && !windows.get(id)!.window.closed,
    release: restoreId,
    find: (id: string) => windows.get(id)?.node,
    contains: (node: HTMLElement) => windows.get(identity(node))?.node === node,
    close,
  };
}
export type WorkspacePopouts = ReturnType<typeof workspacePopouts>;
