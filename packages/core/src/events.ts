import type { Dispose, EventDefinition, EventPublisher, Observer } from '@study/feature-sdk';
import { Registry } from './registry.ts';
import { noopObserver } from './observability.ts';

export class DeadlineExceeded extends Error {
  constructor() {
    super('Operation timed out');
  }
}
export async function bounded<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => work(controller.signal)),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new DeadlineExceeded());
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}
export class EventBus extends Registry<EventDefinition> implements EventPublisher {
  private readonly subscribers = new Map<
    string,
    Set<(payload: unknown, signal: AbortSignal) => Promise<void>>
  >();
  constructor(
    private readonly observer: Observer = noopObserver,
    private readonly timeoutMs = 2_000,
  ) {
    super();
  }
  subscribe(
    id: string,
    handler: (payload: unknown, signal: AbortSignal) => Promise<void>,
  ): Dispose {
    if (!this.get(id)) throw new Error(`Unknown event: ${id}`);
    const subscribers = this.subscribers.get(id) ?? new Set();
    subscribers.add(handler);
    this.subscribers.set(id, subscribers);
    return () => {
      subscribers.delete(handler);
      if (!subscribers.size) this.subscribers.delete(id);
    };
  }
  async emit<T>(definition: EventDefinition<T>, payload: T): Promise<void> {
    const registered = this.get(definition.id);
    if (!registered) throw new Error(`Unknown event: ${definition.id}`);
    const validated = registered.schema.parse(payload);
    await Promise.all(
      [...(this.subscribers.get(definition.id) ?? [])].map(async (handler) => {
        try {
          await bounded((signal) => handler(structuredClone(validated), signal), this.timeoutMs);
        } catch {
          this.observer.record('event.subscriber.failed', { event: definition.id });
        }
      }),
    );
  }
}
