import { defineComponent, h } from 'vue';
import {
  layoutSchema,
  breakStartedSchema,
  timerViewSchema,
  personalTimerViewSchema,
  clockSchema,
} from '@study/contracts';
import type { TimerTiming } from '@study/contracts';
import { createBreakObserver } from '@study/pomodoro/browser';
import type { EventBus } from '@study/core/browser';
import type { UiRegistry, TileRegistry } from '@study/core/browser';
import { createRealtimeClient } from '../lib/realtime';
export function registerProductivity(
  ui: UiRegistry,
  roomId: string,
  realtime = createRealtimeClient(),
  tiles?: TileRegistry,
  events?: EventBus,
) {
  const stopObservers: (() => void)[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  let clockTimer: ReturnType<typeof setInterval> | undefined;
  let clockOffset = 0,
    disposed = false,
    syncing = false;
  if (events) {
    const states: Record<string, TimerTiming | null> = { personal: null, shared: null };
    const observers = (['personal', 'shared'] as const).map((scope) => {
      const observe = createBreakObserver((boundary) => {
        void events.emit(
          { id: 'timer.break.started', schema: breakStartedSchema },
          { roomId, scope, boundary },
        );
      });
      // Use a separate public observer subscription so the panel's subscription remains independent.
      // HTTPS snapshots avoid replacing the multiplexed panel's realtime subscription key.
      return { scope, observe };
    });
    const sync = async () => {
      if (!realtime.state.connected || disposed || syncing) return;
      syncing = true;
      try {
        const sent = Date.now(),
          clock = clockSchema.parse(await realtime.send('pomodoro.clock', {}));
        clockOffset = clock.serverNow - (sent + Date.now()) / 2;
        const responses = await Promise.all([
          fetch('/api/v1/pomodoro/personal-snapshot', {
            cache: 'no-store',
            signal: AbortSignal.timeout(4000),
          }),
          fetch(`/api/v1/pomodoro/snapshot?roomId=${roomId}`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(4000),
          }),
        ]);
        if (disposed) return;
        if (responses[0]!.ok)
          states.personal = personalTimerViewSchema.parse(await responses[0]!.json()).state;
        if (responses[1]!.ok)
          states.shared = timerViewSchema.parse(await responses[1]!.json()).state;
      } catch {
        /* Optional event discovery never blocks productivity. */
      } finally {
        syncing = false;
      }
    };
    void sync();
    clockTimer = setInterval(() => void sync(), 5000);
    timer = setInterval(() => {
      for (const { scope, observe } of observers)
        observe(realtime.state.connected ? states[scope]! : null, Date.now() + clockOffset);
    }, 250);
    stopObservers.push(() => {
      disposed = true;
      clearInterval(timer);
      clearInterval(clockTimer);
    });
  }
  const panels = [
    ['pomodoro', 'Pomodoro', () => import('../components/productivity/PomodoroPanel.vue')],
    ['tasks', 'Tasks', () => import('../components/productivity/TasksPanel.vue')],
    ['chat', 'Chat', () => import('../components/productivity/ChatPanel.vue')],
  ] as const;
  panels.forEach(([id, label, load], index) => {
    const renderer = async () => {
      const Component = (await load()).default;
      return defineComponent({ setup: () => () => h(Component, { roomId, realtime }) });
    };
    if (tiles)
      tiles.register(id + '.panel', {
        type: id + '.panel',
        label,
        load: renderer,
        workspaceCard: true,
        defaultSize: { width: 320, height: 300 },
        minimumSize: { width: 220, height: id === 'pomodoro' ? 260 : 200 },
        resizable: true,
        fullscreenable: true,
        layoutSchema,
      });
    else
      ui.register(id + '.panel', {
        id: id + '.panel',
        point: 'rightRail',
        order: (index + 1) * 10,
        label,
        load: renderer,
      });
  });
  tiles?.register('clock.panel', {
    type: 'clock.panel',
    label: 'Clock',
    workspaceCard: true,
    defaultSize: { width: 320, height: 180 },
    minimumSize: { width: 200, height: 160 },
    resizable: true,
    fullscreenable: true,
    layoutSchema,
    load: async () => (await import('../components/productivity/ClockPanel.vue')).default,
  });
  realtime.start();
  return () => {
    for (const stop of stopObservers) stop();
    realtime.stop();
  };
}
