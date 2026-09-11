import { afterEach, expect, it, vi } from 'vitest';
import { createRealtimeClient } from '../../apps/web/app/lib/realtime.ts';
class FakeSocket {
  static latest: FakeSocket;
  readyState = 1;
  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: () => void;
  constructor() {
    FakeSocket.latest = this;
  }
  send() {}
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}
afterEach(() => vi.unstubAllGlobals());
it('early transport rejection without a matching request ID immediately settles pending commands', async () => {
  vi.stubGlobal('location', { host: 'localhost:8449' });
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    json: async () => ({ csrfToken: 'a'.repeat(43) }),
  }));
  const client = createRealtimeClient();
  try {
    client.start();
    await vi.waitFor(() => expect(FakeSocket.latest?.onopen).toBeTruthy());
    FakeSocket.latest.onopen!();
    const result = client.send('pomodoro.control', {});
    const rejected = expect(result).rejects.toThrow('Too many requests');
    FakeSocket.latest.onmessage!({
      data: JSON.stringify({
        version: 1,
        error: { code: 'RATE_LIMITED', requestId: 'server-generated-id' },
      }),
    });
    await rejected;
  } finally {
    client.stop();
  }
});
