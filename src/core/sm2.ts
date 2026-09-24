/**
 * SuperMemo-2 spaced repetition (Wozniak, 1990).
 * https://super-memory.com/english/ol/sm2.htm
 */
import { addDays, type DateKey } from './date';

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export interface Card {
  sentenceId: string;
  /** Easiness factor, >= 1.3 */
  ef: number;
  /** Days until the next review. */
  interval: number;
  /** Consecutive successful reviews (q >= 3). */
  repetition: number;
  due: DateKey;
  lastAccuracy?: number;
  /** Date of the last graded review; used to grade only the first attempt per day. */
  lastReviewed?: DateKey;
}

const MIN_EF = 1.3;
const INITIAL_EF = 2.5;

/** Maps a 0–100 pronunciation accuracy to an SM-2 grade (see docs/stage0-requirements.md §4.3). */
export function qualityFromAccuracy(accuracy: number): Quality {
  if (!(accuracy >= 30)) return 0; // also catches NaN
  if (accuracy >= 95) return 5;
  if (accuracy >= 85) return 4;
  if (accuracy >= 70) return 3;
  if (accuracy >= 50) return 2;
  return 1;
}

export function newCard(sentenceId: string, today: DateKey): Card {
  return { sentenceId, ef: INITIAL_EF, interval: 0, repetition: 0, due: today };
}

export function review(card: Card, quality: number, today: DateKey, accuracy?: number): Card {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new RangeError(`Quality must be an integer 0–5, got ${quality}`);
  }
  const next: Card = { ...card, lastReviewed: today };
  if (accuracy !== undefined) next.lastAccuracy = accuracy;

  if (quality < 3) {
    // Original SM-2: restart repetitions without changing EF.
    next.repetition = 0;
    next.interval = 1;
  } else {
    const q = quality;
    const ef = card.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    next.ef = Math.max(MIN_EF, Math.round(ef * 1000) / 1000);
    next.repetition = card.repetition + 1;
    next.interval =
      next.repetition === 1 ? 1 : next.repetition === 2 ? 6 : Math.round(card.interval * next.ef);
  }
  next.due = addDays(today, next.interval);
  return next;
}

export function isDue(card: Card, today: DateKey): boolean {
  return card.due <= today;
}
