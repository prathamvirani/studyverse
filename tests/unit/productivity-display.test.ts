import { expect, it } from 'vitest';
import { initialPersonalTimer, projectTimer } from '@study/pomodoro/browser';
import { completedTimerSegment } from '../../apps/web/app/lib/timer-alert.ts';
import { clockAppearanceSchema, clockGreeting } from '../../apps/web/app/lib/clock-appearance.ts';
import { timerAppearanceSchema } from '../../apps/web/app/lib/timer-appearance.ts';
import { timerConfigSchema } from '@study/contracts';

it('alerts once at natural boundaries including auto-start off, with no alerts for initial load or commands', () => {
  const raw = {
    ...initialPersonalTimer(1000),
    running: true,
    remainingMs: 60000,
    config: {
      focusSeconds: 60,
      shortBreakSeconds: 60,
      longBreakSeconds: 120,
      cycles: 2,
      autoStart: false,
    },
  };
  const before = projectTimer(raw, 60999),
    completed = projectTimer(raw, 61000);
  expect(completedTimerSegment(before, completed)).toBe(true);
  expect(completed.running).toBe(false);
  expect(completedTimerSegment(completed, projectTimer(raw, 62000))).toBe(false);
  expect(completedTimerSegment(null, completed)).toBe(false);
  expect(completedTimerSegment(before, { ...completed, version: 1 })).toBe(false);
  expect(completedTimerSegment({ ...before, running: false }, completed)).toBe(false);
  expect(completedTimerSegment(before, { ...completed, anchorAt: 60999 })).toBe(false);
});
it('keeps old device preferences and versioned timer config readable with bounded optional alert runtime', () => {
  expect(
    timerAppearanceSchema.parse({
      style: 'flip',
      progress: true,
      notifications: false,
      sound: 'bell',
      volume: 0.3,
    }),
  ).toMatchObject({ style: 'flip', alertRuntime: 'fixed', alertSeconds: 4, scale: 1 });
  const config = { focusSeconds: 1500, shortBreakSeconds: 300, longBreakSeconds: 900, cycles: 4 };
  expect(timerConfigSchema.parse(config)).toEqual(config);
  expect(timerConfigSchema.safeParse({ ...config, alertSeconds: 31 }).success).toBe(false);
  expect(timerConfigSchema.safeParse({ ...config, alertRuntime: 'forever' }).success).toBe(false);
});
it('uses local-time greeting buckets and calm five-minute variations with safe display defaults', () => {
  expect(clockAppearanceSchema.parse({})).toMatchObject({
    format: '24',
    seconds: false,
    style: 'bold',
    scale: 1,
  });
  const date = new Date(2026, 9, 2, 9, 0);
  expect(clockGreeting(date, false)).toBe('Good morning.');
  expect(clockGreeting(new Date(2026, 9, 2, 9, 4), true)).toBe(clockGreeting(date, true));
  expect(clockGreeting(new Date(2026, 9, 2, 9, 5), true)).not.toBe(clockGreeting(date, true));
  expect(clockGreeting(new Date(2026, 9, 2, 20, 0), false)).toBe('Good evening.');
});
