/** Wait for the laid-out first viewport, not media/provider playback or offscreen imagery. */
export async function waitForCriticalFrame(root: HTMLElement, signal: AbortSignal) {
  const abortable = async (work: Promise<unknown>) => {
    if (signal.aborted) return;
    let release = () => {};
    const cancelled = new Promise<void>((resolve) => {
      release = resolve;
      signal.addEventListener('abort', release, { once: true });
    });
    try {
      await Promise.race([work, cancelled]);
    } finally {
      signal.removeEventListener('abort', release);
    }
  };
  const frame = () =>
    abortable(new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await frame();
  if (signal.aborted) return;
  // Layout first so fonts needed by newly mounted text enter the font loading set.
  root.getBoundingClientRect();
  await abortable(document.fonts.ready);
  if (signal.aborted) return;
  const images = [...root.querySelectorAll('img')].filter((img) => {
    const box = img.getBoundingClientRect();
    return (
      box.width > 0 &&
      box.height > 0 &&
      box.bottom > 0 &&
      box.top < innerHeight &&
      box.right > 0 &&
      box.left < innerWidth
    );
  });
  await Promise.all(
    images.map(async (img) => {
      // An above-fold lazy image is first-frame content; leave offscreen images lazy.
      if (img.loading === 'lazy') img.loading = 'eager';
      await abortable(img.decode().catch(() => {})); // Broken images settle into the page's fallback.
    }),
  );
  await frame();
}
