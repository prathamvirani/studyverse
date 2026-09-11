import { expect, it, vi } from 'vitest';
import { createReadinessProbe, READINESS_TIMEOUT_MS } from '../../apps/api/src/readiness.ts';

it('bounds stalled checks, aborts them and coalesces probes until the dependency settles', async () => {
  vi.useFakeTimers();
  try {
    let finish!: (value: boolean) => void;
    let signal: AbortSignal | undefined;
    const check = vi.fn(async (input: AbortSignal) => {
      signal = input;
      return new Promise<boolean>((resolve) => {
        finish = resolve;
      });
    });
    const probe = createReadinessProbe(check);
    const first = probe();
    expect(probe()).toBe(first);
    await vi.advanceTimersByTimeAsync(READINESS_TIMEOUT_MS);
    expect(await first).toEqual({ status: 'unavailable' });
    expect(signal?.aborted).toBe(true);
    expect(await probe()).toEqual({ status: 'unavailable' });
    expect(check).toHaveBeenCalledTimes(1);
    finish(true);
    await vi.advanceTimersByTimeAsync(0);
    check.mockResolvedValue(false);
    expect(await probe()).toEqual({ status: 'unavailable' });
    expect(check).toHaveBeenCalledTimes(2);
    check.mockResolvedValue(true);
    expect(await probe()).toEqual({ status: 'ok' });
  } finally {
    vi.useRealTimers();
  }
});
