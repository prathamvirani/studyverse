import { describe, expect, it } from 'vitest';
import { commandEnvelopeSchema, negotiateCapabilities } from '@study/contracts';

describe('versioned contracts', () => {
  const command = {
    version: 1,
    requestId: '44ea844a-782f-4c88-916b-9b7b49a68f78',
    command: 'fixture.write',
    payload: {},
  };
  it('rejects unknown versions, extra identity claims and invalid request IDs', () => {
    expect(commandEnvelopeSchema.safeParse(command).success).toBe(true);
    for (const change of [
      { version: 2 },
      { userId: 'victim' },
      { role: 'owner' },
      { requestId: 'arbitrary log text' },
    ]) {
      expect(commandEnvelopeSchema.safeParse({ ...command, ...change }).success).toBe(false);
    }
  });
  it('negotiates only mutually supported capabilities', () => {
    expect(negotiateCapabilities(['protocol.v1'], ['admin', 'protocol.v1', 'protocol.v1'])).toEqual(
      ['protocol.v1'],
    );
  });
});
