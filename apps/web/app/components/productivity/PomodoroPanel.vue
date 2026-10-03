<script setup lang="ts">
import {
  SegmentedControl,
  workspaceHeaderKey,
  SettingsSheet,
  StudySelect,
  StudySlider,
  Settings,
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
} from '@study/ui';
import { createPreferenceStore } from '@study/adapters/indexeddb';
import { timerAppearancePreference, timerAppearanceSchema } from '../../lib/timer-appearance';
import { completedTimerSegment, TimerAlertSound } from '../../lib/timer-alert';
import TimeDisplay from './TimeDisplay.vue';
import { computed, onMounted, onUnmounted, ref, watch, inject, nextTick } from 'vue';
import {
  clockSchema,
  timerViewSchema,
  personalTimerViewSchema,
  timerConfigSchema,
} from '@study/contracts';
import type { z } from '@study/contracts';
import { projectTimer } from '@study/pomodoro/browser';
import type { RealtimeClient } from '../../lib/realtime';
const headerTarget = inject(workspaceHeaderKey, undefined);
const settingsSaved = ref(false);
const alertActive = ref(false);
const sound = new TimerAlertSound();
let alertTimeout: ReturnType<typeof setTimeout> | undefined;
const skipping = ref(false);
let skipTimeout: ReturnType<typeof setTimeout> | undefined;
const styleChoices = [
  { value: 'default', label: 'Default' },
  { value: 'flip', label: 'Flip' },
  { value: 'bar', label: 'Progress bar' },
  { value: 'gauge', label: 'Gauge' },
  { value: 'dots', label: 'Dot matrix' },
  { value: 'pie', label: 'Pie' },
] as const;
const props = defineProps<{ roomId: string; realtime: RealtimeClient }>();
const { profile } = useAccount();
const display = ref(timerAppearanceSchema.parse({})),
  autoStart = ref(true);
const displayDef = timerAppearancePreference(profile.value?.id ?? 'device');
let displayStore: Awaited<ReturnType<typeof createPreferenceStore>> | undefined,
  displayChanged = false,
  displayDisposed = false;
let displayQueue = Promise.resolve();
watch(
  display,
  () => {
    displayChanged = true;
    const value = JSON.parse(JSON.stringify(display.value));
    displayQueue = displayQueue
      .then(() => displayStore?.set(displayDef, value))
      .then(() => {})
      .catch(() => {});
  },
  { deep: true },
);
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
const sharedRuntime = ref<'fixed' | 'dismiss'>('fixed'),
  sharedSeconds = ref(4);
let serverAnchor = 0,
  localAnchor = 0,
  tick: ReturnType<typeof setInterval> | undefined,
  sync: ReturnType<typeof setInterval> | undefined;
let unsubscribe: (() => void) | undefined;
async function sample() {
  const start = performance.now();
  try {
    const r = clockSchema.parse(await props.realtime.send('pomodoro.clock', {}));
    const end = performance.now();
    serverAnchor = r.serverNow + (end - start) / 2;
    localAnchor = end;
    clock.value = serverAnchor;
  } catch {
    // Keep the last successful clock anchor during temporary reconnects.
  }
}
function subscribe() {
  dismissAlert();
  unsubscribe?.();
  view.value = null;
  settings.value = false;
  error.value = '';
  const target = scope.value;
  unsubscribe = props.realtime.subscribe(
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
  void createPreferenceStore([displayDef]).then(async (store) => {
    if (displayDisposed) {
      await store.close();
      return;
    }
    displayStore = store;
    const saved = await store.get(displayDef);
    if (!displayDisposed && !displayChanged) display.value = saved;
    else if (!displayDisposed)
      await store.set(displayDef, timerAppearanceSchema.parse(display.value));
  });
  subscribe();
  tick = setInterval(() => {
    if (clock.value !== null) clock.value = serverAnchor + performance.now() - localAnchor;
  }, 250);
  sync = setInterval(() => void sample(), 30000);
});
onUnmounted(() => {
  displayDisposed = true;
  void displayQueue.finally(() => displayStore?.close());
  unsubscribe?.();
  clearInterval(tick);
  clearInterval(sync);
  clearTimeout(alertTimeout);
  clearTimeout(skipTimeout);
  sound.dispose();
});
const current = computed(() =>
  view.value && clock.value !== null ? projectTimer(view.value.state, clock.value) : null,
);
const digits = computed(() => {
  const n = Math.ceil((current.value?.remainingMs ?? 0) / 1000);
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
});
function openSettings() {
  settingsSaved.value = false;
  const c = view.value?.state.config;
  if (!c) return;
  focus.value = c.focusSeconds / 60;
  short.value = c.shortBreakSeconds / 60;
  long.value = c.longBreakSeconds / 60;
  cycles.value = c.cycles;
  autoStart.value = c.autoStart ?? true;
  sharedRuntime.value = c.alertRuntime ?? 'fixed';
  sharedSeconds.value = c.alertSeconds ?? 4;
  settings.value = !settings.value;
}
async function command(action: 'start' | 'resume' | 'pause' | 'reset' | 'skip' | 'configure') {
  if (!view.value || busy.value || !props.realtime.state.connected) return;
  busy.value = true;
  dismissAlert();
  if (action === 'resume' || action === 'start') void sound.unlock();
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
                  autoStart: autoStart.value,
                  alertRuntime: sharedRuntime.value,
                  alertSeconds: sharedSeconds.value,
                },
              }
            : {}),
        },
      ),
      target,
    );
    if (scope.value === target) view.value = result;
    if (action === 'configure') settingsSaved.value = true;
    else {
      settings.value = false;
      if (action === 'skip') {
        skipping.value = true;
        clearTimeout(skipTimeout);
        skipTimeout = setTimeout(() => {
          skipping.value = false;
        }, 700);
      }
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
    props.realtime.refresh(snapshotCommand());
  }
}
const configChanged = computed(() => {
  const c = view.value?.state.config;
  return (
    !!c &&
    (focus.value * 60 !== c.focusSeconds ||
      short.value * 60 !== c.shortBreakSeconds ||
      long.value * 60 !== c.longBreakSeconds ||
      cycles.value !== c.cycles ||
      autoStart.value !== (c.autoStart ?? true) ||
      sharedRuntime.value !== (c.alertRuntime ?? 'fixed') ||
      sharedSeconds.value !== (c.alertSeconds ?? 4))
  );
});
async function saveConfig() {
  await nextTick();
  if (!view.value?.canControl || current.value?.running || busy.value || !configChanged.value)
    return;
  const valid = timerConfigSchema.safeParse({
    focusSeconds: focus.value * 60,
    shortBreakSeconds: short.value * 60,
    longBreakSeconds: long.value * 60,
    cycles: cycles.value,
    autoStart: autoStart.value,
    alertRuntime: sharedRuntime.value,
    alertSeconds: sharedSeconds.value,
  });
  if (!valid.success) {
    error.value = 'Use whole minutes and keep each duration within its displayed range.';
    return;
  }
  await command('configure');
}
watch(
  [focus, short, long, cycles, autoStart, sharedRuntime, sharedSeconds],
  () => (settingsSaved.value = false),
);
const progress = computed(() => {
  const s = current.value;
  if (!s) return 0;
  const duration =
    (s.phase === 'focus'
      ? s.config.focusSeconds
      : s.phase === 'shortBreak'
        ? s.config.shortBreakSeconds
        : s.config.longBreakSeconds) * 1000;
  return Math.max(0, Math.min(1, 1 - s.remainingMs / duration));
});
function dismissAlert() {
  alertActive.value = false;
  clearTimeout(alertTimeout);
  sound.stop();
}
async function previewSound() {
  dismissAlert();
  if (!(await sound.preview(display.value.sound, display.value.volume)))
    error.value = 'Sound is unavailable in this browser. The visual alert remains available.';
}
async function enableNotifications() {
  if (!display.value.notifications) return;
  if (!('Notification' in window) || (await Notification.requestPermission()) !== 'granted') {
    display.value.notifications = false;
    error.value = 'Notifications are unavailable or were not allowed.';
  }
}
watch(current, (value, previous) => {
  if (!completedTimerSegment(previous, value)) return;
  dismissAlert();
  alertActive.value = true;
  const runtime =
    scope.value === 'shared'
      ? (view.value?.state.config.alertRuntime ?? 'fixed')
      : display.value.alertRuntime;
  const seconds =
    scope.value === 'shared'
      ? (view.value?.state.config.alertSeconds ?? 4)
      : display.value.alertSeconds;
  sound.start(display.value.sound, display.value.volume, runtime === 'fixed' ? seconds : undefined);
  if (runtime === 'fixed') alertTimeout = setTimeout(dismissAlert, seconds * 1000);
  if (
    display.value.notifications &&
    'Notification' in window &&
    Notification.permission === 'granted'
  )
    new Notification('Study Space', { body: 'Your next Pomodoro segment is ready.' });
});
</script>
<template>
  <div class="productivity-panel pomodoro-timer">
    <Teleport :to="headerTarget ?? 'body'" :disabled="!headerTarget">
      <div class="productivity-title">
        <strong v-if="!headerTarget">Pomodoro</strong
        ><SegmentedControl
          :model-value="scope"
          label="Pomodoro scope"
          :disabled="busy"
          :options="[
            { value: 'personal', label: 'Personal' },
            { value: 'shared', label: 'Shared' },
          ]"
          @update:model-value="
            scope = $event as 'personal' | 'shared';
            subscribe();
          "
        />
      </div>
    </Teleport>
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
      <div
        class="timer-main"
        :data-timer-style="display.style"
        :style="{ '--timer-scale': display.scale }"
      >
        <button
          v-if="view?.canControl"
          class="timer-reset"
          :disabled="busy || !realtime.state.connected"
          aria-label="Reset timer"
          @click="command('reset')"
        >
          <RotateCcw :size="18" />
        </button>
        <span v-else class="timer-reset-space" aria-hidden="true" />
        <div class="timer-digits" role="timer" aria-label="Time remaining">
          <TimeDisplay :text="digits" :style="display.style" :progress="progress" />
        </div>
        <div class="timer-controls">
          <button
            v-if="view?.canControl"
            :disabled="busy || !realtime.state.connected"
            :aria-label="current.running ? 'Pause timer' : 'Play timer'"
            @click="command(current.running ? 'pause' : 'resume')"
          >
            <Pause v-if="current.running" :size="20" /><Play v-else :size="20" />
          </button>
          <button aria-label="Timer settings" :disabled="busy" @click="openSettings">
            <Settings :size="18" />
          </button>
        </div>
      </div>
      <progress
        v-if="display.progress"
        class="timer-progress"
        :value="progress"
        max="1"
        aria-label="Segment progress"
      />
      <div class="timer-footer">
        <button
          v-if="view?.canControl"
          class="skip-cycle"
          :class="{ 'is-skipping': skipping }"
          :disabled="busy || !realtime.state.connected"
          @click="command('skip')"
        >
          Skip cycle <ArrowRight class="skip-arrow" :size="15" aria-hidden="true" />
        </button>
        <small>{{ current.focusSessions ?? 0 }} focus sessions</small>
      </div>
      <div v-if="alertActive" class="timer-alert" role="status">
        Segment complete <button type="button" @click="dismissAlert">Dismiss alert</button>
      </div>
      <Teleport to="body"
        ><div v-if="alertActive" class="timer-completion-bloom" aria-hidden="true"
      /></Teleport>
      <small v-if="!view?.canControl">Room owner controls the timer</small>
      <SettingsSheet v-model:open="settings" title="Timer settings">
        <form class="timer-settings form" @submit.prevent="saveConfig" @change="saveConfig">
          <div class="timer-duration-grid">
            <label
              >Focus minutes<input
                v-model.number="focus"
                type="number"
                min="1"
                max="180"
                required
                :disabled="!view?.canControl || current.running || busy"
            /></label>
            <label
              >Short break minutes<input
                v-model.number="short"
                type="number"
                min="1"
                max="60"
                required
                :disabled="!view?.canControl || current.running || busy"
            /></label>
            <label
              >Long break minutes<input
                v-model.number="long"
                type="number"
                min="1"
                max="120"
                required
                :disabled="!view?.canControl || current.running || busy"
            /></label>
            <label
              >Cycles<input
                v-model.number="cycles"
                type="number"
                min="1"
                max="12"
                required
                :disabled="!view?.canControl || current.running || busy"
            /></label>
          </div>
          <p v-if="current.running" class="timer-duration-notice">
            Pause the timer to change its durations.
          </p>
          <label class="checkbox-row"
            ><input
              v-model="autoStart"
              type="checkbox"
              :disabled="!view?.canControl || current.running || busy"
            />Auto-start the next segment</label
          >
          <template v-if="scope === 'shared'">
            <StudySelect
              v-model="sharedRuntime"
              label="Shared alert runtime"
              :disabled="!view?.canControl || current.running || busy"
              :options="[
                { value: 'fixed', label: 'Fixed duration' },
                { value: 'dismiss', label: 'Until dismissed' },
              ]"
              @update:model-value="saveConfig"
            />
            <label v-if="sharedRuntime === 'fixed'"
              >Shared alert seconds<input
                v-model.number="sharedSeconds"
                type="number"
                min="2"
                max="30"
                :disabled="!view?.canControl || current.running || busy"
            /></label>
          </template>
          <div class="timer-settings-actions">
            <span role="status">{{
              busy
                ? 'Saving…'
                : settingsSaved && !configChanged
                  ? 'Saved'
                  : 'Changes apply immediately while paused.'
            }}</span>
          </div>
        </form>
        <section class="timer-display-settings">
          <h3>Display on this device</h3>
          <fieldset class="timer-style-options">
            <legend>Timer style</legend>
            <button
              v-for="choice in styleChoices"
              :key="choice.value"
              type="button"
              :aria-pressed="display.style === choice.value"
              :aria-label="`Timer style: ${choice.label}`"
              @click="display.style = choice.value"
            >
              <TimeDisplay
                text="13:09"
                :style="choice.value"
                :progress="0.6"
                :animate="false"
              /><span>{{ choice.label }}</span>
            </button>
          </fieldset>
          <StudySlider
            v-model="display.scale"
            label="Timer scale"
            :min="0.7"
            :max="1.4"
            :step="0.1"
          />
          <label class="checkbox-row"
            ><input v-model="display.progress" type="checkbox" />Show progress</label
          >
          <label class="checkbox-row"
            ><input
              v-model="display.notifications"
              type="checkbox"
              @change="enableNotifications"
            />Notify at segment end</label
          >
          <StudySelect
            v-model="display.sound"
            label="Alert sound"
            :options="[
              { value: 'none', label: 'No Alert' },
              { value: 'soft', label: 'Soft tone' },
              { value: 'bell', label: 'Bell' },
            ]"
          />
          <button type="button" :disabled="display.sound === 'none'" @click="previewSound">
            Preview alert
          </button>
          <label
            >Alert volume<StudySlider v-model="display.volume" min="0" max="1" step="0.05"
          /></label>
          <template v-if="scope === 'personal'">
            <StudySelect
              v-model="display.alertRuntime"
              label="Personal alert runtime"
              :options="[
                { value: 'fixed', label: 'Fixed duration' },
                { value: 'dismiss', label: 'Until dismissed' },
              ]"
            />
            <label v-if="display.alertRuntime === 'fixed'"
              >Alert seconds<input
                v-model.number="display.alertSeconds"
                type="number"
                min="2"
                max="30"
                @change="
                  display.alertSeconds = Math.max(
                    2,
                    Math.min(30, Math.round(display.alertSeconds || 4)),
                  )
                "
            /></label>
          </template>
          <p v-else>
            Shared alert runtime follows the room owner's timer settings. Sound and volume stay
            personal.
          </p>
          <p>
            Durations and auto-start follow Personal/Shared authority. Display and alerts are saved
            on this device.
          </p>
        </section>
      </SettingsSheet></template
    >
    <p v-else>{{ realtime.state.errors[snapshotCommand()] || 'Synchronizing timer…' }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.pomodoro-timer {
  padding: 0;
}
.productivity-title,
.timer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.timer-footer {
  flex-direction: column;
  justify-content: center;
  margin-top: var(--space-2);
}
.timer-footer small {
  font-size: 10px;
}
.pomodoro-timer > small {
  font-size: 10px;
}
.timer-main {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) 76px;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  margin: var(--space-3) 0;
}
.timer-digits {
  min-width: 0;
  text-align: center;
  font-size: clamp(18px, calc(12cqi * var(--timer-scale, 1)), 48px);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.timer-progress {
  display: block;
  margin: 4px 0;
  width: 100%;
  height: 5px;
  accent-color: var(--accent);
}
.skip-cycle {
  min-height: 30px;
  padding: 4px 8px;
  align-self: center;
  font-size: 11px;
}
.timer-display-settings fieldset.timer-style-options {
  border: 0;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}
.timer-style-options legend {
  margin-bottom: var(--space-3);
  padding: 0;
}
.timer-style-options button {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-2);
  min-height: 104px;
  padding: var(--space-3);
}
.timer-style-options button > :first-child {
  font-size: 26px;
}
.timer-style-options button[aria-pressed='true'] {
  background: var(--accent-subtle);
  border-color: var(--accent);
}
.timer-style-options button > span:last-child {
  font-size: 12px;
}
.timer-alert {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-2);
  font-size: 11px;
}
.timer-completion-bloom {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 85;
  box-shadow: inset 0 0 100px 20px var(--accent-subtle);
  animation: completion-bloom var(--motion-expressive) var(--ease-enter) both;
}
@keyframes completion-bloom {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.skip-cycle {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  overflow: hidden;
}
.is-skipping .skip-arrow {
  animation: skip-travel 350ms ease-in-out 2;
}
@keyframes skip-travel {
  0% {
    transform: translateX(-16px);
    opacity: 0;
  }
  35% {
    opacity: 1;
  }
  100% {
    transform: translateX(20px);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .is-skipping .skip-arrow,
  .timer-completion-bloom {
    animation: none;
  }
}
@media (max-width: 400px) {
  .timer-display-settings fieldset.timer-style-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.timer-display-settings {
  margin-top: 24px;
}
.timer-settings input {
  width: 100%;
}
.timer-settings input[type='checkbox'] {
  width: 18px;
}
.timer-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
}
.timer-controls button,
.timer-reset {
  min-width: 36px;
  min-height: 36px;
  padding: 6px;
}
.timer-reset {
  justify-self: end;
}
@container workspace-card (max-width: 280px) {
  .timer-main {
    grid-template-columns: 52px minmax(0, 1fr) 52px;
  }
  .timer-controls {
    flex-direction: column;
    gap: 0;
  }
}
.timer-settings,
.timer-display-settings {
  text-align: left;
}
.timer-settings.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.timer-duration-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
  width: 100%;
}
.timer-duration-grid label {
  font-size: 12px;
  margin: 0;
}
.timer-duration-grid input {
  height: 44px;
  min-width: 0;
}
.timer-settings-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.timer-settings-actions button {
  width: auto;
  min-height: 44px;
  align-self: start;
}
.timer-settings-actions span {
  color: var(--text-muted);
  font-size: 12px;
}
.timer-display-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
@media (max-width: 540px) {
  .timer-duration-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 300px) {
  .timer-duration-grid {
    grid-template-columns: 1fr;
  }
}
</style>
