/** Individually curated ordinary English words, authored for Study Space. No imported corpus. */
export const deductionWords = [
  'APPLE',
  'BRAVE',
  'CEDAR',
  'DREAM',
  'EARTH',
  'FLAME',
  'GRASS',
  'HOUSE',
  'LIGHT',
  'MAPLE',
  'OCEAN',
  'PLANT',
  'QUIET',
  'RIVER',
  'STONE',
  'TRAIN',
  'WATER',
  'CLOUD',
  'BLOOM',
  'SHEEP',
] as const;
export const drawingPrompts = [
  'apple',
  'bicycle',
  'cloud',
  'flower',
  'house',
  'moon',
  'mountain',
  'pencil',
  'rain',
  'sun',
  'tree',
  'umbrella',
] as const;
export function normalizeWord(raw: string) {
  if (raw.length > 16 || !/^\s*[a-zA-Z]{5}\s*$/.test(raw)) throw new Error('INVALID_REQUEST');
  return raw.trim().toUpperCase();
}
export function normalizeDrawingGuess(raw: string) {
  if (raw.length > 32 || !/^[a-zA-Z ]+$/.test(raw)) throw new Error('INVALID_REQUEST');
  const value = raw.trim().toLowerCase().replace(/ +/g, ' ');
  if (!value) throw new Error('INVALID_REQUEST');
  return value;
}
export function evaluateWord(answer: string, guess: string): ('exact' | 'near' | 'absent')[] {
  const result: ('exact' | 'near' | 'absent')[] = Array(5).fill('absent'),
    remaining = new Map<string, number>();
  for (let i = 0; i < 5; i++) {
    if (answer[i] === guess[i]) result[i] = 'exact';
    else remaining.set(answer[i]!, (remaining.get(answer[i]!) ?? 0) + 1);
  }
  for (let i = 0; i < 5; i++)
    if (result[i] !== 'exact' && (remaining.get(guess[i]!) ?? 0) > 0) {
      result[i] = 'near';
      remaining.set(guess[i]!, remaining.get(guess[i]!)! - 1);
    }
  return result;
}
