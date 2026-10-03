export interface AppVisit {
  path: string;
  scroll: number;
  position: number;
}
export interface AppHistory {
  visits: AppVisit[];
  cursor: number;
  pending: number | null;
}
/** Store only known app addresses. External history and auth/bearer query values are excluded. */
export function safeAppPath(value: string): string | null {
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\r\n]/.test(value) ||
    value.length > 2000
  )
    return null;
  try {
    const url = new URL(value, 'https://study.invalid');
    if (
      url.origin !== 'https://study.invalid' ||
      !(
        /^\/(?:home|my-rooms|discover|friends|account)?$/.test(url.pathname) ||
        /^\/rooms\/[a-zA-Z0-9-]{3,40}(?:\/configure)?$/.test(url.pathname)
      )
    )
      return null;
    for (const key of ['invite-code', 'code', 'state', 'token']) url.searchParams.delete(key);
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
export function recordVisit(history: AppHistory, value: string, position: number) {
  const path = safeAppPath(value);
  if (!path) return;
  const intended = history.pending;
  history.pending = null;
  if (intended !== null && history.visits[intended]?.path === path) {
    history.cursor = intended;
    history.visits[intended]!.position = position;
    return;
  }
  const native = history.visits.findIndex((v) => v.position === position && v.path === path);
  if (native >= 0) {
    history.cursor = native;
    return;
  }
  if (history.visits[history.cursor]?.path === path) return;
  history.visits.splice(history.cursor + 1);
  history.visits.push({ path, scroll: 0, position });
  if (history.visits.length > 80) history.visits.shift();
  history.cursor = history.visits.length - 1;
}
export function historyDestination(history: AppHistory, direction: -1 | 1) {
  return history.visits[history.cursor + direction] ?? null;
}
