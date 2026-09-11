import { expect, it } from 'vitest';
import {
  checkBoundaries,
  importsFrom,
  importViolations,
  browserGraphViolations,
} from '../../scripts/check-boundaries.ts';

it('checks all repository source boundaries', async () => {
  expect(await checkBoundaries()).toEqual([]);
});
it.each(['./neutral.ts', './neutral', './neutral.js'])(
  'rejects a server dependency hidden behind browser barrel %s',
  (barrel) => {
    const graph = new Map([
      ['apps/web/app/example.ts', ['@study/core/browser']],
      ['packages/core/src/browser.ts', [barrel]],
      ['packages/core/src/neutral.ts', ['./sessions.ts']],
      ['packages/core/src/sessions.ts', ['node:crypto']],
    ]);
    expect(browserGraphViolations(graph).length).toBeGreaterThan(0);
  },
);
it('follows future feature public exports before accepting them into a browser bundle', () => {
  const graph = new Map([
    ['apps/web/app/example.ts', ['@study/fixture/browser']],
    ['packages/features/fixture/src/browser.ts', ['./unsafe.ts']],
    ['packages/features/fixture/src/unsafe.ts', ['node:crypto']],
  ]);
  expect(browserGraphViolations(graph).length).toBeGreaterThan(0);
});
it.each([
  ['packages/core/src/bad.ts', '@study/chat'],
  ['packages/core/src/bad.ts', '../../features/chat/src/internal.ts'],
  ['packages/features/chat/src/bad.ts', '@study/tasks/internal/repository'],
  ['packages/features/chat/src/bad.ts', '../../tasks/src/repository.ts'],
  ['packages/features/chat/src/bad.ts', 'fastify'],
  ['packages/features/chat/src/bad.ts', 'ws'],
  ['packages/feature-sdk/src/bad.ts', '@study/core'],
  ['packages/contracts/src/bad.ts', '@study/feature-sdk'],
  ['apps/web/app/bad.ts', '@study/core/server'],
  ['apps/web/app/bad.ts', '@study/adapters/postgres'],
  ['packages/ui/src/bad.ts', '../../../apps/api/src/server.ts'],
  ['apps/api/src/bad.ts', '../../../tests/fixtures/dummy-module.ts'],
])('fails forbidden import %s -> %s', (from, target) => {
  expect(importViolations(from, target).length).toBeGreaterThan(0);
});
it('detects re-exports, dynamic imports and CommonJS, not just import declarations', () => {
  const entries = importsFrom(
    `export * from '@study/chat'; import('@study/tasks/internal/service'); require('fastify'); import(variable);`,
    'fixture.ts',
  );
  expect(entries.map((entry) => entry.specifier)).toEqual([
    '@study/chat',
    '@study/tasks/internal/service',
    'fastify',
    '<computed>',
  ]);
});
it('allows public contracts and registered browser adapters', () => {
  expect(importViolations('packages/features/chat/src/module.ts', '@study/contracts')).toEqual([]);
  expect(importViolations('apps/web/app/registry.ts', '@study/core/browser')).toEqual([]);
  expect(importViolations('apps/web/app/preferences.ts', '@study/adapters/indexeddb')).toEqual([]);
});
