import { expect, it, vi } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { layoutSchema } from '@study/contracts';
import { TileRegistry, Workspace, workspaceSchema, rectanglesOverlap } from '@study/core/browser';
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
it('derives snap columns from current chrome and preserves the preview through drop and reflow', () => {
  const ws = fixture({
    workspaceCard: true,
    minimumSize: { width: 160, height: 260 },
    defaultSize: { width: 300, height: 300 },
  });
  const card = ws.open('fixture.tile', 'dynamic');
  const pill = { x: 760, y: 0, width: 130, height: 44 };
  const dock = { x: 300, y: 524, width: 300, height: 68 };
  const initial = ws.snapSlots(bounds, [dock]);
  const moved = ws.snapSlots(bounds, [pill, dock]);
  expect(moved).not.toEqual(initial);
  for (const rect of moved)
    for (const obstacle of [pill, dock]) expect(rectanglesOverlap(rect, obstacle, 7)).toBe(false);
  for (const index of [0, 1, 0]) {
    const preview = ws.snapTarget(card.id, index, bounds, [pill, dock])!;
    ws.snap(card.id, index, bounds, [pill, dock]);
    ws.reflow(bounds, [pill, dock]);
    expect(card.layout).toMatchObject(preview.rect);
    expect(ws.snaps.get(card.id)).toBe(preview.index);
  }
  const before = { ...card.layout };
  ws.unsnap(card.id);
  ws.place(card.id, { x: 180, y: 190, width: 260, height: 270 }, bounds, false);
  const free = { ...card.layout };
  ws.reflow(bounds, [dock]);
  expect(card.layout).toEqual(free);
  expect(card.layout).not.toEqual(before);
});
it('persists independent card snaps, displaces occupants, unsnaps and recovers shrinking viewports', () => {
  const ws = fixture({ workspaceCard: true });
  const a = ws.open('fixture.tile', 'a'),
    b = ws.open('fixture.tile', 'b');
  ws.snap(a.id, 0, bounds);
  ws.snap(b.id, 0, bounds);
  expect(ws.snaps.has(a.id)).toBe(false);
  expect(ws.snaps.get(b.id)).toBe(0);
  ws.snap(a.id, 2, bounds);
  const next = fixture({ workspaceCard: true });
  next.recover(
    { panels: {}, dimmed: false, tiles: ws.snapshot(), snaps: Object.fromEntries(ws.snaps) },
    bounds,
  );
  expect(next.snaps.get(a.id)).toBe(2);
  next.reflow({ width: 240, height: 250 });
  expect(next.snaps.has(a.id)).toBe(false);
  for (const tile of next.values()) {
    expect(tile.layout.x + tile.layout.width).toBeLessThanOrEqual(240);
    expect(tile.layout.y + tile.layout.height).toBeLessThanOrEqual(250);
  }
  next.unsnap(b.id);
  expect(next.snaps.size).toBe(0);
});
it('shrinks the snap column to the real narrow rail gap instead of covering primary controls', () => {
  const ws = fixture({ workspaceCard: true, minimumSize: { width: 220, height: 120 } });
  const card = ws.open('fixture.tile', 'narrow');
  const narrow = { width: 366, height: 824 };
  const rail = { x: 0, y: 50, width: 72, height: 774 };
  const header = { x: 0, y: 0, width: 366, height: 44 };
  const preview = ws.snapTarget(card.id, 0, narrow, [rail, header])!;
  expect(preview.rect).toMatchObject({ x: 80, y: 52, width: 286 });
  ws.snap(card.id, 0, narrow, [rail, header]);
  expect(card.layout).toMatchObject(preview.rect);
  expect(rectanglesOverlap(card.layout, rail, 7)).toBe(false);
});
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
  expect(demo.ui.at('bottomDock').map((x) => x.label)).toEqual(['More']);
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
it('defers Microsoft by default and keeps MID-02 deletion scoped to authenticated self', async () => {
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
  ).toEqual([
    {
      method: 'POST',
      path: '/api/v1/account/delete-account',
      operation: 'identity.delete-account',
      input: 'body',
    },
  ]);
  const deletion = modules[0]!.operations!.find((op) => op.id === 'identity.delete-account')!;
  expect(deletion.access).toMatchObject({ permission: 'identity.self' });
  expect(deletion.kind).toBe('authentication');
  expect(deletion.input.safeParse({ confirmation: 'DELETE', userId: 'someone-else' }).success).toBe(
    false,
  );
  const shell = await readFile('apps/web/app/components/room/RoomShell.vue', 'utf8');
  expect(shell).not.toMatch(/from .*demo|@study\/(?:identity|rooms)|getUserMedia|getDisplayMedia/);
});

it('clamps fractional-coordinate resize to an accepted minimum without moving the opposite anchors', () => {
  const ws = fixture({ minimumSize: { width: 200, height: 200 } });
  const tile = ws.open('fixture.tile', 'fractional-minimum');
  const bounds = { width: 1440, height: 1000 };
  const start = {
    ...tile.layout,
    x: 1010.3333333333334,
    y: 481.3333333333333,
    width: 320,
    height: 230.66666666666666,
  };
  for (const edge of ['se', 'nw', 'ne', 'sw'] as const) {
    ws.update(tile.id, start);
    expect(() =>
      ws.resize(
        tile.id,
        start,
        edge,
        edge.includes('w') ? 1000 : -1000,
        edge.includes('n') ? 1000 : -1000,
        bounds,
      ),
    ).not.toThrow();
    expect(tile.layout.width).toBeGreaterThanOrEqual(200);
    expect(tile.layout.width).toBeCloseTo(200, 10);
    expect(tile.layout.height).toBeGreaterThanOrEqual(200);
    expect(tile.layout.height).toBeCloseTo(200, 10);
    if (edge.includes('e')) expect(tile.layout.x).toBe(start.x);
    else expect(tile.layout.x + tile.layout.width).toBeCloseTo(start.x + start.width, 10);
    if (edge.includes('s')) expect(tile.layout.y).toBe(start.y);
    else expect(tile.layout.y + tile.layout.height).toBeCloseTo(start.y + start.height, 10);
  }
});
