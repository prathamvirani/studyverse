import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { it, expect } from 'vitest';
import { initialTimer, projectTimer, nextPhase } from '@study/pomodoro/browser';
import { productivityModules } from '../../apps/api/src/productivity.ts';
import { ModuleRuntime } from '@study/core/server';
import { MemoryLimiter } from '../fixtures/memory.ts';
import type { Database } from '@study/feature-sdk';
it('projects exact boundaries, cycles, pause, late join, drift and years of downtime', () => {
  const initial = initialTimer(randomUUID(), 1000),
    s = { ...initial, running: true };
  expect(projectTimer(s, 61000).remainingMs).toBe(1440000);
  expect(projectTimer(s, 1501000)).toMatchObject({
    phase: 'shortBreak',
    cycle: 1,
    remainingMs: 300000,
  });
  expect(projectTimer(s, 1801000)).toMatchObject({
    phase: 'focus',
    cycle: 2,
    remainingMs: 1500000,
  });
  expect(nextPhase({ ...s, cycle: 4 })).toMatchObject({ phase: 'longBreak' });
  expect(nextPhase({ ...s, phase: 'longBreak' })).toMatchObject({ phase: 'focus', cycle: 1 });
  expect(projectTimer(initial, 1e12)).toEqual(initial);
  expect(projectTimer(s, 0).remainingMs).toBe(1500000);
  expect(projectTimer(projectTimer(s, 40000), 2500000)).toEqual(projectTimer(s, 2500000));
  expect(projectTimer(s, 1e12).remainingMs).toBeGreaterThan(0);
});
it('each module registers independently; every operation is protected and individually flag gated', async () => {
  const a = randomUUID();
  const db: Database = {
    query: async (statement) =>
      statement.text.includes('JOIN rooms.memberships')
        ? ([{ owner_id: a, role: 'owner' }] as never)
        : [],
    transaction: async (fn) => fn(db),
  };
  for (const enabled of [true, false])
    for (const module of productivityModules(db, {
      POMODORO_ENABLED: String(enabled),
      TASKS_ENABLED: String(enabled),
      CHAT_ENABLED: String(enabled),
    })) {
      const runtime = new ModuleRuntime(new MemoryLimiter(), 'test');
      await runtime.start([module]);
      expect(runtime.capabilities()).toContain(module.id + '.v1');
      for (const op of module.operations!) {
        expect(op.access).not.toHaveProperty('public');
        expect(op.flag).toBe(module.id + '.enabled');
        expect(runtime.operations.get(op.id)).toBeTruthy();
      }
      if (!enabled) {
        const op = module.operations![0]!;
        await expect(
          runtime.operations.execute(
            op.id,
            module.id === 'tasks' ? { scope: 'personal' } : { roomId: randomUUID() },
            {
              actor: { subjectId: a, sessionId: randomUUID() },
              requestId: randomUUID(),
              signal: AbortSignal.timeout(1000),
            },
          ),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      }
      await runtime.stop();
    }
});

it('OpenAPI documents both Personal and Shared query scope without dropping union fields', async () => {
  const doc = JSON.parse(await readFile('packages/contracts/generated/openapi-v1.json', 'utf8'));
  const parameters = doc.paths['/api/v1/tasks/snapshot'].get.parameters;
  expect(parameters.find((p: { name: string }) => p.name === 'scope')).toMatchObject({
    required: true,
  });
  expect(parameters.find((p: { name: string }) => p.name === 'roomId')).toMatchObject({
    required: false,
  });
});
