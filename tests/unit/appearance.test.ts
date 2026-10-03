import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { createPreferenceStore } from '@study/adapters/indexeddb';
import {
  appearancePreference,
  layoutWidthPreference,
  glassTransparencyPreference,
  readPresentationPreference,
} from '../../apps/web/app/lib/appearance.ts';

describe('versioned presentation preferences', () => {
  it('rejects corrupt, future and untrusted SSR mirrors without changing stored identities', () => {
    for (const value of [
      null,
      'dark',
      { version: 2, value: 'dark' },
      { version: 1, value: 'arbitrary' },
      { version: 1, value: 'dark', role: 'owner' },
    ]) {
      expect(readPresentationPreference(appearancePreference, value)).toBe('system');
    }
    expect(readPresentationPreference(appearancePreference, { version: 1, value: 'dark' })).toBe(
      'dark',
    );
    expect(
      readPresentationPreference(layoutWidthPreference, { version: 1, value: 'compressed' }),
    ).toBe('compressed');
  });
  it('bounds manual glass values and defaults invalid mirrors to Auto', () => {
    for (const value of [-5, 105, 2.5, 72, '50', null, { opacity: 0 }]) {
      expect(readPresentationPreference(glassTransparencyPreference, { version: 1, value })).toBe(
        'auto',
      );
    }
    for (const value of ['auto', 0, 50, 100]) {
      expect(readPresentationPreference(glassTransparencyPreference, { version: 1, value })).toBe(
        value,
      );
    }
  });
  it('roundtrips through the accepted preference adapter and preserves unrelated records', async () => {
    const store = await createPreferenceStore(
      [appearancePreference, layoutWidthPreference, glassTransparencyPreference],
      'test-appearance',
    );
    await store.set(appearancePreference, 'dark');
    await store.set(layoutWidthPreference, 'full');
    await store.set(glassTransparencyPreference, 75);
    await store.close();
    const reopened = await createPreferenceStore(
      [appearancePreference, layoutWidthPreference, glassTransparencyPreference],
      'test-appearance',
    );
    expect(await reopened.get(appearancePreference)).toBe('dark');
    expect(await reopened.get(layoutWidthPreference)).toBe('full');
    expect(await reopened.get(glassTransparencyPreference)).toBe(75);
    await reopened.delete(appearancePreference.key);
    expect(await reopened.get(layoutWidthPreference)).toBe('full');
    await reopened.close();
  });
});
