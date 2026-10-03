export function copyAppLink(path: string) {
  return navigator.clipboard.writeText(new URL(path, location.origin).href);
}
export async function shareAppLink(path: string, title = 'Study Space') {
  const url = new URL(path, location.origin).href;
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') throw error;
    }
  } else await navigator.clipboard.writeText(url);
}
