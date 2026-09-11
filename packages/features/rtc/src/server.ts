import {
  mediaJoinSchema,
  mediaAudienceSchema,
  mediaLeaseSchema,
  mediaCredentialSchema,
  okSchema,
} from '@study/contracts';
import { defineOperation } from '@study/feature-sdk';
import type {
  Actor,
  Fail,
  FeatureModule,
  MediaAuthority,
  PeopleDirectory,
  ProductivityRooms,
  SessionStore,
} from '@study/feature-sdk';

/** Ephemeral connection leases; no account-global publish boolean or client authority fields. */
export function rtcModule(deps: {
  authority: MediaAuthority;
  rooms: ProductivityRooms;
  sessions: SessionStore;
  enabled: boolean;
  people?: PeopleDirectory;
  blocked?: (a: string, b: string) => Promise<boolean>;
  fail: Fail;
  uuid: () => string;
  now?: () => number;
}): FeatureModule {
  const now = deps.now ?? Date.now;
  const leases = new Map<string, { actor: Actor; roomId: string; until: number }>();
  let timer: ReturnType<typeof setInterval> | undefined,
    sweeping = false;
  const enforced = () => deps.authority.enforcement.scopedGrants === true;
  const retired = new Map<string, { roomId: string; until: number }>();
  async function conflict(actor: Actor, roomId: string) {
    for (const lease of leases.values())
      if (lease.roomId === roomId && (await deps.blocked?.(actor.subjectId, lease.actor.subjectId)))
        return true;
    return false;
  }
  async function retire(id: string, roomId: string) {
    leases.delete(id);
    // Self-hosted refreshed tokens are not invalidated by RemoveParticipant.
    // Re-remove replayed identities throughout their documented reconnect lifetime.
    if (!deps.authority.reconcile) retired.set(id, { roomId, until: now() + 15 * 60_000 });
    await deps.authority.remove(roomId, id);
  }
  async function valid(actor: Actor, roomId: string) {
    const s = await deps.sessions.findById(actor.sessionId);
    return (
      !!s &&
      s.subjectId === actor.subjectId &&
      s.revokedAt === null &&
      s.expiresAt > now() &&
      s.idleExpiresAt > now() &&
      !!(await deps.rooms.role(actor.subjectId, roomId)) &&
      !(await conflict(actor, roomId))
    );
  }
  async function sweep() {
    if (sweeping) return;
    sweeping = true;
    try {
      const invalid: [string, string][] = [];
      for (const [id, lease] of leases) {
        let allowed = false;
        try {
          allowed =
            deps.enabled &&
            enforced() &&
            lease.until > now() &&
            (await valid(lease.actor, lease.roomId));
        } catch {
          /* deny on unavailable authority */
        }
        if (!allowed) invalid.push([id, lease.roomId]);
      }
      for (const [id, roomId] of invalid) await retire(id, roomId).catch(() => {});
      await deps.authority
        .reconcile?.((roomId, id) => {
          const lease = leases.get(id);
          return deps.enabled && !!lease && lease.roomId === roomId && lease.until > now();
        })
        .catch(() => {});
      const rooms = new Map<string, Set<string>>();
      for (const [id, item] of retired) {
        try {
          if (deps.authority.participants) {
            if (!rooms.has(item.roomId))
              rooms.set(
                item.roomId,
                new Set(
                  (await deps.authority.participants(item.roomId)).map((p) => p.connectionId),
                ),
              );
            if (rooms.get(item.roomId)!.has(id)) {
              item.until = now() + 15 * 60_000;
              await deps.authority.remove(item.roomId, id);
            } else if (item.until <= now()) retired.delete(id);
          } else if (item.until <= now()) retired.delete(id);
          else await deps.authority.remove(item.roomId, id);
        } catch {
          /* Keep tombstone across provider failures; never let an observed replay age out. */
        }
      }
    } finally {
      sweeping = false;
    }
  }
  const access = {
    permission: 'rtc.member',
    resource: async (i: { roomId: string }) => ({ id: i.roomId, scopeId: i.roomId }),
  };
  const operations = [
    defineOperation({
      id: 'rtc.audience',
      kind: 'query',
      input: mediaJoinSchema,
      output: mediaAudienceSchema,
      access,
      rate: { limit: 180, windowMs: 60000 },
      handle: async (i, c) => {
        if (!(await valid(c.actor!, i.roomId))) return deps.fail('FORBIDDEN');
        const result = [];
        for (const p of (await deps.authority.participants?.(i.roomId)) ?? []) {
          const l = leases.get(p.connectionId);
          if (
            !l ||
            l.roomId !== i.roomId ||
            l.until <= now() ||
            !p.publishing ||
            !(await valid(l.actor, i.roomId))
          )
            continue;
          if (await deps.blocked?.(c.actor!.subjectId, l.actor.subjectId)) continue;
          const person = await deps.people?.person(l.actor.subjectId);
          if (person)
            result.push({ connectionId: p.connectionId, userId: person.id, name: person.name });
        }
        // Recheck after provider/directory IO, including concurrent revocation.
        if (!(await valid(c.actor!, i.roomId))) return deps.fail('FORBIDDEN');
        return result.slice(0, 200);
      },
    }),
    defineOperation({
      id: 'rtc.join',
      kind: 'command',
      input: mediaJoinSchema,
      output: mediaCredentialSchema,
      access,
      rate: { limit: 12, windowMs: 60000 },
      handle: async (i, c) => {
        if (!enforced()) return deps.fail('UNAVAILABLE');
        if (!(await valid(c.actor!, i.roomId))) return deps.fail('FORBIDDEN');
        if (
          [...leases.values()].filter((l) => l.actor.sessionId === c.actor!.sessionId).length >= 4
        )
          return deps.fail('CONFLICT');
        const connectionId = deps.uuid(),
          expiresAt = now() + 60_000;
        leases.set(connectionId, { actor: c.actor!, roomId: i.roomId, until: now() + 30_000 });
        try {
          const credential = await deps.authority.issue({
            actor: c.actor!,
            roomId: i.roomId,
            connectionId,
            expiresAt,
            sources: ['microphone', 'camera', 'screen'],
          });
          if (c.signal.aborted || !(await valid(c.actor!, i.roomId))) {
            await deps.authority.remove(i.roomId, connectionId);
            return deps.fail('FORBIDDEN');
          }
          return credential;
        } catch (error) {
          await retire(connectionId, i.roomId).catch(() => {});
          throw error;
        }
      },
    }),
    defineOperation({
      id: 'rtc.renew',
      kind: 'command',
      input: mediaLeaseSchema,
      output: okSchema,
      access,
      rate: { limit: 120, windowMs: 60000 },
      handle: async (i, c) => {
        const l = leases.get(i.connectionId);
        if (
          !l ||
          l.roomId !== i.roomId ||
          l.actor.sessionId !== c.actor!.sessionId ||
          l.actor.subjectId !== c.actor!.subjectId ||
          l.until <= now() ||
          !enforced() ||
          !(await valid(c.actor!, i.roomId))
        )
          return deps.fail('FORBIDDEN');
        l.until = now() + 30_000;
        return { ok: true as const };
      },
    }),
    defineOperation({
      id: 'rtc.leave',
      kind: 'command',
      input: mediaLeaseSchema,
      output: okSchema,
      access,
      rate: { limit: 30, windowMs: 60000 },
      handle: async (i, c) => {
        const l = leases.get(i.connectionId);
        if (!l || l.roomId !== i.roomId || l.actor.sessionId !== c.actor!.sessionId)
          return deps.fail('FORBIDDEN');
        await retire(i.connectionId, i.roomId);
        return { ok: true as const };
      },
    }),
  ];
  return {
    id: 'rtc',
    version: '1.0.0',
    required: true,
    capabilities: ['rtc.v1'],
    permissions: [
      {
        id: 'rtc.member',
        description: 'Current authenticated room member',
        allows: (a, r) => valid(a, r.id),
      },
    ],
    flags: [{ id: 'rtc.enabled', rule: { mode: deps.enabled ? 'global' : 'disabled' } }],
    operations: operations.map((o) => ({ ...o, flag: 'rtc.enabled' })),
    http: operations.map((o) => ({
      method: 'POST',
      path: `/api/v1/rtc/${o.id.split('.')[1]}`,
      input: 'body',
      operation: o.id,
    })),
    start: async () => {
      await deps.authority.reset?.();
      timer = setInterval(() => {
        void sweep();
      }, 2000);
    },
    stop: async () => {
      clearInterval(timer);
      await Promise.allSettled([...leases].map(([id, l]) => deps.authority.remove(l.roomId, id)));
      leases.clear();
    },
  };
}
