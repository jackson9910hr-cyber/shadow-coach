import { buildQueue } from './queue';
import { newCard, type Card } from './sm2';
import type { Sentence } from './sentenceSet';

const s = (id: string, category: Sentence['category'] = 'business'): Sentence => ({
  id,
  text: id,
  category,
});
const card = (sentenceId: string, due: string): Card => ({ ...newCard(sentenceId, due), due });
const today = '2026-09-24';

describe('buildQueue', () => {
  const sentences = [s('a'), s('b'), s('c', 'church'), s('d', 'daily'), s('e')];

  it('puts due reviews first (oldest due first), then new sentences in set order', () => {
    const cards = {
      e: card('e', '2026-09-20'),
      b: card('b', '2026-09-24'),
      a: card('a', '2026-09-30'), // not due
    };
    const q = buildQueue(sentences, cards, today, { newLimit: 10, newIntroducedToday: 0 });
    expect(q.map((x) => x.id)).toEqual(['e', 'b', 'c', 'd']);
  });

  it('keeps set order for equal due dates', () => {
    const cards = { e: card('e', today), a: card('a', today) };
    const q = buildQueue(sentences, cards, today, { newLimit: 0, newIntroducedToday: 0 });
    expect(q.map((x) => x.id)).toEqual(['a', 'e']);
  });

  it('limits new sentences by the remaining daily allowance', () => {
    const q = buildQueue(sentences, {}, today, { newLimit: 3, newIntroducedToday: 1 });
    expect(q.map((x) => x.id)).toEqual(['a', 'b']);
    expect(buildQueue(sentences, {}, today, { newLimit: 3, newIntroducedToday: 5 })).toEqual([]);
  });

  it('filters by category', () => {
    const cards = { c: card('c', today) };
    const q = buildQueue(sentences, cards, today, {
      newLimit: 10,
      newIntroducedToday: 0,
      category: 'daily',
    });
    expect(q.map((x) => x.id)).toEqual(['d']);
    const all = buildQueue(sentences, cards, today, {
      newLimit: 10,
      newIntroducedToday: 0,
      category: 'all',
    });
    expect(all).toHaveLength(5);
  });
});

describe('buildQueue ordering', () => {
  it('orders later-due items after earlier ones regardless of set order', () => {
    const cards = { a: card('a', '2026-09-23'), b: card('b', '2026-09-21') };
    const q = buildQueue([s('a'), s('b')], cards, today, { newLimit: 0, newIntroducedToday: 0 });
    expect(q.map((x) => x.id)).toEqual(['b', 'a']);
  });
});
