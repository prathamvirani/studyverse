import { historyDestination, recordVisit } from '../lib/app-history';
import type { AppHistory } from '../lib/app-history';
export function useAppHistory() {
  const state = useState<AppHistory>('safe-app-history', () => ({
    visits: [],
    cursor: -1,
    pending: null,
  }));
  const router = useRouter();
  const back = computed(() => historyDestination(state.value, -1));
  const forward = computed(() => historyDestination(state.value, 1));
  async function go(direction: -1 | 1) {
    const destination = historyDestination(state.value, direction);
    if (!destination) return;
    state.value.pending = state.value.cursor + direction;
    const failure = await router.push(destination.path);
    if (failure) state.value.pending = null;
  }
  return { state, back, forward, go };
}
/** Install once at the app ownership root, after authentication; never read external referrers. */
export function installAppHistory() {
  const history = useAppHistory(),
    router = useRouter(),
    { profile } = useAccount();
  const motion = useRouteMotionState();
  let restore: { path: string; scroll: number } | null = null;
  const position = () => Number(window.history.state?.position ?? 0);
  const eligible = () => !!profile.value && Object.values(profile.value.onboarding).every(Boolean);
  function record() {
    if (!eligible()) return;
    const previous = history.state.value.cursor;
    const revisiting =
      history.state.value.pending !== null ||
      history.state.value.visits.some(
        (visit) =>
          visit.position === position() && visit.path === router.currentRoute.value.fullPath,
      );
    recordVisit(history.state.value, router.currentRoute.value.fullPath, position());
    if (history.state.value.cursor !== previous && revisiting) {
      const visit = history.state.value.visits[history.state.value.cursor];
      if (visit) restore = { path: visit.path, scroll: visit.scroll };
    }
  }
  onMounted(record);
  watch(
    () => profile.value?.id,
    () => {
      history.state.value = { visits: [], cursor: -1, pending: null };
      record();
    },
  );
  const removeBefore = router.beforeEach(() => {
    const current = history.state.value.visits[history.state.value.cursor];
    if (current) current.scroll = window.scrollY;
  });
  const removeAfter = router.afterEach((_to, _from, failure) => {
    if (!failure) record();
    else history.state.value.pending = null;
  });
  watch(
    () => motion.value.active,
    async (active) => {
      if (active || !restore || router.currentRoute.value.fullPath !== restore.path) return;
      const target = restore;
      restore = null;
      await nextTick();
      requestAnimationFrame(() => {
        if (router.currentRoute.value.fullPath === target.path) window.scrollTo(0, target.scroll);
      });
    },
  );
  onUnmounted(() => {
    removeBefore();
    removeAfter();
  });
  return history;
}
