<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { clockSchema, timerViewSchema, personalTimerViewSchema } from '@study/contracts';
import type { z } from '@study/contracts';
import { projectTimer } from '@study/pomodoro/browser';
import type { RealtimeClient } from '../../lib/realtime';
const props = defineProps<{ roomId: string; realtime: RealtimeClient }>();
const scope = ref<'personal' | 'shared'>('personal');
const snapshotCommand = () =>
  scope.value === 'personal' ? 'pomodoro.personal-snapshot' : 'pomodoro.snapshot';
const parseView = (v: unknown, target = scope.value) =>
  target === 'personal' ? personalTimerViewSchema.parse(v) : timerViewSchema.parse(v);
const view = ref<z.infer<typeof timerViewSchema> | z.infer<typeof personalTimerViewSchema> | null>(
    null,
  ),
  clock = ref<number | null>(null),
  error = ref(''),
  busy = ref(false),
  settings = ref(false);
const focus = ref(25),
  short = ref(5),
  long = ref(15),
  cycles = ref(4);
let serverAnchor = 0,
  localAnchor = 0,
  tick: ReturnType<typeof setInterval> | undefined,
  sync: ReturnType<typeof setInterval> | undefined;
async function sample() {
  const start = performance.now();
  try {
    const r = clockSchema.parse(await props.realtime.send('pomodoro.clock', {}));
    const end = performance.now();
    serverAnchor = r.serverNow + (end - start) / 2;
    localAnchor = end;
    clock.value = serverAnchor;
  } catch {
    clock.value = null;
  }
}
function subscribe() {
  view.value = null;
  settings.value = false;
  error.value = '';
  const target = scope.value;
  props.realtime.subscribe(
    snapshotCommand(),
    target === 'personal' ? {} : { roomId: props.roomId },
    (v) => {
      if (scope.value !== target) return;
      view.value = parseView(v, target);
      void sample();
    },
    () => {
      if (scope.value !== target) return;
      view.value = null;
      clock.value = null;
    },
  );
}
onMounted(() => {
  subscribe();
  tick = setInterval(() => {
    if (clock.value !== null) clock.value = serverAnchor + performance.now() - localAnchor;
  }, 250);
  sync = setInterval(() => void sample(), 30000);
});
onUnmounted(() => {
  clearInterval(tick);
  clearInterval(sync);
});
const current = computed(() =>
  view.value && clock.value !== null ? projectTimer(view.value.state, clock.value) : null,
);
const digits = computed(() => {
  const n = Math.ceil((current.value?.remainingMs ?? 0) / 1000);
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
});
function openSettings() {
  const c = view.value?.state.config;
  if (!c) return;
  focus.value = c.focusSeconds / 60;
  short.value = c.shortBreakSeconds / 60;
  long.value = c.longBreakSeconds / 60;
  cycles.value = c.cycles;
  settings.value = !settings.value;
}
async function command(action: 'start' | 'resume' | 'pause' | 'reset' | 'skip' | 'configure') {
  if (!view.value) return;
  busy.value = true;
  error.value = '';
  const target = scope.value;
  try {
    const result = parseView(
      await props.realtime.send(
        target === 'personal' ? 'pomodoro.personal-control' : 'pomodoro.control',
        {
          ...(target === 'shared' ? { roomId: props.roomId } : {}),
          version: view.value.state.version,
          action,
          ...(action === 'configure'
            ? {
                config: {
                  focusSeconds: focus.value * 60,
                  shortBreakSeconds: short.value * 60,
                  longBreakSeconds: long.value * 60,
                  cycles: cycles.value,
                },
              }
            : {}),
        },
      ),
      target,
    );
    if (scope.value === target) view.value = result;
    settings.value = false;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
    props.realtime.refresh(snapshotCommand());
  }
}
</script>
<template>
  <div class="productivity-panel pomodoro-timer">
    <div class="scope-tabs" role="group" aria-label="Pomodoro scope">
      <button
        :disabled="busy"
        :aria-pressed="scope === 'personal'"
        @click="
          scope = 'personal';
          subscribe();
        "
      >
        Personal</button
      ><button
        :disabled="busy"
        :aria-pressed="scope === 'shared'"
        @click="
          scope = 'shared';
          subscribe();
        "
      >
        Shared
      </button>
    </div>
    <p class="timer-scope-note">
      {{
        scope === 'personal' ? 'Private to you · continues across rooms' : 'Shared with this room'
      }}
    </p>
    <template v-if="current"
      ><small
        >{{
          current.phase === 'focus'
            ? 'FOCUS'
            : current.phase === 'shortBreak'
              ? 'SHORT BREAK'
              : 'LONG BREAK'
        }}
        · CYCLE {{ current.cycle }} / {{ current.config.cycles }}</small
      >
      <div class="timer-digits" role="timer" aria-label="Time remaining">{{ digits }}</div>
      <div v-if="view?.canControl" class="productivity-actions">
        <button :disabled="busy" @click="command(current.running ? 'pause' : 'resume')">
          {{ current.running ? 'Pause' : 'Start / Resume' }}</button
        ><button :disabled="busy" @click="command('skip')">Skip</button
        ><button :disabled="busy" @click="command('reset')">Reset</button
        ><button :disabled="busy || current.running" @click="openSettings">Timer settings</button>
      </div>
      <small v-else>Room owner controls the timer</small>
      <form v-if="settings" @submit.prevent="command('configure')">
        <label
          >Focus minutes<input
            v-model.number="focus"
            type="number"
            min="1"
            max="180"
            required /></label
        ><label
          >Short break minutes<input
            v-model.number="short"
            type="number"
            min="1"
            max="60"
            required /></label
        ><label
          >Long break minutes<input
            v-model.number="long"
            type="number"
            min="1"
            max="120"
            required /></label
        ><label
          >Cycles<input v-model.number="cycles" type="number" min="1" max="12" required /></label
        ><button :disabled="busy">Save timer settings</button>
      </form></template
    >
    <p v-else>{{ realtime.state.errors[snapshotCommand()] || 'Synchronizing timer…' }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>
