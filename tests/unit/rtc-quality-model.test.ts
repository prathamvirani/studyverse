import { expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { createQualityModel } from '../../apps/web/app/room/rtc-quality.ts';
import { qualityPreset } from '@study/contracts';
import type { RealtimeMediaProvider } from '@study/feature-sdk';
function provider(): RealtimeMediaProvider {
  let prefs = qualityPreset('balanced');
  return {
    snapshot: () => ({ connection: 'disconnected', tracks: [] }),
    listen: () => () => {},
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    publish: vi.fn(async () => {}),
    unpublish: vi.fn(async () => {}),
    mute: vi.fn(async () => {}),
    switchDevice: vi.fn(async () => {}),
    devices: async () => [],
    receive: () => {},
    quality: {
      capabilities: () => ({ stage: 'a', codecs: ['vp8'], processing: [] }),
      preferences: () => prefs,
      apply: vi.fn(async (p) => {
        prefs = p;
      }),
    },
  };
}
it('restores private preferences before enabling controls without starting capture', async () => {
  const id = crypto.randomUUID(),
    p = provider();
  let model = createQualityModel(p, id);
  await model.ready;
  await model.apply(qualityPreset('high'));
  await model.save('Home');
  await model.dispose();
  model = createQualityModel(p, id);
  await model.ready;
  expect(model.state.current.camera.width).toBe(1920);
  expect(model.state.saved[0]!.name).toBe('Home');
  expect(p.publish).not.toHaveBeenCalled();
  expect(p.connect).not.toHaveBeenCalled();
  await model.dispose();
});
it('independent tabs do not automatically apply each other’s profile or capture state', async () => {
  const id = crypto.randomUUID(),
    a = provider(),
    b = provider();
  const first = createQualityModel(a, id),
    second = createQualityModel(b, id);
  await Promise.all([first.ready, second.ready]);
  await first.apply(qualityPreset('high'));
  expect(second.state.current.mode).toBe('basic');
  expect(b.publish).not.toHaveBeenCalled();
  await Promise.all([first.dispose(), second.dispose()]);
});
it('late preference reads cannot apply to a disposed room', async () => {
  const p = provider();
  const model = createQualityModel(p, crypto.randomUUID());
  await model.dispose();
  expect(p.quality!.apply).not.toHaveBeenCalled();
  expect(p.publish).not.toHaveBeenCalled();
});
