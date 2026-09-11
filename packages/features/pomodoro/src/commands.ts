import type { TimerTiming, z, timerCommandSchema } from '@study/contracts';
import type { Fail } from '@study/feature-sdk';
import { initialTiming, projectTimer, nextPhase } from './browser.ts';
/** One transition algorithm, with ownership and persistence enforced separately by scope. */
export function applyTimerCommand<T extends TimerTiming>(
  previous: T,
  i: Omit<z.infer<typeof timerCommandSchema>, 'roomId'>,
  now: number,
  fail: Fail,
): T {
  if (previous.version !== i.version) return fail('CONFLICT');
  let s = projectTimer(previous, now);
  if (i.action !== 'configure' && i.config) return fail('INVALID_REQUEST');
  switch (i.action) {
    case 'start':
    case 'resume':
      if (s.running) return fail('CONFLICT');
      s.running = true;
      break;
    case 'pause':
      if (!s.running) return fail('CONFLICT');
      s.running = false;
      break;
    case 'reset':
      s = {
        ...s,
        ...initialTiming(now),
        config: s.config,
        remainingMs: s.config.focusSeconds * 1000,
      };
      break;
    case 'skip':
      s = nextPhase(s);
      break;
    case 'configure':
      if (!i.config || s.running) return fail('CONFLICT');
      s = {
        ...s,
        ...initialTiming(now),
        config: i.config,
        remainingMs: i.config.focusSeconds * 1000,
      };
      break;
  }
  return { ...s, version: previous.version + 1, anchorAt: now };
}
