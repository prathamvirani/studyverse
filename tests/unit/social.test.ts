import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { aggregatePresence, createPresence, LEASE_MS } from '@study/presence/server';
import { friendsModule } from '@study/friends/server';
import { ModuleRuntime, AppError, Sessions } from '@study/core/server';
import { MemorySessions, MemoryLimiter } from '../fixtures/memory.ts';
import type { Privacy } from '@study/contracts';
import type { Database } from '@study/feature-sdk';
const base = {
  userId: randomUUID(),
  sessionId: randomUUID(),
  roomId: randomUUID(),
  status: 'focusing' as const,
  active: true,
  changedAt: 10,
  expiresAt: 100,
};
it('Friends initializes without Presence internals and its flag denies disabled actions', async () => {
  const db: Database = { query: async () => [], transaction: async (work) => work(db) };
  for (const enabled of [true, false]) {
    const runtime = new ModuleRuntime(new MemoryLimiter(), 'test');
    await runtime.start([
      { id: 'identity', version: '1.0.0' },
      friendsModule({
        db,
        enabled,
        fail: (code) => {
          throw new AppError(code);
        },
        people: { person: async (id) => ({ id, name: 'Test' }) },
        rooms: { member: async () => false, shared: async () => false, current: async () => null },
        social: {
          blocked: async () => false,
          friends: async () => false,
          privacy: async () => ({
            online: true,
            room: false,
            study: true,
            join: false,
            invites: true,
          }),
        },
        presence: { view: async () => null },
      }),
    ]);
    const work = runtime.operations.execute(
      'friends.snapshot',
      {},
      {
        actor: { subjectId: base.userId, sessionId: base.sessionId },
        requestId: randomUUID(),
        signal: AbortSignal.timeout(1000),
      },
    );
    if (enabled) expect(await work).toMatchObject({ friends: [], incoming: [], blocked: [] });
    else await expect(work).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await runtime.stop();
  }
});
it('aggregates multiple tabs/devices and explicit status by last change, not heartbeat order', () => {
  expect(aggregatePresence([base, { ...base, active: false, changedAt: 9 }], 50).status).toBe(
    'focusing',
  );
  expect(aggregatePresence([{ ...base, active: false }], 50).status).toBe('away');
  expect(aggregatePresence([base], 101)).toEqual({ status: 'offline', roomId: null });
  expect(aggregatePresence([base, { ...base, status: 'dnd', changedAt: 20 }], 50).status).toBe(
    'dnd',
  );
  expect(aggregatePresence([base, { ...base, status: 'offline', changedAt: 20 }], 50)).toEqual({
    status: 'offline',
    roomId: null,
  });
});
async function fixture() {
  let now = 1000,
    member = true,
    blocked = false;
  let privacy: Privacy = { online: true, room: false, study: true, join: false, invites: true };
  const values = new Map<string, string>(),
    sessions = new MemorySessions(),
    issued = await new Sessions(sessions, undefined, () => now).issue(base.userId);
  const { module, directory } = createPresence({
    store: {
      get: async (_, k) => values.get(k) ?? null,
      set: async (_, k, v) => {
        values.set(k, v);
      },
      delete: async (_, k) => {
        values.delete(k);
      },
    },
    sessions,
    people: { person: async (id) => ({ id, name: 'Member' }) },
    rooms: {
      member: async () => member,
      shared: async () => true,
      current: async (_, id) => ({ id, name: 'Private title', joinable: true }),
    },
    social: {
      blocked: async () => blocked,
      friends: async () => true,
      privacy: async () => privacy,
    },
    fail: (code) => {
      throw new AppError(code);
    },
    now: () => now,
  });
  const runtime = new ModuleRuntime(new MemoryLimiter(), 'test');
  await runtime.start([module]);
  const invoke = (command: string, input: unknown, connectionId = 'one') =>
    runtime.operations.execute(command, input, {
      actor: { subjectId: base.userId, sessionId: issued.session.id },
      requestId: randomUUID(),
      signal: AbortSignal.timeout(2000),
      connectionId,
    });
  const beat = (id: string) =>
    invoke('presence.heartbeat', { roomId: base.roomId, status: 'focusing', active: true }, id);
  return {
    runtime,
    directory,
    values,
    sessions,
    issued,
    invoke,
    beat,
    setNow: (v: number) => {
      now = v;
    },
    setMember: (v: boolean) => {
      member = v;
    },
    setBlocked: (v: boolean) => {
      blocked = v;
    },
    setPrivacy: (v: Privacy) => {
      privacy = v;
    },
  };
}
it('closing one connection keeps another online; abrupt disconnect expires and reconnect recovers', async () => {
  const f = await fixture();
  await f.beat('one');
  await f.beat('two');
  await f.runtime.connectionClosed('one');
  expect((await f.directory.view(randomUUID(), base.userId))?.status).toBe('focusing');
  f.setNow(1001 + LEASE_MS);
  expect((await f.directory.view(randomUUID(), base.userId))?.status).toBe('offline');
  await f.beat('three');
  expect((await f.directory.view(randomUUID(), base.userId))?.status).toBe('focusing');
  await f.runtime.stop();
});
it('Redis loss removes presence and heartbeat rebuilds it without durable changes', async () => {
  const f = await fixture();
  await f.beat('one');
  f.values.clear();
  expect((await f.directory.view(randomUUID(), base.userId))?.status).toBe('offline');
  await f.beat('one');
  expect((await f.directory.view(randomUUID(), base.userId))?.status).toBe('focusing');
  await f.runtime.stop();
});
it('privacy omits room and online data and blocking hides the entire person', async () => {
  const f = await fixture();
  await f.beat('one');
  const viewer = randomUUID();
  expect((await f.directory.view(viewer, base.userId))?.room).toBeNull();
  f.setPrivacy({ online: false, room: true, study: true, join: true, invites: true });
  expect(await f.directory.view(viewer, base.userId)).toMatchObject({ status: null, room: null });
  f.setBlocked(true);
  expect(await f.directory.view(viewer, base.userId)).toBeNull();
  await f.runtime.stop();
});
it('revoked sessions and removed memberships immediately disappear from snapshots', async () => {
  const f = await fixture();
  await f.beat('one');
  f.setMember(false);
  expect((await f.directory.view(randomUUID(), base.userId))?.status).toBe('offline');
  await expect(f.beat('one')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  f.setMember(true);
  await f.sessions.revoke(f.issued.session.id, 1001);
  expect((await f.directory.view(randomUUID(), base.userId))?.status).toBe('offline');
  await f.runtime.stop();
});
it('spoofed user/session/status payload fields and inaccessible rooms are rejected', async () => {
  const f = await fixture();
  for (const field of ['userId', 'senderId', 'sessionId', 'connectionId'])
    await expect(
      f.invoke('presence.heartbeat', {
        roomId: base.roomId,
        status: 'online',
        active: true,
        [field]: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  f.setMember(false);
  await expect(f.invoke('presence.room', { roomId: base.roomId })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  await f.runtime.stop();
});
