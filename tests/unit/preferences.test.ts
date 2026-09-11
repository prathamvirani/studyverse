import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { openDB, deleteDB } from 'idb';
import { z } from '@study/contracts';
import { createPreferenceStore } from '@study/adapters/indexeddb';

const definition = {
  key: 'fixture.display',
  version: 1,
  schema: z.strictObject({ scale: z.number().min(0.5).max(2) }),
  defaultValue: { scale: 1 },
};
describe('local-only preferences', () => {
  it('persists registered non-sensitive preferences and supports clear/delete', async () => {
    const name = 'test-preferences',
      store = await createPreferenceStore([definition], name);
    expect(store.mode).toBe('indexeddb');
    await store.set(definition, { scale: 1.5 });
    await store.close();
    const reopened = await createPreferenceStore([definition], name);
    expect(await reopened.get(definition)).toEqual({ scale: 1.5 });
    await reopened.delete(definition.key);
    expect(await reopened.get(definition)).toEqual({ scale: 1 });
    await reopened.set(definition, { scale: 2 });
    await reopened.clear();
    expect(await reopened.get(definition)).toEqual({ scale: 1 });
    await reopened.close();
    await deleteDB(name);
  });
  it('rejects unknown keys, identity material and invalid data', async () => {
    const store = await createPreferenceStore([definition], 'test-allowlist');
    await expect(store.set({ ...definition, key: 'auth.token' }, { scale: 1 })).rejects.toThrow(
      'Unregistered',
    );
    await expect(
      store.set(definition, { scale: 1, sessionToken: 'secret' } as never),
    ).rejects.toThrow();
    await expect(
      createPreferenceStore([{ ...definition, key: 'refresh-token' }]),
    ).rejects.toThrow();
    await expect(store.set(definition, { scale: 100 })).rejects.toThrow();
    await store.close();
    await deleteDB('test-allowlist');
  });
  it('validates corrupt records and supports explicitly versioned local migrations', async () => {
    const name = 'test-migrations',
      store = await createPreferenceStore([definition], name);
    await store.close();
    const db = await openDB(name);
    await db.put('preferences', { version: 1, value: { scale: 'corrupt' } }, definition.key);
    db.close();
    const newer = { ...definition, version: 2, migrate: () => ({ scale: 1.25 }) };
    const migrated = await createPreferenceStore([newer], name);
    expect(await migrated.get(newer)).toEqual({ scale: 1.25 });
    await migrated.close();
    const original = await createPreferenceStore([definition], name);
    expect(await original.get(definition)).toEqual({ scale: 1 });
    await original.close();
    await deleteDB(name);
  });
  it('falls back to memory when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    try {
      const store = await createPreferenceStore([definition]);
      expect(store.mode).toBe('memory');
      await store.set(definition, { scale: 2 });
      expect(await store.get(definition)).toEqual({ scale: 2 });
      await store.close();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
