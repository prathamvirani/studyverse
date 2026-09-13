import { defineOperation } from '@study/feature-sdk';
import type {
  EphemeralStore,
  Fail,
  FeatureModule,
  OperationContext,
  PeopleDirectory,
  PresenceDirectory,
  RoomOccupancy,
  RoomDirectory,
  SessionStore,
  SocialDirectory,
  EventPublisher,
} from '@study/feature-sdk';
import {
  okSchema,
  roomOccupancyEventSchema,
  presenceInputSchema,
  presenceSnapshotSchema,
  roomIdSchema,
  z,
} from '@study/contracts';
import type { PresenceStatus } from '@study/contracts';
export const LEASE_MS = 65000;
interface Lease {
  userId: string;
  sessionId: string;
  roomId: string | null;
  status: PresenceStatus;
  active: boolean;
  changedAt: number;
  expiresAt: number;
}
export function aggregatePresence(
  leases: readonly Lease[],
  now: number,
): { status: PresenceStatus; roomId: string | null } {
  const valid = leases.filter((l) => l.expiresAt > now).sort((a, b) => b.changedAt - a.changedAt);
  if (!valid.length) return { status: 'offline', roomId: null };
  const latest = valid[0]!;
  if (latest.status === 'offline') return { status: 'offline', roomId: null };
  return {
    status: latest.status === 'dnd' || valid.some((l) => l.active) ? latest.status : 'away',
    roomId: valid.find((l) => l.roomId)?.roomId ?? null,
  };
}
export function createPresence(deps: {
  store: EphemeralStore;
  sessions: SessionStore;
  rooms: RoomDirectory;
  people: PeopleDirectory;
  social: SocialDirectory;
  fail: Fail;
  enabled?: boolean;
  now?: () => number;
}): { module: FeatureModule; directory: PresenceDirectory; occupancy: RoomOccupancy } {
  const now = deps.now ?? Date.now,
    keys = new Map<string, Lease>();
  let lastChange = 0;
  const valid = async (target?: string) => {
    const result: Lease[] = [];
    for (const [key, cached] of keys) {
      if (target && cached.userId !== target) continue;
      if (cached.expiresAt <= now()) {
        keys.delete(key);
        continue;
      }
      const raw = await deps.store.get('presence', key);
      if (!raw) continue;
      const l = JSON.parse(raw) as Lease;
      const session = await deps.sessions.findById(l.sessionId);
      if (
        !session ||
        session.revokedAt !== null ||
        session.expiresAt <= now() ||
        session.idleExpiresAt <= now()
      )
        continue;
      if (l.roomId && !(await deps.rooms.member(l.userId, l.roomId))) continue;
      result.push(l);
    }
    return result;
  };
  const directory: PresenceDirectory = {
    async view(viewer, target) {
      const person = await deps.people.person(target);
      if (!person || (await deps.social.blocked(viewer, target))) return null;
      if (
        viewer !== target &&
        !(await deps.social.friends(viewer, target)) &&
        !(await deps.rooms.shared(viewer, target))
      )
        return null;
      const privacy = await deps.social.privacy(target),
        state = aggregatePresence(await valid(target), now());
      const visible = viewer === target || privacy.online;
      const room =
        visible && state.status !== 'offline' && (viewer === target || privacy.room) && state.roomId
          ? await deps.rooms.current(viewer, state.roomId)
          : null;
      return {
        ...person,
        status: !visible
          ? null
          : privacy.study || viewer === target
            ? state.status
            : state.status === 'offline'
              ? 'offline'
              : 'online',
        room: room
          ? { ...room, joinable: room.joinable && (viewer === target || privacy.join) }
          : null,
      };
    },
  };
  const membershipSchema = z.strictObject({ userId: z.uuid(), roomId: z.uuid() });
  const joined = { id: 'presence.member-joined', schema: membershipSchema },
    left = { id: 'presence.member-left', schema: membershipSchema };
  const occupancyChanged = { id: 'presence.room-occupancy', schema: roomOccupancyEventSchema };
  let occupiedRooms = new Map<string, string[]>();
  let events: EventPublisher | undefined,
    timer: ReturnType<typeof setInterval> | undefined,
    sweeping = false;
  let observed = new Map<string, { userId: string; roomId: string }>();
  async function sweep() {
    if (sweeping || !events) return;
    sweeping = true;
    try {
      const leases = await valid(),
        next = new Map<string, { userId: string; roomId: string }>();
      const currentRooms = new Map<string, string[]>();
      for (const lease of leases)
        if (lease.roomId) {
          const members = currentRooms.get(lease.roomId) ?? [];
          if (!members.includes(lease.userId)) members.push(lease.userId);
          currentRooms.set(lease.roomId, members);
        }
      for (const roomId of new Set([...occupiedRooms.keys(), ...currentRooms.keys()])) {
        const members = (currentRooms.get(roomId) ?? []).sort();
        if (JSON.stringify(members) !== JSON.stringify(occupiedRooms.get(roomId) ?? []))
          await events.emit(occupancyChanged, { roomId, members });
      }
      occupiedRooms = currentRooms;
      for (const l of leases)
        if (
          l.roomId &&
          aggregatePresence(
            leases.filter((v) => v.userId === l.userId),
            now(),
          ).status !== 'offline'
        )
          next.set(JSON.stringify([l.userId, l.roomId]), { userId: l.userId, roomId: l.roomId });
      for (const [id, value] of next) if (!observed.has(id)) await events.emit(joined, value);
      for (const [id, value] of observed) if (!next.has(id)) await events.emit(left, value);
      observed = next;
    } finally {
      sweeping = false;
    }
  }
  const actor = (c: OperationContext) => c.actor ?? deps.fail('UNAUTHENTICATED');
  const access = {
    permission: 'presence.account',
    resource: async (_: unknown, c: OperationContext) => ({ id: actor(c).subjectId }),
  };
  const operations = [
    defineOperation({
      id: 'presence.heartbeat',
      kind: 'command',
      input: presenceInputSchema,
      output: okSchema,
      access,
      rate: { limit: 40, windowMs: 60000 },
      handle: async (i, c) => {
        if (!c.connectionId) return deps.fail('FORBIDDEN');
        const a = actor(c);
        if (i.roomId && !(await deps.rooms.member(a.subjectId, i.roomId)))
          return deps.fail('FORBIDDEN');
        const previous = keys.get(c.connectionId);
        const lease: Lease = {
          userId: a.subjectId,
          sessionId: a.sessionId,
          ...i,
          changedAt:
            previous && previous.status === i.status && previous.roomId === i.roomId
              ? previous.changedAt
              : (lastChange = Math.max(now(), lastChange + 1)),
          expiresAt: now() + LEASE_MS,
        };
        await deps.store.set('presence', c.connectionId, JSON.stringify(lease), LEASE_MS);
        keys.set(c.connectionId, lease);
        await sweep();
        return { ok: true };
      },
    }),
    defineOperation({
      id: 'presence.room',
      kind: 'query',
      input: roomIdSchema,
      output: presenceSnapshotSchema,
      access,
      rate: { limit: 600, windowMs: 60000 },
      handle: async (i, c) => {
        const a = actor(c);
        if (!(await deps.rooms.member(a.subjectId, i.roomId))) return deps.fail('FORBIDDEN');
        const ids = [
          ...new Set((await valid()).filter((l) => l.roomId === i.roomId).map((l) => l.userId)),
        ];
        const participants = [];
        for (const id of ids) {
          if (id !== a.subjectId && !(await deps.social.privacy(id)).room) continue;
          const view = await directory.view(a.subjectId, id);
          if (view && view.status !== null && view.status !== 'offline')
            participants.push({ ...view, room: null });
        }
        return { participants: participants.slice(0, 200) };
      },
    }),
  ];
  const module: FeatureModule = {
    id: 'presence',
    version: '1.0.0',
    required: true,
    capabilities: ['presence.v1'],
    persistence: { ephemeralNamespace: 'presence' },
    permissions: [
      {
        id: 'presence.account',
        description: 'Current account presence',
        allows: async (a, r) => a.subjectId === r.id && !!(await deps.people.person(a.subjectId)),
      },
    ],
    flags: [
      { id: 'presence.enabled', rule: { mode: deps.enabled === false ? 'disabled' : 'global' } },
    ],
    operations: operations.map((op) => ({ ...op, flag: 'presence.enabled' })),
    realtime: operations.map((op) => ({
      command: op.id,
      operation: op.id,
      ...(op.kind === 'query' ? { snapshotEvent: 'presence.snapshot' } : {}),
    })),
    events: [joined, left, occupancyChanged],
    start: async (c) => {
      events = c.events;
      timer = setInterval(() => {
        void sweep().catch(() => c.observer.record('presence.sweep.failed'));
      }, 2000);
      timer.unref();
    },
    connectionClosed: async (id) => {
      keys.delete(id);
      await deps.store.delete('presence', id);
      await sweep();
    },
    stop: async () => {
      clearInterval(timer);
      await Promise.all([...keys.keys()].map((id) => deps.store.delete('presence', id)));
      keys.clear();
    },
  };
  return {
    module,
    directory,
    occupancy: {
      async members(roomId) {
        if (deps.enabled === false) return [];
        // Count valid room leases even when a member hides their public presence.
        return [
          ...new Set((await valid()).filter((l) => l.roomId === roomId).map((l) => l.userId)),
        ];
      },
    },
  };
}
