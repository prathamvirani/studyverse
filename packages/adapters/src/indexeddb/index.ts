import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { PreferenceDefinition, PreferenceStore } from '@study/feature-sdk';

const forbidden = /token|session|password|credential|secret|authorization|cookie/i;
function safeValue(value: unknown): void {
  if (Array.isArray(value)) {
    for (const child of value) safeValue(child);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (forbidden.test(key)) throw new Error('Sensitive preference field prohibited');
      safeValue(child);
    }
  }
}
interface SavedPreference {
  version: number;
  value: unknown;
}
class LocalPreferences implements PreferenceStore {
  private readonly definitions = new Map<string, PreferenceDefinition<unknown>>();
  private readonly memory = new Map<string, SavedPreference>();
  private degraded = false;
  constructor(
    definitions: readonly PreferenceDefinition<unknown>[],
    private readonly db: IDBPDatabase | null,
  ) {
    for (const definition of definitions) {
      if (
        !/^[a-z][a-z0-9.-]{0,99}$/.test(definition.key) ||
        forbidden.test(definition.key) ||
        this.definitions.has(definition.key) ||
        !Number.isInteger(definition.version) ||
        definition.version < 1
      )
        throw new Error('Invalid preference definition');
      safeValue(definition.schema.parse(definition.defaultValue));
      this.definitions.set(definition.key, definition);
    }
  }
  get mode(): 'indexeddb' | 'memory' {
    return this.db && !this.degraded ? 'indexeddb' : 'memory';
  }
  private registered<T>(definition: PreferenceDefinition<T>): void {
    if (this.definitions.get(definition.key) !== definition)
      throw new Error('Unregistered preference definition');
  }
  async get<T>(definition: PreferenceDefinition<T>): Promise<T> {
    this.registered(definition);
    let stored: SavedPreference | undefined = this.memory.get(definition.key);
    try {
      if (this.mode === 'indexeddb')
        stored = (await this.db!.get('preferences', definition.key)) as SavedPreference | undefined;
    } catch {
      this.degraded = true;
    }
    if (!stored) return structuredClone(definition.defaultValue);
    try {
      const value: unknown =
        stored.version === definition.version
          ? stored.value
          : stored.version < definition.version
            ? definition.migrate?.(stored.value, stored.version)
            : undefined;
      const validated = definition.schema.parse(value);
      safeValue(validated);
      this.memory.set(definition.key, { version: definition.version, value: validated });
      return structuredClone(validated);
    } catch {
      return structuredClone(definition.defaultValue);
    }
  }
  async set<T>(definition: PreferenceDefinition<T>, value: T): Promise<void> {
    this.registered(definition);
    const validated = definition.schema.parse(value);
    safeValue(validated);
    const stored = { version: definition.version, value: structuredClone(validated) };
    this.memory.set(definition.key, stored);
    try {
      if (this.mode === 'indexeddb') await this.db!.put('preferences', stored, definition.key);
    } catch {
      this.degraded = true;
    }
  }
  async delete(key: string): Promise<void> {
    if (!this.definitions.has(key)) throw new Error('Unregistered preference');
    this.memory.delete(key);
    // Deletion failures are surfaced: never claim that durable private data was cleared.
    if (this.db) await this.db.delete('preferences', key);
  }
  async clear(): Promise<void> {
    if (this.db) await this.db.clear('preferences');
    this.memory.clear();
  }
  async close(): Promise<void> {
    this.db?.close();
  }
}
export async function createPreferenceStore(
  definitions: readonly PreferenceDefinition<unknown>[],
  databaseName = 'study-preferences-v1',
): Promise<LocalPreferences> {
  // Validate the allowlist before opening any browser storage.
  new LocalPreferences(definitions, null);
  let db: IDBPDatabase | null = null;
  try {
    db = await openDB(databaseName, 1, {
      upgrade(database) {
        database.createObjectStore('preferences');
      },
      blocking() {
        db?.close();
      },
    });
  } catch {
    /* Private browsing, SSR or disabled storage: keep preferences in memory. */
  }
  return new LocalPreferences(definitions, db);
}
