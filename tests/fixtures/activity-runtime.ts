import { randomUUID } from 'node:crypto';
import { ModuleRuntime, AppError } from '@study/core/server';
import { activitiesModule } from '@study/activities/server';
import { roomOccupancyEventSchema } from '@study/contracts';
import type { ActivityView } from '@study/contracts';
import type { Database, OperationContext, ActivityDefinition } from '@study/feature-sdk';
import { MemoryLimiter } from './memory.ts';
export async function activityHarness(enabled = true, definitions?: ActivityDefinition[]) {
  const owner = randomUUID(),
    member = randomUUID(),
    other = randomUUID(),
    spectator = randomUUID(),
    outsider = randomUUID(),
    roomId = randomUUID(),
    wrongRoom = randomUUID();
  const roles = new Map<string, 'owner' | 'member' | 'moderator'>([
    [owner, 'owner'],
    [member, 'member'],
    [other, 'member'],
    [spectator, 'member'],
  ]);
  let occupants = [...roles.keys()],
    time = 100000;
  const blocks = new Set<string>();
  const unfriends = new Set<string>();
  let config: unknown = null;
  const db: Database = {
    query: async (statement) => {
      if (statement.text.startsWith('SELECT settings'))
        return config ? ([{ settings: config }] as never[]) : [];
      if (statement.text.startsWith('INSERT INTO activities.settings')) {
        config = JSON.parse(String(statement.values[1]));
        return [];
      }
      throw new Error('Unexpected database access');
    },
    transaction: async (work) => work(db),
  };
  const module = activitiesModule({
    db,
    rooms: { role: async (id, room) => (room === roomId ? (roles.get(id) ?? null) : null) },
    occupancy: { members: async () => occupants },
    social: {
      blocked: async (a, b) => blocks.has([a, b].sort().join(':')),
      friends: async (a, b) => !unfriends.has([a, b].sort().join(':')),
      privacy: async () => ({}) as never,
    },
    people: { person: async (id) => ({ id, name: id === owner ? 'Owner' : 'Member' }) },
    fail: (code) => {
      throw new AppError(code);
    },
    now: () => time,
    enabled,
    ...(definitions ? { definitions } : {}),
  });
  const runtime = new ModuleRuntime(new MemoryLimiter(), 'test');
  await runtime.start([
    {
      id: 'presence',
      version: '1.0.0',
      events: [{ id: 'presence.room-occupancy', schema: roomOccupancyEventSchema }],
    },
    module,
  ]);
  const context = (actor: string | null): OperationContext => ({
    actor: actor ? { subjectId: actor, sessionId: actor } : null,
    requestId: randomUUID(),
    signal: new AbortController().signal,
  });
  const call = (name: string, actor: string | null, input: unknown) =>
    runtime.operations.execute(
      'activities.' + name,
      input,
      context(actor),
    ) as Promise<ActivityView>;
  const snapshot = (actor = owner) => call('snapshot', actor, { roomId });
  const revision = (v: ActivityView) => ({
    roomId,
    activityId: v.activity!.id,
    version: v.activity!.version,
    round: v.activity!.round,
    requestId: randomUUID(),
  });
  const action = (v: ActivityView, actor: string, action: string) =>
    call('member', actor, { ...revision(v), action });
  const play = (v: ActivityView, actor: string, action: unknown) =>
    call('play', actor, { ...revision(v), action });
  const start = (kind = 'letter-lantern') =>
    call('start', owner, {
      roomId,
      kind,
      requestId: randomUUID(),
      options: { rounds: 1, seconds: 30, friendsOnly: false },
    });
  async function occupancy(ids: string[]) {
    occupants = ids;
    await runtime.events.emit(
      { id: 'presence.room-occupancy', schema: roomOccupancyEventSchema },
      { roomId, members: ids },
    );
  }
  return {
    owner,
    member,
    other,
    spectator,
    outsider,
    roomId,
    wrongRoom,
    roles,
    blocks,
    unfriends,
    module,
    runtime,
    call,
    snapshot,
    revision,
    action,
    play,
    start,
    occupancy,
    advance(ms: number) {
      time += ms;
    },
    close: () => runtime.stop(),
  };
}
