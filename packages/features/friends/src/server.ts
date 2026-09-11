import { defineOperation, sql } from '@study/feature-sdk';
import type {
  Database,
  Fail,
  FeatureModule,
  OperationContext,
  PeopleDirectory,
  RoomDirectory,
  PresenceDirectory,
  SocialDirectory,
  EventPublisher,
} from '@study/feature-sdk';
import {
  emptySchema,
  okSchema,
  socialPrivacySchema,
  socialTargetSchema,
  friendsSnapshotSchema,
  z,
} from '@study/contracts';
export const friendsDefinition = {
  id: 'friends',
  version: '1.0.0',
  required: true,
  dependencies: [{ id: 'identity', major: 1 }],
  persistence: { durableSchema: 'friends' },
} as const;
export function socialDirectory(db: Database): SocialDirectory {
  return {
    async blocked(a, b, tx = db) {
      return (
        (
          await tx.query(
            sql`SELECT 1 FROM friends.blocks WHERE (actor_id=${a} AND target_id=${b}) OR (actor_id=${b} AND target_id=${a})`,
          )
        ).length > 0
      );
    },
    async friends(a, b, tx = db) {
      return (
        (
          await tx.query(
            sql`SELECT 1 FROM friends.relationships WHERE low_id=LEAST(${a}::uuid,${b}::uuid) AND high_id=GREATEST(${a}::uuid,${b}::uuid) AND state='accepted'`,
          )
        ).length > 0
      );
    },
    async privacy(id, tx = db) {
      const [r] = await tx.query(
        sql`SELECT online,room,study,join_visible AS "join",invites FROM friends.privacy WHERE user_id=${id}`,
      );
      return socialPrivacySchema.parse(
        r ?? { online: true, room: false, study: true, join: false, invites: true },
      );
    },
  };
}
export function friendsModule(deps: {
  db: Database;
  fail: Fail;
  people: PeopleDirectory;
  rooms: RoomDirectory;
  social: SocialDirectory;
  presence: PresenceDirectory;
  enabled?: boolean;
}): FeatureModule {
  const { db, fail, social } = deps;
  let events: EventPublisher | undefined;
  const changed = {
    id: 'friends.changed',
    schema: z.strictObject({ actorId: z.uuid(), targetId: z.uuid() }),
  };
  const actor = (c: OperationContext) => c.actor?.subjectId ?? fail('UNAUTHENTICATED');
  const access = {
    permission: 'friends.account',
    resource: async (_: unknown, c: OperationContext) => ({ id: actor(c) }),
  };
  const rate = { limit: 600, windowMs: 60000 };
  const operations = [
    defineOperation({
      id: 'friends.snapshot',
      kind: 'query',
      input: emptySchema,
      output: friendsSnapshotSchema,
      access,
      rate,
      handle: async (_, c) => {
        const a = actor(c);
        const rows = await db.query(
          sql`SELECT *, CASE WHEN low_id=${a} THEN high_id ELSE low_id END AS target FROM friends.relationships WHERE low_id=${a} OR high_id=${a} ORDER BY low_id,high_id LIMIT 200`,
        );
        const result = {
          friends: [] as import('@study/contracts').PresenceView[],
          incoming: [] as { id: string; name: string }[],
          outgoing: [] as { id: string; name: string }[],
          blocked: [] as { id: string; name: string }[],
          privacy: await social.privacy(a),
        };
        for (const r of rows) {
          const target = String(r.target);
          if (await social.blocked(a, target)) continue;
          const person = await deps.people.person(target);
          if (!person) continue;
          if (r.state === 'accepted') {
            const view = await deps.presence.view(a, target);
            if (view) result.friends.push(view);
          } else (r.sender_id === a ? result.outgoing : result.incoming).push(person);
        }
        for (const r of await db.query(
          sql`SELECT target_id FROM friends.blocks WHERE actor_id=${a} ORDER BY target_id LIMIT 200`,
        )) {
          const person = await deps.people.person(String(r.target_id));
          if (person) result.blocked.push(person);
        }
        return result;
      },
    }),
    defineOperation({
      id: 'friends.privacy',
      kind: 'command',
      input: socialPrivacySchema,
      output: socialPrivacySchema,
      access,
      rate: { limit: 20, windowMs: 60000 },
      handle: async (i, c) => {
        await db.query(
          sql`INSERT INTO friends.privacy(user_id,online,room,study,join_visible,invites) VALUES(${actor(c)},${i.online},${i.room},${i.study},${i.join},${i.invites}) ON CONFLICT(user_id) DO UPDATE SET online=EXCLUDED.online,room=EXCLUDED.room,study=EXCLUDED.study,join_visible=EXCLUDED.join_visible,invites=EXCLUDED.invites`,
        );
        return i;
      },
    }),
    ...(['request', 'accept', 'decline', 'remove', 'block', 'unblock'] as const).map((action) =>
      defineOperation({
        id: `friends.${action}`,
        kind: 'command',
        input: socialTargetSchema,
        output: okSchema,
        access,
        rate: { limit: action === 'request' ? 10 : 30, windowMs: 60000 },
        handle: async (i, c) => {
          const a = actor(c),
            b = i.targetId;
          if (a === b) return fail('FORBIDDEN');
          await db.transaction(async (tx) => {
            // Serialize social mutations, including opposite-direction requests and block races.
            await tx.query(sql`SELECT pg_advisory_xact_lock(730003)`);
            const [r] = await tx.query(
              sql`SELECT * FROM friends.relationships WHERE low_id=LEAST(${a}::uuid,${b}::uuid) AND high_id=GREATEST(${a}::uuid,${b}::uuid) FOR UPDATE`,
            );
            const blocked = await social.blocked(a, b, tx);
            if (action === 'unblock') {
              await tx.query(
                sql`DELETE FROM friends.blocks WHERE actor_id=${a} AND target_id=${b}`,
              );
              return;
            }
            if (action === 'block') {
              if (!r && !(await deps.rooms.shared(a, b))) return fail('FORBIDDEN');
              const [count] = await tx.query(
                sql`SELECT count(*)::int AS n FROM friends.blocks WHERE actor_id=${a}`,
              );
              if (Number(count?.n) >= 200) return fail('RATE_LIMITED');
              await tx.query(
                sql`INSERT INTO friends.blocks(actor_id,target_id) VALUES(${a},${b}) ON CONFLICT DO NOTHING`,
              );
              await tx.query(
                sql`DELETE FROM friends.relationships WHERE low_id=LEAST(${a}::uuid,${b}::uuid) AND high_id=GREATEST(${a}::uuid,${b}::uuid)`,
              );
              await deps.rooms.revokeInvites?.(a, b, tx);
              return;
            }
            if (blocked) return fail('FORBIDDEN');
            if (action === 'request') {
              // No global account search or guessed-ID lookup. Meet in a room first.
              if (!(await deps.rooms.shared(a, b)) || !(await deps.people.person(b)))
                return fail('FORBIDDEN');
              if (r) return fail('CONFLICT');
              const [count] = await tx.query(
                sql`SELECT GREATEST((SELECT count(*) FROM friends.relationships WHERE low_id=${a} OR high_id=${a}),(SELECT count(*) FROM friends.relationships WHERE low_id=${b} OR high_id=${b}))::int AS n`,
              );
              if (Number(count?.n) >= 200) return fail('RATE_LIMITED');
              await tx.query(
                sql`INSERT INTO friends.relationships(low_id,high_id,sender_id,state) VALUES(LEAST(${a}::uuid,${b}::uuid),GREATEST(${a}::uuid,${b}::uuid),${a},'pending')`,
              );
              return;
            }
            if (
              !r ||
              (action === 'accept' && (r.state !== 'pending' || r.sender_id === a)) ||
              (action === 'decline' && r.state !== 'pending') ||
              (action === 'remove' && r.state !== 'accepted')
            )
              return fail('FORBIDDEN');
            if (action === 'accept')
              await tx.query(
                sql`UPDATE friends.relationships SET state='accepted' WHERE low_id=${r.low_id} AND high_id=${r.high_id}`,
              );
            else
              await tx.query(
                sql`DELETE FROM friends.relationships WHERE low_id=${r.low_id} AND high_id=${r.high_id}`,
              );
            if (action === 'remove') await deps.rooms.revokeInvites?.(a, b, tx);
          });
          await events?.emit(changed, { actorId: a, targetId: b });
          return { ok: true };
        },
      }),
    ),
  ];
  return {
    ...friendsDefinition,
    capabilities: ['friends.v1'],
    flags: [
      { id: 'friends.enabled', rule: { mode: deps.enabled === false ? 'disabled' : 'global' } },
    ],
    permissions: [
      {
        id: 'friends.account',
        description: 'Own social state only',
        allows: async (a, r) => a.subjectId === r.id && !!(await deps.people.person(a.subjectId)),
      },
    ],
    operations: operations.map((op) => ({ ...op, flag: 'friends.enabled' })),
    http: operations.map((op) => ({
      method: op.kind === 'query' ? 'GET' : 'POST',
      path: `/api/v1/friends/${op.id.slice(8)}`,
      operation: op.id,
      input: op.kind === 'query' ? 'query' : 'body',
    })),
    realtime: operations.map((op) => ({
      command: op.id,
      operation: op.id,
      ...(op.kind === 'query' ? { snapshotEvent: 'friends.snapshot' } : {}),
    })),
    events: [changed],
    start: async (c) => {
      events = c.events;
    },
  };
}
