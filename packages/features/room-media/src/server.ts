import { randomUUID } from 'node:crypto';
import { defineOperation, sql } from '@study/feature-sdk';
import type {
  Database,
  Fail,
  FeatureModule,
  ProductivityRooms,
  RoomOccupancy,
  SocialDirectory,
  PeopleDirectory,
} from '@study/feature-sdk';
import {
  mediaRoomSchema,
  roomOccupancyEventSchema,
  mediaViewSchema,
  mediaClockSchema,
  mediaCommandSchema,
  mediaConfigureSchema,
  mediaReconcileSchema,
  mediaSuggestionDecisionSchema,
  mediaPlaybackSchema,
  mediaSettingsSchema,
} from '@study/contracts';
import type { MediaPlayback, MediaSettings, MediaView } from '@study/contracts';
import {
  initialPlayback,
  defaultMediaSettings,
  mayControl,
  applyMediaAction,
  mediaPosition,
} from './browser.ts';
export const roomMediaDefinition = {
  id: 'room-media',
  version: '1.0.0',
  persistence: { durableSchema: 'room_media', ephemeralNamespace: 'room-media' },
} as const;
type Session = {
  epoch: string;
  version: number;
  state: MediaPlayback;
  baseline: MediaPlayback;
  settings: MediaSettings;
  controller: string | null;
  changedBy: string[];
  suggestions: { id: string; userId: string; action: MediaView['suggestions'][number]['action'] }[];
  occupied: boolean;
  ownerPresent: boolean;
};
export function roomMediaModule(deps: {
  db: Database;
  rooms: ProductivityRooms;
  occupancy: RoomOccupancy;
  social: SocialDirectory;
  people: PeopleDirectory;
  fail: Fail;
  enabled?: boolean;
  now?: () => number;
}): FeatureModule {
  const { db, rooms, occupancy, fail } = deps,
    now = deps.now ?? Date.now;
  const sessions = new Map<string, Session>(),
    queues = new Map<string, Promise<unknown>>();
  let timer: ReturnType<typeof setInterval> | undefined;
  const serial = async <T>(roomId: string, work: () => Promise<T>): Promise<T> => {
    const next = (queues.get(roomId) ?? Promise.resolve()).catch(() => {}).then(work);
    queues.set(roomId, next);
    try {
      return await next;
    } finally {
      if (queues.get(roomId) === next) queues.delete(roomId);
    }
  };
  async function occupants(roomId: string) {
    const ids = await occupancy.members(roomId),
      roles = await Promise.all(ids.map((id) => rooms.role(id, roomId)));
    return { occupied: roles.some(Boolean), ownerPresent: roles.includes('owner') };
  }
  async function read(roomId: string): Promise<Session> {
    const existing = sessions.get(roomId);
    if (existing) return existing;
    const [row] = await db.query(
      sql`SELECT baseline,settings FROM room_media.baselines WHERE room_id=${roomId}`,
    );
    const baseline = row ? mediaPlaybackSchema.parse(row.baseline) : initialPlayback(now());
    // Restart restores the saved position, never extrapolates across an unobserved outage.
    const s: Session = {
      epoch: randomUUID(),
      version: 0,
      state: { ...structuredClone(baseline), updatedAt: now() },
      baseline,
      settings: row
        ? mediaSettingsSchema.parse(row.settings)
        : structuredClone(defaultMediaSettings),
      controller: null,
      changedBy: [],
      suggestions: [],
      ...(await occupants(roomId)),
    };
    sessions.set(roomId, s);
    return s;
  }
  function reconcileOccupancy(s: Session, current: { occupied: boolean; ownerPresent: boolean }) {
    if (s.occupied === current.occupied && s.ownerPresent === current.ownerPresent) return;
    if (!current.occupied && s.occupied) {
      s.state = { ...structuredClone(s.baseline), updatedAt: now() };
      s.changedBy = [];
      s.suggestions = [];
      s.controller = null;
      s.version++;
    }
    if (!s.occupied && current.occupied && s.state.playing) {
      s.state.updatedAt = now();
      s.version++;
    }
    Object.assign(s, current);
  }
  async function view(roomId: string, userId: string, s: Session): Promise<MediaView> {
    const role = await rooms.role(userId, roomId);
    if (!role) return fail('FORBIDDEN');
    const person = async (id: string) =>
      (await deps.social.blocked(userId, id)) ? null : await deps.people.person(id);
    const changedBy = (await Promise.all(s.changedBy.map(person))).filter((p) => p !== null);
    const suggestions: MediaView['suggestions'] = [];
    for (const suggestion of s.suggestions) {
      const by = await person(suggestion.userId);
      if (by) suggestions.push({ id: suggestion.id, by, action: suggestion.action });
    }
    const current = await occupants(roomId);
    return {
      roomId,
      epoch: s.epoch,
      version: s.version,
      state: s.state,
      ownerBaseline: s.baseline,
      settings: s.settings,
      ownerPresent: current.ownerPresent,
      temporary: s.changedBy.length > 0,
      canControl: mayControl(s.settings, role, current.ownerPresent),
      isOwner: role === 'owner',
      controller: s.controller ? await person(s.controller) : null,
      changedBy,
      suggestions,
    };
  }
  const access = {
    permission: 'room-media.member',
    resource: async (i: { roomId: string }) => ({ id: i.roomId, scopeId: i.roomId }),
  };
  type Revision = { roomId: string; epoch: string; version: number };
  async function mutate(
    i: Revision,
    userId: string,
    mode: 'control' | 'owner' | 'suggest',
    work: (s: Session, owner: boolean) => void | Promise<void>,
  ) {
    return serial(i.roomId, async () => {
      const previous = await read(i.roomId),
        current = await occupants(i.roomId);
      reconcileOccupancy(previous, current);
      const next = structuredClone(previous);
      await db.transaction(async (tx) => {
        const role = await rooms.role(userId, i.roomId, tx);
        if (
          !role ||
          (mode === 'owner' && role !== 'owner') ||
          (mode === 'control' && !mayControl(next.settings, role, current.ownerPresent))
        )
          return fail('FORBIDDEN');
        if (!current.occupied && (mode === 'suggest' || (mode === 'control' && role !== 'owner')))
          return fail('FORBIDDEN');
        if (i.epoch !== next.epoch || i.version !== next.version) return fail('CONFLICT');
        try {
          await work(next, role === 'owner');
        } catch (e) {
          if (e instanceof Error && e.message === 'INVALID_REQUEST') return fail('INVALID_REQUEST');
          throw e;
        }
        next.version++;
        if (
          mode === 'owner' ||
          (mode === 'control' && role === 'owner' && !next.changedBy.length)
        ) {
          await tx.query(
            sql`INSERT INTO room_media.baselines(room_id,baseline,settings) VALUES(${i.roomId},${JSON.stringify(next.baseline)}::jsonb,${JSON.stringify(next.settings)}::jsonb) ON CONFLICT(room_id) DO UPDATE SET baseline=EXCLUDED.baseline,settings=EXCLUDED.settings`,
          );
        }
      });
      sessions.set(i.roomId, next);
      return view(i.roomId, userId, next);
    });
  }
  function changed(s: Session, userId: string, owner: boolean) {
    s.controller = userId;
    if (owner && !s.changedBy.length) s.baseline = structuredClone(s.state);
    else if (!s.changedBy.includes(userId)) s.changedBy = [...s.changedBy, userId].slice(-200);
  }
  const operations = [
    defineOperation({
      id: 'room-media.snapshot',
      kind: 'query',
      input: mediaRoomSchema,
      output: mediaViewSchema,
      access,
      rate: { limit: 600, windowMs: 60000 },
      handle: (i, c) =>
        serial(i.roomId, async () => view(i.roomId, c.actor!.subjectId, await read(i.roomId))),
    }),
    defineOperation({
      id: 'room-media.clock',
      kind: 'query',
      input: mediaRoomSchema,
      output: mediaClockSchema,
      access,
      rate: { limit: 60, windowMs: 60000 },
      handle: async () => ({ serverNow: now() }),
    }),
    defineOperation({
      id: 'room-media.control',
      kind: 'command',
      input: mediaCommandSchema,
      output: mediaViewSchema,
      access,
      rate: { limit: 90, windowMs: 60000 },
      handle: (i, c) =>
        mutate(i, c.actor!.subjectId, 'control', (s, owner) => {
          s.state = applyMediaAction(s.state, i.action, now());
          changed(s, c.actor!.subjectId, owner);
        }),
    }),
    defineOperation({
      id: 'room-media.configure',
      kind: 'command',
      input: mediaConfigureSchema,
      output: mediaViewSchema,
      access,
      rate: { limit: 20, windowMs: 60000 },
      handle: (i, c) =>
        mutate(i, c.actor!.subjectId, 'owner', (s) => {
          s.settings = i.settings;
        }),
    }),
    defineOperation({
      id: 'room-media.reconcile',
      kind: 'command',
      input: mediaReconcileSchema,
      output: mediaViewSchema,
      access,
      rate: { limit: 20, windowMs: 60000 },
      handle: (i, c) =>
        mutate(i, c.actor!.subjectId, 'owner', (s) => {
          if (i.decision === 'keep')
            s.baseline = {
              ...structuredClone(s.state),
              position: mediaPosition(s.state, now()),
              updatedAt: now(),
            };
          s.state = { ...structuredClone(s.baseline), updatedAt: now() };
          s.changedBy = [];
          s.controller = c.actor!.subjectId;
        }),
    }),
    defineOperation({
      id: 'room-media.suggest',
      kind: 'command',
      input: mediaCommandSchema,
      output: mediaViewSchema,
      access,
      rate: { limit: 10, windowMs: 60000 },
      handle: (i, c) =>
        mutate(i, c.actor!.subjectId, 'suggest', (s) => {
          if (
            s.suggestions.length >= 30 ||
            s.suggestions.filter((x) => x.userId === c.actor!.subjectId).length >= 5
          )
            return fail('RATE_LIMITED');
          s.suggestions.push({ id: randomUUID(), userId: c.actor!.subjectId, action: i.action });
        }),
    }),
    defineOperation({
      id: 'room-media.suggestion-decide',
      kind: 'command',
      input: mediaSuggestionDecisionSchema,
      output: mediaViewSchema,
      access,
      rate: { limit: 30, windowMs: 60000 },
      handle: async (i, c) => {
        // Suggestions from blocked or removed members cannot be accepted by replaying an ID.
        return mutate(i, c.actor!.subjectId, 'control', async (s, owner) => {
          const item = s.suggestions.find((x) => x.id === i.suggestionId);
          if (!item) return fail('CONFLICT');
          if (
            (await deps.social.blocked(c.actor!.subjectId, item.userId)) ||
            !(await rooms.role(item.userId, i.roomId))
          )
            return fail('FORBIDDEN');
          if (i.accept) {
            s.state = applyMediaAction(s.state, item.action, now());
            changed(s, c.actor!.subjectId, owner);
          }
          s.suggestions = s.suggestions.filter((x) => x.id !== i.suggestionId);
        });
      },
    }),
  ];
  return {
    ...roomMediaDefinition,
    dependencies: [{ id: 'presence', major: 1 }],
    capabilities: ['room-media.v1'],
    permissions: [
      {
        id: 'room-media.member',
        description: 'Current room membership and owner-block policy',
        allows: async (a, r) => !!(await rooms.role(a.subjectId, r.id)),
      },
    ],
    flags: [
      { id: 'room-media.enabled', rule: { mode: deps.enabled === false ? 'disabled' : 'global' } },
    ],
    operations: operations.map((o) => ({ ...o, flag: 'room-media.enabled' })),
    http: operations.map((o) => ({
      method: o.kind === 'query' ? 'GET' : 'POST',
      path: `/api/v1/room-media/${o.id.split('.')[1]}`,
      operation: o.id,
      input: o.kind === 'query' ? 'query' : 'body',
    })),
    realtime: operations.map((o) => ({
      command: o.id,
      operation: o.id,
      ...(o.id === 'room-media.snapshot' ? { snapshotEvent: o.id } : {}),
    })),
    subscriptions: [
      {
        event: 'presence.room-occupancy',
        handle: async (payload) => {
          if (deps.enabled === false) return;
          const event = roomOccupancyEventSchema.parse(payload);
          await serial(event.roomId, async () => {
            const s = sessions.get(event.roomId);
            if (!s) return;
            const roles = await Promise.all(
              event.members.map((id) => rooms.role(id, event.roomId)),
            );
            reconcileOccupancy(s, {
              occupied: roles.some(Boolean),
              ownerPresent: roles.includes('owner'),
            });
          });
        },
      },
    ],
    start: async (c) => {
      if (deps.enabled === false) return;
      timer = setInterval(() => {
        for (const roomId of sessions.keys())
          void serial(roomId, async () => {
            const s = sessions.get(roomId)!;
            reconcileOccupancy(s, await occupants(roomId));
          }).catch(() => c.observer.record('room-media.sweep.failed'));
      }, 2000);
      timer.unref();
    },
    stop: async () => {
      clearInterval(timer);
      await Promise.allSettled(queues.values());
      sessions.clear();
    },
  };
}
