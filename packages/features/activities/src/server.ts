import { randomUUID } from 'node:crypto';
import { defineOperation, sql } from '@study/feature-sdk';
import type {
  ActivityDefinition,
  ActivitySession,
  Database,
  Fail,
  FeatureModule,
  PeopleDirectory,
  ProductivityRooms,
  RoomOccupancy,
  SocialDirectory,
} from '@study/feature-sdk';
import {
  activityRoomSchema,
  activityViewSchema,
  activityStartSchema,
  activityMemberSchema,
  activityPlaySchema,
  activityConfigureSchema,
  activitySettingsSchema,
  clockSchema,
  roomOccupancyEventSchema,
} from '@study/contracts';
import type { ActivitySettings, ActivityView } from '@study/contracts';
import { ActivityRegistry } from './browser.ts';
import { letterLantern } from './word.ts';
import { sketchCircle } from './drawing.ts';
export const activitiesDefinition = {
  id: 'activities',
  version: '1.0.0',
  persistence: { durableSchema: 'activities', ephemeralNamespace: 'activities' },
} as const;
export const defaultActivitySettings: ActivitySettings = {
  start: 'owner',
  ownerAbsent: 'preserve',
};
export function mayStartActivity(
  settings: ActivitySettings,
  role: 'owner' | 'moderator' | 'member',
  ownerPresent: boolean,
) {
  if (role === 'owner') return true;
  const policy =
    !ownerPresent && settings.ownerAbsent !== 'preserve' ? settings.ownerAbsent : settings.start;
  return policy === 'everyone' || (policy === 'moderators' && role === 'moderator');
}
type Stored = {
  session: ActivitySession;
  audience: string[];
  commands: string[];
  createdAt: number;
  touchedAt: number;
  rates: Record<string, { at: number; count: number }>;
  missing: Record<string, number>;
};
export function activitiesModule(deps: {
  db: Database;
  rooms: ProductivityRooms;
  occupancy: RoomOccupancy;
  social: SocialDirectory;
  people: PeopleDirectory;
  fail: Fail;
  enabled?: boolean;
  now?: () => number;
  definitions?: ActivityDefinition[];
}): FeatureModule {
  const { db, rooms, occupancy, fail } = deps,
    now = deps.now ?? Date.now;
  const registry = new ActivityRegistry();
  for (const definition of deps.definitions ?? [letterLantern, sketchCircle])
    registry.register(definition);
  // Disablement removes registrations, jobs and subscriptions, not just UI affordances.
  if (deps.enabled === false)
    return {
      ...activitiesDefinition,
      flags: [{ id: 'activities.enabled', rule: { mode: 'disabled' } }],
    };
  const states = new Map<string, Stored>(),
    queues = new Map<string, Promise<unknown>>();
  const starts = new Map<string, { ids: string[]; at: number }>();
  let timer: ReturnType<typeof setInterval> | undefined,
    sweeping = false;
  async function serial<T>(roomId: string, work: () => Promise<T>) {
    const next = (queues.get(roomId) ?? Promise.resolve()).catch(() => {}).then(work);
    queues.set(roomId, next);
    try {
      return await next;
    } finally {
      if (queues.get(roomId) === next) queues.delete(roomId);
    }
  }
  async function settings(roomId: string, tx = db) {
    const [row] = await tx.query(
      sql`SELECT settings FROM activities.settings WHERE room_id=${roomId}`,
    );
    return row ? activitySettingsSchema.parse(row.settings) : { ...defaultActivitySettings };
  }
  async function ownerPresent(roomId: string) {
    return (
      await Promise.all((await occupancy.members(roomId)).map((id) => rooms.role(id, roomId)))
    ).includes('owner');
  }
  async function conflict(viewer: string, record: Stored, tx?: Database) {
    for (const id of record.audience)
      if (id !== viewer && (await deps.social.blocked(viewer, id, tx))) return true;
    return false;
  }
  function remove(record: Stored, id: string) {
    const s = record.session,
      def = registry.get(s.kind)!;
    s.members = s.members.filter((m) => m.id !== id);
    delete record.missing[id];
    def.left(s, id, now());
    const participants = s.members.filter((m) => m.mode === 'participant');
    if (s.creator === id && participants.length) s.creator = participants[0]!.id;
    if (!participants.length || (s.state !== 'lobby' && participants.length < def.min)) {
      s.state = 'cancelled';
      s.deadline = null;
    }
    s.version++;
  }
  async function maintain(roomId: string, record: Stored, ids?: string[]) {
    const occupied = ids ?? (await occupancy.members(roomId));
    if (!occupied.length) {
      states.delete(roomId);
      return;
    }
    const s = record.session;
    for (const m of [...s.members]) {
      if (
        !(await rooms.role(m.id, roomId)) ||
        (await conflict(m.id, record)) ||
        (s.options.friendsOnly &&
          m.id !== s.creator &&
          !(await deps.social.friends(m.id, s.creator)))
      )
        remove(record, m.id);
      else if (occupied.includes(m.id)) delete record.missing[m.id];
      else {
        record.missing[m.id] ??= now();
        // Presence immediately retires a closed socket. Keep only activity membership briefly
        // so a page reload can recover; commands still require current room occupancy.
        if (now() - record.missing[m.id]! >= 10000) remove(record, m.id);
      }
    }
    if (s.state === 'lobby' && now() - record.createdAt > 300000) {
      s.state = 'cancelled';
      s.deadline = null;
      s.version++;
    }
    const before = `${s.state}:${s.round}`;
    registry.get(s.kind)!.tick(s, now());
    if (before !== `${s.state}:${s.round}`) {
      s.version++;
      record.touchedAt = now();
    }
    if (['completed', 'cancelled'].includes(s.state) && now() - record.touchedAt > 300000)
      states.delete(roomId);
  }
  async function view(roomId: string, actor: string): Promise<ActivityView> {
    const role = await rooms.role(actor, roomId);
    if (!role) return fail('FORBIDDEN');
    const config = await settings(roomId),
      record = states.get(roomId),
      hidden = record
        ? (await conflict(actor, record)) ||
          (record.session.options.friendsOnly &&
            role === 'member' &&
            record.session.creator !== actor &&
            !(await deps.social.friends(actor, record.session.creator)))
        : false;
    const result: ActivityView = {
      roomId,
      settings: config,
      canStart: !hidden && mayStartActivity(config, role, await ownerPresent(roomId)),
      isOwner: role === 'owner',
      catalog: registry.catalog(),
      activity: null,
    };
    if (!record || hidden) return result;
    const s = record.session;
    // Defense in depth: a query never sends removed/blocked identities or their content while a sweep is pending.
    for (const m of s.members) if (!(await rooms.role(m.id, roomId))) return result;
    const members = await Promise.all(
      s.members.map(async (m) => ({
        ...m,
        name: (await deps.people.person(m.id))?.name.slice(0, 100) ?? 'Participant',
      })),
    );
    result.activity = {
      id: s.id,
      kind: s.kind,
      creator: s.creator,
      version: s.version,
      state: s.state,
      round: s.round,
      deadline: s.deadline,
      members,
      myMode:
        s.members.find((m) => m.id === actor)?.mode ??
        (s.declined.includes(actor) ? 'declined' : 'none'),
      canManage: s.creator === actor || role === 'owner' || role === 'moderator',
      reports: role === 'owner' || role === 'moderator' ? s.reports.length : 0,
      data: registry.get(s.kind)!.project(s, actor),
    };
    return result;
  }
  const access = {
    permission: 'activities.member',
    resource: async (i: { roomId: string }) => ({ id: i.roomId, scopeId: i.roomId }),
  };
  type Revision = {
    roomId: string;
    activityId: string;
    version: number;
    round: number;
    requestId: string;
  };
  async function mutate(
    i: Revision,
    actor: string,
    signal: AbortSignal,
    work: (record: Stored, role: 'owner' | 'moderator' | 'member') => Promise<void> | void,
  ) {
    return serial(i.roomId, async () => {
      const previous = states.get(i.roomId);
      if (!previous) return fail('CONFLICT');
      await maintain(i.roomId, previous);
      if (!states.has(i.roomId)) return fail('CONFLICT');
      const record = structuredClone(previous),
        s = record.session;
      await db.transaction(async (tx) => {
        const role = await rooms.role(actor, i.roomId, tx);
        if (
          !role ||
          !(await occupancy.members(i.roomId)).includes(actor) ||
          (await conflict(actor, record, tx)) ||
          (s.options.friendsOnly &&
            role === 'member' &&
            actor !== s.creator &&
            !(await deps.social.friends(actor, s.creator, tx)))
        )
          return fail('FORBIDDEN');
        if (
          s.id !== i.activityId ||
          s.version !== i.version ||
          s.round !== i.round ||
          record.commands.includes(i.requestId)
        )
          return fail('CONFLICT');
        signal.throwIfAborted();
        try {
          await work(record, role);
        } catch (e) {
          if (e instanceof Error && ['INVALID_REQUEST', 'FORBIDDEN'].includes(e.message))
            return fail(e.message as 'INVALID_REQUEST' | 'FORBIDDEN');
          throw e;
        }
        signal.throwIfAborted();
        s.version++;
        record.commands = [...record.commands, i.requestId].slice(-128);
        record.touchedAt = now();
      });
      states.set(i.roomId, record);
      return view(i.roomId, actor);
    });
  }
  function rate(record: Stored, actor: string, type: string) {
    const key = actor + ':' + type,
      window = type === 'stroke' ? 1000 : 10000,
      limit = type === 'stroke' ? 2 : 5;
    const previous = record.rates[key],
      bucket = previous && now() - previous.at < window ? previous : { at: now(), count: 0 };
    if (++bucket.count > limit) return fail('RATE_LIMITED');
    record.rates[key] = bucket;
  }
  const operations = [
    defineOperation({
      id: 'activities.snapshot',
      kind: 'query',
      input: activityRoomSchema,
      output: activityViewSchema,
      access,
      rate: { limit: 600, windowMs: 60000 },
      handle: (i, c) => serial(i.roomId, () => view(i.roomId, c.actor!.subjectId)),
    }),
    defineOperation({
      id: 'activities.clock',
      kind: 'query',
      input: activityRoomSchema,
      output: clockSchema,
      access,
      rate: { limit: 60, windowMs: 60000 },
      handle: async () => ({ serverNow: now() }),
    }),
    defineOperation({
      id: 'activities.configure',
      kind: 'command',
      input: activityConfigureSchema,
      output: activityViewSchema,
      access,
      rate: { limit: 10, windowMs: 60000 },
      handle: (i, c) =>
        serial(i.roomId, async () => {
          await db.transaction(async (tx) => {
            if ((await rooms.role(c.actor!.subjectId, i.roomId, tx)) !== 'owner')
              return fail('FORBIDDEN');
            c.signal.throwIfAborted();
            await tx.query(
              sql`INSERT INTO activities.settings(room_id,settings) VALUES(${i.roomId},${JSON.stringify(i.settings)}::jsonb) ON CONFLICT(room_id) DO UPDATE SET settings=EXCLUDED.settings`,
            );
          });
          return view(i.roomId, c.actor!.subjectId);
        }),
    }),
    defineOperation({
      id: 'activities.start',
      kind: 'command',
      input: activityStartSchema,
      output: activityViewSchema,
      access,
      rate: { limit: 10, windowMs: 60000 },
      handle: (i, c) =>
        serial(i.roomId, async () => {
          const actor = c.actor!.subjectId,
            def = registry.get(i.kind);
          if (!def) return fail('INVALID_REQUEST');
          const existing = states.get(i.roomId);
          if (existing) await maintain(i.roomId, existing);
          const record = await db.transaction<Stored>(async (tx) => {
            const role = await rooms.role(actor, i.roomId, tx);
            if (
              !role ||
              !mayStartActivity(await settings(i.roomId, tx), role, await ownerPresent(i.roomId)) ||
              !(await occupancy.members(i.roomId)).includes(actor)
            )
              return fail('FORBIDDEN');
            if (i.options.prompts && (role !== 'owner' || i.kind !== 'sketch-circle'))
              return fail('FORBIDDEN');
            const current = states.get(i.roomId),
              history = starts.get(i.roomId);
            if (
              (current && !['completed', 'cancelled'].includes(current.session.state)) ||
              history?.ids.includes(i.requestId)
            )
              return fail('CONFLICT');
            if (states.size >= 200 && !states.has(i.roomId)) return fail('UNAVAILABLE');
            if (starts.size >= 200 && !starts.has(i.roomId)) return fail('RATE_LIMITED');
            c.signal.throwIfAborted();
            return {
              session: {
                id: randomUUID(),
                kind: i.kind,
                creator: actor,
                state: 'lobby',
                version: 0,
                round: 0,
                deadline: null,
                options: i.options,
                members: [{ id: actor, mode: 'participant', score: 0 }],
                declined: [],
                reports: [],
                privateState: null,
              },
              audience: [actor],
              commands: [],
              createdAt: now(),
              touchedAt: now(),
              rates: {},
              missing: {},
            };
          });
          states.set(i.roomId, record);
          starts.set(i.roomId, {
            ids: [...(starts.get(i.roomId)?.ids ?? []), i.requestId].slice(-64),
            at: now(),
          });
          return view(i.roomId, actor);
        }),
    }),
    defineOperation({
      id: 'activities.member',
      kind: 'command',
      input: activityMemberSchema,
      output: activityViewSchema,
      access,
      rate: { limit: 60, windowMs: 60000 },
      handle: (i, c) =>
        mutate(i, c.actor!.subjectId, c.signal, async (r, role) => {
          const s = r.session,
            actor = c.actor!.subjectId,
            def = registry.get(s.kind)!;
          if (['completed', 'cancelled'].includes(s.state)) return fail('CONFLICT');
          if (i.action === 'begin' || i.action === 'cancel') {
            if (s.creator !== actor && role !== 'owner' && role !== 'moderator')
              return fail('FORBIDDEN');
            if (i.action === 'cancel') {
              s.state = 'cancelled';
              s.deadline = null;
              return;
            }
            if (
              s.state !== 'lobby' ||
              s.members.filter((m) => m.mode === 'participant').length < def.min
            )
              return fail('CONFLICT');
            def.begin(s, now());
            return;
          }
          if (i.action === 'report') {
            if (!s.reports.includes(actor)) s.reports = [...s.reports, actor].slice(-24);
            return;
          }
          if (i.action === 'leave' || i.action === 'decline') {
            if (s.members.some((m) => m.id === actor)) remove(r, actor);
            if (i.action === 'decline' && !s.declined.includes(actor))
              s.declined = [...s.declined, actor].slice(-24);
            return;
          }
          if (s.members.some((m) => m.id === actor)) return fail('CONFLICT');
          if (i.action === 'join' && s.state !== 'lobby') return fail('CONFLICT');
          const mode = i.action === 'join' ? 'participant' : 'spectator';
          if (mode === 'spectator' && !def.spectators) return fail('FORBIDDEN');
          if (
            s.members.filter((m) => m.mode === mode).length >=
              (mode === 'participant' ? def.max : 12) ||
            (!r.audience.includes(actor) && r.audience.length >= 24)
          )
            return fail('CONFLICT');
          if (
            s.options.friendsOnly &&
            actor !== s.creator &&
            !(await deps.social.friends(actor, s.creator))
          )
            return fail('FORBIDDEN');
          s.members.push({ id: actor, mode, score: 0 });
          s.declined = s.declined.filter((id) => id !== actor);
          if (!r.audience.includes(actor)) r.audience.push(actor);
        }),
    }),
    defineOperation({
      id: 'activities.play',
      kind: 'command',
      input: activityPlaySchema,
      output: activityViewSchema,
      access,
      rate: { limit: 120, windowMs: 60000 },
      handle: (i, c) =>
        mutate(i, c.actor!.subjectId, c.signal, (r) => {
          const actor = c.actor!.subjectId,
            s = r.session;
          if (!s.members.some((m) => m.id === actor && m.mode === 'participant'))
            return fail('FORBIDDEN');
          if (s.state !== 'active' || s.deadline === null || now() >= s.deadline)
            return fail('CONFLICT');
          if (JSON.stringify(i.action).length > 8192) return fail('INVALID_REQUEST');
          rate(r, actor, i.action.type);
          registry.get(s.kind)!.act(s, actor, i.action, now());
        }),
    }),
  ];
  return {
    ...activitiesDefinition,
    dependencies: [{ id: 'presence', major: 1 }],
    capabilities: ['activities.v1'],
    flags: [{ id: 'activities.enabled', rule: { mode: 'global' } }],
    permissions: [
      {
        id: 'activities.member',
        description: 'Current room role and owner-block authorization',
        allows: async (a, r) => !!(await rooms.role(a.subjectId, r.id)),
      },
    ],
    operations: operations.map((o) => ({ ...o, flag: 'activities.enabled' })),
    http: operations.map((o) => ({
      method: o.kind === 'query' ? 'GET' : 'POST',
      path: `/api/v1/activities/${o.id.split('.')[1]}`,
      operation: o.id,
      input: o.kind === 'query' ? 'query' : 'body',
    })),
    realtime: operations.map((o) => ({
      command: o.id,
      operation: o.id,
      ...(o.id === 'activities.snapshot' ? { snapshotEvent: o.id } : {}),
    })),
    subscriptions: [
      {
        event: 'presence.room-occupancy',
        handle: async (payload) => {
          const event = roomOccupancyEventSchema.parse(payload);
          await serial(event.roomId, async () => {
            const r = states.get(event.roomId);
            if (r) await maintain(event.roomId, r, event.members);
          });
        },
      },
    ],
    start: async (c) => {
      timer = setInterval(() => {
        if (sweeping) return;
        sweeping = true;
        void (async () => {
          for (const roomId of states.keys())
            await serial(roomId, async () => {
              const r = states.get(roomId);
              if (r) await maintain(roomId, r);
            });
          for (const [id, history] of starts) if (now() - history.at > 600000) starts.delete(id);
        })()
          .catch(() => c.observer.record('activities.sweep.failed'))
          .finally(() => {
            sweeping = false;
          });
      }, 1000);
      timer.unref();
    },
    stop: async () => {
      clearInterval(timer);
      await Promise.allSettled(queues.values());
      states.clear();
      starts.clear();
    },
  };
}
