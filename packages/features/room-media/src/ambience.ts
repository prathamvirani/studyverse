import type { MediaPlayback } from '@study/contracts';
/** Original procedural textures; no samples, recording, credentials or remote assets. */
export function noiseSamples(
  kind: 'rain' | 'white' | 'pink' | 'brown',
  length: number,
  seed = 731,
): Float32Array<ArrayBuffer> {
  const result = new Float32Array(length);
  let slow = 0,
    medium = 0;
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const white = seed / 2147483648 - 1;
    slow = 0.98 * slow + 0.02 * white;
    medium = 0.8 * medium + 0.2 * white;
    const sample =
      kind === 'white'
        ? white * 0.3
        : kind === 'brown'
          ? slow * 1.8
          : kind === 'pink'
            ? (slow * 2 + medium + white * 0.1) * 0.5
            : (white - medium) * 0.22;
    const edge = Math.min(1, i / 512, (length - 1 - i) / 512);
    result[i] = Math.max(-1, Math.min(1, sample)) * edge;
  }
  return result;
}
export function createAmbienceEngine() {
  let context: AudioContext | undefined;
  const nodes = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();
  const effects = new Set<OscillatorNode>();
  return {
    async enable() {
      context ??= new AudioContext();
      await context.resume();
    },
    effect(frequency: number, volume: number) {
      if (!context || context.state !== 'running' || volume <= 0) return;
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      oscillator.frequency.value = Math.max(220, Math.min(1000, frequency));
      gain.gain.setValueAtTime(Math.max(0.0001, Math.min(1, volume) * 0.12), context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
      oscillator.connect(gain).connect(context.destination);
      effects.add(oscillator);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        effects.delete(oscillator);
      };
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
    },
    set(levels: MediaPlayback['mix']['ambience']) {
      if (!context || context.state === 'closed') return;
      for (const [id, level] of Object.entries(levels)) {
        let node = nodes.get(id);
        if (!node && level > 0) {
          const buffer = context.createBuffer(1, context.sampleRate * 12, context.sampleRate);
          buffer.copyToChannel(noiseSamples(id as keyof typeof levels, buffer.length), 0);
          const source = context.createBufferSource(),
            gain = context.createGain();
          source.buffer = buffer;
          source.loop = true;
          gain.gain.value = 0;
          source.connect(gain);
          gain.connect(context.destination);
          source.start();
          node = { source, gain };
          nodes.set(id, node);
        }
        if (node) node.gain.gain.setTargetAtTime(level, context.currentTime, 0.15);
      }
    },
    async close() {
      for (const effect of effects) {
        try {
          effect.stop();
        } catch {
          /* already ended */
        }
      }
      effects.clear();
      for (const node of nodes.values()) {
        node.source.stop();
        node.source.disconnect();
        node.gain.disconnect();
      }
      nodes.clear();
      await context?.close();
      context = undefined;
    },
  };
}
