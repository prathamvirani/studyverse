import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { rtcModule } from '@study/rtc/server';
import { Sessions, SESSION_COOKIE, AppError } from '@study/core/server';
import { createServer } from '../../apps/api/src/server.ts';
import { readConfig } from '../../apps/api/src/config.ts';
import { MemoryLimiter, MemorySessions } from '../fixtures/memory.ts';
import type { MediaAuthority } from '@study/feature-sdk';
const roomId = randomUUID(),
  otherRoom = randomUUID(),
  subject = randomUUID();
const config = readConfig({
  NODE_ENV: 'test',
  APP_ORIGIN: 'https://localhost:8443',
  DATABASE_URL: 'postgresql://unused/unused',
  REDIS_URL: 'redis://unused',
  LOG_LEVEL: 'silent',
});
let server: Awaited<ReturnType<typeof createServer>>,
  sessions: Sessions,
  store: MemorySessions,
  issued: Awaited<ReturnType<Sessions['issue']>>;
let member = true,
  enabled = true,
  blocked = false,
  authority: MediaAuthority;
const headers = () => ({
  host: 'localhost:8443',
  origin: 'https://localhost:8443',
  cookie: `${SESSION_COOKIE}=${issued.token}`,
  'x-csrf-token': issued.session.csrfToken,
});
const request = (path: string, payload: unknown) =>
  server.app.inject({
    method: 'POST',
    url: `/api/v1/rtc/${path}`,
    headers: headers(),
    payload: JSON.stringify(payload),
  });
async function start() {
  server = await createServer({
    config,
    sessions,
    limiter: new MemoryLimiter(),
    modules: [
      rtcModule({
        authority,
        people: { person: async (id) => ({ id, name: 'Authorized room publisher' }) },
        blocked: async (a, b) => a !== b && blocked,
        sessions: store,
        rooms: { role: async (_user, id) => (member && id === roomId ? 'member' : null) },
        enabled,
        uuid: randomUUID,
        fail: (code) => {
          throw new AppError(code);
        },
      }),
    ],
  });
}
beforeEach(async () => {
  member = true;
  blocked = false;
  enabled = true;
  store = new MemorySessions();
  sessions = new Sessions(store);
  issued = await sessions.issue(subject);
  authority = {
    enforcement: { scopedGrants: true },
    issue: vi.fn(async (i) => ({
      url: 'wss://isolated-fixture.test',
      token: 'fixture-only',
      room: `study-${i.roomId}`,
      connectionId: i.connectionId,
      expiresAt: i.expiresAt,
      sources: i.sources,
    })),
    remove: vi.fn(async () => {}),
  };
  await start();
});
afterEach(async () => {
  await server.app.close();
});
// JSON content type is explicit because schema validation must see the hostile object.
const post = (path: string, payload: unknown, extra: Record<string, string> = {}) =>
  server.app.inject({
    method: 'POST',
    url: `/api/v1/rtc/${path}`,
    headers: { ...headers(), 'content-type': 'application/json', ...extra },
    payload: JSON.stringify(payload),
  });
it('server mints distinct tab identities and rejects forged identity/roles/permissions/quality', async () => {
  for (const extra of [
    { userId: randomUUID() },
    { ownerId: subject },
    { role: 'owner' },
    { canPublish: true },
    { sources: ['camera'] },
    { width: 3840 },
    { fps: 240 },
    { room: 'invented-sfu-room' },
  ]) {
    expect((await post('join', { roomId, ...extra })).statusCode).toBe(400);
  }
  const a = await post('join', { roomId }),
    b = await post('join', { roomId });
  expect(a.statusCode).toBe(200);
  expect(b.statusCode).toBe(200);
  expect(a.json().connectionId).not.toBe(b.json().connectionId);
  expect(a.headers['cache-control']).toBe('no-store');
  expect(vi.mocked(authority.issue).mock.calls[0]![0].actor).toEqual({
    subjectId: subject,
    sessionId: issued.session.id,
  });
  expect((await post('leave', { roomId, connectionId: a.json().connectionId })).statusCode).toBe(
    200,
  );
  expect((await post('renew', { roomId, connectionId: b.json().connectionId })).statusCode).toBe(
    200,
  );
  expect((await post('renew', { roomId, connectionId: a.json().connectionId })).statusCode).toBe(
    403,
  );
});
it('rejects non-membership, removed membership, revoked auth, missing CSRF and disabled flag', async () => {
  expect((await post('join', { roomId: otherRoom })).statusCode).toBe(403);
  expect((await post('join', { roomId }, { 'x-csrf-token': '' })).statusCode).toBe(403);
  member = false;
  expect((await post('join', { roomId })).statusCode).toBe(403);
  member = true;
  await sessions.revoke(issued.session.id);
  expect((await post('join', { roomId })).statusCode).toBe(401);
  issued = await sessions.issue(subject);
  await server.app.close();
  enabled = false;
  await start();
  expect((await post('join', { roomId })).statusCode).toBe(404);
  expect(authority.issue).not.toHaveBeenCalled();
});
it('one tab cannot tear down another session and removal is enforced without client cooperation', async () => {
  const a = await post('join', { roomId });
  expect(a.statusCode).toBe(200);
  const connectionId = a.json().connectionId;
  const original = issued;
  issued = await sessions.issue(subject);
  expect((await post('leave', { roomId, connectionId })).statusCode).toBe(403);
  expect((await post('renew', { roomId, connectionId })).statusCode).toBe(403);
  issued = original;
  member = false;
  expect((await post('renew', { roomId, connectionId })).statusCode).toBe(403);
  await vi.waitFor(() => expect(authority.remove).toHaveBeenCalledWith(roomId, connectionId), {
    timeout: 4000,
  });
});
it('invalid/stale leases and duplicate capacity cannot be used to acquire unbounded publishers', async () => {
  expect((await post('renew', { roomId, connectionId: randomUUID() })).statusCode).toBe(403);
  for (let i = 0; i < 4; i++) expect((await post('join', { roomId })).statusCode).toBe(200);
  expect((await post('join', { roomId })).statusCode).toBe(409);
  expect((await request('join', { roomId })).statusCode).not.toBe(200);
});
it('revocation during asynchronous signing never returns a credential to a stale request', async () => {
  let finish!: () => void;
  vi.mocked(authority.issue).mockImplementation(async (i) => {
    await new Promise<void>((r) => {
      finish = r;
    });
    return {
      url: 'wss://isolated-fixture.test',
      token: 'must-not-be-delivered',
      room: `study-${i.roomId}`,
      connectionId: i.connectionId,
      expiresAt: i.expiresAt,
      sources: i.sources,
    };
  });
  const pending = post('join', { roomId }).then((r) => r);
  await vi.waitFor(() => expect(authority.issue).toHaveBeenCalled());
  await sessions.revoke(issued.session.id);
  finish();
  const response = await pending;
  expect(response.statusCode).toBe(403);
  expect(response.body).not.toContain('must-not-be-delivered');
  expect(authority.remove).toHaveBeenCalled();
});

it('media directory resolves only server leases and blocks remove both active connections', async () => {
  const first = (await post('join', { roomId })).json();
  issued = await sessions.issue(randomUUID());
  const second = (await post('join', { roomId })).json();
  authority.participants = vi.fn(async () => [
    { connectionId: first.connectionId, publishing: true },
    { connectionId: second.connectionId, publishing: false },
    { connectionId: randomUUID(), publishing: true },
  ]);
  expect((await post('audience', { roomId })).json()).toEqual([
    { connectionId: first.connectionId, userId: subject, name: 'Authorized room publisher' },
  ]);
  expect((await post('audience', { roomId: otherRoom })).statusCode).toBe(403);
  expect((await post('audience', { roomId, userId: subject })).statusCode).toBe(400);
  blocked = true;
  expect((await post('audience', { roomId })).statusCode).toBe(403);
  expect((await post('join', { roomId })).statusCode).toBe(403);
  await vi.waitFor(
    () => {
      expect(authority.remove).toHaveBeenCalledWith(roomId, first.connectionId);
      expect(authority.remove).toHaveBeenCalledWith(roomId, second.connectionId);
    },
    { timeout: 4000 },
  );
  expect((await post('audience', { roomId })).json()).toEqual([]);
  // A provider-replayed retired identity continues to be removed after its original lease vanished.
  const count = vi.mocked(authority.remove).mock.calls.length;
  await vi.waitFor(
    () => expect(vi.mocked(authority.remove).mock.calls.length).toBeGreaterThan(count),
    { timeout: 4000 },
  );
});
