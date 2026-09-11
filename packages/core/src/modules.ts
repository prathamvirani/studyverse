import { identifier } from '@study/contracts';
import type {
  Dispose,
  FeatureModule,
  LifecycleContext,
  Observer,
  RateLimiter,
} from '@study/feature-sdk';
import { HttpRegistry, RealtimeRegistry } from './bindings.ts';
import { EventBus, bounded } from './events.ts';
import { FeatureFlags } from './flags.ts';
import { OperationRegistry, PermissionRegistry } from './operations.ts';
import { noopObserver } from './observability.ts';
import { UiRegistry, TileRegistry } from './ui.ts';

export function orderModules(modules: readonly FeatureModule[]): FeatureModule[] {
  const byId = new Map<string, FeatureModule>();
  for (const module of modules) {
    identifier.parse(module.id);
    if (!/^\d+\.\d+\.\d+$/.test(module.version) || byId.has(module.id))
      throw new Error('Invalid or duplicate module');
    byId.set(module.id, module);
  }
  const ordered: FeatureModule[] = [],
    visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (module: FeatureModule) => {
    if (visiting.has(module.id)) throw new Error('Circular module dependency');
    if (visited.has(module.id)) return;
    visiting.add(module.id);
    for (const dependency of module.dependencies ?? []) {
      const target = byId.get(dependency.id);
      if (!target && !dependency.optional) throw new Error(`Missing module: ${dependency.id}`);
      if (target) {
        if (Number(target.version.split('.')[0]) !== dependency.major)
          throw new Error('Incompatible module dependency');
        visit(target);
      }
    }
    visiting.delete(module.id);
    visited.add(module.id);
    ordered.push(module);
  };
  for (const module of modules) visit(module);
  return ordered;
}
export class ModuleRuntime {
  readonly permissions = new PermissionRegistry();
  readonly flags: FeatureFlags;
  readonly operations: OperationRegistry;
  readonly http: HttpRegistry;
  readonly realtime: RealtimeRegistry;
  readonly events: EventBus;
  readonly ui = new UiRegistry();
  readonly tiles = new TileRegistry();
  private readonly active = new Map<string, { module: FeatureModule; disposers: Dispose[] }>();
  private started = false;
  constructor(
    limiter: RateLimiter,
    environment: string,
    private readonly observer: Observer = noopObserver,
    private readonly timeoutMs = 2_000,
  ) {
    this.flags = new FeatureFlags(environment);
    this.operations = new OperationRegistry(this.permissions, this.flags, limiter);
    this.http = new HttpRegistry(this.operations);
    this.realtime = new RealtimeRegistry(this.operations);
    this.events = new EventBus(observer, timeoutMs);
  }
  private context(signal: AbortSignal): LifecycleContext {
    return { signal, events: this.events, observer: this.observer };
  }
  async start(modules: readonly FeatureModule[]): Promise<void> {
    if (this.started) throw new Error('Runtime already started');
    const ordered = orderModules(modules);
    this.started = true;
    try {
      for (const module of ordered) {
        const disposers: Dispose[] = [];
        try {
          for (const dependency of module.dependencies ?? []) {
            if (!dependency.optional && !this.active.has(dependency.id))
              throw new Error('Dependency unavailable');
          }
          const own = (id: string) => {
            if (!id.startsWith(`${module.id}.`))
              throw new Error('Registration must use module namespace');
          };
          for (const migration of module.migrations ?? [])
            if (migration.owner !== module.id) throw new Error('Migration ownership mismatch');
          for (const item of module.permissions ?? []) {
            own(item.id);
            disposers.push(this.permissions.register(item.id, item));
          }
          for (const item of module.flags ?? []) {
            own(item.id);
            disposers.push(this.flags.register(item.id, item));
          }
          for (const item of module.operations ?? []) {
            own(item.id);
            disposers.push(this.operations.register(item.id, item));
          }
          for (const item of module.http ?? []) {
            own(item.operation);
            disposers.push(this.http.register(item));
          }
          for (const item of module.realtime ?? []) {
            own(item.command);
            own(item.operation);
            disposers.push(this.realtime.register(item.command, item));
          }
          for (const item of module.events ?? []) {
            own(item.id);
            disposers.push(this.events.register(item.id, item));
          }
          for (const item of module.subscriptions ?? [])
            disposers.push(this.events.subscribe(item.event, item.handle));
          for (const item of module.ui ?? []) {
            own(item.id);
            disposers.push(this.ui.register(item.id, item));
          }
          for (const item of module.tiles ?? []) {
            own(item.type);
            disposers.push(this.tiles.register(item.type, item));
          }
          if (module.start)
            await bounded((signal) => module.start!(this.context(signal)), this.timeoutMs);
          this.active.set(module.id, { module, disposers });
          for (const job of module.jobs ?? []) {
            own(job.id);
            // Jobs are bounded one-shot lifecycle tasks, not a durable background queue.
            try {
              await bounded((signal) => job.run(this.context(signal)), this.timeoutMs);
            } catch {
              this.observer.record('module.job.failed', { module: module.id, job: job.id });
            }
          }
        } catch (error) {
          this.active.delete(module.id);
          for (const dispose of disposers.reverse()) dispose();
          if (module.stop) {
            try {
              await bounded((signal) => module.stop!(this.context(signal)), this.timeoutMs);
            } catch {
              /* Already failed; preserve original cause. */
            }
          }
          this.observer.record('module.start.failed', { module: module.id });
          if (module.required) throw error;
        }
      }
    } catch (error) {
      await this.stop();
      throw error;
    }
  }
  async stop(): Promise<void> {
    for (const { module, disposers } of [...this.active.values()].reverse()) {
      // Remove entry points before releasing module resources.
      for (const dispose of disposers.reverse()) dispose();
      try {
        if (module.stop)
          await bounded((signal) => module.stop!(this.context(signal)), this.timeoutMs);
      } catch {
        this.observer.record('module.stop.failed', { module: module.id });
      }
    }
    this.active.clear();
    this.started = false;
  }
  capabilities(): string[] {
    return [
      ...new Set([...this.active.values()].flatMap(({ module }) => module.capabilities ?? [])),
    ].sort();
  }
  async connectionClosed(id: string): Promise<void> {
    await Promise.all(
      [...this.active.values()].map(async ({ module }) => {
        if (module.connectionClosed) {
          try {
            await bounded(() => module.connectionClosed!(id), this.timeoutMs);
          } catch {
            this.observer.record('module.connection-cleanup.failed', { module: module.id });
          }
        }
      }),
    );
  }
  moduleIds(): readonly string[] {
    return [...this.active.keys()];
  }
}
