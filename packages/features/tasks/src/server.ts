import { randomUUID } from 'node:crypto';
import { defineOperation, sql } from '@study/feature-sdk';
import type {
  Database,
  Fail,
  FeatureModule,
  ProductivityRooms,
  OperationContext,
  EventPublisher,
  PermissionDefinition,
} from '@study/feature-sdk';
import {
  taskMoveSchema,
  taskScopeSchema,
  taskCreateSchema,
  taskUpdateSchema,
  taskDeleteSchema,
  tasksViewSchema,
  okSchema,
  z,
} from '@study/contracts';
import type { TaskScope } from '@study/contracts';
/** Values stay parameterized; only this closed, module-owned table choice changes SQL structure. */
function scopedSql(scope: TaskScope) {
  return (parts: TemplateStringsArray, ...values: unknown[]) => {
    const statement = sql(parts, ...values);
    return {
      ...statement,
      text: statement.text.replaceAll(
        '__items__',
        scope.scope === 'personal' ? 'tasks.personal_items' : 'tasks.shared_items',
      ),
    };
  };
}
export const tasksDefinition = {
  id: 'tasks',
  version: '1.0.0',
  persistence: { durableSchema: 'tasks' },
} as const;
export function tasksModule(deps: {
  db: Database;
  rooms: ProductivityRooms;
  fail: Fail;
  enabled?: boolean;
}): FeatureModule {
  const { db, rooms, fail } = deps;
  let events: EventPublisher | undefined;
  const changed = {
    id: 'tasks.changed',
    schema: z.strictObject({ id: z.uuid(), scope: taskScopeSchema }),
  };
  const actor = (c: OperationContext) => c.actor?.subjectId ?? fail('UNAUTHENTICATED');
  const personalPolicy: PermissionDefinition = {
    id: 'tasks.personal',
    description: 'Account owner accesses only private task storage',
    allows: async (a, r) => r.ownerId === a.subjectId && !r.scopeId,
  };
  const sharedPolicy: PermissionDefinition = {
    id: 'tasks.shared',
    description:
      'Current room member accesses room-owned task storage; mutation ownership rechecked transactionally',
    allows: async (a, r) =>
      !r.ownerId && !!r.scopeId && !!(await rooms.role(a.subjectId, r.scopeId)),
  };
  const access = {
    permission: 'tasks.access',
    resource: async (i: { scope: TaskScope } | TaskScope, c: OperationContext) => {
      const s = typeof i.scope === 'string' ? (i as TaskScope) : (i as { scope: TaskScope }).scope;
      return s.scope === 'personal'
        ? { id: actor(c), ownerId: actor(c) }
        : { id: s.roomId, scopeId: s.roomId };
    },
  };
  const owner = (s: TaskScope, a: string) => (s.scope === 'personal' ? a : null),
    room = (s: TaskScope) => (s.scope === 'shared' ? s.roomId : null);
  async function check(s: TaskScope, a: string, tx: Database) {
    if (s.scope === 'shared' && !(await rooms.role(a, s.roomId, tx))) return fail('FORBIDDEN');
  }
  async function list(s: TaskScope, a: string) {
    const rows = await db.query(
      scopedSql(
        s,
      )`SELECT * FROM __items__ WHERE owner_id IS NOT DISTINCT FROM ${owner(s, a)}::uuid AND room_id IS NOT DISTINCT FROM ${room(s)}::uuid AND NOT deleted ORDER BY position,id LIMIT 200`,
    );
    const manager = s.scope === 'shared' && (await rooms.role(a, s.roomId)) === 'owner';
    return {
      tasks: rows.map((r) => ({
        id: String(r.id),
        title: String(r.title),
        completed: !!r.completed,
        position: Number(r.position),
        version: Number(r.version),
        createdBy: String(r.created_by),
        canEdit: s.scope === 'personal' || r.created_by === a || manager,
      })),
      limit: 200 as const,
      scope: s,
    };
  }
  const operations = [
    defineOperation({
      id: 'tasks.snapshot',
      kind: 'query',
      input: taskScopeSchema,
      output: tasksViewSchema,
      access,
      rate: { limit: 600, windowMs: 60000 },
      handle: async (i, c) => list(i, actor(c)),
    }),
    defineOperation({
      id: 'tasks.create',
      kind: 'command',
      input: taskCreateSchema,
      output: okSchema,
      access,
      rate: { limit: 30, windowMs: 60000 },
      handle: async (i, c) => {
        const a = actor(c);
        const id = await db.transaction(async (tx) => {
          await tx.query(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${'task-request:' + a + ':' + i.requestId},0))`,
          );
          await tx.query(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${'tasks:' + (room(i.scope) ?? a)},0))`,
          );
          await check(i.scope, a, tx);
          const [replay] = await tx.query(
            sql`SELECT id,owner_id,room_id FROM tasks.personal_items WHERE created_by=${a} AND request_id=${i.requestId} UNION ALL SELECT id,owner_id,room_id FROM tasks.shared_items WHERE created_by=${a} AND request_id=${i.requestId}`,
          );
          if (replay) {
            if (replay.owner_id !== owner(i.scope, a) || replay.room_id !== room(i.scope))
              return fail('CONFLICT');
            return String(replay.id);
          }
          const [count] = await tx.query(
            scopedSql(
              i.scope,
            )`SELECT count(*)::int AS n,COALESCE(max(position),-1)::int AS p FROM __items__ WHERE owner_id IS NOT DISTINCT FROM ${owner(i.scope, a)}::uuid AND room_id IS NOT DISTINCT FROM ${room(i.scope)}::uuid AND NOT deleted`,
          );
          if (Number(count!.n) >= 200) return fail('CONFLICT');
          const id = randomUUID();
          await tx.query(
            scopedSql(
              i.scope,
            )`INSERT INTO __items__(id,owner_id,room_id,created_by,request_id,title,position) VALUES(${id},${owner(i.scope, a)},${room(i.scope)},${a},${i.requestId},${i.title},${Math.min(1000000, Number(count!.p) + 1)})`,
          );
          return id;
        });
        await events?.emit(changed, { id, scope: i.scope });
        return { ok: true };
      },
    }),
    defineOperation({
      id: 'tasks.move',
      kind: 'command',
      input: taskMoveSchema,
      output: okSchema,
      access,
      rate: { limit: 60, windowMs: 60000 },
      handle: async (i, c) => {
        const a = actor(c);
        await db.transaction(async (tx) => {
          await tx.query(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${'tasks:' + (room(i.scope) ?? a)},0))`,
          );
          await check(i.scope, a, tx);
          const rows = await tx.query(
            scopedSql(
              i.scope,
            )`SELECT * FROM __items__ WHERE owner_id IS NOT DISTINCT FROM ${owner(i.scope, a)}::uuid AND room_id IS NOT DISTINCT FROM ${room(i.scope)}::uuid AND NOT deleted ORDER BY position,id FOR UPDATE`,
          );
          const index = rows.findIndex((r) => r.id === i.id),
            item = rows[index];
          if (!item) return fail('FORBIDDEN');
          if (
            i.scope.scope === 'shared' &&
            item.created_by !== a &&
            (await rooms.role(a, i.scope.roomId, tx)) !== 'owner'
          )
            return fail('FORBIDDEN');
          if (item.version !== i.version) return fail('CONFLICT');
          const next = Math.max(
            0,
            Math.min(rows.length - 1, index + (i.direction === 'up' ? -1 : 1)),
          );
          rows.splice(index, 1);
          rows.splice(next, 0, item);
          for (const [position, r] of rows.entries())
            await tx.query(
              scopedSql(
                i.scope,
              )`UPDATE __items__ SET position=${position},version=version+1 WHERE id=${r.id}`,
            );
        });
        await events?.emit(changed, { id: i.id, scope: i.scope });
        return { ok: true };
      },
    }),
    ...(['update', 'delete'] as const).map((action) =>
      defineOperation({
        id: 'tasks.' + action,
        kind: 'command',
        input: action === 'update' ? taskUpdateSchema : taskDeleteSchema,
        output: okSchema,
        access,
        rate: { limit: 60, windowMs: 60000 },
        handle: async (i, c) => {
          const a = actor(c);
          await db.transaction(async (tx) => {
            await tx.query(
              sql`SELECT pg_advisory_xact_lock(hashtextextended(${'tasks:' + (room(i.scope) ?? a)},0))`,
            );
            await check(i.scope, a, tx);
            const [r] = await tx.query(
              scopedSql(
                i.scope,
              )`SELECT * FROM __items__ WHERE id=${i.id} AND owner_id IS NOT DISTINCT FROM ${owner(i.scope, a)}::uuid AND room_id IS NOT DISTINCT FROM ${room(i.scope)}::uuid AND NOT deleted FOR UPDATE`,
            );
            if (!r) return fail('FORBIDDEN');
            if (
              i.scope.scope === 'shared' &&
              r.created_by !== a &&
              (await rooms.role(a, i.scope.roomId, tx)) !== 'owner'
            )
              return fail('FORBIDDEN');
            if (r.version !== i.version) return fail('CONFLICT');
            if (action === 'delete')
              await tx.query(
                scopedSql(
                  i.scope,
                )`UPDATE __items__ SET deleted=true,title='Deleted task',completed=false,version=version+1 WHERE id=${i.id}`,
              );
            else {
              const update = taskUpdateSchema.parse(i);
              await tx.query(
                scopedSql(
                  i.scope,
                )`UPDATE __items__ SET title=${update.title},completed=${update.completed},position=${update.position},version=version+1 WHERE id=${i.id}`,
              );
            }
          });
          await events?.emit(changed, { id: i.id, scope: i.scope });
          return { ok: true };
        },
      }),
    ),
  ];
  return {
    ...tasksDefinition,
    capabilities: ['tasks.v1'],
    permissions: [
      personalPolicy,
      sharedPolicy,
      {
        id: 'tasks.access',
        description:
          'Compatibility scope dispatcher; invokes the distinct Personal or Shared policy',
        allows: async (a, r) =>
          r.ownerId ? personalPolicy.allows(a, r) : sharedPolicy.allows(a, r),
      },
    ],
    flags: [
      { id: 'tasks.enabled', rule: { mode: deps.enabled === false ? 'disabled' : 'global' } },
    ],
    operations: operations.map((o) => ({ ...o, flag: 'tasks.enabled' })),
    http: operations.map((o) => ({
      method: o.kind === 'query' ? 'GET' : 'POST',
      path: `/api/v1/tasks/${o.id.split('.')[1]}`,
      operation: o.id,
      input: o.kind === 'query' ? 'query' : 'body',
    })),
    realtime: operations.map((o) => ({
      command: o.id,
      operation: o.id,
      ...(o.kind === 'query' ? { snapshotEvent: 'tasks.snapshot' } : {}),
    })),
    events: [changed],
    start: async (c) => {
      events = c.events;
    },
  };
}
