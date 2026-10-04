import { randomInt } from 'node:crypto';
import { drawingStrokeSchema } from '@study/contracts';
import type { DrawingStroke } from '@study/contracts';
import type { ActivityDefinition, ActivitySession } from '@study/feature-sdk';
import { drawingPrompts, normalizeDrawingGuess } from './words.ts';
type DrawingState = {
  prompt: string;
  drawer: string | null;
  queue: string[];
  index: number;
  strokes: DrawingStroke[];
  accepted: string[];
  guesses: { by: string; text: string; correct: boolean }[];
};
const data = (s: ActivitySession) => s.privateState as DrawingState;
function next(s: ActivitySession, now: number) {
  const d = data(s);
  d.index++;
  if (d.index >= d.queue.length) {
    s.state = 'completed';
    s.deadline = null;
    return;
  }
  const prompts = s.options.prompts ?? drawingPrompts;
  d.prompt = prompts[randomInt(prompts.length)]!.toLowerCase().trim().replace(/ +/g, ' ');
  d.drawer = d.queue[d.index]!;
  d.strokes = [];
  d.accepted = [];
  d.guesses = [];
  s.round++;
  s.state = 'active';
  s.deadline = now + s.options.seconds * 1000;
}
function transition(s: ActivitySession, now: number) {
  s.state = 'transition';
  s.deadline = now + 3000;
}
export function boundedStrokes(strokes: DrawingStroke[]) {
  if (strokes.length < 1 || strokes.length > 4 || JSON.stringify(strokes).length > 8192)
    throw new Error('INVALID_REQUEST');
  for (const stroke of strokes) drawingStrokeSchema.parse(stroke);
}
export const sketchCircle: ActivityDefinition = {
  id: 'sketch-circle',
  name: 'Sketch Circle',
  description: 'Take turns sketching a prompt while friends guess.',
  min: 2,
  max: 12,
  spectators: true,
  begin(s, now) {
    const ids = s.members.filter((m) => m.mode === 'participant').map((m) => m.id);
    s.privateState = {
      prompt: '',
      drawer: null,
      queue: Array.from({ length: s.options.rounds }, () => ids).flat(),
      index: -1,
      strokes: [],
      accepted: [],
      guesses: [],
    };
    next(s, now);
  },
  act(s, actor, action, now) {
    const d = data(s);
    if (action.type === 'clear') {
      if (d.drawer !== actor) throw new Error('FORBIDDEN');
      d.strokes = [];
      return;
    }
    if (action.type === 'stroke') {
      if (d.drawer !== actor) throw new Error('FORBIDDEN');
      boundedStrokes(action.strokes);
      // A snapshot is capped at 512 points/40 strokes; reject overflow instead of unbounded history.
      if (
        d.strokes.length + action.strokes.length > 40 ||
        [...d.strokes, ...action.strokes].reduce((n, stroke) => n + stroke.points.length, 0) > 512
      )
        throw new Error('INVALID_REQUEST');
      d.strokes.push(...action.strokes);
      return;
    }
    if (d.drawer === actor || d.accepted.includes(actor)) throw new Error('FORBIDDEN');
    const guess = normalizeDrawingGuess(action.guess),
      correct = guess === d.prompt;
    d.guesses = [...d.guesses, { by: actor, text: correct ? 'Correct' : guess, correct }].slice(
      -20,
    );
    if (correct) {
      d.accepted.push(actor);
      s.members.find((m) => m.id === actor)!.score += 100;
      const drawer = s.members.find((m) => m.id === d.drawer);
      if (drawer) drawer.score += 50;
      if (
        s.members
          .filter((m) => m.mode === 'participant' && m.id !== d.drawer)
          .every((m) => d.accepted.includes(m.id))
      )
        transition(s, now);
    }
  },
  tick(s, now) {
    if (s.deadline !== null && now >= s.deadline) {
      if (s.state === 'active') transition(s, now);
      else if (s.state === 'transition') next(s, now);
    }
  },
  left(s, actor, now) {
    const d = s.privateState as DrawingState | null;
    if (!d) return;
    d.queue = d.queue.filter((id, index) => index <= d.index || id !== actor);
    if (
      s.state === 'active' &&
      (d.drawer === actor ||
        s.members
          .filter((m) => m.mode === 'participant' && m.id !== d.drawer)
          .every((m) => d.accepted.includes(m.id)))
    )
      transition(s, now);
  },
  project(s, viewer) {
    const d = s.privateState as DrawingState | null;
    return {
      type: 'drawing',
      drawer: d?.drawer ?? null,
      letters: d?.prompt.replace(/ /g, '').length ?? 0,
      strokes: d?.strokes ?? [],
      accepted: d?.accepted ?? [],
      guesses: d?.guesses ?? [],
      ...(s.state === 'active' && d?.drawer === viewer ? { prompt: d.prompt } : {}),
      ...(['transition', 'completed'].includes(s.state) && d ? { reveal: d.prompt } : {}),
    };
  },
};
