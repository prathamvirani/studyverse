const origins = new Set(['/', '/home', '/my-rooms', '/discover', '/friends']);
export const roomAddress = (room: { id: string; publicId?: string; slug?: string | null }) =>
  room.slug ?? room.publicId ?? room.id;
/** Only application browse routes can be a room-management return destination. */
export function roomOrigin(value: unknown): string {
  if (typeof value !== 'string' || value.length > 1000 || /[\\\r\n]/.test(value))
    return '/my-rooms';
  try {
    const url = new URL(value, 'https://study.invalid');
    if (
      !value.startsWith('/') ||
      url.origin !== 'https://study.invalid' ||
      !origins.has(url.pathname)
    )
      return '/my-rooms';
    const query = new URLSearchParams();
    for (const key of ['search', 'sort', 'filter', 'minMembers', 'columns', 'friend']) {
      const part = url.searchParams.get(key);
      if (part && part.length <= 80) query.set(key, part);
    }
    return url.pathname + (query.size ? `?${query}` : '');
  } catch {
    return '/my-rooms';
  }
}
export const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
export const memberLabel = (count: number) => `${count} ${count === 1 ? 'member' : 'members'}`;
