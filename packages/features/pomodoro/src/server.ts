import { defineOperation, sql } from '@study/feature-sdk';
import type {
  Database,
  Fail,
  FeatureModule,
  ProductivityRooms,
  EventPublisher,
  OperationContext,
} from '@study/feature-sdk';
import {
  productivityRoomSchema,
  timerStateSchema,
  timerViewSchema,
  timerCommandSchema,
  clockSchema,
  emptySchema,
  personalTimerStateSchema,
  personalTimerViewSchema,
  personalTimerCommandSchema,
} from '@study/contracts';
import { initialTimer, initialPersonalTimer, projectTimer } from './browser.ts';
import { applyTimerCommand } from './commands.ts';
export const pomodoroDefinition = {
  id: 'pomodoro',
  version: '1.0.0',
  persistence: { durableSchema: 'pomodoro' },
} as const;
export function pomodoroModule(deps: {
  db: Database;
  rooms: ProductivityRooms;
  fail: Fail;
  enabled?: boolean;
  now?: () => number;
}): FeatureModule {
  const { db, rooms, fail } = deps,
    now = deps.now ?? Date.now;
  let events: EventPublisher | undefined;
  const updated = { id: 'pomodoro.updated', schema: timerStateSchema },
    phaseChanged = { id: 'pomodoro.phase-changed', schema: timerStateSchema };
  const access = {
    permission: 'pomodoro.member',
    resource: async (i: { roomId: string }) => ({ id: i.roomId, scopeId: i.roomId }),
  };
  const read = async (roomId: string, tx = db) => {
    const [r] = await tx.query(sql`SELECT state FROM pomodoro.timers WHERE room_id=${roomId}`);
    return r ? timerStateSchema.parse(r.state) : initialTimer(roomId, 0);
  };
  const self = {
    permission: 'pomodoro.personal',
    resource: async (_: unknown, c: OperationContext) => ({
      id: c.actor?.subjectId ?? fail('UNAUTHENTICATED'),
    }),
  };
  const readPersonal = async (userId: string, tx = db) => {
    const [r] = await tx.query(
      sql`SELECT state FROM pomodoro.personal_timers WHERE user_id=${userId}`,
    );
    return r ? personalTimerStateSchema.parse(r.state) : initialPersonalTimer(0);
  };
  const operations = [
    defineOperation({
      id: 'pomodoro.snapshot',
      kind: 'query',
      input: productivityRoomSchema,
      output: timerViewSchema,
      access,
      rate: { limit: 600, windowMs: 60000 },
      handle: async (i, c) => ({
        state: await read(i.roomId),
        canControl: (await rooms.role(c.actor!.subjectId, i.roomId)) === 'owner',
      }),
    }),
    defineOperation({
      id: 'pomodoro.clock',
      kind: 'query',
      input: emptySchema,
      output: clockSchema,
      access: { permission: 'pomodoro.clock', resource: async () => ({ id: 'clock' }) },
      rate: { limit: 120, windowMs: 60000 },
      handle: async () => ({ serverNow: now() }),
    }),
    defineOperation({
      id: 'pomodoro.control',
      kind: 'command',
      input: timerCommandSchema,
      output: timerViewSchema,
      access: { ...access, permission: 'pomodoro.control' },
      rate: { limit: 30, windowMs: 60000 },
      handle: async (i, c) => {
        let phase = false;
        const state = await db.transaction(async (tx) => {
          await tx.query(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${'timer:' + i.roomId},0))`,
          );
          if ((await rooms.role(c.actor!.subjectId, i.roomId, tx)) !== 'owner')
            return fail('FORBIDDEN');
          const previous = await read(i.roomId, tx);
          const s = applyTimerCommand(previous, i, now(), fail);
          phase = s.phase !== projectTimer(previous, now()).phase;
          await tx.query(
            sql`INSERT INTO pomodoro.timers(room_id,state) VALUES(${i.roomId},${JSON.stringify(s)}::jsonb) ON CONFLICT(room_id) DO UPDATE SET state=EXCLUDED.state`,
          );
          return s;
        });
        await events?.emit(updated, state);
        if (phase) await events?.emit(phaseChanged, state);
        return { state, canControl: true };
      },
    }),
    defineOperation({
      id: 'pomodoro.personal-snapshot',
      kind: 'query',
      input: emptySchema,
      output: personalTimerViewSchema,
      access: self,
      rate: { limit: 600, windowMs: 60000 },
      handle: async (_, c) => ({ state: await readPersonal(c.actor!.subjectId), canControl: true }),
    }),
    defineOperation({
      id: 'pomodoro.personal-control',
      kind: 'command',
      input: personalTimerCommandSchema,
      output: personalTimerViewSchema,
      access: self,
      rate: { limit: 30, windowMs: 60000 },
      handle: async (i, c) => {
        const userId = c.actor!.subjectId;
        const state = await db.transaction(async (tx) => {
          await tx.query(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${'personal-timer:' + userId},0))`,
          );
          const next = applyTimerCommand(await readPersonal(userId, tx), i, now(), fail);
          await tx.query(
            sql`INSERT INTO pomodoro.personal_timers(user_id,state) VALUES(${userId},${JSON.stringify(next)}::jsonb) ON CONFLICT(user_id) DO UPDATE SET state=EXCLUDED.state`,
          );
          return next;
        });
        // Personal data is delivered exclusively through the actor-authorized personal snapshot.
        // No shared-room event or room worker observes this table.
        return { state, canControl: true };
      },
    }),
  ];
  // Automatic phases are deterministic projections of the durable anchor. Internal events are advisory.
  let timer: ReturnType<typeof setInterval> | undefined,
    busy = false;
  const observed = new Map<string, string>();
  return {
    ...pomodoroDefinition,
    capabilities: ['pomodoro.v1', 'pomodoro.personal.v1'],
    permissions: [
      {
        id: 'pomodoro.personal',
        description: 'Read/control only the authenticated account timer',
        allows: async (a, r) => r.id === a.subjectId,
      },
      {
        id: 'pomodoro.member',
        description: 'Current room member reads shared timer',
        allows: async (a, r) => !!(await rooms.role(a.subjectId, r.id)),
      },
      {
        id: 'pomodoro.control',
        description: 'Room owner controls shared timer',
        allows: async (a, r) => (await rooms.role(a.subjectId, r.id)) === 'owner',
      },
      {
        id: 'pomodoro.clock',
        description: 'Authenticated clock synchronization',
        allows: async () => true,
      },
    ],
    flags: [
      { id: 'pomodoro.enabled', rule: { mode: deps.enabled === false ? 'disabled' : 'global' } },
    ],
    operations: operations.map((o) => ({ ...o, flag: 'pomodoro.enabled' })),
    http: operations.map((o) => ({
      method: o.kind === 'query' ? 'GET' : 'POST',
      path: `/api/v1/pomodoro/${o.id.split('.')[1]}`,
      operation: o.id,
      input: o.kind === 'query' ? 'query' : 'body',
    })),
    realtime: operations.map((o) => ({
      command: o.id,
      operation: o.id,
      ...(['pomodoro.snapshot', 'pomodoro.personal-snapshot'].includes(o.id)
        ? { snapshotEvent: o.id }
        : {}),
    })),
    events: [updated, phaseChanged],
    start: async (c) => {
      events = c.events;
      if (deps.enabled === false) return;
      timer = setInterval(() => {
        if (busy) return;
        busy = true;
        void (async () => {
          for (const r of await db.query(
            sql`SELECT state FROM pomodoro.timers WHERE state->>'running'='true'`,
          )) {
            const s = projectTimer(timerStateSchema.parse(r.state), now()),
              key = s.phase + ':' + s.cycle;
            const old = observed.get(s.roomId);
            observed.set(s.roomId, key);
            if (old && old !== key) await events?.emit(phaseChanged, s);
          }
        })()
          .catch(() => c.observer.record('pomodoro.tick.failed'))
          .finally(() => {
            busy = false;
          });
      }, 1000);
    },
    stop: async () => {
      clearInterval(timer);
      observed.clear();
    },
  };
}
