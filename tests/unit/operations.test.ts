import { expect, it } from 'vitest';
import { emptySchema, z } from '@study/contracts';
import { defineOperation } from '@study/feature-sdk';
import type { OperationContract } from '@study/feature-sdk';
import { FeatureFlags, OperationRegistry, PermissionRegistry } from '@study/core';

const context = { actor: null, requestId: 'test', signal: new AbortController().signal };
it('bounds stalled operations, aborts their work and returns a safe unavailable error', async () => {
  const registry = new OperationRegistry(
    new PermissionRegistry(),
    new FeatureFlags('test'),
    { consume: async () => true },
    20,
  );
  let observed: AbortSignal | undefined;
  registry.register(
    'fixture.slow',
    defineOperation({
      id: 'fixture.slow',
      kind: 'query',
      input: emptySchema,
      output: emptySchema,
      access: { public: true },
      rate: { limit: 1, windowMs: 1000 },
      handle: async (_input, context) => {
        observed = context.signal;
        return new Promise(() => {});
      },
    }),
  );
  await expect(registry.execute('fixture.slow', {}, context)).rejects.toMatchObject({
    code: 'UNAVAILABLE',
  });
  expect(observed?.aborted).toBe(true);
});
it('invokes a shared typed contract through registered validation and rate limits', async () => {
  const contract: OperationContract<{ value: number }, number> = {
    id: 'fixture.echo',
    kind: 'query',
    input: z.strictObject({ value: z.number() }),
    output: z.number(),
  };
  const registry = new OperationRegistry(new PermissionRegistry(), new FeatureFlags('test'), {
    consume: async () => true,
  });
  registry.register(
    contract.id,
    defineOperation({
      ...contract,
      access: { public: true },
      rate: { limit: 1, windowMs: 1000 },
      handle: async (input) => input.value,
    }),
  );
  const value: number = await registry.invoke(contract, { value: 3 }, context);
  expect(value).toBe(3);
  await expect(registry.execute(contract.id, { value: 'forged' }, context)).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
  });
});
