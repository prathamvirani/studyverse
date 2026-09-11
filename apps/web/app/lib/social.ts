import { reactive } from 'vue';
import type { InjectionKey } from 'vue';
import {
  csrfResponseSchema,
  friendsSnapshotSchema,
  friendInvitationsSchema,
  presenceSnapshotSchema,
} from '@study/contracts';
import type { FriendsSnapshot, PresenceStatus, PresenceView, z } from '@study/contracts';
export const statusLabels: Record<PresenceStatus, string> = {
  online: 'Online',
  focusing: 'Focusing',
  break: 'On Break',
  away: 'Away',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};
export function createSocialClient() {
  const state = reactive({
    connected: false,
    error: '',
    status: 'online' as PresenceStatus,
    roomId: null as string | null,
    participants: [] as PresenceView[],
    snapshot: null as FriendsSnapshot | null,
    invitations: [] as z.infer<typeof friendInvitationsSchema>,
  });
  let socket: WebSocket | undefined,
    stopped = true,
    generation = 0,
    csrf = '',
    lastActivity = Date.now(),
    lastReply = Date.now(),
    retry = 0;
  let timer: ReturnType<typeof setInterval> | undefined,
    reconnect: ReturnType<typeof setTimeout> | undefined;
  const pending = new Map<string, (result: unknown) => void>();
  function send(command: string, payload: unknown, done?: (result: unknown) => void) {
    if (socket?.readyState !== 1) return;
    const requestId = crypto.randomUUID();
    if (done) pending.set(requestId, done);
    socket.send(JSON.stringify({ version: 1, requestId, command, payload, csrf }));
  }
  function heartbeat() {
    send('presence.heartbeat', {
      roomId: state.roomId,
      status: state.status,
      active: document.visibilityState === 'visible' && Date.now() - lastActivity < 300000,
    });
  }
  async function connect() {
    const current = ++generation;
    try {
      const response = await fetch('/api/v1/session/csrf', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error();
      csrf = csrfResponseSchema.parse(await response.json()).csrfToken;
      if (stopped || current !== generation) return;
      const ws = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/v1/realtime`,
      );
      socket = ws;
      ws.onopen = () => {
        if (stopped || current !== generation) {
          ws.close();
          return;
        }
        state.connected = true;
        state.error = '';
        lastReply = Date.now();
        retry = 0;
        heartbeat();
        send('friends.snapshot', {}, (value) => {
          state.snapshot = friendsSnapshotSchema.parse(value);
        });
        send('rooms.friend-invitations', {}, (value) => {
          state.invitations = friendInvitationsSchema.parse(value);
        });
        if (state.roomId)
          send('presence.room', { roomId: state.roomId }, (value) => {
            state.participants = presenceSnapshotSchema.parse(value).participants;
          });
      };
      ws.onmessage = (e) => {
        if (stopped || current !== generation) return;
        try {
          lastReply = Date.now();
          const message = JSON.parse(String(e.data));
          if (message.error) {
            state.error = 'Social action unavailable. Your access may have changed.';
            pending.clear();
            return;
          }
          if (message.requestId) {
            pending.get(message.requestId)?.(message.result);
            pending.delete(message.requestId);
          }
          if (message.event === 'friends.snapshot')
            state.snapshot = friendsSnapshotSchema.parse(message.payload);
          if (message.event === 'presence.snapshot')
            state.participants = presenceSnapshotSchema.parse(message.payload).participants;
          if (message.event === 'rooms.friend-invitations')
            state.invitations = friendInvitationsSchema.parse(message.payload);
        } catch {
          ws.close();
        }
      };
      ws.onclose = () => {
        if (current !== generation) return;
        state.connected = false;
        state.participants = [];
        state.snapshot = null;
        state.invitations = [];
        pending.clear();
        if (!stopped)
          reconnect = setTimeout(
            () => void connect(),
            Math.min(30000, 1000 * 2 ** retry++) + Math.random() * 500,
          );
      };
    } catch {
      if (!stopped && current === generation) {
        state.connected = false;
        state.error = 'Reconnecting to your study space…';
        reconnect = setTimeout(() => void connect(), 5000);
      }
    }
  }
  function activity() {
    lastActivity = Date.now();
  }
  function wake() {
    lastActivity = Date.now();
    if (socket?.readyState === 1) heartbeat();
  }
  return {
    state,
    start() {
      if (!stopped) return;
      stopped = false;
      document.addEventListener('pointerdown', activity);
      document.addEventListener('keydown', activity);
      document.addEventListener('visibilitychange', wake);
      window.addEventListener('online', wake);
      void connect();
      timer = setInterval(() => {
        if (Date.now() - lastReply > 70000) socket?.close();
        else heartbeat();
      }, 20000);
    },
    stop() {
      stopped = true;
      generation++;
      clearInterval(timer);
      clearTimeout(reconnect);
      socket?.close();
      state.connected = false;
      state.snapshot = null;
      state.participants = [];
      state.invitations = [];
      pending.clear();
      document.removeEventListener('pointerdown', activity);
      document.removeEventListener('keydown', activity);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    },
    room(id: string | null) {
      state.roomId = id;
      state.participants = [];
      if (!stopped) {
        state.connected = false;
        generation++;
        socket?.close();
        pending.clear();
        clearTimeout(reconnect);
        void connect();
      }
    },
    status(value: PresenceStatus) {
      state.status = value;
      heartbeat();
    },
  };
}
export type SocialClient = ReturnType<typeof createSocialClient>;
export const socialKey: InjectionKey<SocialClient> = Symbol('social');
