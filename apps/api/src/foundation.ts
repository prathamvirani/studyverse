import {
  capabilitiesSchema,
  csrfResponseSchema,
  emptySchema,
  healthSchema,
} from '@study/contracts';
import { defineOperation } from '@study/feature-sdk';
import type { FeatureModule } from '@study/feature-sdk';
import type { ModuleRuntime, Sessions } from '@study/core/server';
import { AppError } from '@study/core';
import { READINESS_PATH, READINESS_OPERATION } from './readiness.ts';
import type { ReadinessResult } from './readiness.ts';

export function foundationModule(
  runtime: Pick<ModuleRuntime, 'capabilities'>,
  sessions: Pick<Sessions, 'csrfFor'>,
  ready: () => Promise<ReadinessResult>,
): FeatureModule {
  const rate = { limit: 120, windowMs: 60_000 };
  return {
    id: 'foundation',
    version: '1.0.0',
    required: true,
    capabilities: ['protocol.v1'],
    permissions: [
      {
        id: 'foundation.session.read',
        description: 'Read current session anti-forgery value',
        allows: async (actor, resource) =>
          actor.sessionId === resource.id && actor.subjectId === resource.ownerId,
      },
    ],
    operations: [
      defineOperation({
        id: 'foundation.health',
        kind: 'query',
        input: emptySchema,
        output: healthSchema,
        access: { public: true },
        rate,
        handle: async () => ({ status: 'ok' as const }),
      }),
      defineOperation({
        id: READINESS_OPERATION,
        kind: 'query',
        input: emptySchema,
        output: healthSchema,
        access: { public: true },
        rate,
        handle: ready,
      }),
      defineOperation({
        id: 'foundation.capabilities',
        kind: 'query',
        input: emptySchema,
        output: capabilitiesSchema,
        access: { public: true },
        rate,
        handle: async () => ({
          version: 1 as const,
          supportedVersions: [1],
          capabilities: runtime.capabilities(),
        }),
      }),
      defineOperation({
        id: 'foundation.csrf',
        kind: 'query',
        input: emptySchema,
        output: csrfResponseSchema,
        access: {
          permission: 'foundation.session.read',
          resource: async (_input, context) =>
            context.actor
              ? { id: context.actor.sessionId, ownerId: context.actor.subjectId }
              : null,
        },
        rate,
        handle: async (_input, context) => {
          if (!context.actor) throw new AppError('UNAUTHENTICATED');
          return { csrfToken: await sessions.csrfFor(context.actor) };
        },
      }),
    ],
    http: [
      { method: 'GET', path: '/api/v1/health', operation: 'foundation.health', input: 'query' },
      { method: 'GET', path: READINESS_PATH, operation: READINESS_OPERATION, input: 'query' },
      {
        method: 'GET',
        path: '/api/v1/capabilities',
        operation: 'foundation.capabilities',
        input: 'query',
      },
      { method: 'GET', path: '/api/v1/session/csrf', operation: 'foundation.csrf', input: 'query' },
    ],
  };
}
