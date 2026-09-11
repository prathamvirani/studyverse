import { afterEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createMediaSession, cameraLocation } from '@study/rtc/browser';
import { rtcModule } from '@study/rtc/server';
import { liveKitAuthority } from '@study/adapters/livekit/server';
import { jwtVerify } from 'jose';
import { mediaCaps } from '@study/contracts';
import type { MediaCredential } from '@study/contracts';
import type { RealtimeMediaProvider, MediaSnapshot } from '@study/feature-sdk';
import { ModuleRuntime, AppError } from '@study/core/server';
import { MemoryLimiter, MemorySessions } from '../fixtures/memory.ts';
const credential: MediaCredential = {
  url: 'wss://sfu.test',
  token: 'test-only-token',
  room: 'test',
  connectionId: randomUUID(),
  expiresAt: Date.now() + 60000,
  sources: ['microphone', 'camera', 'screen'],
};
function fakeProvider() {
  let state: MediaSnapshot = { connection: 'disconnected', tracks: [] };
  let listener = () => {};
  const p: RealtimeMediaProvider = {
    snapshot: () => state,
    listen: (f) => {
      listener = f;
      return () => {};
    },
    connect: vi.fn(async () => {
      state = { connection: 'connected', tracks: [] };
      listener();
    }),
    disconnect: vi.fn(async () => {
      state = { connection: 'disconnected', tracks: [] };
      listener();
    }),
    publish: vi.fn(async () => {}),
    unpublish: vi.fn(async () => {}),
    mute: vi.fn(async () => {}),
    switchDevice: vi.fn(async () => {}),
    receive: vi.fn(),
    devices: vi.fn(async () => []),
  };
  return p;
}
afterEach(() => vi.useRealTimers());
it('screen selection waits for a fresh deliberate action after first connection', async () => {
  const p = fakeProvider();
  const session = createMediaSession(
    p,
    { join: async () => credential, renew: async () => {}, leave: async () => {} },
    () => {},
  );
  await session.toggle('screen');
  expect(p.publish).not.toHaveBeenCalled();
  expect(session.state.error).toContain('Select Screen Share again');
  await session.toggle('screen');
  expect(p.publish).toHaveBeenCalledWith('screen');
  await session.dispose();
});
it('connect never captures and denial requires a deliberate new activation', async () => {
  const p = fakeProvider(),
    join = vi.fn(async () => credential);
  const session = createMediaSession(
    p,
    { join, renew: async () => {}, leave: async () => {} },
    () => {},
  );
  expect(join).not.toHaveBeenCalled();
  await session.connect();
  expect(p.publish).not.toHaveBeenCalled();
  vi.mocked(p.publish).mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
  await session.toggle('camera');
  expect(session.state.error).toContain('Permission denied');
  expect(p.publish).toHaveBeenCalledTimes(1);
  await session.toggle('camera');
  expect(p.publish).toHaveBeenCalledTimes(2);
  await session.dispose();
  expect(p.disconnect).toHaveBeenCalled();
});
it('leaving while admission is pending cannot start capture', async () => {
  const p = fakeProvider();
  let resolve!: (c: MediaCredential) => void;
  const leave = vi.fn(async () => {}),
    session = createMediaSession(
      p,
      {
        join: () =>
          new Promise((r) => {
            resolve = r;
          }),
        renew: async () => {},
        leave,
      },
      () => {},
    );
  const activation = session.toggle('microphone');
  await session.dispose();
  resolve(credential);
  await activation;
  expect(p.publish).not.toHaveBeenCalled();
  expect(p.connect).not.toHaveBeenCalled();
  expect(leave).toHaveBeenCalledWith(credential);
});
it('duplicate activation is serialized and revoked renewal stops capture', async () => {
  vi.useFakeTimers();
  const p = fakeProvider();
  let done!: () => void;
  vi.mocked(p.publish).mockImplementation(
    () =>
      new Promise((r) => {
        done = r;
      }),
  );
  const session = createMediaSession(
    p,
    {
      join: async () => credential,
      renew: async () => {
        throw new Error('Revoked');
      },
      leave: async () => {},
    },
    () => {},
  );
  await session.connect();
  const first = session.toggle('camera');
  await Promise.resolve();
  await Promise.resolve();
  await session.toggle('camera');
  expect(p.publish).toHaveBeenCalledTimes(1);
  done();
  await first;
  await vi.advanceTimersByTimeAsync(10001);
  expect(p.disconnect).toHaveBeenCalled();
  expect(session.state.error).toContain('access lost');
  await session.dispose();
});
it('camera presentation chooses exactly one location in every state', () => {
  expect([
    cameraLocation(false, false),
    cameraLocation(true, false),
    cameraLocation(true, true),
    cameraLocation(true, false),
    cameraLocation(false, true),
  ]).toEqual(['none', 'circle', 'workspace', 'circle', 'none']);
});
it('LiveKit grants contain server identity, exact room, source restrictions, short expiry and no data/admin power', async () => {
  const key = 'test-key',
    secret = 'test-only-secret-'.repeat(4),
    actor = { subjectId: randomUUID(), sessionId: randomUUID() },
    roomId = randomUUID();
  const authority = liveKitAuthority({ url: 'wss://sfu.test', apiKey: key, apiSecret: secret });
  expect(authority.enforcement.scopedGrants).toBe(true);
  const result = await authority.issue({
    actor,
    roomId,
    connectionId: credential.connectionId,
    expiresAt: Date.now() + 60000,
    sources: ['microphone'],
  });
  const { payload } = await jwtVerify(result.token, new TextEncoder().encode(secret), {
    issuer: key,
  });
  expect(payload.sub).toBe(credential.connectionId);
  expect(payload.attributes).toBeUndefined();
  expect(payload.video).toMatchObject({
    room: `study-${roomId}`,
    canPublishSources: ['microphone'],
    canPublishData: false,
    roomAdmin: false,
    canUpdateOwnMetadata: false,
  });
  expect(payload.exp! - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(60);
  await expect(
    jwtVerify(result.token, new TextEncoder().encode(secret), {
      currentDate: new Date(Date.now() + 61000),
    }),
  ).rejects.toThrow();
  await expect(
    jwtVerify(result.token + 'modified', new TextEncoder().encode(secret)),
  ).rejects.toThrow();
  expect(mediaCaps.camera).toEqual({ width: 1280, height: 720, fps: 30, bitrate: 2000000 });
});
it('unconfigured authority cannot mint credentials even with RTC flag enabled', async () => {
  const runtime = new ModuleRuntime(new MemoryLimiter(), 'test');
  const issue = vi.fn();
  const store = new MemorySessions();
  const id = randomUUID(),
    subject = randomUUID();
  await store.create({
    id,
    subjectId: subject,
    tokenHash: 'test',
    csrfToken: 'test',
    createdAt: 0,
    expiresAt: Date.now() + 60000,
    idleExpiresAt: Date.now() + 60000,
    revokedAt: null,
  });
  await runtime.start([
    rtcModule({
      authority: {
        enforcement: {
          scopedGrants: false,
        },
        issue,
        remove: async () => {},
      },
      sessions: store,
      rooms: { role: async () => 'member' },
      enabled: true,
      uuid: randomUUID,
      fail: (code) => {
        throw new AppError(code);
      },
    }),
  ]);
  try {
    await expect(
      runtime.operations.execute(
        'rtc.join',
        { roomId: randomUUID() },
        {
          actor: { subjectId: subject, sessionId: id },
          requestId: randomUUID(),
          signal: new AbortController().signal,
        },
      ),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(issue).not.toHaveBeenCalled();
  } finally {
    await runtime.stop();
  }
});
