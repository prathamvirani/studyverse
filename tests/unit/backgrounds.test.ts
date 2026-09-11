import 'fake-indexeddb/auto';
import { readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  EnvironmentCatalog,
  curatedProvider,
  defaultBackground,
  shouldAnimate,
  inspectImage,
} from '@study/backgrounds/browser';
import { createLocalVisualStore } from '@study/adapters/indexeddb';
import { backgroundsModules } from '../../apps/api/src/backgrounds.ts';
import { ModuleRuntime } from '@study/core/server';
import { MemoryLimiter } from '../fixtures/memory.ts';
import type { Database, LocalVisualAsset } from '@study/feature-sdk';
it('catalog expands through providers, rejects conflicts and recovers removed assets', () => {
  const catalog = new EnvironmentCatalog();
  catalog.register(curatedProvider);
  expect(catalog.assets()).toHaveLength(6);
  expect(catalog.assets().filter((a) => a.kind === 'loop')).toHaveLength(2);
  expect(catalog.resolve('removed').id).toBe(defaultBackground);
  expect(() => catalog.register(curatedProvider)).toThrow();
  expect(() =>
    catalog.register({ id: 'duplicate', assets: () => [curatedProvider.assets()[0]!] }),
  ).toThrow();
  catalog.register({
    id: 'future',
    assets: () => [{ ...curatedProvider.assets()[0]!, id: 'new-scene' }],
  });
  expect(catalog.find('new-scene')).toBeTruthy();
});
it('all bundled backgrounds have accurate provenance and small independent thumbnails', async () => {
  const manifest = JSON.parse(
    await readFile('apps/web/public/backgrounds/provenance.json', 'utf8'),
  );
  for (const a of curatedProvider.assets()) {
    const p = manifest.find((v: { id: string }) => v.id === a.id);
    expect(p.license).toContain('Project-owned');
    expect(p.bytes).toBe((await stat('apps/web/public' + a.source)).size);
    expect((await stat('apps/web/public' + a.thumbnail)).size).toBeLessThan(p.bytes);
    expect(p.attributionRequired).toBe(false);
  }
});
it('motion stops independently for reduced motion, hidden tab, saving and manual pause', () => {
  const flags = { hidden: false, reduced: false, saving: false, paused: false };
  expect(shouldAnimate(flags)).toBe(true);
  for (const key of Object.keys(flags))
    expect(shouldAnimate({ ...flags, [key]: true })).toBe(false);
});
it('rejects fake extensions, SVG/script, malformed data and predecode bombs', async () => {
  for (const text of [
    '<svg onload="alert(1)"></svg>',
    '<script>hello</script>',
    'not an image',
    'GIF89a',
  ])
    expect(() => inspectImage(new TextEncoder().encode(text))).toThrow();
  expect(() => inspectImage(new Uint8Array(5 * 1024 * 1024 + 1))).toThrow(/5 MB/);
  const png = new Uint8Array(await readFile('tests/fixtures/background.png'));
  expect(inspectImage(png)).toMatchObject({
    mime: 'image/png',
    width: 640,
    height: 360,
    frames: 1,
  });
  const bomb = png.slice();
  new DataView(bomb.buffer).setUint32(16, 65535);
  expect(() => inspectImage(bomb)).toThrow(/budget/);
  expect(() => inspectImage(png.slice(0, -12))).toThrow();
  const gif = new Uint8Array(await readFile('tests/fixtures/background.gif'));
  expect(inspectImage(gif).frames).toBe(2);
  expect(() => inspectImage(gif.slice(0, -1))).toThrow();
  const gifBomb = gif.slice();
  new DataView(gifBomb.buffer).setUint16(6, 65535, true);
  expect(() => inspectImage(gifBomb)).toThrow(/budget/);
});
it('local binary store isolates accounts, deduplicates imports and atomically enforces quota', async () => {
  const store = await createLocalVisualStore(randomUUID()),
    other = await createLocalVisualStore(randomUUID());
  const blob = new Blob(['encoded'], { type: 'image/webp' });
  const asset = (n: number): LocalVisualAsset => ({
    id: 'custom-' + n.toString(16).padStart(64, '0'),
    title: 'Private',
    frames: [blob],
    durations: [1000],
    thumbnail: blob,
    width: 10,
    height: 10,
    bytes: blob.size * 2,
  });
  try {
    await store.put(asset(0));
    await store.put(asset(0));
    expect(await store.list()).toHaveLength(1);
    expect(await other.get(asset(0).id)).toBeUndefined();
    await Promise.all(Array.from({ length: 7 }, (_, i) => store.put(asset(i + 1))));
    await expect(store.put(asset(9))).rejects.toThrow(/limit/);
    expect(await store.list()).toHaveLength(8);
    await store.delete(asset(0).id);
    expect(await store.get(asset(0).id)).toBeUndefined();
    await expect(
      store.put({ ...asset(10), frames: [new Blob(['<svg/>'], { type: 'image/svg+xml' })] }),
    ).rejects.toThrow();
  } finally {
    store.close();
    other.close();
  }
});
it('background feature independently registers, gates every protected operation and keeps core generic', async () => {
  const db: Database = {
    query: async (s) =>
      s.text.includes('JOIN rooms.memberships')
        ? ([{ owner_id: randomUUID(), role: 'member' }] as never)
        : [],
    transaction: async (fn) => fn(db),
  };
  const [module] = backgroundsModules(db, { BACKGROUNDS_ENABLED: 'false' });
  const runtime = new ModuleRuntime(new MemoryLimiter(), 'test');
  await runtime.start([module!]);
  for (const operation of module!.operations!) {
    expect(operation.access).not.toHaveProperty('public');
    expect(operation.flag).toBe('backgrounds.enabled');
  }
  await expect(
    runtime.operations.execute(
      'backgrounds.snapshot',
      { roomId: randomUUID() },
      {
        actor: { subjectId: randomUUID(), sessionId: randomUUID() },
        requestId: randomUUID(),
        signal: AbortSignal.timeout(1000),
      },
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await runtime.stop();
  const shell = await readFile('apps/web/app/components/room/RoomShell.vue', 'utf8');
  expect(shell).not.toContain('@study/backgrounds');
  expect(shell).toContain('point="environment"');
});
