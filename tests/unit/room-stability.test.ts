import { expect, it, vi, afterEach } from 'vitest';
import { createRealtimeClient } from '../../apps/web/app/lib/realtime.ts';
import { createBackgroundModel } from '../../apps/web/app/room/background-model.ts';
import { randomUUID } from 'node:crypto';
import {
  TileRegistry,
  Workspace,
  resizeLayout,
  avoidOverlap,
  rectanglesOverlap,
} from '@study/core/browser';
import { layoutSchema } from '@study/contracts';
import type { RealtimeClient } from '../../apps/web/app/lib/realtime.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('retains feature state on transient refresh failure and rejects retired subscription replies', async () => {
  vi.useFakeTimers();
  const sockets: FakeSocket[] = [];
  class FakeSocket {
    readyState = 1;
    onopen?: () => void;
    onclose?: () => void;
    onmessage?: (e: { data: string }) => void;
    sent: { requestId: string; command: string }[] = [];
    constructor() {
      sockets.push(this);
    }
    send(raw: string) {
      this.sent.push(JSON.parse(raw));
    }
    close() {
      this.readyState = 3;
      this.onclose?.();
    }
  }
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('location', { host: 'localhost' });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ csrfToken: 'x'.repeat(43) }) })),
  );
  const client = createRealtimeClient(),
    receive = vi.fn(),
    clear = vi.fn();
  client.subscribe('fixture.snapshot', {}, receive, clear);
  client.start();
  await vi.advanceTimersByTimeAsync(0);
  sockets[0]!.onopen?.();
  clear.mockClear();
  const request = sockets[0]!.sent[0]!;
  sockets[0]!.onmessage?.({
    data: JSON.stringify({ error: { requestId: request.requestId, code: 'RATE_LIMITED' } }),
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(clear).not.toHaveBeenCalled();
  const retired = receive;
  const replacement = vi.fn();
  client.subscribe('fixture.snapshot', { version: 2 }, replacement, clear);
  sockets[0]!.onmessage?.({
    data: JSON.stringify({ requestId: request.requestId, result: { retired: true } }),
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(retired).not.toHaveBeenCalled();
  client.stop();
});
it.each(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const)(
  'clamps %s edges without moving the opposite anchor, and resumes after boundary overshoot',
  (edge) => {
    const start = {
        version: 1 as const,
        x: 100,
        y: 100,
        width: 300,
        height: 200,
        zIndex: 0,
        minimized: false,
        fullscreen: false,
      },
      bounds = { width: 600, height: 500 },
      minimum = { width: 160, height: 120 };
    const end = resizeLayout(
      start,
      edge,
      edge.includes('w') ? -2000 : 2000,
      edge.includes('n') ? -2000 : 2000,
      minimum,
      bounds,
    );
    if (edge.includes('e')) expect(end.x).toBe(start.x);
    if (edge.includes('w')) expect(end.x + end.width).toBe(start.x + start.width);
    if (edge.includes('s')) expect(end.y).toBe(start.y);
    if (edge.includes('n')) expect(end.y + end.height).toBe(start.y + start.height);
    expect(end.x).toBeGreaterThanOrEqual(0);
    expect(end.y).toBeGreaterThanOrEqual(0);
    expect(end.x + end.width).toBeLessThanOrEqual(bounds.width);
    expect(end.y + end.height).toBeLessThanOrEqual(bounds.height);
    const resumed = resizeLayout(start, edge, 20, 20, minimum, bounds);
    expect(resumed).not.toEqual(end);
  },
);
it('places atmosphere beside occupied room objects or reports no safe space', () => {
  const obstacles = [
      { x: 0, y: 0, width: 100, height: 500 },
      { x: 300, y: 0, width: 300, height: 500 },
    ],
    bounds = { width: 600, height: 500 };
  const placed = avoidOverlap({ x: 20, y: 20, width: 160, height: 80 }, obstacles, bounds)!;
  expect(placed).not.toBeNull();
  expect(obstacles.some((o) => rectanglesOverlap(placed, o))).toBe(false);
  expect(avoidOverlap({ x: 0, y: 0, width: 600, height: 500 }, obstacles, bounds)).toBeNull();
});

it('does not roll an accepted wallpaper back on stale snapshots or temporary transport loss', async () => {
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      decode = async () => {};
    },
  );
  let receive: (v: unknown) => void = () => {},
    clear = () => {};
  const realtime = {
    subscribe: (_c: string, _p: unknown, r: typeof receive, c: typeof clear) => {
      receive = r;
      clear = c;
    },
  } as RealtimeClient;
  const roomId = randomUUID();
  const model = createBackgroundModel(roomId, randomUUID(), realtime);
  await model.init();
  const ids = model.catalog.assets().map((a) => a.id);
  receive({ state: { roomId, assetId: ids[1], version: 2 }, canControl: true });
  const accepted = model.state.roomAsset;
  receive({ state: { roomId, assetId: ids[0], version: 1 }, canControl: true });
  expect(model.state.roomAsset).toBe(accepted);
  clear();
  expect(model.state.roomAsset).toBe(accepted);
  model.dispose();
});

it('keeps the opposite resize anchor fixed after the active edge reaches a viewport boundary', () => {
  const types = new TileRegistry();
  types.register('fixture.tile', {
    type: 'fixture.tile',
    label: 'Fixture',
    load: async () => ({}),
    defaultSize: { width: 300, height: 200 },
    minimumSize: { width: 160, height: 120 },
    resizable: true,
    fullscreenable: true,
    layoutSchema,
  });
  const ws = new Workspace(types),
    tile = ws.open('fixture.tile', 'one');
  const bounds = { width: 900, height: 600 };
  ws.place(tile.id, { x: 600, y: 400 }, bounds, false);
  ws.resize(tile.id, { ...tile.layout }, 'se', 200, 200, bounds);
  expect(tile.layout.x).toBe(600);
  expect(tile.layout.y).toBe(400);
});

it('allocates snap heights from content minima without reducing free movement bounds', () => {
  const types = new TileRegistry();
  for (const [type, height] of [
    ['timer', 260],
    ['tasks', 200],
    ['chat', 200],
    ['clock', 120],
  ] as const)
    types.register(type, {
      type,
      label: type,
      workspaceCard: true,
      defaultSize: { width: 320, height },
      minimumSize: { width: 200, height },
      resizable: true,
      fullscreenable: true,
      layoutSchema,
      load: async () => ({}),
    });
  const workspace = new Workspace(types),
    bounds = { width: 1400, height: 976 },
    slots = workspace.snapSlots(bounds);
  expect(slots).toHaveLength(4);
  for (let index = 0; index < slots.length; index++) {
    expect(slots[index]!.height).toBeGreaterThanOrEqual([260, 200, 200, 120][index]!);
    if (index)
      expect(slots[index]!.y).toBeCloseTo(slots[index - 1]!.y + slots[index - 1]!.height + 10);
  }
  expect(slots[3]!.y + slots[3]!.height).toBeCloseTo(bounds.height);
  const free = workspace.open('clock', 'free');
  workspace.place(free.id, { x: 0, y: 900 }, bounds, false);
  expect(free.layout.y + free.layout.height).toBe(bounds.height);
});
