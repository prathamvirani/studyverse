import { randomInt } from 'node:crypto';
import type { ActivityDefinition, ActivitySession } from '@study/feature-sdk';
import type { z, wordResultSchema } from '@study/contracts';
import { deductionWords, normalizeWord, evaluateWord } from './words.ts';
type WordState = { answer: string; guesses: z.infer<typeof wordResultSchema>[]; solved: boolean };
const data = (s: ActivitySession) => s.privateState as WordState;
function next(s: ActivitySession, now: number) {
  s.round++;
  s.privateState = {
    answer: deductionWords[randomInt(deductionWords.length)],
    guesses: [],
    solved: false,
  };
  s.state = 'active';
  s.deadline = now + s.options.seconds * 1000;
}
function finish(s: ActivitySession, now: number) {
  s.state = s.round >= s.options.rounds ? 'completed' : 'transition';
  s.deadline = s.state === 'transition' ? now + 3000 : null;
}
export const letterLantern: ActivityDefinition = {
  id: 'letter-lantern',
  name: 'Letter Lantern',
  description: 'Find one five-letter word together in six guesses.',
  min: 1,
  max: 12,
  spectators: true,
  begin: next,
  act(s, actor, action, now) {
    if (action.type !== 'guess') throw new Error('INVALID_REQUEST');
    const d = data(s),
      guess = normalizeWord(action.guess);
    if (d.guesses.some((g) => g.guess === guess) || d.guesses.length >= 6)
      throw new Error('INVALID_REQUEST');
    const evaluation = evaluateWord(d.answer, guess);
    d.guesses.push({ guess, evaluation, by: actor });
    d.solved = evaluation.every((e) => e === 'exact');
    if (d.solved) {
      for (const m of s.members)
        if (m.mode === 'participant') m.score += m.id === actor ? (7 - d.guesses.length) * 20 : 10;
    }
    if (d.solved || d.guesses.length === 6) finish(s, now);
  },
  tick(s, now) {
    if (s.deadline !== null && now >= s.deadline) {
      if (s.state === 'active') finish(s, now);
      else if (s.state === 'transition') next(s, now);
    }
  },
  left() {},
  project(s) {
    const d = s.privateState as WordState | null;
    return {
      type: 'word',
      guesses: d?.guesses ?? [],
      solved: d?.solved ?? false,
      ...(['transition', 'completed'].includes(s.state) && d ? { reveal: d.answer } : {}),
    };
  },
};
