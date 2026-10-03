import type { TimerTiming } from '@study/contracts';

/** A natural boundary, not a manual skip/reset, scope switch or first snapshot. */
export function completedTimerSegment(previous: TimerTiming | null, next: TimerTiming | null) {
  return !!(
    previous &&
    next &&
    previous.version === next.version &&
    previous.running &&
    next.anchorAt >= previous.anchorAt + previous.remainingMs &&
    (previous.phase !== next.phase ||
      previous.cycle !== next.cycle ||
      (next.focusSessions ?? 0) > (previous.focusSessions ?? 0))
  );
}

/** One reusable, gesture-unlocked synthesizer; original tones, no downloaded sound assets. */
export class TimerAlertSound {
  private context: AudioContext | undefined;
  private repeat: ReturnType<typeof setInterval> | undefined;
  private end: ReturnType<typeof setTimeout> | undefined;
  private nodes = new Set<OscillatorNode>();
  private disposed = false;
  async unlock() {
    if (this.disposed) return false;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
      return !this.disposed && this.context.state === 'running';
    } catch {
      return false;
    }
  }
  private tone(sound: 'none' | 'soft' | 'bell', volume: number) {
    const context = this.context;
    if (sound === 'none' || !context || context.state !== 'running' || this.disposed) return;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = sound === 'bell' ? 880 : 440;
    gain.gain.setValueAtTime(Math.max(0.0001, volume * 0.2), context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.65);
    oscillator.connect(gain).connect(context.destination);
    this.nodes.add(oscillator);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.nodes.delete(oscillator);
    };
    oscillator.start();
    oscillator.stop(context.currentTime + 0.65);
  }
  async preview(sound: 'none' | 'soft' | 'bell', volume: number) {
    this.stop();
    const ready = await this.unlock();
    if (ready) this.tone(sound, volume);
    return ready;
  }
  start(sound: 'none' | 'soft' | 'bell', volume: number, seconds?: number) {
    this.stop();
    this.tone(sound, volume);
    if (sound !== 'none') this.repeat = setInterval(() => this.tone(sound, volume), 1500);
    if (seconds !== undefined) this.end = setTimeout(() => this.stop(), seconds * 1000);
  }
  stop() {
    clearInterval(this.repeat);
    clearTimeout(this.end);
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
    }
    this.nodes.clear();
  }
  dispose() {
    this.disposed = true;
    this.stop();
    void this.context?.close();
  }
}
