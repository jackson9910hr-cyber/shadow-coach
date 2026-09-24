import type { Card } from './sm2';
import type { Category, Sentence } from './sentenceSet';
import type { DateKey } from './date';

export interface QueueOptions {
  /** Maximum new sentences to introduce per day. */
  newLimit: number;
  /** New sentences already introduced today. */
  newIntroducedToday: number;
  category?: Category | 'all';
}

/** Today's practice queue: due reviews (oldest first), then new sentences up to the daily limit. */
export function buildQueue<T extends Sentence>(
  sentences: readonly T[],
  cards: Readonly<Record<string, Card>>,
  today: DateKey,
  options: QueueOptions,
): T[] {
  const { category = 'all' } = options;
  const pool = sentences.filter((s) => category === 'all' || s.category === category);

  const due: { sentence: T; due: DateKey; order: number }[] = [];
  const fresh: T[] = [];
  pool.forEach((sentence, order) => {
    const card = cards[sentence.id];
    if (!card) fresh.push(sentence);
    else if (card.due <= today) due.push({ sentence, due: card.due, order });
  });
  due.sort((a, b) => (a.due === b.due ? a.order - b.order : a.due < b.due ? -1 : 1));

  const allowance = Math.max(0, options.newLimit - options.newIntroducedToday);
  return [...due.map((d) => d.sentence), ...fresh.slice(0, allowance)];
}
