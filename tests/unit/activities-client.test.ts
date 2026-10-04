import { expect, it, vi } from 'vitest';
import { EventBus } from '@study/core/browser';
import { breakStartedSchema } from '@study/contracts';
import type { ActivityView } from '@study/contracts';
import type { RealtimeClient } from '../../apps/web/app/lib/realtime.ts';
import { createActivitiesModel } from '../../apps/web/app/room/activities-model.ts';
import { activityHarness } from '../fixtures/activity-runtime.ts';
vi.mock('@study/adapters/indexeddb', () => ({
  createPreferenceStore: async () => ({
    mode: 'indexeddb',
    get: async (definition: { defaultValue: unknown }) => structuredClone(definition.defaultValue),
    set: async () => {},
    close: async () => {},
  }),
}));
function client(
  h: Awaited<ReturnType<typeof activityHarness>>,
  actor: string,
  initial: ActivityView,
) {
  const sent: string[] = [];
  const realtime: RealtimeClient = {
    state: { connected: true, errors: {} },
    send: async (operation, payload) => {
      sent.push(operation);
      return operation === 'activities.clock'
        ? { serverNow: Date.now() }
        : h.call(operation.split('.')[1]!, actor, payload);
    },
    subscribe: (_operation, _payload, receive) => {
      receive(initial);
      return () => {};
    },
    refresh: () => {},
    start: () => {},
    stop: () => {},
  };
  const events = new EventBus();
  events.register('timer.break.started', { id: 'timer.break.started', schema: breakStartedSchema });
  const model = createActivitiesModel(h.roomId, actor, realtime, events, {
    enable: async () => {},
    effect: () => {},
  });
  return { model, sent };
}
it('a client with an old lobby projection can spectate after another participant joins', async () => {
  const h = await activityHarness();
  let model: ReturnType<typeof createActivitiesModel> | undefined;
  try {
    const offer = await h.start();
    const c = client(h, h.spectator, await h.snapshot(h.spectator));
    model = c.model;
    await h.action(offer, h.member, 'join');
    expect(await model.member('spectate')).toBe(true);
    expect((await h.snapshot(h.spectator)).activity?.myMode).toBe('spectator');
  } finally {
    model?.dispose();
    await h.close();
  }
});
it('a guess from an old client round cannot be silently submitted into the next round', async () => {
  const h = await activityHarness();
  let model: ReturnType<typeof createActivitiesModel> | undefined;
  try {
    let v = await h.call('start', h.owner, {
      roomId: h.roomId,
      kind: 'letter-lantern',
      requestId: crypto.randomUUID(),
      options: { rounds: 2, seconds: 30, friendsOnly: false },
    });
    v = await h.action(v, h.owner, 'begin');
    const c = client(h, h.owner, v);
    model = c.model;
    h.advance(30001);
    await h.occupancy([h.owner]);
    h.advance(3001);
    await h.occupancy([h.owner]);
    expect((await h.snapshot()).activity?.round).toBe(2);
    expect(await model.play({ type: 'guess', guess: 'ZZZZZ' })).toBe(false);
    expect(c.sent).not.toContain('activities.play');
    expect(model.state.error).toContain('Activity changed');
    const view = await h.snapshot();
    expect(view.activity?.data.type === 'word' && view.activity.data.guesses).toEqual([]);
  } finally {
    model?.dispose();
    await h.close();
  }
});
