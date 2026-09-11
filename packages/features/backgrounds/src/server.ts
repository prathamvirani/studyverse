import { defineOperation, sql } from '@study/feature-sdk';
import type { Database, Fail, FeatureModule, ProductivityRooms } from '@study/feature-sdk';
import {
  backgroundRoomSchema,
  backgroundStateSchema,
  backgroundViewSchema,
  backgroundChangeSchema,
} from '@study/contracts';
import { curatedProvider, defaultBackground } from './browser.ts';
export const backgroundsDefinition = {
  id: 'backgrounds',
  version: '1.0.0',
  persistence: { durableSchema: 'backgrounds' },
} as const;
export function backgroundsModule(deps: {
  db: Database;
  rooms: ProductivityRooms;
  fail: Fail;
  enabled?: boolean;
}): FeatureModule {
  const { db, rooms, fail } = deps;
  const read = async (roomId: string, tx = db) => {
    const [row] = await tx.query(
      sql`SELECT asset_id,version FROM backgrounds.room_defaults WHERE room_id=${roomId}`,
    );
    return backgroundStateSchema.parse({
      roomId,
      assetId: row?.asset_id ?? defaultBackground,
      version: row?.version ?? 0,
    });
  };
  const access = {
    permission: 'backgrounds.member',
    resource: async (i: { roomId: string }) => ({ id: i.roomId, scopeId: i.roomId }),
  };
  const operations = [
    defineOperation({
      id: 'backgrounds.snapshot',
      kind: 'query',
      input: backgroundRoomSchema,
      output: backgroundViewSchema,
      access,
      rate: { limit: 600, windowMs: 60000 },
      handle: async (i, c) => ({
        state: await read(i.roomId),
        canControl: (await rooms.role(c.actor!.subjectId, i.roomId)) === 'owner',
      }),
    }),
    defineOperation({
      id: 'backgrounds.change',
      kind: 'command',
      input: backgroundChangeSchema,
      output: backgroundViewSchema,
      access: { ...access, permission: 'backgrounds.change' },
      rate: { limit: 30, windowMs: 60000 },
      handle: async (i, c) => {
        if (!curatedProvider.assets().some((a) => a.id === i.assetId))
          return fail('INVALID_REQUEST');
        const state = await db.transaction(async (tx) => {
          await tx.query(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${'background:' + i.roomId},0))`,
          );
          if ((await rooms.role(c.actor!.subjectId, i.roomId, tx)) !== 'owner')
            return fail('FORBIDDEN');
          const previous = await read(i.roomId, tx);
          if (previous.version !== i.version) return fail('CONFLICT');
          const next = { ...i, version: i.version + 1 };
          await tx.query(
            sql`INSERT INTO backgrounds.room_defaults(room_id,asset_id,version) VALUES(${i.roomId},${i.assetId},${next.version}) ON CONFLICT(room_id) DO UPDATE SET asset_id=EXCLUDED.asset_id,version=EXCLUDED.version`,
          );
          return next;
        });
        return { state, canControl: true };
      },
    }),
  ];
  return {
    ...backgroundsDefinition,
    capabilities: ['backgrounds.v1'],
    permissions: [
      {
        id: 'backgrounds.member',
        description: 'Current room members read the visual default',
        allows: async (a, r) => !!(await rooms.role(a.subjectId, r.id)),
      },
      {
        id: 'backgrounds.change',
        description: 'Only the room owner changes the durable visual default',
        allows: async (a, r) => (await rooms.role(a.subjectId, r.id)) === 'owner',
      },
    ],
    flags: [
      { id: 'backgrounds.enabled', rule: { mode: deps.enabled === false ? 'disabled' : 'global' } },
    ],
    operations: operations.map((o) => ({ ...o, flag: 'backgrounds.enabled' })),
    http: operations.map((o) => ({
      method: o.kind === 'query' ? 'GET' : 'POST',
      path: `/api/v1/backgrounds/${o.id.split('.')[1]}`,
      operation: o.id,
      input: o.kind === 'query' ? 'query' : 'body',
    })),
    realtime: [
      {
        command: 'backgrounds.snapshot',
        operation: 'backgrounds.snapshot',
        snapshotEvent: 'backgrounds.snapshot',
      },
      { command: 'backgrounds.change', operation: 'backgrounds.change' },
    ],
  };
}
