import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import type { EphemeralStore, RateLimiter, RatePolicy } from '@study/feature-sdk';
import { AppError } from '@study/core';

export function createRedis(url: string) {
  return createClient({
    url,
    socket: { connectTimeout: 3_000, reconnectStrategy: false },
    disableOfflineQueue: true,
    commandsQueueMaxLength: 1_000,
  });
}
export type RedisConnection = ReturnType<typeof createRedis>;
function stateKey(namespace: string, key: string): string {
  if (!/^[a-z][a-z0-9.-]{0,99}$/.test(namespace) || key.length > 512)
    throw new Error('Invalid ephemeral namespace/key');
  return `state:${namespace}:${Buffer.from(key).toString('base64url')}`;
}
export class RedisEphemeralStore implements EphemeralStore {
  constructor(private readonly redis: RedisConnection) {}
  async get(namespace: string, key: string): Promise<string | null> {
    return this.redis.withAbortSignal(AbortSignal.timeout(3_000)).get(stateKey(namespace, key));
  }
  async set(namespace: string, key: string, value: string, ttlMs: number): Promise<void> {
    if (
      !Number.isInteger(ttlMs) ||
      ttlMs < 1 ||
      ttlMs > 86_400_000 ||
      Buffer.byteLength(value) > 65_536
    )
      throw new Error('Invalid ephemeral value/TTL');
    await this.redis
      .withAbortSignal(AbortSignal.timeout(3_000))
      .set(stateKey(namespace, key), value, { PX: ttlMs });
  }
  async delete(namespace: string, key: string): Promise<void> {
    await this.redis.withAbortSignal(AbortSignal.timeout(3_000)).del(stateKey(namespace, key));
  }
}
const consumeScript =
  "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end; return n";
export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: RedisConnection) {}
  async consume(key: string, policy: RatePolicy): Promise<boolean> {
    if (
      !Number.isInteger(policy.limit) ||
      policy.limit < 1 ||
      !Number.isInteger(policy.windowMs) ||
      policy.windowMs < 1
    )
      throw new Error('Invalid rate limit');
    try {
      const count = await this.redis
        .withAbortSignal(AbortSignal.timeout(2_000))
        .eval(consumeScript, {
          keys: [`rate:${createHash('sha256').update(key).digest('hex')}`],
          arguments: [String(policy.windowMs)],
        });
      return typeof count === 'number' && count <= policy.limit;
    } catch {
      throw new AppError('UNAVAILABLE');
    }
  }
}
