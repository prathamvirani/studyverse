import type { Dispose, HttpBinding, RealtimeBinding } from '@study/feature-sdk';
import type { OperationRegistry } from './operations.ts';
import { Registry } from './registry.ts';

export class HttpRegistry {
  private readonly bindings = new Map<string, HttpBinding>();
  constructor(private readonly operations: OperationRegistry) {}
  register(binding: HttpBinding): Dispose {
    const operation = this.operations.get(binding.operation);
    if (!operation || !/^\/api\/v1\/[A-Za-z0-9/:._-]+$/.test(binding.path))
      throw new Error('Invalid HTTP binding');
    const safe = binding.method === 'GET' || binding.method === 'HEAD';
    if (
      operation.kind === 'authentication' &&
      (binding.method !== 'POST' || binding.input !== 'body')
    )
      throw new Error('Authentication requires an explicit POST body binding');
    if (safe && operation.kind !== 'query') throw new Error('Safe methods cannot mutate');
    if (safe && binding.input === 'body') throw new Error('Safe methods cannot accept bodies');
    const canonical = binding.path.replace(/:[^/]+/g, ':param');
    const key = `${binding.method === 'HEAD' ? 'GET' : binding.method} ${canonical}`;
    if (this.bindings.has(key)) throw new Error('Conflicting HTTP binding');
    this.bindings.set(key, binding);
    return () => {
      this.bindings.delete(key);
    };
  }
  values(): readonly HttpBinding[] {
    return [...this.bindings.values()];
  }
}
export class RealtimeRegistry extends Registry<RealtimeBinding> {
  constructor(private readonly operations: OperationRegistry) {
    super();
  }
  override register(id: string, binding: RealtimeBinding) {
    if (
      id !== binding.command ||
      !this.operations.get(binding.operation) ||
      this.operations.get(binding.operation)?.kind === 'authentication'
    )
      throw new Error('Invalid realtime binding');
    if (binding.snapshotEvent && this.operations.get(binding.operation)?.kind !== 'query')
      throw new Error('Snapshots require a read-only operation');
    return super.register(id, binding);
  }
}
