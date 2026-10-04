import type { TimerState, TimerTiming, PersonalTimerState } from '@study/contracts';
export const defaultTimerConfig = {
  focusSeconds: 1500,
  shortBreakSeconds: 300,
  longBreakSeconds: 900,
  cycles: 4,
};
export function initialTiming(now: number): TimerTiming {
  return {
    version: 0,
    config: { ...defaultTimerConfig },
    phase: 'focus',
    cycle: 1,
    running: false,
    remainingMs: 1500000,
    anchorAt: now,
  };
}
export function initialTimer(roomId: string, now: number): TimerState {
  return { ...initialTiming(now), roomId };
}
export function initialPersonalTimer(now: number): PersonalTimerState {
  return { ...initialTiming(now), scope: 'personal' };
}
export function nextPhase<T extends TimerTiming>(state: T, completed = false): T {
  const s = { ...state };
  if (completed && s.phase === 'focus') s.focusSessions = (s.focusSessions ?? 0) + 1;
  if (s.phase === 'focus') s.phase = s.cycle >= s.config.cycles ? 'longBreak' : 'shortBreak';
  else {
    s.cycle = s.phase === 'longBreak' ? 1 : s.cycle + 1;
    s.phase = 'focus';
  }
  s.remainingMs =
    (s.phase === 'focus'
      ? s.config.focusSeconds
      : s.phase === 'shortBreak'
        ? s.config.shortBreakSeconds
        : s.config.longBreakSeconds) * 1000;
  return s;
}
/** Pure timestamp projection; bounded even after years of downtime. No browser authority. */
export function projectTimer<T extends TimerTiming>(state: T, now: number): T {
  let s = { ...state };
  if (!s.running) return s;
  let elapsed = Math.max(0, now - s.anchorAt);
  if (elapsed < s.remainingMs) return { ...s, remainingMs: s.remainingMs - elapsed, anchorAt: now };
  elapsed -= s.remainingMs;
  s = nextPhase(s, true);
  if (s.config.autoStart === false) return { ...s, running: false, anchorAt: now };
  const cycleMs =
    (s.config.cycles * s.config.focusSeconds +
      (s.config.cycles - 1) * s.config.shortBreakSeconds +
      s.config.longBreakSeconds) *
    1000;
  s.focusSessions = (s.focusSessions ?? 0) + Math.floor(elapsed / cycleMs) * s.config.cycles;
  elapsed %= cycleMs;
  while (elapsed >= s.remainingMs) {
    elapsed -= s.remainingMs;
    s = nextPhase(s, true);
  }
  return { ...s, remainingMs: s.remainingMs - elapsed, anchorAt: now };
}

/** Public generic boundary observer. First snapshots and reconnect do not manufacture a break. */
export function createBreakObserver(emit: (boundary: string) => void) {
  let previous: TimerTiming | null = null;
  return (state: TimerTiming | null, now: number) => {
    if (!state) {
      previous = null;
      return;
    }
    const current = projectTimer(state, now);
    if (previous?.phase === 'focus' && current.phase !== 'focus')
      emit(`${current.version}:${current.phase}:${current.cycle}:${current.focusSessions ?? 0}`);
    previous = current;
  };
}
