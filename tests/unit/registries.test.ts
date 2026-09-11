import { describe, expect, it, vi } from 'vitest';
import { layoutSchema, z } from '@study/contracts';
import { defineOperation } from '@study/feature-sdk';
import type { FeatureModule, RateLimiter } from '@study/feature-sdk';
import {
  EventBus,
  FeatureFlags,
  ModuleRuntime,
  TileHost,
  TileRegistry,
  UiRegistry,
  orderModules,
} from '@study/core';

const limiter: RateLimiter = { consume: async () => true };
const context = {
  actor: { subjectId: 'alice', sessionId: 'session' },
  requestId: 'request',
  signal: new AbortController().signal,
};
const resource = { id: 'object', ownerId: 'alice' };
const operation = defineOperation({
  id: 'dummy.write',
  kind: 'command',
  input: z.strictObject({ value: z.number().int() }),
  output: z.number(),
  access: { permission: 'dummy.write', resource: async () => resource },
  rate: { limit: 10, windowMs: 1000 },
  handle: async ({ value }) => value,
});
function dummy(): FeatureModule {
  return {
    id: 'dummy',
    version: '1.0.0',
    required: true,
    permissions: [
      {
        id: 'dummy.write',
        description: 'Write own fixture',
        allows: async (actor, object) => actor.subjectId === object.ownerId,
      },
    ],
    operations: [operation],
    http: [{ method: 'POST', path: '/api/v1/dummy', operation: operation.id, input: 'body' }],
    realtime: [{ command: 'dummy.write', operation: operation.id }],
  };
}
describe('module and transport registries', () => {
  it('registers a dummy without core edits and shares authorization across transports', async () => {
    const runtime = new ModuleRuntime(limiter, 'test');
    await runtime.start([dummy()]);
    expect(runtime.http.values()).toHaveLength(1);
    expect(runtime.realtime.get('dummy.write')).toBeDefined();
    expect(await runtime.operations.execute('dummy.write', { value: 3 }, context)).toBe(3);
    await expect(
      runtime.operations.execute('dummy.write', { value: 3 }, { ...context, actor: null }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(
      runtime.operations.execute(
        'dummy.write',
        { value: 3 },
        { ...context, actor: { subjectId: 'bob', sessionId: 'other' } },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      runtime.operations.execute('dummy.write', { value: 3, role: 'owner' }, context),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await runtime.stop();
    expect(runtime.operations.values()).toHaveLength(0);
  });
  it('rejects duplicate modules, cycles, missing and incompatible dependencies', () => {
    const a: FeatureModule = { id: 'a', version: '1.0.0', dependencies: [{ id: 'b', major: 1 }] };
    const b: FeatureModule = { id: 'b', version: '1.0.0', dependencies: [{ id: 'a', major: 1 }] };
    expect(() => orderModules([a, b])).toThrow('Circular');
    expect(() => orderModules([a])).toThrow('Missing');
    expect(() => orderModules([dummy(), dummy()])).toThrow('duplicate');
    expect(() => orderModules([a, { ...b, version: '2.0.0', dependencies: [] }])).toThrow(
      'Incompatible',
    );
  });
  it('rolls back optional failures and fails required dependants', async () => {
    const runtime = new ModuleRuntime(limiter, 'test', undefined, 20);
    const failing = {
      ...dummy(),
      required: false,
      start: async () => {
        throw new Error('unavailable provider');
      },
    };
    await runtime.start([failing]);
    expect(runtime.operations.values()).toEqual([]);
    expect(runtime.moduleIds()).toEqual([]);
    await runtime.stop();
    await expect(
      runtime.start([
        failing,
        {
          id: 'dependent',
          version: '1.0.0',
          required: true,
          dependencies: [{ id: 'dummy', major: 1 }],
        },
      ]),
    ).rejects.toThrow('Dependency unavailable');
  });
  it('rejects mutating GET, unknown permissions, duplicate routes and bindings', async () => {
    const runtime = new ModuleRuntime(limiter, 'test');
    await runtime.start([dummy()]);
    expect(() =>
      runtime.http.register({
        method: 'GET',
        path: '/api/v1/mutate',
        operation: 'dummy.write',
        input: 'query',
      }),
    ).toThrow('cannot mutate');
    expect(() => runtime.http.register(runtime.http.values()[0]!)).toThrow('Conflicting');
    expect(() =>
      runtime.operations.register('dummy.bad', {
        ...operation,
        id: 'dummy.bad',
        access: { permission: 'missing', resource: async () => resource },
      }),
    ).toThrow('Unknown permission');
    expect(() =>
      runtime.realtime.register('dummy.write', {
        command: 'dummy.write',
        operation: 'dummy.write',
      }),
    ).toThrow('Duplicate');
    await runtime.stop();
  });
  it('starts dependencies first and stops them last, with bounded failure isolation', async () => {
    const calls: string[] = [];
    const runtime = new ModuleRuntime(limiter, 'test', undefined, 20);
    const a: FeatureModule = {
      id: 'a',
      version: '1.0.0',
      start: async () => {
        calls.push('a+');
      },
      stop: async () => {
        calls.push('a-');
      },
    };
    const b: FeatureModule = {
      id: 'b',
      version: '1.0.0',
      dependencies: [{ id: 'a', major: 1 }],
      start: async () => {
        calls.push('b+');
      },
      stop: async () => {
        calls.push('b-');
      },
    };
    await runtime.start([
      b,
      a,
      { id: 'slow', version: '1.0.0', start: async () => new Promise(() => {}) },
    ]);
    expect(runtime.moduleIds()).toEqual(['a', 'b']);
    await runtime.stop();
    expect(calls).toEqual(['a+', 'b+', 'b-', 'a-']);
  });
});
describe('events, flags and UI extension points', () => {
  it('validates events, isolates failing subscribers and unregisters subscriptions', async () => {
    const event = { id: 'dummy.changed', schema: z.strictObject({ value: z.number() }) };
    const bus = new EventBus();
    bus.register(event.id, event);
    const observed = vi.fn();
    bus.subscribe(event.id, async () => {
      throw new Error('optional failure');
    });
    const unsubscribe = bus.subscribe(event.id, async (payload) => {
      observed(payload);
    });
    await bus.emit(event, { value: 1 });
    expect(observed).toHaveBeenCalledOnce();
    await expect(bus.emit(event, { value: 'bad' } as never)).rejects.toThrow();
    unsubscribe();
    await bus.emit(event, { value: 2 });
    expect(observed).toHaveBeenCalledOnce();
  });
  it('flags fail closed and support environment, cohort, scope and global rules', () => {
    const flags = new FeatureFlags('production');
    for (const [id, rule] of Object.entries({
      off: { mode: 'disabled' },
      dev: { mode: 'development' },
      all: { mode: 'global' },
      cohort: { mode: 'cohort', subjects: ['alice'] },
      scope: { mode: 'scope', scopes: ['one'] },
    } as const))
      flags.register(id, { id, rule });
    expect(flags.enabled('missing', context.actor)).toBe(false);
    expect(flags.enabled('dev', context.actor)).toBe(false);
    expect(flags.enabled('off', context.actor)).toBe(false);
    expect(flags.enabled('all', null)).toBe(true);
    expect(flags.enabled('cohort', context.actor)).toBe(true);
    expect(flags.enabled('cohort', null)).toBe(false);
    expect(flags.enabled('scope', context.actor, 'two')).toBe(false);
    expect(flags.enabled('scope', context.actor, 'one')).toBe(true);
  });
  it('uses named slots and one tile instance per resource; validates layouts and lifecycle', () => {
    const ui = new UiRegistry();
    ui.register('dummy.panel', {
      id: 'dummy.panel',
      point: 'rightRail',
      label: 'Fixture',
      order: 1,
      permission: 'dummy.read',
      load: async () => ({}),
    });
    expect(ui.at('rightRail')).toEqual([]);
    expect(ui.at('rightRail', () => true)).toHaveLength(1);
    expect(() =>
      ui.register('dummy.bad', {
        id: 'dummy.bad',
        point: 'unknown' as never,
        label: 'bad',
        order: 0,
        load: async () => ({}),
      }),
    ).toThrow();
    const registry = new TileRegistry(),
      open = vi.fn(),
      close = vi.fn();
    registry.register('dummy.tile', {
      type: 'dummy.tile',
      label: 'Fixture',
      load: async () => ({}),
      minimumSize: { width: 100, height: 100 },
      defaultSize: { width: 200, height: 150 },
      resizable: true,
      fullscreenable: false,
      layoutSchema,
      onOpen: open,
      onClose: close,
    });
    const host = new TileHost(registry),
      first = host.open('dummy.tile', 'object');
    expect(host.open('dummy.tile', 'object')).toBe(first);
    expect(open).toHaveBeenCalledOnce();
    expect(() => host.update(first.id, { ...first.layout, width: 1 })).toThrow();
    expect(() => host.update(first.id, { ...first.layout, fullscreen: true })).toThrow();
    host.close(first.id);
    host.close(first.id);
    expect(close).toHaveBeenCalledOnce();
  });
});
