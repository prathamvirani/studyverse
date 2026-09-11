import { expect, it, vi } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { layoutSchema } from '@study/contracts';
import { TileRegistry, Workspace, workspaceSchema } from '@study/core/browser';
import { WorkspaceTileView } from '@study/ui';
import type { Database, TileDefinition } from '@study/feature-sdk';
import { createRoomComposition } from '../../apps/web/app/room/composition.ts';
import { createCameraFixture, cameraTarget, MockCamera } from '../fixtures/workspace-camera.ts';
import { identityModules } from '../../apps/api/src/identity.ts';
import { readFile } from 'node:fs/promises';

function fixture(overrides: Partial<TileDefinition> = {}) {
  const types = new TileRegistry();
  types.register('fixture.tile', {
    type: 'fixture.tile',
    label: 'Independent tile',
    load: async () => ({ render: () => h('p', 'Independent renderer') }),
    minimumSize: { width: 160, height: 120 },
    defaultSize: { width: 300, height: 200 },
    resizable: true,
    fullscreenable: true,
    layoutSchema,
    ...overrides,
  });
  return new Workspace(types);
}
const bounds = { width: 900, height: 600 };
it('runs independent tile lifecycle, stacking, minimize/restore and fullscreen', () => {
  const onOpen = vi.fn(),
    onClose = vi.fn(),
    onLayoutChange = vi.fn();
  const ws = fixture({ onOpen, onClose, onLayoutChange }),
    a = ws.open('fixture.tile', 'a'),
    b = ws.open('fixture.tile', 'b');
  expect(ws.open('fixture.tile', 'a')).toBe(a);
  expect(onOpen).toHaveBeenCalledTimes(2);
  ws.focus(a.id);
  expect(a.layout.zIndex).toBeGreaterThan(b.layout.zIndex);
  ws.update(a.id, { ...a.layout, minimized: true });
  expect(a.layout.minimized).toBe(true);
  ws.update(a.id, { ...a.layout, minimized: false, fullscreen: true });
  expect(a.layout.fullscreen).toBe(true);
  expect(onLayoutChange).toHaveBeenCalled();
  ws.close(a.id);
  ws.close(a.id);
  expect(onClose).toHaveBeenCalledTimes(1);
});
it('snaps, clamps and serializes drag/resize geometry across fresh hosts', () => {
  const ws = fixture(),
    tile = ws.open('fixture.tile', 'a');
  ws.place(tile.id, { x: 590, y: 7 }, bounds);
  expect(tile.layout.x).toBe(600);
  expect(tile.layout.y).toBe(0);
  ws.place(tile.id, { width: 420, height: 310, x: 200, y: 160 }, bounds);
  const next = fixture();
  next.recover({ panels: {}, dimmed: false, tiles: ws.snapshot() }, bounds);
  expect(next.values()[0]!.layout).toEqual(tile.layout);
  next.place(tile.id, { x: 99999, y: -100 }, { width: 400, height: 300 });
  expect(next.values()[0]!.layout).toMatchObject({ width: 400, height: 300, x: 0, y: 0 });
});
it('recovers safely from invalid, oversized, future, unknown or permission-bearing local state', () => {
  for (const raw of [
    null,
    {},
    { version: 9 },
    { panels: {}, dimmed: false, tiles: [], isOwner: true },
  ]) {
    const ws = fixture();
    ws.recover(raw, bounds);
    expect(ws.values()).toEqual([]);
  }
  const source = fixture(),
    tile = source.open('fixture.tile', 'a');
  const bad = {
    panels: {},
    dimmed: false,
    tiles: [{ type: tile.type, resourceKey: 'a', layout: { ...tile.layout, width: -1 } }],
  };
  expect(workspaceSchema.safeParse(bad).success).toBe(false);
  const target = fixture();
  target.recover(
    { ...bad, tiles: [{ type: 'removed.module', resourceKey: 'a', layout: tile.layout }] },
    bounds,
  );
  expect(target.values()).toEqual([]);
  expect(() =>
    source.types.register('bad', {
      ...source.types.get(tile.type)!,
      type: 'bad',
      minimumSize: { width: NaN, height: 20 },
    }),
  ).toThrow();
});
it('honors tile capability flags and rolls back failed lifecycle opening', () => {
  const ws = fixture({ resizable: false, fullscreenable: false }),
    tile = ws.open('fixture.tile', 'a');
  expect(() => ws.update(tile.id, { ...tile.layout, fullscreen: true })).toThrow();
  expect(() => ws.update(tile.id, { ...tile.layout, width: 400 })).toThrow();
  const broken = fixture({
    onOpen: () => {
      throw new Error('optional feature failed');
    },
  });
  expect(() => broken.open('fixture.tile', 'a')).toThrow();
  expect(broken.values()).toEqual([]);
});
it('registers canonical zones and future menu/settings contributions independently', () => {
  const demo = createRoomComposition('Test', () => {});
  expect(demo.ui.at('rightRail')).toEqual([]);
  expect(demo.ui.at('bottomDock').map((x) => x.label)).toEqual(['Media', 'More']);
  expect(demo.ui.at('participantContextMenu')).toHaveLength(0);
  demo.ui.register('future.settings', {
    id: 'future.settings',
    point: 'roomSettings',
    order: 1,
    label: 'Future',
    load: async () => ({}),
  });
  expect(demo.ui.at('roomSettings')).toHaveLength(1);
  expect(() => demo.ui.register('future.settings', demo.ui.get('future.settings')!)).toThrow();
});
it('renders exactly one mock camera through expand, minimize, restore, close and off transitions', async () => {
  const demo = createCameraFixture(),
    p = demo.participants[0]!;
  const count = async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h('div', [
            cameraTarget(p) === 'circle'
              ? h(MockCamera, { participantId: p.id })
              : h('span', 'avatar'),
            ...demo.workspace
              .values()
              .map((instance) => h(WorkspaceTileView, { registry: demo.tiles, instance })),
          ]),
      }),
    );
    return (html.match(/data-camera-renderer=/g) ?? []).length;
  };
  expect(cameraTarget(p)).toBe('none');
  expect(await count()).toBe(0);
  p.camera = true;
  expect(cameraTarget(p)).toBe('circle');
  expect(await count()).toBe(1);
  const tile = demo.workspace.open('fixture.camera', p.id);
  expect(cameraTarget(p)).toBe('workspace');
  expect(await count()).toBe(1);
  demo.workspace.update(tile.id, { ...tile.layout, minimized: true });
  expect(cameraTarget(p)).toBe('circle');
  expect(await count()).toBe(1);
  demo.workspace.update(tile.id, { ...tile.layout, minimized: false });
  expect(await count()).toBe(1);
  expect(demo.workspace.snapshot()).toEqual([]);
  demo.workspace.close(tile.id);
  expect(cameraTarget(p)).toBe('circle');
  expect(await count()).toBe(1);
  p.camera = false;
  expect(await count()).toBe(0);
});
it('defers Microsoft by default without introducing any account-deletion route', async () => {
  const db = { query: vi.fn(), transaction: vi.fn() } as Database;
  const modules = identityModules(
    db,
    { OAUTH_MICROSOFT_CLIENT_ID: 'configured', OAUTH_MICROSOFT_CLIENT_SECRET: 'configured' },
    'https://localhost:8443',
  );
  const providerQuery = modules[0]!.operations!.find((op) => op.id.includes('providers'))!;
  expect(
    await providerQuery.handle(
      {},
      { actor: null, resource: null, requestId: 'test', signal: new AbortController().signal },
    ),
  ).toEqual([]);
  expect(
    modules
      .flatMap((m) => m.http ?? [])
      .filter((route) =>
        /(?:user|account).*(?:delete|remove)|(?:delete|remove).*(?:user|account)/i.test(route.path),
      ),
  ).toEqual([]);
  const shell = await readFile('apps/web/app/components/room/RoomShell.vue', 'utf8');
  expect(shell).not.toMatch(/from .*demo|@study\/(?:identity|rooms)|getUserMedia|getDisplayMedia/);
});
