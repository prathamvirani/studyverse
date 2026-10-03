export function useRouteMotionState() {
  return useState('route-motion', () => ({
    generation: 0,
    pending: 0,
    mounted: true,
    active: false,
  }));
}

/** Track existing first-frame reads without changing their data, errors or authorization. */
export function onCriticalPageMounted(load: () => Promise<unknown>) {
  const motion = useRouteMotionState();
  let release = () => {};
  onMounted(async () => {
    const generation = motion.value.generation;
    motion.value.pending++;
    let released = false;
    release = () => {
      if (!released && motion.value.generation === generation) motion.value.pending--;
      released = true;
    };
    try {
      await load();
    } finally {
      release();
    }
  });
  onBeforeUnmount(() => release());
}
