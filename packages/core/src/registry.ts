import { identifier } from '@study/contracts';
import type { Dispose } from '@study/feature-sdk';

export class Registry<T> {
  private readonly items = new Map<string, T>();
  register(id: string, value: T): Dispose {
    identifier.parse(id);
    if (this.items.has(id)) throw new Error(`Duplicate registration: ${id}`);
    this.items.set(id, value);
    return () => {
      if (this.items.get(id) === value) this.items.delete(id);
    };
  }
  get(id: string): T | undefined {
    return this.items.get(id);
  }
  values(): readonly T[] {
    return [...this.items.values()];
  }
  keys(): readonly string[] {
    return [...this.items.keys()];
  }
}
