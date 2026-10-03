import { reactive } from 'vue';
import { csrfResponseSchema } from '@study/contracts';
/** Multiplexed room transport. Feature callbacks own schema validation and projections. */
export function createRealtimeClient() {
  const state = reactive({ connected: false, errors: {} as Record<string, string> });
  let ws: WebSocket | undefined,
    stopped = true,
    generation = 0,
    csrf = '',
    retry = 0,
    lastReply = 0;
  let reconnect: ReturnType<typeof setTimeout> | undefined,
    health: ReturnType<typeof setInterval> | undefined;
  const subscriptions = new Map<
    string,
    { payload: unknown; receive: (v: unknown) => void; clear: () => void }
  >();
  const pending = new Map<
    string,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const clears = () => {
    for (const s of subscriptions.values()) s.clear();
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('Connection lost. Recheck the latest state before retrying.'));
    }
    pending.clear();
  };
  function send(command: string, payload: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (ws?.readyState !== 1) {
        reject(new Error('Reconnecting…'));
        return;
      }
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error('No response. Recheck state before retrying.'));
      }, 10000);
      pending.set(requestId, { resolve, reject, timer });
      ws.send(JSON.stringify({ version: 1, requestId, command, payload, csrf }));
    });
  }
  function refresh(command: string) {
    const s = subscriptions.get(command);
    if (s)
      void send(command, s.payload)
        .then((v) => {
          if (subscriptions.get(command) === s) {
            state.errors[command] = '';
            s.receive(v);
          }
        })
        .catch((e: Error) => {
          if (subscriptions.get(command) === s) {
            state.errors[command] = e.message;
            if (
              ['FORBIDDEN', 'UNAUTHENTICATED', 'NOT_FOUND', 'FEATURE_DISABLED'].includes(
                (e as Error & { code?: string }).code ?? '',
              )
            )
              s.clear();
          }
        });
  }
  async function connect() {
    const current = ++generation;
    try {
      const r = await fetch('/api/v1/session/csrf', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      csrf = csrfResponseSchema.parse(await r.json()).csrfToken;
      if (stopped || current !== generation) return;
      const socket = new WebSocket('wss://' + location.host + '/api/v1/realtime');
      ws = socket;
      socket.onopen = () => {
        if (stopped || current !== generation) {
          socket.close();
          return;
        }
        state.connected = true;
        retry = 0;
        lastReply = Date.now();
        for (const key of subscriptions.keys()) refresh(key);
      };
      socket.onmessage = (e) => {
        if (current !== generation) return;
        lastReply = Date.now();
        try {
          const m = JSON.parse(String(e.data));
          const replyId = m.requestId ?? m.error?.requestId;
          // Ingress rejection may occur before the transport has parsed a request ID.
          if (m.error && !pending.has(replyId)) {
            const error = Object.assign(
              new Error(
                m.error.code === 'RATE_LIMITED'
                  ? 'Too many requests. Wait a moment, then try again.'
                  : 'Action unavailable. Check your connection or access.',
              ),
              { code: m.error.code },
            );
            for (const p of pending.values()) {
              clearTimeout(p.timer);
              p.reject(error);
            }
            pending.clear();
          }
          if (replyId) {
            const p = pending.get(replyId);
            if (p) {
              clearTimeout(p.timer);
              pending.delete(replyId);
              if (m.error)
                p.reject(
                  Object.assign(
                    new Error(
                      m.error.code === 'CONFLICT'
                        ? 'Changed elsewhere. Review the latest state and try again.'
                        : 'Action unavailable. Check your access or try again shortly.',
                    ),
                    { code: m.error.code },
                  ),
                );
              else p.resolve(m.result);
            }
          }
          if (m.event) subscriptions.get(m.event)?.receive(m.payload);
        } catch {
          socket.close();
        }
      };
      socket.onclose = (event) => {
        if (current !== generation) return;
        state.connected = false;
        if (event?.code === 1008) clears();
        else {
          for (const p of pending.values()) {
            clearTimeout(p.timer);
            p.reject(new Error('Reconnecting…'));
          }
          pending.clear();
        }
        if (!stopped)
          reconnect = setTimeout(
            () => void connect(),
            Math.min(30000, 1000 * 2 ** retry++) + Math.random() * 500,
          );
      };
    } catch {
      if (!stopped && current === generation) reconnect = setTimeout(() => void connect(), 5000);
    }
  }
  return {
    state,
    send,
    refresh,
    subscribe(command: string, payload: unknown, receive: (v: unknown) => void, clear: () => void) {
      const subscription = { payload, receive, clear };
      if (!subscriptions.has(command)) clear();
      subscriptions.set(command, subscription);
      if (state.connected) refresh(command);
      return () => {
        if (subscriptions.get(command) !== subscription) return;
        subscriptions.delete(command);
        if (state.connected) void send('foundation.unsubscribe', { command }).catch(() => {});
      };
    },
    start() {
      if (!stopped) return;
      stopped = false;
      void connect();
      health = setInterval(() => {
        if (Date.now() - lastReply > 45000) ws?.close();
      }, 15000);
    },
    stop() {
      stopped = true;
      generation++;
      clearTimeout(reconnect);
      clearInterval(health);
      ws?.close();
      state.connected = false;
      clears();
      subscriptions.clear();
    },
  };
}
export type RealtimeClient = ReturnType<typeof createRealtimeClient>;
