import { emptySchema, z } from '@study/contracts';
import { defineOperation } from '@study/feature-sdk';
import type { EventPublisher, FeatureModule, Resource } from '@study/feature-sdk';

export const ids = {
  alice: '2d481e31-0d41-4f8a-b7dd-0b5a6b19fdf1',
  bob: '7c9f343f-79b7-4939-b5c8-27a5944956c3',
  scopeA: '56f588ac-eb67-4c62-a9fb-ed729b87c6a1',
  scopeB: '67ef81d5-cf83-4856-acf4-3c1ef27d5c02',
  objectA: '6a662c65-119b-400a-b0a6-cab7cc985f93',
  objectB: '0f10ab51-baca-4429-a331-ee3119dbf63d',
};
const params = z.strictObject({ scopeId: z.uuid(), id: z.uuid() });
export const fixtureInput = z.strictObject({
  params,
  query: emptySchema,
  body: z.strictObject({ value: z.string().max(200) }),
});
const output = z.strictObject({ value: z.string() });
export function dummyModule() {
  const objects = new Map<string, Resource & { value: string }>([
    [ids.objectA, { id: ids.objectA, scopeId: ids.scopeA, ownerId: ids.alice, value: 'initial' }],
    [ids.objectB, { id: ids.objectB, scopeId: ids.scopeB, ownerId: ids.bob, value: 'private' }],
  ]);
  const members = new Map<string, Set<string>>([
    [ids.scopeA, new Set([ids.alice])],
    [ids.scopeB, new Set([ids.bob])],
  ]);
  const observed: unknown[] = [],
    changed = {
      id: 'fixture.changed',
      schema: z.strictObject({ id: z.uuid(), value: z.string().max(200) }),
    };
  let events: EventPublisher;
  const resolve = async (input: { scopeId: string; id: string }) => {
    const object = objects.get(input.id);
    return object?.scopeId === input.scopeId ? object : null;
  };
  const write = defineOperation({
    id: 'fixture.write',
    kind: 'command',
    input: fixtureInput,
    output,
    access: { permission: 'fixture.own', resource: async (input) => resolve(input.params) },
    rate: { limit: 3, windowMs: 60_000 },
    handle: async (input, context) => {
      const object = context.resource && objects.get(context.resource.id);
      if (!object) throw new Error('Authorized fixture missing');
      objects.set(object.id, { ...object, value: input.body.value });
      await events.emit(changed, { id: object.id, value: input.body.value });
      return { value: input.body.value };
    },
  });
  const read = defineOperation({
    id: 'fixture.read',
    kind: 'query',
    input: params,
    output,
    access: { permission: 'fixture.own', resource: resolve },
    rate: { limit: 30, windowMs: 60_000 },
    handle: async (_input, context) => ({ value: objects.get(context.resource!.id)!.value }),
  });
  const module: FeatureModule = {
    id: 'fixture',
    version: '1.0.0',
    required: true,
    permissions: [
      {
        id: 'fixture.own',
        description: 'Access own synthetic object in current scope',
        allows: async (actor, object) =>
          actor.subjectId === object.ownerId &&
          members.get(object.scopeId ?? '')?.has(actor.subjectId) === true,
      },
    ],
    operations: [write, read],
    events: [changed],
    subscriptions: [
      {
        event: changed.id,
        handle: async (payload) => {
          observed.push(payload);
        },
      },
    ],
    http: [
      { method: 'POST', path: '/api/v1/fixture/:scopeId/:id', operation: write.id, input: 'parts' },
      { method: 'GET', path: '/api/v1/fixture/:scopeId/:id', operation: read.id, input: 'params' },
    ],
    realtime: [
      { command: 'fixture.write', operation: write.id },
      { command: 'fixture.read', operation: read.id },
    ],
    start: async (context) => {
      events = context.events;
    },
  };
  return { module, objects, members, observed };
}
