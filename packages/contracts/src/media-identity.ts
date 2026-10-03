/** Public YouTube identity only. Query credentials and tracking never become identity. */
export function youtubeContentId(input: string): string | null {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    let id: string | null = null;
    if (u.hostname === 'youtu.be' && /^\/[^/]+$/.test(u.pathname)) id = u.pathname.slice(1);
    if (['youtube.com', 'www.youtube.com', 'music.youtube.com'].includes(u.hostname)) {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else if (/^\/(embed|shorts)\/[^/]+$/.test(u.pathname)) id = u.pathname.split('/')[2] ?? null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
