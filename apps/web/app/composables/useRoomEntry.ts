import { roomSchema } from '@study/contracts';
import type { Room } from '@study/contracts';
import { roomAddress } from '../lib/room-navigation';
import { safeAppPath } from '../lib/app-history';

interface EntryState {
  room: Room | null;
  origin: string;
  pending: boolean;
  error: string;
  generation: number;
  resolving: boolean;
  preparedRoomId: string;
  confirmed: { room: Room; userId: string; expires: number } | null;
}
/** Page-local decision UI; only the server join response can create a short-lived handoff. */
export function useRoomEntry() {
  const state = useState<EntryState>('room-entry-decision', () => ({
    room: null,
    origin: '/my-rooms',
    pending: false,
    error: '',
    generation: 0,
    resolving: false,
    preparedRoomId: '',
    confirmed: null,
  }));
  const { api, profile } = useAccount();
  const router = useRouter();
  const history = useAppHistory();
  function close(returnToOrigin = true) {
    const path = state.value.room ? `/rooms/${roomAddress(state.value.room)}` : '';
    const origin = state.value.origin;
    state.value.generation++;
    state.value.room = null;
    state.value.pending = false;
    state.value.error = '';
    state.value.resolving = false;
    state.value.preparedRoomId = '';
    if (returnToOrigin && path && router.currentRoute.value.path === path) {
      if (history.back.value?.path === origin) void history.go(-1);
      else void router.push(origin);
    }
  }
  async function open(room: Room, origin: string) {
    return openAddress(roomAddress(room), origin);
  }
  function preview(room: Room, origin: string) {
    close(false);
    state.value.origin = safeAppPath(origin) ?? '/my-rooms';
    state.value.room = room;
  }
  async function openAddress(address: string, origin: string) {
    close(false);
    const generation = state.value.generation,
      userId = profile.value?.id,
      originalPath = router.currentRoute.value.fullPath;
    state.value.origin = safeAppPath(origin) ?? '/my-rooms';
    state.value.resolving = true;
    try {
      const room = await api.request(
        `/api/v1/rooms/resolve?address=${encodeURIComponent(address)}`,
        roomSchema,
      );
      if (
        generation !== state.value.generation ||
        profile.value?.id !== userId ||
        router.currentRoute.value.fullPath !== originalPath
      )
        return false;
      state.value.room = room;
      const failure = await router.push({
        path: `/rooms/${roomAddress(room)}`,
        query: { from: state.value.origin },
      });
      if (failure) throw new Error('Preview navigation did not complete');
      return true;
    } catch {
      if (generation === state.value.generation) {
        state.value.room = null;
        state.value.error = 'This room is unavailable or your access has changed.';
      }
      return false;
    } finally {
      if (generation === state.value.generation) state.value.resolving = false;
    }
  }
  async function commit() {
    const selected = state.value.room;
    const userId = profile.value?.id;
    if (!selected || !userId || state.value.pending || state.value.preparedRoomId !== selected.id)
      return;
    const generation = state.value.generation;
    state.value.pending = true;
    state.value.error = '';
    try {
      const admitted = await api.request('/api/v1/rooms/join', roomSchema, { roomId: selected.id });
      if (generation !== state.value.generation || profile.value?.id !== userId) return;
      state.value.confirmed = { room: admitted, userId, expires: Date.now() + 15000 };
      close(false);
    } catch {
      if (generation === state.value.generation) {
        state.value.confirmed = null;
        state.value.error = 'This room could not be opened. Please try again.';
      }
    } finally {
      if (generation === state.value.generation) state.value.pending = false;
    }
  }
  function consume(roomId: string): Room | null {
    const confirmed = state.value.confirmed;
    state.value.confirmed = null;
    return confirmed?.room.id === roomId &&
      confirmed.userId === profile.value?.id &&
      confirmed.expires >= Date.now()
      ? confirmed.room
      : null;
  }
  function prepared(roomId: string) {
    if (state.value.room?.id === roomId) state.value.preparedRoomId = roomId;
  }
  return { state, open, openAddress, preview, prepared, close, commit, consume };
}
