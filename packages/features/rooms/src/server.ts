import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { defineOperation, sql } from '@study/feature-sdk';
import type {
  Actor,
  Database,
  EventPublisher,
  Fail,
  FeatureModule,
  OperationContext,
  SocialDirectory,
  RoomDirectory,
} from '@study/feature-sdk';
import {
  roomFieldsSchema,
  roomIdSchema,
  roomUpdateSchema,
  roomSchema,
  roomListSchema,
  roomListInputSchema,
  inviteCreateSchema,
  inviteCreatedSchema,
  inviteRedeemSchema,
  inviteRevokeSchema,
  invitesSchema,
  okSchema,
  roomChangedSchema,
  friendInviteSchema,
  friendInviteIdSchema,
  friendInvitationsSchema,
  emptySchema,
} from '@study/contracts';
import type { Room } from '@study/contracts';

export const roomsDefinition = {
  id: 'rooms',
  version: '1.0.0',
  required: true,
  dependencies: [{ id: 'identity', major: 1 }],
  persistence: { durableSchema: 'rooms' },
} as const;
export interface RoomsDependencies {
  readonly socialEnabled?: boolean;
  readonly social?: SocialDirectory;
  readonly db: Database;
  readonly accountExists: (id: string) => Promise<boolean>;
  readonly fail: Fail;
  readonly enabled?: boolean;
}
export function roomDirectory(db: Database, social?: SocialDirectory): RoomDirectory {
  return {
    async revokeInvites(a, b, tx) {
      await tx.query(
        sql`UPDATE rooms.invites SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP) WHERE (sender_id=${a} AND recipient_id=${b}) OR (sender_id=${b} AND recipient_id=${a})`,
      );
    },
    async member(userId, roomId) {
      const [r] = await db.query(
        sql`SELECT r.owner_id FROM rooms.memberships m JOIN rooms.rooms r ON r.id=m.room_id WHERE m.room_id=${roomId} AND m.user_id=${userId}`,
      );
      return !!r && !(await social?.blocked(userId, String(r.owner_id)));
    },
    async shared(a, b) {
      return (
        (
          await db.query(
            sql`SELECT 1 FROM rooms.memberships a JOIN rooms.memberships b ON b.room_id=a.room_id WHERE a.user_id=${a} AND b.user_id=${b} LIMIT 1`,
          )
        ).length > 0
      );
    },
    async current(viewer, roomId) {
      const [r] = await db.query(
        sql`SELECT r.*,m.user_id FROM rooms.rooms r LEFT JOIN rooms.memberships m ON m.room_id=r.id AND m.user_id=${viewer} WHERE r.id=${roomId}`,
      );
      if (
        !r ||
        (r.privacy !== 'public' && !r.user_id) ||
        (await social?.blocked(viewer, String(r.owner_id)))
      )
        return null;
      return { id: String(r.id), name: String(r.name), joinable: true };
    },
  };
}
const changed = { id: 'rooms.changed', schema: roomChangedSchema };
const joined = { id: 'rooms.member-joined', schema: roomChangedSchema };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function roomsModule(deps: RoomsDependencies): FeatureModule {
  const { db, fail } = deps;
  let events: EventPublisher | undefined;
  const actor = (c: OperationContext): Actor => c.actor ?? fail('UNAUTHENTICATED');
  const row = async (database: Database, id: string, a: Actor, lock = false) => {
    if (lock) await database.query(sql`SELECT id FROM rooms.rooms WHERE id = ${id} FOR UPDATE`);
    return (
      await database.query(
        sql`SELECT r.*, m.role AS membership, (SELECT count(*)::int FROM rooms.memberships mc WHERE mc.room_id = r.id) AS member_count FROM rooms.rooms r LEFT JOIN rooms.memberships m ON m.room_id = r.id AND m.user_id = ${a.subjectId} WHERE r.id = ${id}`,
      )
    )[0];
  };
  const visible = (r: Record<string, unknown> | undefined): boolean =>
    !!r && (r.privacy !== 'private' || r.membership !== null);
  const render = (r: Record<string, unknown>): Room =>
    roomSchema.parse({
      id: r.id,
      ownerId: r.owner_id,
      name: r.name,
      description: r.description,
      tags: r.tags,
      privacy: r.privacy,
      version: r.version,
      createdAt: (r.created_at as Date).toISOString(),
      membership: r.membership,
      memberCount: r.member_count,
    });
  const access = (permission: string) => ({
    permission: `rooms.${permission}`,
    resource: async (input: { roomId: string }) => ({ id: input.roomId, scopeId: input.roomId }),
  });
  const account = {
    permission: 'rooms.account',
    resource: async (_: unknown, c: OperationContext) => ({ id: actor(c).subjectId }),
  };
  const read = async (id: string, a: Actor) => {
    const r = await row(db, id, a);
    if (!visible(r) || (await deps.social?.blocked(a.subjectId, String(r!.owner_id))))
      return fail('FORBIDDEN');
    return render(r!);
  };
  const owned = async (tx: Database, id: string, a: Actor) => {
    const r = await row(tx, id, a, true);
    if (!r || r.owner_id !== a.subjectId) return fail('FORBIDDEN');
    return r;
  };
  const list = async (
    a: Actor,
    input: { cursor?: string | undefined; search: string },
    mine: boolean,
  ) => {
    const rows = await db.query(
      sql`SELECT r.*, m.role AS membership, (SELECT count(*)::int FROM rooms.memberships mc WHERE mc.room_id = r.id) AS member_count FROM rooms.rooms r LEFT JOIN rooms.memberships m ON m.room_id = r.id AND m.user_id = ${a.subjectId} WHERE ((${mine}::boolean AND m.user_id IS NOT NULL) OR (NOT ${mine}::boolean AND r.privacy = 'public')) AND (${input.cursor ?? null}::uuid IS NULL OR r.id > ${input.cursor ?? null}::uuid) AND (r.name ILIKE '%' || ${input.search} || '%' OR r.description ILIKE '%' || ${input.search} || '%') ORDER BY r.id LIMIT 51`,
    );
    const more = rows.length > 50;
    const page = rows.slice(0, 50);
    const allowed = [];
    for (const r of page)
      if (!(await deps.social?.blocked(a.subjectId, String(r.owner_id)))) allowed.push(render(r));
    return { rooms: allowed, nextCursor: more ? String(page.at(-1)!.id) : null };
  };
  const rate = { limit: 120, windowMs: 60_000 };
  const invites = (r: Record<string, unknown>) => ({
    id: String(r.id),
    expiresAt: (r.expires_at as Date).toISOString(),
    maxUses: Number(r.max_uses),
    uses: Number(r.uses),
    revoked: r.revoked_at !== null,
  });
  const operations = [
    defineOperation({
      id: 'rooms.discover',
      kind: 'query',
      input: roomListInputSchema,
      output: roomListSchema,
      access: account,
      rate,
      handle: async (i, c) => list(actor(c), i, false),
    }),
    defineOperation({
      id: 'rooms.mine',
      kind: 'query',
      input: roomListInputSchema,
      output: roomListSchema,
      access: account,
      rate,
      handle: async (i, c) => list(actor(c), i, true),
    }),
    defineOperation({
      id: 'rooms.detail',
      kind: 'query',
      input: roomIdSchema,
      output: roomSchema,
      access: access('read'),
      rate,
      handle: async (i, c) => read(i.roomId, actor(c)),
    }),
    defineOperation({
      id: 'rooms.create',
      kind: 'command',
      input: roomFieldsSchema,
      output: roomSchema,
      access: account,
      rate: { limit: 10, windowMs: 60_000 },
      handle: async (i, c) => {
        const a = actor(c),
          id = randomUUID();
        await db.transaction(async (tx) => {
          await tx.query(sql`SELECT pg_advisory_xact_lock(hashtextextended(${a.subjectId}, 1))`);
          const [count] = await tx.query(
            sql`SELECT count(*)::int AS n FROM rooms.rooms WHERE owner_id = ${a.subjectId}`,
          );
          if (Number(count?.n) >= 100) return fail('RATE_LIMITED');
          await tx.query(
            sql`INSERT INTO rooms.rooms (id, owner_id, name, description, tags, privacy) VALUES (${id}, ${a.subjectId}, ${i.name}, ${i.description}, ${JSON.stringify(i.tags)}::jsonb, ${i.privacy})`,
          );
          await tx.query(
            sql`INSERT INTO rooms.memberships (room_id, user_id, role) VALUES (${id}, ${a.subjectId}, 'owner')`,
          );
        });
        await events?.emit(changed, { roomId: id });
        return read(id, a);
      },
    }),
    defineOperation({
      id: 'rooms.update',
      kind: 'command',
      input: roomUpdateSchema,
      output: roomSchema,
      access: access('manage'),
      rate,
      handle: async (i, c) => {
        await db.transaction(async (tx) => {
          const r = await owned(tx, i.roomId, actor(c));
          if (r.version !== i.version) return fail('CONFLICT');
          await tx.query(
            sql`UPDATE rooms.rooms SET name = ${i.name}, description = ${i.description}, tags = ${JSON.stringify(i.tags)}::jsonb, privacy = ${i.privacy}, version = version + 1 WHERE id = ${i.roomId}`,
          );
          if (r.privacy !== i.privacy)
            await tx.query(
              sql`UPDATE rooms.invites SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP) WHERE room_id = ${i.roomId}`,
            );
        });
        await events?.emit(changed, { roomId: i.roomId });
        return read(i.roomId, actor(c));
      },
    }),
    defineOperation({
      id: 'rooms.join',
      kind: 'command',
      input: roomIdSchema,
      output: roomSchema,
      access: access('read'),
      rate: { limit: 30, windowMs: 60_000 },
      handle: async (i, c) => {
        const added = await db.transaction(async (tx) => {
          const r = await row(tx, i.roomId, actor(c), true);
          if (
            !visible(r) ||
            (await deps.social?.blocked(actor(c).subjectId, String(r!.owner_id), tx))
          )
            return fail('FORBIDDEN');
          const inserted = await tx.query(
            sql`INSERT INTO rooms.memberships (room_id, user_id, role) VALUES (${i.roomId}, ${actor(c).subjectId}, 'member') ON CONFLICT DO NOTHING RETURNING room_id`,
          );
          if (!inserted.length)
            await tx.query(
              sql`UPDATE rooms.memberships SET last_visited_at = CURRENT_TIMESTAMP WHERE room_id = ${i.roomId} AND user_id = ${actor(c).subjectId}`,
            );
          return inserted.length === 1;
        });
        if (added) await events?.emit(joined, { roomId: i.roomId });
        return read(i.roomId, actor(c));
      },
    }),
    defineOperation({
      id: 'rooms.invites',
      kind: 'query',
      input: roomIdSchema,
      output: invitesSchema,
      access: access('manage'),
      rate,
      handle: async (i) =>
        (
          await db.query(
            sql`SELECT id, expires_at, max_uses, uses, revoked_at FROM rooms.invites WHERE room_id = ${i.roomId} ORDER BY created_at DESC LIMIT 100`,
          )
        ).map(invites),
    }),
    defineOperation({
      id: 'rooms.invite-create',
      kind: 'command',
      input: inviteCreateSchema,
      output: inviteCreatedSchema,
      access: access('manage'),
      rate: { limit: 20, windowMs: 60_000 },
      handle: async (i, c) => {
        const token = randomBytes(32).toString('base64url'),
          id = randomUUID();
        const created = await db.transaction(async (tx) => {
          await owned(tx, i.roomId, actor(c));
          const [count] = await tx.query(
            sql`SELECT count(*)::int AS n FROM rooms.invites WHERE room_id = ${i.roomId} AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP AND uses < max_uses`,
          );
          if (Number(count?.n) >= 100) return fail('RATE_LIMITED');
          const [r] = await tx.query(
            sql`INSERT INTO rooms.invites (id, room_id, token_hash, expires_at, max_uses) VALUES (${id}, ${i.roomId}, ${digest(token)}, CURRENT_TIMESTAMP + ${i.expiresInHours} * INTERVAL '1 hour', ${i.maxUses}) RETURNING id, expires_at, max_uses, uses, revoked_at`,
          );
          return invites(r!);
        });
        return { ...created, token };
      },
    }),
    defineOperation({
      id: 'rooms.invite-revoke',
      kind: 'command',
      input: inviteRevokeSchema,
      output: okSchema,
      access: access('manage'),
      rate,
      handle: async (i, c) => {
        await db.transaction(async (tx) => {
          await owned(tx, i.roomId, actor(c));
          const rows = await tx.query(
            sql`UPDATE rooms.invites SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP) WHERE room_id = ${i.roomId} AND id = ${i.inviteId} RETURNING id`,
          );
          if (!rows.length) return fail('FORBIDDEN');
        });
        return { ok: true };
      },
    }),
    defineOperation({
      id: 'rooms.invite-redeem',
      kind: 'command',
      input: inviteRedeemSchema,
      output: roomSchema,
      access: account,
      rate: { limit: 20, windowMs: 60_000 },
      handle: async (i, c) => {
        const result = await db.transaction(async (tx) => {
          const [hint] = await tx.query(
            sql`SELECT room_id FROM rooms.invites WHERE token_hash = ${digest(i.token)}`,
          );
          if (!hint) return fail('FORBIDDEN');
          const id = String(hint.room_id);
          const room = await row(tx, id, actor(c), true);
          if (!room || (await deps.social?.blocked(actor(c).subjectId, String(room.owner_id), tx)))
            return fail('FORBIDDEN');
          const [invite] = await tx.query(
            sql`SELECT * FROM rooms.invites WHERE token_hash = ${digest(i.token)} AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP AND uses < max_uses FOR UPDATE`,
          );
          if (!invite || (invite.recipient_id && invite.recipient_id !== actor(c).subjectId))
            return fail('FORBIDDEN');
          if (
            invite.recipient_id &&
            (!deps.social ||
              !(await deps.social.friends(String(invite.sender_id), actor(c).subjectId, tx)) ||
              !(await deps.social.privacy(actor(c).subjectId, tx)).invites)
          )
            return fail('FORBIDDEN');
          const inserted = await tx.query(
            sql`INSERT INTO rooms.memberships (room_id, user_id, role) VALUES (${id}, ${actor(c).subjectId}, 'member') ON CONFLICT DO NOTHING RETURNING room_id`,
          );
          if (inserted.length)
            await tx.query(sql`UPDATE rooms.invites SET uses = uses + 1 WHERE id = ${invite.id}`);
          return { roomId: id, added: inserted.length === 1 };
        });
        if (result.added) await events?.emit(joined, { roomId: result.roomId });
        return read(result.roomId, actor(c));
      },
    }),
  ];
  operations.push(
    defineOperation({
      id: 'rooms.friend-invite',
      kind: 'command',
      input: friendInviteSchema,
      output: okSchema,
      access: access('manage'),
      rate: { limit: 10, windowMs: 60000 },
      handle: async (i, c) => {
        const a = actor(c).subjectId;
        await db.transaction(async (tx) => {
          await tx.query(sql`SELECT pg_advisory_xact_lock(730003)`);
          await owned(tx, i.roomId, actor(c));
          if (
            !deps.social ||
            a === i.targetId ||
            (await deps.social.blocked(a, i.targetId, tx)) ||
            !(await deps.social.friends(a, i.targetId, tx)) ||
            !(await deps.social.privacy(i.targetId, tx)).invites
          )
            return fail('FORBIDDEN');
          const [count] = await tx.query(
            sql`SELECT count(*)::int AS n FROM rooms.invites WHERE recipient_id=${i.targetId} AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP AND uses<max_uses`,
          );
          if (Number(count?.n) >= 100) return fail('RATE_LIMITED');
          if (
            (
              await tx.query(
                sql`SELECT 1 FROM rooms.invites WHERE room_id=${i.roomId} AND recipient_id=${i.targetId} AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP AND uses<max_uses`,
              )
            ).length
          )
            return fail('CONFLICT');
          await tx.query(
            sql`INSERT INTO rooms.invites(id,room_id,token_hash,expires_at,max_uses,recipient_id,sender_id) VALUES(${randomUUID()},${i.roomId},${digest(randomBytes(32).toString('base64url'))},CURRENT_TIMESTAMP+INTERVAL '24 hours',1,${i.targetId},${a})`,
          );
        });
        return { ok: true };
      },
    }),
    defineOperation({
      id: 'rooms.friend-invitations',
      kind: 'query',
      input: emptySchema,
      output: friendInvitationsSchema,
      access: account,
      rate: { limit: 600, windowMs: 60000 },
      handle: async (_, c) => {
        const a = actor(c).subjectId,
          result = [];
        if (!deps.social || !(await deps.social.privacy(a)).invites) return [];
        const rows = await db.query(
          sql`SELECT i.*,r.name FROM rooms.invites i JOIN rooms.rooms r ON r.id=i.room_id WHERE i.recipient_id=${a} AND i.revoked_at IS NULL AND i.expires_at>CURRENT_TIMESTAMP AND i.uses<i.max_uses ORDER BY i.created_at DESC LIMIT 100`,
        );
        for (const r of rows)
          if (
            !(await deps.social.blocked(a, String(r.sender_id))) &&
            (await deps.social.friends(a, String(r.sender_id)))
          )
            result.push({
              id: String(r.id),
              roomId: String(r.room_id),
              roomName: String(r.name),
              senderId: String(r.sender_id),
              expiresAt: (r.expires_at as Date).toISOString(),
            });
        return result;
      },
    }),
    ...(['accept', 'decline'] as const).map((action) =>
      defineOperation({
        id: `rooms.friend-invite-${action}`,
        kind: 'command',
        input: friendInviteIdSchema,
        output: okSchema,
        access: account,
        rate: { limit: 20, windowMs: 60000 },
        handle: async (i, c) => {
          const a = actor(c).subjectId;
          await db.transaction(async (tx) => {
            await tx.query(sql`SELECT pg_advisory_xact_lock(730003)`);
            const [hint] = await tx.query(
              sql`SELECT room_id FROM rooms.invites WHERE id=${i.inviteId} AND recipient_id=${a}`,
            );
            if (!hint) return fail('FORBIDDEN');
            const r = await row(tx, String(hint.room_id), actor(c), true);
            if (!r) return fail('FORBIDDEN');
            const [invite] = await tx.query(
              sql`SELECT * FROM rooms.invites WHERE id=${i.inviteId} AND recipient_id=${a} AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP AND uses<max_uses FOR UPDATE`,
            );
            if (
              !invite ||
              !deps.social ||
              (await deps.social.blocked(a, String(invite.sender_id), tx)) ||
              !(await deps.social.friends(a, String(invite.sender_id), tx)) ||
              !(await deps.social.privacy(a, tx)).invites
            )
              return fail('FORBIDDEN');
            if (action === 'accept') {
              await tx.query(
                sql`INSERT INTO rooms.memberships(room_id,user_id,role) VALUES(${invite.room_id},${a},'member') ON CONFLICT DO NOTHING`,
              );
              await tx.query(sql`UPDATE rooms.invites SET uses=1 WHERE id=${i.inviteId}`);
            } else
              await tx.query(
                sql`UPDATE rooms.invites SET revoked_at=CURRENT_TIMESTAMP WHERE id=${i.inviteId}`,
              );
          });
          return { ok: true };
        },
      }),
    ),
  );
  return {
    ...roomsDefinition,
    capabilities: ['rooms.v1'],
    permissions: [
      {
        id: 'rooms.account',
        description: 'Use rooms as the current account',
        allows: async (a, r) => r.id === a.subjectId && deps.accountExists(a.subjectId),
      },
      {
        id: 'rooms.read',
        description: 'Read/join a policy-accessible room',
        allows: async (a, r) =>
          (await deps.accountExists(a.subjectId)) && visible(await row(db, r.id, a)),
      },
      {
        id: 'rooms.manage',
        description: 'Owner manages permanent settings and invites',
        allows: async (a, r) => (await row(db, r.id, a))?.owner_id === a.subjectId,
      },
    ],
    flags: [
      { id: 'rooms.enabled', rule: { mode: deps.enabled === false ? 'disabled' : 'global' } },
      {
        id: 'rooms.social-enabled',
        rule: {
          mode: deps.enabled === false || deps.socialEnabled === false ? 'disabled' : 'global',
        },
      },
    ],
    operations: operations.map((op) => ({
      ...op,
      flag: op.id.startsWith('rooms.friend-') ? 'rooms.social-enabled' : 'rooms.enabled',
    })),
    http: operations.map((op) => ({
      method: op.kind === 'query' ? 'GET' : 'POST',
      path: `/api/v1/rooms/${op.id.slice('rooms.'.length)}`,
      operation: op.id,
      input: op.kind === 'query' ? 'query' : 'body',
    })),
    events: [changed, joined],
    realtime: [
      {
        command: 'rooms.friend-invitations',
        operation: 'rooms.friend-invitations',
        snapshotEvent: 'rooms.friend-invitations',
      },
    ],
    start: async (c) => {
      events = c.events;
    },
  };
}

/** Public transactional policy port. Feature callers never inspect Rooms tables. */
export function productivityRooms(
  db: Database,
  social: SocialDirectory,
): import('@study/feature-sdk').ProductivityRooms {
  return {
    async role(userId, roomId, tx) {
      const database = tx ?? db;
      if (tx) {
        await database.query(sql`SELECT pg_advisory_xact_lock(730003)`);
        await database.query(sql`SELECT id FROM rooms.rooms WHERE id=${roomId} FOR SHARE`);
        await database.query(
          sql`SELECT user_id FROM rooms.memberships WHERE room_id=${roomId} AND user_id=${userId} FOR SHARE`,
        );
      }
      const [r] = await database.query(
        sql`SELECT r.owner_id,m.role FROM rooms.rooms r JOIN rooms.memberships m ON m.room_id=r.id WHERE r.id=${roomId} AND m.user_id=${userId}`,
      );
      if (!r || (await social.blocked(userId, String(r.owner_id), database))) return null;
      return r.owner_id === userId ? 'owner' : r.role === 'moderator' ? 'moderator' : 'member';
    },
  };
}
