/** User-agent claims are informational. Reduced UA strings cannot identify Windows 11 or hardware. */
export function deviceSummary(ua: string): string {
  let os = 'Unknown operating system';
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua))
    os = `Android${ua.match(/Android ([\d.]+)/)?.[1] ? ' ' + ua.match(/Android ([\d.]+)/)![1] : ''}`;
  else if (/iPhone|iPad/.test(ua))
    os = `${/iPad/.test(ua) ? 'iPadOS' : 'iOS'}${ua.match(/OS ([\d_]+)/)?.[1] ? ' ' + ua.match(/OS ([\d_]+)/)![1]!.replaceAll('_', '.') : ''}`;
  else if (/Macintosh/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  const browser = [
    ['Edge', /Edg(?:A|iOS)?\/([\d.]+)/],
    ['Opera', /OPR\/([\d.]+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ] as const;
  for (const [name, pattern] of browser) {
    const match = ua.match(pattern);
    if (match) return `${os} · ${name} ${match[1]}`;
  }
  return `${os} · Browser`;
}
