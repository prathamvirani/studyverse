import { afterEach, expect, it, vi } from 'vitest';
import { createSocialClient } from '../../apps/web/app/lib/social.ts';

class Socket {
  static instances: Socket[] = [];
  readyState = 1;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: () => void;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.();
  });
  constructor() {
    Socket.instances.push(this);
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  Socket.instances = [];
});

it('ignores late social callbacks after room changes and shutdown, releasing listeners', async () => {
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const remove = vi.spyOn(document, 'removeEventListener');
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('location', { protocol: 'https:', host: 'localhost:8449' });
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    json: async () => ({ csrfToken: 'a'.repeat(43) }),
  }));
  const client = createSocialClient();
  try {
    client.start();
    await vi.waitFor(() => expect(Socket.instances).toHaveLength(1));
    const old = Socket.instances[0]!;
    client.room('new-room');
    await vi.waitFor(() => expect(Socket.instances).toHaveLength(2));
    const current = Socket.instances[1]!;
    old.onopen?.();
    expect(client.state.connected).toBe(false);
    expect(old.send).not.toHaveBeenCalled();
    current.onopen?.();
    expect(client.state.connected).toBe(true);
    const message = {
      data: JSON.stringify({
        event: 'presence.snapshot',
        payload: {
          participants: [
            {
              id: '00000000-0000-4000-8000-000000000001',
              name: 'Old room',
              status: 'online',
              room: null,
            },
          ],
        },
      }),
    };
    old.onmessage?.(message);
    expect(client.state.participants).toEqual([]);
    client.stop();
    current.onopen?.();
    current.onmessage?.(message);
    expect(client.state.connected).toBe(false);
    expect(client.state.participants).toEqual([]);
    expect(remove.mock.calls.map(([event]) => event)).toEqual([
      'pointerdown',
      'keydown',
      'visibilitychange',
    ]);
  } finally {
    client.stop();
  }
});
