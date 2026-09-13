import { expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  effectiveVideo,
  mediaQualitySchema,
  qualityPreset,
  receiveTarget,
  voiceProfile,
} from '@study/contracts';
import { mediaPreference } from '@study/rtc/browser';
import { createPreferenceStore } from '@study/adapters/indexeddb';
it('Balanced retains accepted capture defaults and independent adaptive receive ceilings', () => {
  const p = qualityPreset('balanced');
  expect(p.camera).toMatchObject({ width: 1280, height: 720, fps: 30, bitrate: 2_000_000 });
  expect(p.screen).toMatchObject({ width: 1920, height: 1080, fps: 30, bitrate: 4_000_000 });
  expect(p.mode).toBe('basic');
  p.cameraReceive.width = 640;
  expect(p.camera.width).toBe(1280);
  expect(qualityPreset('data-saver').camera.bitrate).toBe(400_000);
  expect(qualityPreset('high').camera).toMatchObject({ width: 1920, height: 1080, fps: 60 });
});
it('custom resolution, bitrate and fractional/high-refresh FPS have finite resource bounds', () => {
  const p = qualityPreset('high');
  Object.assign(p.screen, { width: 3840, height: 2160, fps: 250, bitrate: 50_000_000 });
  expect(mediaQualitySchema.parse(p)).toEqual(p);
  for (const [field, value] of [
    ['width', 0],
    ['height', 4321],
    ['fps', 251],
    ['fps', NaN],
    ['fps', Infinity],
    ['bitrate', 99_999],
    ['bitrate', 50_000_001],
    ['codec', 'h265'],
  ] as const)
    expect(
      mediaQualitySchema.safeParse({ ...p, camera: { ...p.camera, [field]: value } }).success,
    ).toBe(false);
  p.camera.fps = 59.94;
  expect(mediaQualitySchema.safeParse(p).success).toBe(true);
  expect(mediaQualitySchema.safeParse({ ...p, token: 'secret', cameraOn: true }).success).toBe(
    false,
  );
});
it('progressive flags reduce requests without mutating requested intent', () => {
  const p = {
    ...qualityPreset('high').camera,
    width: 3840,
    height: 2160,
    fps: 250,
    bitrate: 40_000_000,
  };
  expect(effectiveVideo(p, 'camera', 'basic')).toMatchObject({
    width: 1280,
    height: 720,
    fps: 30,
    bitrate: 2_000_000,
  });
  expect(effectiveVideo(p, 'camera', 'a')).toMatchObject({
    width: 1920,
    height: 1080,
    fps: 60,
    bitrate: 8_000_000,
  });
  expect(effectiveVideo(p, 'camera', 'b')).toMatchObject({ width: 2560, height: 1440, fps: 60 });
  expect(effectiveVideo(p, 'camera', 'c')).toMatchObject({ width: 3840, height: 2160, fps: 60 });
  expect(effectiveVideo(p, 'camera', 'd')).toMatchObject({ width: 3840, height: 2160, fps: 250 });
  expect(p.fps).toBe(250);
});
it('native requests retain deployment bounds and ultrawide intent scales proportionally', () => {
  const p = { ...qualityPreset('balanced').screen, resolution: 'native' as const, fps: null };
  expect(effectiveVideo(p, 'screen', 'a')).toMatchObject({ width: 1920, height: 1080, fps: 60 });
  expect(
    effectiveVideo({ ...p, resolution: 'fixed', width: 3440, height: 1440 }, 'screen', 'b').height,
  ).toBe(1071);
});
it('circle, small tile, fullscreen, receive ceiling and hidden targets stay useful', () => {
  const p = qualityPreset('high').camera;
  expect(receiveTarget(p, 'circle', { width: 90, height: 90 })).toEqual({
    width: 640,
    height: 360,
    fps: 60,
  });
  expect(receiveTarget(p, 'workspace', { width: 480, height: 300 })).toEqual({
    width: 480,
    height: 300,
    fps: 60,
  });
  expect(receiveTarget(p, 'workspace', { width: 3840, height: 2160 })).toEqual({
    width: 1920,
    height: 1080,
    fps: 60,
  });
  expect(receiveTarget(p, 'hidden')).toEqual({ width: 0, height: 0, fps: 0 });
});
it('Studio Voice uses normal high quality Opus intent with opt-in DSP', () => {
  expect(voiceProfile('studio')).toMatchObject({
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    bitrate: 128_000,
    dtx: false,
  });
  expect(voiceProfile('high').echoCancellation).toBe(true);
  expect(voiceProfile('standard').autoGainControl).toBe(true);
});
it('allowlisted preferences persist current and named profiles without activation or secrets', async () => {
  const definition = mediaPreference('test-user');
  const db = `rtc-quality-test-${crypto.randomUUID()}`;
  let store = await createPreferenceStore([definition], db);
  const value = {
    current: qualityPreset('high'),
    saved: [{ name: 'Home Fibre', quality: qualityPreset('high') }],
  };
  await store.set(definition, value);
  await store.close();
  store = await createPreferenceStore([definition], db);
  expect(await store.get(definition)).toEqual(value);
  expect(JSON.stringify(value)).not.toMatch(/cameraOn|microphoneOn|token|stream|credential/);
  await store.clear();
  await store.close();
});
