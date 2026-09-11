import { afterEach, expect, it, vi } from 'vitest';
import { createBackgroundModel } from '../../apps/web/app/room/background-model.ts';
import type { RealtimeClient } from '../../apps/web/app/lib/realtime.ts';

const adapters = vi.hoisted(() => ({ preferences: vi.fn(), assets: vi.fn() }));
vi.mock('@study/adapters/indexeddb', () => ({
  createPreferenceStore: adapters.preferences,
  createLocalVisualStore: adapters.assets,
}));
afterEach(() => vi.restoreAllMocks());

function realtime(): RealtimeClient {
  return {
    state: { connected: true, errors: {} },
    send: vi.fn(),
    refresh: vi.fn(),
    subscribe: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

it('does not restore preferences or subscribe when a device read completes after disposal', async () => {
  let resolveRead!: (value: { selected: null; favorites: string[]; paused: boolean }) => void;
  const store = {
    get: vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    ),
    set: vi.fn(),
    close: vi.fn(),
  };
  adapters.preferences.mockResolvedValue(store);
  const client = realtime();
  const model = createBackgroundModel('room', 'account', client);
  const opening = model.init();
  await vi.waitFor(() => expect(store.get).toHaveBeenCalled());
  model.dispose();
  resolveRead({ selected: null, favorites: ['quiet-hours'], paused: true });
  await opening;
  expect(model.state.ready).toBe(false);
  expect(model.state.favorites).toEqual([]);
  expect(client.subscribe).not.toHaveBeenCalled();
  expect(store.set).not.toHaveBeenCalled();
  expect(store.close).toHaveBeenCalledTimes(1);
});

it('does not allocate thumbnail URLs when browsing completes after disposal', async () => {
  let resolveList!: (value: { thumbnail: Blob }[]) => void;
  const assets = {
    list: vi.fn(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    ),
    close: vi.fn(),
  };
  adapters.assets.mockResolvedValue(assets);
  const createUrl = vi.spyOn(URL, 'createObjectURL');
  const model = createBackgroundModel('room', 'account', realtime());
  const browsing = model.browse();
  await vi.waitFor(() => expect(assets.list).toHaveBeenCalled());
  model.dispose();
  resolveList([{ thumbnail: new Blob(['image']) }]);
  await browsing;
  expect(createUrl).not.toHaveBeenCalled();
  expect(model.state.customs).toEqual([]);
  expect(assets.close).toHaveBeenCalledTimes(1);
});
