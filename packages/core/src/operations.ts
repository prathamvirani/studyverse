import type {
  Actor,
  OperationContext,
  OperationContract,
  PermissionDefinition,
  RateLimiter,
  RegisteredOperation,
  Resource,
} from '@study/feature-sdk';
import { AppError } from './errors.ts';
import { Registry } from './registry.ts';
import type { FeatureFlags } from './flags.ts';
import { bounded, DeadlineExceeded } from './events.ts';

export class PermissionRegistry extends Registry<PermissionDefinition> {
  async authorize(
    actor: Actor | null,
    resource: Resource | null,
    permission: string,
  ): Promise<void> {
    if (!actor) throw new AppError('UNAUTHENTICATED');
    const policy = this.get(permission);
    // Missing and inaccessible resources are deliberately indistinguishable.
    if (!resource || !policy || !(await policy.allows(actor, resource)))
      throw new AppError('FORBIDDEN');
  }
}
export class OperationRegistry extends Registry<RegisteredOperation> {
  async invoke<I, O>(
    contract: OperationContract<I, O>,
    input: I,
    context: OperationContext,
  ): Promise<O> {
    return contract.output.parse(await this.execute(contract.id, input, context));
  }
  constructor(
    private readonly permissions: PermissionRegistry,
    private readonly flags: FeatureFlags,
    private readonly limiter: RateLimiter,
    private readonly timeoutMs = 5_000,
  ) {
    super();
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000)
      throw new Error('Invalid operation timeout');
  }
  override register(id: string, operation: RegisteredOperation) {
    if (operation.id !== id || (operation.kind === 'command' && 'public' in operation.access))
      throw new Error('Commands must be protected');
    if (!('public' in operation.access) && !this.permissions.get(operation.access.permission))
      throw new Error('Unknown permission');
    if (operation.flag && !this.flags.get(operation.flag)) throw new Error('Unknown flag');
    if (
      !Number.isInteger(operation.rate.limit) ||
      operation.rate.limit < 1 ||
      operation.rate.windowMs < 1
    )
      throw new Error('Invalid rate policy');
    return super.register(id, operation);
  }
  async execute(id: string, raw: unknown, context: OperationContext): Promise<unknown> {
    try {
      return await bounded(
        (signal) =>
          this.dispatch(id, raw, {
            ...context,
            signal: AbortSignal.any([context.signal, signal]),
          }),
        this.timeoutMs,
      );
    } catch (error) {
      if (error instanceof DeadlineExceeded) throw new AppError('UNAVAILABLE');
      throw error;
    }
  }
  private async dispatch(id: string, raw: unknown, context: OperationContext): Promise<unknown> {
    context.signal.throwIfAborted();
    const operation = this.get(id);
    if (!operation) throw new AppError('NOT_FOUND');
    if (operation.kind === 'authentication' && !context.browser) throw new AppError('FORBIDDEN');
    if (!('public' in operation.access) && !context.actor) throw new AppError('UNAUTHENTICATED');
    const input = operation.input.safeParse(raw);
    if (!input.success) throw new AppError('INVALID_REQUEST');
    const identity = context.actor?.subjectId ?? 'anonymous';
    if (!(await this.limiter.consume(`operation:${id}:${identity}`, operation.rate)))
      throw new AppError('RATE_LIMITED');
    const resource =
      'public' in operation.access ? null : await operation.access.resource(input.data, context);
    if (!('public' in operation.access))
      await this.permissions.authorize(context.actor, resource, operation.access.permission);
    if (operation.flag && !this.flags.enabled(operation.flag, context.actor, resource?.scopeId))
      throw new AppError('NOT_FOUND');
    context.signal.throwIfAborted();
    const result = await operation.handle(input.data, { ...context, resource });
    const output = operation.output.safeParse(result);
    if (!output.success) throw new AppError('INTERNAL');
    return output.data;
  }
}
