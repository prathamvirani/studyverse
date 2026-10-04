import { describe, expect, it } from 'vitest';
import { ActivityRegistry, activityPreference, shouldSuggest } from '@study/activities/browser';
import { mayStartActivity } from '@study/activities/server';
import {
  evaluateWord,
  normalizeWord,
  normalizeDrawingGuess,
} from '../../packages/features/activities/src/words.ts';
import { boundedStrokes } from '../../packages/features/activities/src/drawing.ts';
import { letterLantern } from '../../packages/features/activities/src/word.ts';
import { sketchCircle } from '../../packages/features/activities/src/drawing.ts';
import { activityActionSchema, activityPlaySchema, drawingStrokeSchema } from '@study/contracts';
import { createBreakObserver, initialTimer } from '@study/pomodoro/browser';
import { activityHarness } from '../fixtures/activity-runtime.ts';
describe('original content and generic extension contracts', () => {
  it('registers both rules and an independent future definition; rejects collisions', () => {
    const registry = new ActivityRegistry();
    registry.register(letterLantern);
    registry.register(sketchCircle);
    registry.register({ ...letterLantern, id: 'future-puzzle', name: 'Future' });
    expect(registry.catalog().map((d) => d.id)).toEqual([
      'letter-lantern',
      'sketch-circle',
      'future-puzzle',
    ]);
    expect(() => registry.register(letterLantern)).toThrow();
  });
  it('normalizes ASCII casing and surrounding whitespace, rejects Unicode/charset/length', () => {
    expect(normalizeWord(' apple ')).toBe('APPLE');
    for (const raw of ['app', 'apples', 'ＡＰＰＬＥ', 'applé', 'a p l', '1pple', 'x'.repeat(10000)])
      expect(() => normalizeWord(raw)).toThrow();
    expect(normalizeDrawingGuess(' RED   APPLE ')).toBe('red apple');
    expect(() => normalizeDrawingGuess('<svg>')).toThrow();
  });
  it.each([
    ['APPLE', 'APPLE', ['exact', 'exact', 'exact', 'exact', 'exact']],
    ['APPLE', 'PLEAP', ['near', 'near', 'near', 'near', 'near']],
    ['APPLE', 'ALLEY', ['exact', 'near', 'absent', 'near', 'absent']],
    ['SHEEP', 'EEEEE', ['absent', 'absent', 'exact', 'exact', 'absent']],
    ['BLOOM', 'OOOOO', ['absent', 'absent', 'exact', 'exact', 'absent']],
  ])('evaluates %s vs %s without duplicate over-credit', (answer, guess, result) =>
    expect(evaluateWord(answer, guess)).toEqual(result),
  );
  it('permissions respect permanent and owner-absent policies', () => {
    expect(mayStartActivity({ start: 'owner', ownerAbsent: 'preserve' }, 'member', false)).toBe(
      false,
    );
    expect(mayStartActivity({ start: 'owner', ownerAbsent: 'everyone' }, 'member', false)).toBe(
      true,
    );
    expect(
      mayStartActivity({ start: 'moderators', ownerAbsent: 'preserve' }, 'moderator', true),
    ).toBe(true);
    expect(
      mayStartActivity({ start: 'suggestions', ownerAbsent: 'preserve' }, 'member', true),
    ).toBe(false);
  });
  it('suggestion/mixer preferences are local, muted by default and bounded', () => {
    const pref = activityPreference('device');
    expect(pref.defaultValue.muted).toBe(true);
    expect(pref.schema.safeParse({ suggestions: true, volume: 2, muted: false }).success).toBe(
      false,
    );
    expect(shouldSuggest({ suggestions: false }, 'new', null)).toBe(false);
    expect(shouldSuggest({ suggestions: true }, 'seen', 'seen')).toBe(false);
    expect(shouldSuggest({ suggestions: true }, 'new', 'old')).toBe(true);
  });
  it('generic timer event emits on break, including manual skip, without first-snapshot auto-start', () => {
    const events: string[] = [],
      observe = createBreakObserver((value) => events.push(value)),
      timer = initialTimer(crypto.randomUUID(), 0);
    observe(timer, 0);
    observe({ ...timer, running: true }, 1500001);
    expect(events).toHaveLength(1);
    observe({ ...timer, running: true }, 1500100);
    expect(events).toHaveLength(1);
    observe(null, 0);
    observe({ ...timer, phase: 'shortBreak' }, 0);
    expect(events).toHaveLength(1);
    observe(timer, 0);
    observe({ ...timer, version: 1, phase: 'shortBreak' }, 0);
    expect(events).toHaveLength(2);
  });
});
describe('drawing bounds', () => {
  const stroke = { color: 'ink' as const, width: 4, points: [{ x: 0.5, y: 0.5 }] };
  it('bounds coordinates, tools, widths, point count and batch count', () => {
    for (const invalid of [
      { ...stroke, points: [{ x: NaN, y: 0 }] },
      { ...stroke, points: [{ x: Infinity, y: 0 }] },
      { ...stroke, points: [{ x: -0.1, y: 1 }] },
      { ...stroke, points: [{ x: 1, y: 1.01 }] },
      { ...stroke, points: Array(65).fill({ x: 0, y: 0 }) },
      { ...stroke, width: 13 },
      { ...stroke, color: 'url(javascript:)' },
    ])
      expect(drawingStrokeSchema.safeParse(invalid).success).toBe(false);
    expect(
      activityActionSchema.safeParse({ type: 'stroke', strokes: Array(5).fill(stroke) }).success,
    ).toBe(false);
    expect(() => boundedStrokes([stroke])).not.toThrow();
  });
  it('rejects excessive serialized payload even with valid numeric point schemas', () => {
    const precise = {
      ...stroke,
      points: Array(64).fill({ x: 0.12345678912345678, y: 0.9876543219876543 }),
    };
    expect(() => boundedStrokes(Array(4).fill(precise))).toThrow('INVALID_REQUEST');
  });
  it('strict commands reject any client authority fields', () => {
    const value = {
      roomId: crypto.randomUUID(),
      activityId: crypto.randomUUID(),
      round: 1,
      version: 0,
      requestId: crypto.randomUUID(),
      action: { type: 'guess', guess: 'APPLE' },
    };
    for (const key of ['score', 'winner', 'turn', 'drawer', 'role', 'actorId', 'userId', 'owner'])
      expect(activityPlaySchema.safeParse({ ...value, [key]: 123 }).success).toBe(false);
    for (const type of ['addScore', 'setWinner', 'advanceRound', 'setDrawer'])
      expect(activityActionSchema.safeParse({ type }).success).toBe(false);
  });
});
describe('server lifecycle and hostile activity clients', () => {
  it('awards word scores only after a server match and transitions on canonical deadlines', async () => {
    const definition = {
      ...letterLantern,
      begin(s: Parameters<typeof letterLantern.begin>[0], now: number) {
        letterLantern.begin(s, now);
        s.privateState = { answer: 'APPLE', guesses: [], solved: false };
      },
    };
    const h = await activityHarness(true, [definition]);
    try {
      let v = await h.start();
      v = await h.action(v, h.member, 'join');
      v = await h.action(v, h.owner, 'begin');
      v = await h.play(v, h.member, { type: 'guess', guess: ' apple ' });
      expect(v.activity?.state).toBe('completed');
      expect(v.activity?.members.find((m) => m.id === h.member)?.score).toBe(120);
      expect(v.activity?.members.find((m) => m.id === h.owner)?.score).toBe(10);
      expect(v.activity?.data).toHaveProperty('reveal', 'APPLE');
      const input = {
        roomId: h.roomId,
        kind: 'letter-lantern',
        requestId: crypto.randomUUID(),
        options: { rounds: 2, seconds: 30, friendsOnly: false },
      };
      v = await h.call('start', h.owner, input);
      v = await h.action(v, h.owner, 'begin');
      h.advance(30001);
      await h.occupancy([h.owner, h.member, h.other, h.spectator]);
      v = await h.snapshot();
      expect(v.activity?.state).toBe('transition');
      const stale = h.revision(v);
      h.advance(3001);
      await h.occupancy([h.owner, h.member, h.other, h.spectator]);
      v = await h.snapshot();
      expect(v.activity?.round).toBe(2);
      await expect(
        h.call('play', h.owner, { ...stale, action: { type: 'guess', guess: 'APPLE' } }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      await h.action(v, h.owner, 'cancel');
      await expect(h.call('start', h.owner, input)).rejects.toMatchObject({ code: 'CONFLICT' });
    } finally {
      await h.close();
    }
  });
  it('snapshot history, drawing clear and giant batches stay bounded', async () => {
    const h = await activityHarness();
    try {
      let v = await h.start('sketch-circle');
      v = await h.action(v, h.member, 'join');
      v = await h.action(v, h.owner, 'begin');
      const stroke = { color: 'ink', width: 3, points: Array(64).fill({ x: 0.1, y: 0.1 }) };
      for (let i = 0; i < 8; i++) {
        h.advance(1001);
        v = await h.play(v, h.owner, { type: 'stroke', strokes: [stroke] });
      }
      expect(JSON.stringify(v).length).toBeLessThan(32768);
      h.advance(1001);
      await expect(h.play(v, h.owner, { type: 'stroke', strokes: [stroke] })).rejects.toMatchObject(
        { code: 'INVALID_REQUEST' },
      );
      v = await h.play(v, h.owner, { type: 'clear' });
      expect(v.activity?.data.type === 'drawing' && v.activity.data.strokes).toEqual([]);
      await expect(h.play(v, h.member, { type: 'clear' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(
        h.play(v, h.owner, { type: 'stroke', strokes: Array(5).fill(stroke) }),
      ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
      await expect(
        h.play(v, h.member, { type: 'guess', guess: 'x'.repeat(10000) }),
      ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    } finally {
      await h.close();
    }
  });
  it('authorizes launch, memberships, begin, spectator rules, replay and cross-room commands', async () => {
    const h = await activityHarness();
    try {
      await expect(
        h.call('start', h.member, {
          roomId: h.roomId,
          kind: 'letter-lantern',
          requestId: crypto.randomUUID(),
          options: { rounds: 1, seconds: 30, friendsOnly: false },
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(h.call('snapshot', h.outsider, { roomId: h.roomId })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(h.call('snapshot', null, { roomId: h.roomId })).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      });
      let v = await h.start();
      expect(v.activity?.data).not.toHaveProperty('answer');
      await expect(
        h
          .action(v, h.owner, 'begin')
          .then(async (active) => h.play(active, h.member, { type: 'guess', guess: 'APPLE' })),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      v = await h.snapshot();
      await h.action(v, h.owner, 'cancel');
      v = await h.start();
      v = await h.action(v, h.member, 'join');
      v = await h.action(v, h.spectator, 'spectate');
      v = await h.action(v, h.other, 'decline');
      expect((await h.snapshot(h.other)).activity?.myMode).toBe('declined');
      v = await h.action(v, h.owner, 'begin');
      await expect(h.play(v, h.spectator, { type: 'guess', guess: 'APPLE' })).rejects.toMatchObject(
        { code: 'FORBIDDEN' },
      );
      const input = { ...h.revision(v), action: { type: 'guess', guess: 'ZZZZZ' } };
      v = await h.call('play', h.member, input);
      expect(v.activity?.data.type === 'word' && v.activity.data.guesses[0]?.evaluation).toEqual(
        Array(5).fill('absent'),
      );
      await expect(h.call('play', h.member, input)).rejects.toMatchObject({ code: 'CONFLICT' });
      await expect(
        h.call('play', h.member, {
          ...h.revision(v),
          round: 50,
          action: { type: 'guess', guess: 'APPLE' },
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      await expect(
        h.call('play', h.member, {
          ...h.revision(v),
          roomId: h.wrongRoom,
          action: { type: 'guess', guess: 'APPLE' },
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        h.call('play', h.member, {
          ...h.revision(v),
          activityId: crypto.randomUUID(),
          action: { type: 'guess', guess: 'APPLE' },
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      await expect(h.action(v, h.member, 'begin')).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect((await h.snapshot(h.member)).activity?.version).toBe(v.activity?.version);
    } finally {
      await h.close();
    }
  });
  it('server word scoring, reveal/completion and six attempts are canonical', async () => {
    const h = await activityHarness();
    try {
      let v = await h.start();
      v = await h.action(v, h.owner, 'begin');
      for (const guess of ['ZZZZZ', 'XXXXX', 'VVVVV', 'JJJJJ', 'KKKKK'])
        v = await h.play(v, h.owner, { type: 'guess', guess });
      h.advance(10001);
      v = await h.play(v, h.owner, { type: 'guess', guess: 'NNNNN' });
      expect(v.activity?.state).toBe('completed');
      expect(v.activity?.data).toHaveProperty('reveal');
      expect(v.activity?.members[0]?.score).toBe(0);
      await expect(h.play(v, h.owner, { type: 'guess', guess: 'APPLE' })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    } finally {
      await h.close();
    }
  });
  it('drawing secret, ownership, score, rate/batch/snapshot bounds and drawer departure', async () => {
    const h = await activityHarness();
    try {
      let v = await h.start('sketch-circle');
      await expect(h.action(v, h.owner, 'begin')).rejects.toMatchObject({ code: 'CONFLICT' });
      v = await h.action(v, h.member, 'join');
      v = await h.action(v, h.other, 'join');
      v = await h.action(v, h.spectator, 'spectate');
      v = await h.action(v, h.owner, 'begin');
      const drawerView = v.activity!.data;
      expect(drawerView.type).toBe('drawing');
      expect(drawerView).toHaveProperty('prompt');
      const safe = await h.snapshot(h.member);
      expect(safe.activity?.data).not.toHaveProperty('prompt');
      expect(safe.activity?.data).not.toHaveProperty('reveal');
      const stroke = {
        type: 'stroke',
        strokes: [
          {
            color: 'ink',
            width: 4,
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        ],
      };
      for (const actor of [h.member, h.spectator])
        await expect(h.play(v, actor, stroke)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      v = await h.play(v, h.owner, stroke);
      v = await h.play(v, h.owner, stroke);
      await expect(h.play(v, h.owner, stroke)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
      h.advance(1001);
      v = await h.play(v, h.member, {
        type: 'guess',
        guess: drawerView.type === 'drawing' ? drawerView.prompt! : '',
      });
      expect(v.activity?.members.find((m) => m.id === h.member)?.score).toBe(100);
      expect(v.activity?.members.find((m) => m.id === h.owner)?.score).toBe(50);
      expect(JSON.stringify((await h.snapshot(h.other)).activity?.data)).not.toContain('"prompt"');
      await expect(h.play(v, h.member, { type: 'guess', guess: 'apple' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      v = await h.action(v, h.owner, 'leave');
      expect(v.activity?.state).toBe('transition');
      expect(v.activity?.creator).toBe(h.member);
      h.advance(3001);
      await h.occupancy([h.owner, h.member, h.other, h.spectator]);
      v = await h.snapshot();
      expect(v.activity?.data.type === 'drawing' && v.activity.data.drawer).toBe(h.member);
      expect(v.activity?.round).toBe(2);
      expect(v.activity?.deadline).toBe(134002);
      await h.occupancy([]);
      expect((await h.snapshot()).activity).toBeNull();
    } finally {
      await h.close();
    }
  });
  it('blocks cannot expose games; permission revocation removes membership; late join must spectate', async () => {
    const h = await activityHarness();
    try {
      let v = await h.start();
      v = await h.action(v, h.owner, 'begin');
      await expect(h.action(v, h.member, 'join')).rejects.toMatchObject({ code: 'CONFLICT' });
      v = await h.action(v, h.member, 'spectate');
      h.blocks.add([h.owner, h.other].sort().join(':'));
      expect((await h.snapshot(h.other)).activity).toBeNull();
      await expect(h.action(v, h.other, 'spectate')).rejects.toMatchObject({ code: 'FORBIDDEN' });
      h.roles.delete(h.member);
      await expect(h.snapshot(h.member)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await h.occupancy([h.owner, h.other, h.spectator]);
      expect((await h.snapshot()).activity?.members).toHaveLength(1);
      h.advance(30001);
      await h.occupancy([h.owner]);
      expect((await h.snapshot()).activity?.state).toBe('completed');
    } finally {
      await h.close();
    }
  });
  it('disablement registers no routes/realtime/subscriptions; generic future rules run without core changes', async () => {
    const h = await activityHarness(false);
    try {
      expect(h.module.http ?? []).toEqual([]);
      expect(h.module.realtime ?? []).toEqual([]);
      expect(h.module.subscriptions ?? []).toEqual([]);
      await expect(h.snapshot()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    } finally {
      await h.close();
    }
    const future = await activityHarness(true, [{ ...letterLantern, id: 'future-puzzle' }]);
    try {
      expect((await future.start('future-puzzle')).activity?.kind).toBe('future-puzzle');
    } finally {
      await future.close();
    }
  });
  it('friends-only projections, friendship revocation and custom pack authority use server ports', async () => {
    const h = await activityHarness();
    try {
      let v = await h.call('start', h.owner, {
        roomId: h.roomId,
        kind: 'sketch-circle',
        requestId: crypto.randomUUID(),
        options: { rounds: 1, seconds: 30, friendsOnly: true, prompts: ['moon'] },
      });
      h.unfriends.add([h.owner, h.other].sort().join(':'));
      expect((await h.snapshot(h.other)).activity).toBeNull();
      await expect(h.action(v, h.other, 'spectate')).rejects.toMatchObject({ code: 'FORBIDDEN' });
      v = await h.action(v, h.member, 'join');
      h.unfriends.add([h.owner, h.member].sort().join(':'));
      await h.occupancy([h.owner, h.member, h.other]);
      expect((await h.snapshot()).activity?.members).toHaveLength(1);
      await h.action(await h.snapshot(), h.owner, 'cancel');
      await h.call('configure', h.owner, {
        roomId: h.roomId,
        settings: { start: 'everyone', ownerAbsent: 'preserve' },
      });
      await expect(
        h.call('start', h.member, {
          roomId: h.roomId,
          kind: 'sketch-circle',
          requestId: crypto.randomUUID(),
          options: { rounds: 1, seconds: 30, friendsOnly: false, prompts: ['moon'] },
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    } finally {
      await h.close();
    }
  });
  it('short socket loss recovers the same activity; absent users cannot play and expire after ten seconds', async () => {
    const h = await activityHarness();
    try {
      let v = await h.start('sketch-circle');
      v = await h.action(v, h.member, 'join');
      v = await h.action(v, h.owner, 'begin');
      await h.occupancy([h.owner]);
      expect((await h.snapshot()).activity?.state).toBe('active');
      await expect(h.play(v, h.member, { type: 'guess', guess: 'moon' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      h.advance(5000);
      await h.occupancy([h.owner, h.member]);
      expect((await h.snapshot(h.member)).activity?.id).toBe(v.activity?.id);
      expect((await h.snapshot(h.member)).activity?.myMode).toBe('participant');
      await h.occupancy([h.owner]);
      h.advance(10001);
      await h.occupancy([h.owner]);
      expect((await h.snapshot()).activity?.state).toBe('cancelled');
    } finally {
      await h.close();
    }
  });
});
