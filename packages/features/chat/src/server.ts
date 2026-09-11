import { randomUUID } from 'node:crypto';
import { defineOperation, sql } from '@study/feature-sdk';
import type {
  Database,
  Fail,
  FeatureModule,
  ProductivityRooms,
  SocialDirectory,
  PeopleDirectory,
  EventPublisher,
} from '@study/feature-sdk';
import {
  chatHistorySchema,
  chatSendSchema,
  chatDeleteSchema,
  chatViewSchema,
  okSchema,
  z,
} from '@study/contracts';
export const chatDefinition = {
  id: 'chat',
  version: '1.0.0',
  persistence: { durableSchema: 'chat' },
} as const;
export function chatModule(deps: {
  db: Database;
  rooms: ProductivityRooms;
  social: SocialDirectory;
  people: PeopleDirectory;
  fail: Fail;
  enabled?: boolean;
}): FeatureModule {
  const { db, rooms, social, people, fail } = deps;
  let events: EventPublisher | undefined;
  const changed = {
      id: 'chat.message-created',
      schema: z.strictObject({ roomId: z.uuid(), id: z.uuid() }),
    },
    deleted = { ...changed, id: 'chat.message-deleted' };
  const access = {
    permission: 'chat.member',
    resource: async (i: { roomId: string }) => ({ id: i.roomId, scopeId: i.roomId }),
  };
  const operations = [
    defineOperation({
      id: 'chat.history',
      kind: 'query',
      input: chatHistorySchema,
      output: chatViewSchema,
      access,
      rate: { limit: 600, windowMs: 60000 },
      handle: async (i, c) => {
        const a = c.actor!.subjectId,
          manager = (await rooms.role(a, i.roomId)) === 'owner';
        const rows = await db.query(
          sql`SELECT * FROM chat.messages WHERE room_id=${i.roomId} AND (${i.before ?? null}::bigint IS NULL OR sequence<${i.before ?? null}::bigint) ORDER BY sequence DESC LIMIT 101`,
        );
        const messages = [];
        for (const r of rows.slice(0, 100)) {
          if (await social.blocked(a, String(r.author_id))) continue;
          const person = await people.person(String(r.author_id));
          messages.push({
            id: String(r.id),
            sequence: String(r.sequence),
            authorId: String(r.author_id),
            authorName: person?.name ?? 'Former member',
            text: r.deleted ? '' : String(r.text),
            createdAt: (r.created_at as Date).toISOString(),
            deleted: !!r.deleted,
            canDelete: manager || r.author_id === a,
          });
        }
        return {
          messages: messages.reverse(),
          hasMore: rows.length > 100,
          nextBefore: rows.length > 100 ? String(rows[99]!.sequence) : null,
        };
      },
    }),
    defineOperation({
      id: 'chat.send',
      kind: 'command',
      input: chatSendSchema,
      output: okSchema,
      access,
      rate: { limit: 20, windowMs: 60000 },
      handle: async (i, c) => {
        const a = c.actor!.subjectId;
        const id = await db.transaction(async (tx) => {
          await tx.query(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${'chat-request:' + a + ':' + i.requestId},0))`,
          );
          await tx.query(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${'chat:' + i.roomId},0))`,
          );
          if (!(await rooms.role(a, i.roomId, tx))) return fail('FORBIDDEN');
          const [prior] = await tx.query(
            sql`SELECT * FROM chat.messages WHERE author_id=${a} AND request_id=${i.requestId}`,
          );
          if (prior) {
            if (prior.room_id !== i.roomId) return fail('CONFLICT');
            return String(prior.id);
          }
          const id = randomUUID();
          await tx.query(
            sql`INSERT INTO chat.messages(id,room_id,author_id,request_id,text) VALUES(${id},${i.roomId},${a},${i.requestId},${i.text})`,
          );
          return id;
        });
        await events?.emit(changed, { id, roomId: i.roomId });
        return { ok: true };
      },
    }),
    defineOperation({
      id: 'chat.delete',
      kind: 'command',
      input: chatDeleteSchema,
      output: okSchema,
      access,
      rate: { limit: 30, windowMs: 60000 },
      handle: async (i, c) => {
        const a = c.actor!.subjectId;
        await db.transaction(async (tx) => {
          await tx.query(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${'chat:' + i.roomId},0))`,
          );
          const role = await rooms.role(a, i.roomId, tx);
          if (!role) return fail('FORBIDDEN');
          const [r] = await tx.query(
            sql`SELECT author_id FROM chat.messages WHERE id=${i.id} AND room_id=${i.roomId} FOR UPDATE`,
          );
          if (!r || (r.author_id !== a && role !== 'owner')) return fail('FORBIDDEN');
          await tx.query(sql`UPDATE chat.messages SET text='',deleted=true WHERE id=${i.id}`);
        });
        await events?.emit(deleted, i);
        return { ok: true };
      },
    }),
  ];
  return {
    ...chatDefinition,
    capabilities: ['chat.v1'],
    permissions: [
      {
        id: 'chat.member',
        description: 'Current unblocked room membership for chat',
        allows: async (a, r) => !!(await rooms.role(a.subjectId, r.id)),
      },
    ],
    flags: [{ id: 'chat.enabled', rule: { mode: deps.enabled === false ? 'disabled' : 'global' } }],
    operations: operations.map((o) => ({ ...o, flag: 'chat.enabled' })),
    http: operations.map((o) => ({
      method: o.kind === 'query' ? 'GET' : 'POST',
      path: `/api/v1/chat/${o.id.split('.')[1]}`,
      operation: o.id,
      input: o.kind === 'query' ? 'query' : 'body',
    })),
    realtime: operations.map((o) => ({
      command: o.id,
      operation: o.id,
      ...(o.kind === 'query' ? { snapshotEvent: 'chat.history' } : {}),
    })),
    events: [changed, deleted],
    start: async (c) => {
      events = c.events;
    },
  };
}
