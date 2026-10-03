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
  PresenceDirectory,
  RoomBackgroundPreview,
} from '@study/feature-sdk';
import {
  roomFieldsSchema,
  roomIdSchema,
  roomUpdateSchema,
  roomSchema,
  roomListSchema,
  roomListInputSchema,
  roomBrowseInputSchema,
  roomBrowseSchema,
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
  socialTargetSchema,
} from '@study/contracts';
import type { Room } from '@study/contracts';
import {
  roomResolveSchema,
  roomSlugUpdateSchema,
  roomSlugCheckSchema,
  roomSlugAvailabilitySchema,
  referralLandingSchema,
} from '@study/contracts';
import { inviteVault } from './invite-vault.ts';
import { referralAttribution } from './referrals.ts';
export { referralAttribution } from './referrals.ts';

export const roomsDefinition = {
  id: 'rooms',
  version: '1.0.0',
  required: true,
  dependencies: [{ id: 'identity', major: 1 }],
  persistence: { durableSchema: 'rooms' },
} as const;
export interface RoomsDependencies {
  readonly inviteKey?: string;
  readonly presence?: PresenceDirectory;
  readonly backgrounds?: RoomBackgroundPreview;
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
      const candidates = await db.query(
        sql`SELECT r.owner_id FROM rooms.memberships a JOIN rooms.memberships b ON b.room_id=a.room_id JOIN rooms.rooms r ON r.id=a.room_id WHERE a.user_id=${a} AND b.user_id=${b}`,
      );
      for (const room of candidates) {
        if (
          !(await social?.blocked(a, String(room.owner_id))) &&
          !(await social?.blocked(b, String(room.owner_id)))
        )
          return true;
      }
      return false;
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
      return {
        id: String(r.id),
        name: String(r.name),
        joinable: true,
        address: String(r.slug ?? r.public_id),
      };
    },
  };
}
const changed = { id: 'rooms.changed', schema: roomChangedSchema };
const joined = { id: 'rooms.member-joined', schema: roomChangedSchema };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function roomsModule(deps: RoomsDependencies): FeatureModule {
  const { db, fail } = deps;
  const vault = deps.inviteKey ? inviteVault(deps.inviteKey) : undefined;
  const referrals = referralAttribution(db);
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
      publicId: r.public_id,
      slug: r.slug,
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
    const result = render(r!);
    const summaries = await deps.presence?.roomSummaries?.(a.subjectId);
    return {
      ...result,
      backgroundId: (await deps.backgrounds?.preview(id)) ?? null,
      ...(summaries
        ? (summaries[id] ?? { onlineCount: 0, friendsHere: 0, friendsStudying: 0 })
        : {}),
    };
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
    ...(r.created_at ? { createdAt: (r.created_at as Date).toISOString() } : {}),
    creatorId: r.creator_id ? String(r.creator_id) : null,
    token:
      r.token_cipher &&
      !r.revoked_at &&
      (r.expires_at as Date).getTime() > Date.now() &&
      Number(r.uses) < Number(r.max_uses) &&
      vault
        ? vault.open(String(r.token_cipher), String(r.id))
        : null,
    status: r.revoked_at
      ? ('revoked' as const)
      : (r.expires_at as Date).getTime() <= Date.now()
        ? ('expired' as const)
        : Number(r.uses) >= Number(r.max_uses)
          ? ('exhausted' as const)
          : ('active' as const),
    joins: Number(r.joins ?? r.uses),
    signups: Number(r.signups ?? 0),
  });
  const operations = [
    defineOperation({
      id: 'rooms.resolve',
      kind: 'query',
      input: roomResolveSchema,
      output: roomSchema,
      access: account,
      rate,
      handle: async (i, c) => {
        const [r] = await db.query(
          sql`SELECT id FROM rooms.rooms WHERE public_id=${i.address} OR slug=${i.address} OR id::text=${i.address}`,
        );
        if (!r) return fail('FORBIDDEN');
        return read(String(r.id), actor(c));
      },
    }),
    defineOperation({
      id: 'rooms.slug-available',
      kind: 'query',
      input: roomSlugCheckSchema,
      output: roomSlugAvailabilitySchema,
      access: account,
      rate: { limit: 20, windowMs: 60000 },
      handle: async (i) => ({
        available: !(
          await db.query(
            sql`SELECT 1 FROM rooms.rooms WHERE slug=${i.slug} AND (${i.roomId ?? null}::uuid IS NULL OR id<>${i.roomId ?? null}::uuid)`,
          )
        ).length,
      }),
    }),
    defineOperation({
      id: 'rooms.slug',
      kind: 'command',
      input: roomSlugUpdateSchema,
      output: roomSchema,
      access: access('manage'),
      rate: { limit: 10, windowMs: 60000 },
      handle: async (i, c) => {
        await db.transaction(async (tx) => {
          await tx.query(sql`SELECT pg_advisory_xact_lock(730004)`);
          const r = await owned(tx, i.roomId, actor(c));
          if (r.version !== i.version) return fail('CONFLICT');
          if (
            i.slug &&
            (
              await tx.query(
                sql`SELECT 1 FROM rooms.rooms WHERE slug=${i.slug} AND id<>${i.roomId}`,
              )
            ).length
          )
            return fail('CONFLICT');
          await tx.query(
            sql`UPDATE rooms.rooms SET slug=${i.slug},version=version+1 WHERE id=${i.roomId}`,
          );
        });
        await events?.emit(changed, { roomId: i.roomId });
        return read(i.roomId, actor(c));
      },
    }),
    defineOperation({
      id: 'rooms.referral-land',
      kind: 'authentication',
      input: referralLandingSchema,
      output: okSchema,
      access: { public: true },
      rate: { limit: 20, windowMs: 60000 },
      handle: async (i) => {
        await referrals.landing(i.token, i.landingId);
        return { ok: true };
      },
    }),
    defineOperation({
      id: 'rooms.shared',
      kind: 'query',
      input: socialTargetSchema,
      output: roomListSchema,
      access: account,
      rate: { limit: 60, windowMs: 60_000 },
      handle: async (i, c) => {
        const a = actor(c);
        if (
          deps.socialEnabled === false ||
          !deps.social ||
          !(await deps.social.friends(a.subjectId, i.targetId)) ||
          (await deps.social.blocked(a.subjectId, i.targetId))
        )
          return fail('FORBIDDEN');
        const rows = await db.query(
          sql`SELECT a.room_id FROM rooms.memberships a JOIN rooms.memberships b ON a.room_id=b.room_id WHERE a.user_id=${a.subjectId} AND b.user_id=${i.targetId} ORDER BY a.last_visited_at DESC, a.room_id LIMIT 50`,
        );
        const rooms: Room[] = [];
        for (const r of rows) {
          const candidate = await row(db, String(r.room_id), a);
          if (
            !candidate ||
            (await deps.social.blocked(a.subjectId, String(candidate.owner_id))) ||
            (await deps.social.blocked(i.targetId, String(candidate.owner_id)))
          )
            continue;
          rooms.push({
            ...render(candidate),
            backgroundId: (await deps.backgrounds?.preview(String(r.room_id))) ?? null,
          });
        }
        return { rooms, nextCursor: null };
      },
    }),
    defineOperation({
      id: 'rooms.browse',
      kind: 'query',
      input: roomBrowseInputSchema,
      output: roomBrowseSchema,
      access: account,
      rate: { limit: 60, windowMs: 60_000 },
      handle: async (i, c) => {
        const a = actor(c);
        const summaries = await deps.presence?.roomSummaries?.(a.subjectId);
        const projected = JSON.stringify(summaries ?? {});
        // All eligibility and ordering are server-owned, before pagination. Presence is
        // already viewer-filtered; private occupancy and SFU rosters never reach this query.
        const rows = await db.query(sql`
          SELECT * FROM (
            SELECT r.*, m.role AS membership, m.last_visited_at,
              (SELECT count(*)::int FROM rooms.memberships mc WHERE mc.room_id=r.id) AS member_count,
              COALESCE((${projected}::jsonb -> r.id::text ->> 'onlineCount')::int,0) AS online_count,
              COALESCE((${projected}::jsonb -> r.id::text ->> 'friendsHere')::int,0) AS friends_here,
              COALESCE((${projected}::jsonb -> r.id::text ->> 'friendsStudying')::int,0) AS friends_studying
            FROM rooms.rooms r LEFT JOIN rooms.memberships m ON m.room_id=r.id AND m.user_id=${a.subjectId}
            WHERE ((${i.scope}='mine' AND m.user_id IS NOT NULL) OR (${i.scope}='discover' AND r.privacy='public'))
              AND (r.name ILIKE '%' || ${i.search} || '%' OR r.description ILIKE '%' || ${i.search} || '%' OR r.tags::text ILIKE '%' || ${i.search} || '%')
          ) candidates
          WHERE member_count >= ${Number(i.minMembers)}
            AND (${i.filter}='all' OR (${i.filter}='online' AND online_count>0) OR (${i.filter}='friends' AND friends_here>0) OR (${i.filter}='studying' AND friends_studying>0))
          ORDER BY
            CASE WHEN ${i.sort}='recommended' THEN last_visited_at END DESC NULLS LAST,
            CASE WHEN ${i.sort} IN ('recommended','friends') THEN friends_here END DESC,
            CASE WHEN ${i.sort} IN ('recommended','online') THEN online_count END DESC,
            CASE WHEN ${i.sort}='largest' THEN member_count END DESC,
            CASE WHEN ${i.sort}='smallest' THEN member_count END ASC,
            CASE WHEN ${i.sort}='visited' THEN last_visited_at END DESC NULLS LAST,
            created_at DESC, id ASC
          LIMIT 51 OFFSET ${Number(i.cursor)}
        `);
        const page = rows.slice(0, 50),
          rooms: Room[] = [];
        for (const r of page) {
          if (await deps.social?.blocked(a.subjectId, String(r.owner_id))) continue;
          rooms.push({
            ...render(r),
            backgroundId: (await deps.backgrounds?.preview(String(r.id))) ?? null,
            lastVisitedAt: r.last_visited_at ? (r.last_visited_at as Date).toISOString() : null,
            ...(summaries
              ? {
                  onlineCount: Number(r.online_count),
                  friendsHere: Number(r.friends_here),
                  friendsStudying: Number(r.friends_studying),
                }
              : {}),
          });
        }
        return { rooms, nextCursor: rows.length > 50 ? String(Number(i.cursor) + 50) : null };
      },
    }),
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
          await tx.query(sql`SELECT pg_advisory_xact_lock(730004)`);
          let publicId: string;
          do {
            publicId = randomBytes(6).toString('hex');
          } while (
            (await tx.query(sql`SELECT 1 FROM rooms.rooms WHERE public_id=${publicId}`)).length
          );
          await tx.query(
            sql`INSERT INTO rooms.rooms (id, public_id, owner_id, name, description, tags, privacy) VALUES (${id}, ${publicId}, ${a.subjectId}, ${i.name}, ${i.description}, ${JSON.stringify(i.tags)}::jsonb, ${i.privacy})`,
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
            sql`SELECT i.*, (SELECT count(*)::int FROM rooms.invite_joins j WHERE j.invite_id=i.id) AS joins, (SELECT count(*)::int FROM rooms.referral_events e JOIN rooms.referral_links l ON l.id=e.link_id WHERE l.identifier_hash=i.token_hash AND e.kind='free-signup') AS signups FROM rooms.invites i WHERE room_id = ${i.roomId} AND archived_at IS NULL ORDER BY created_at DESC LIMIT 100`,
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
        if (!vault) return fail('UNAVAILABLE');
        const created = await db.transaction(async (tx) => {
          await owned(tx, i.roomId, actor(c));
          const [count] = await tx.query(
            sql`SELECT count(*)::int AS n FROM rooms.invites WHERE room_id = ${i.roomId} AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP AND uses < max_uses`,
          );
          if (Number(count?.n) >= 100) return fail('RATE_LIMITED');
          const [r] = await tx.query(
            sql`INSERT INTO rooms.invites (id, room_id, token_hash, token_cipher, creator_id, expires_at, max_uses) VALUES (${id}, ${i.roomId}, ${digest(token)}, ${vault.seal(token, id)}, ${actor(c).subjectId}, CURRENT_TIMESTAMP + ${i.expiresInHours} * INTERVAL '1 hour', ${i.maxUses}) RETURNING *`,
          );
          await tx.query(
            sql`INSERT INTO rooms.referral_links(id,identifier_hash,kind,creator_id,source) VALUES(${randomUUID()},${digest(token)},'room-invite',${actor(c).subjectId},'room-invite')`,
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
      id: 'rooms.invite-delete',
      kind: 'command',
      input: inviteRevokeSchema,
      output: okSchema,
      access: access('manage'),
      rate,
      handle: async (i, c) => {
        await db.transaction(async (tx) => {
          await owned(tx, i.roomId, actor(c));
          const rows = await tx.query(
            sql`UPDATE rooms.invites SET archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP), token_cipher = NULL WHERE room_id = ${i.roomId} AND id = ${i.inviteId} AND revoked_at IS NOT NULL RETURNING id`,
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
          if (inserted.length) {
            await tx.query(sql`UPDATE rooms.invites SET uses = uses + 1 WHERE id = ${invite.id}`);
            await tx.query(
              sql`INSERT INTO rooms.invite_joins(invite_id,user_id) VALUES(${invite.id},${actor(c).subjectId}) ON CONFLICT DO NOTHING`,
            );
          }
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
            sql`INSERT INTO rooms.invites(id,room_id,token_hash,expires_at,max_uses,recipient_id,sender_id,creator_id) VALUES(${randomUUID()},${i.roomId},${digest(randomBytes(32).toString('base64url'))},CURRENT_TIMESTAMP+INTERVAL '24 hours',1,${i.targetId},${a},${a})`,
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
              await tx.query(
                sql`INSERT INTO rooms.invite_joins(invite_id,user_id) VALUES(${i.inviteId},${a}) ON CONFLICT DO NOTHING`,
              );
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
