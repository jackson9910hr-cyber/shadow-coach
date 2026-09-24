import { isDue, newCard, qualityFromAccuracy, review, type Card } from './sm2';

describe('qualityFromAccuracy', () => {
  it.each([
    [100, 5],
    [95, 5],
    [94, 4],
    [85, 4],
    [84, 3],
    [70, 3],
    [69, 2],
    [50, 2],
    [49, 1],
    [30, 1],
    [29, 0],
    [0, 0],
  ])('%i%% -> q%i', (acc, q) => {
    expect(qualityFromAccuracy(acc)).toBe(q);
  });

  it('clamps out-of-range and NaN input', () => {
    expect(qualityFromAccuracy(150)).toBe(5);
    expect(qualityFromAccuracy(-10)).toBe(0);
    expect(qualityFromAccuracy(Number.NaN)).toBe(0);
  });
});

describe('newCard', () => {
  it('starts with EF 2.5, due today', () => {
    expect(newCard('s1', '2026-09-24')).toEqual({
      sentenceId: 's1',
      ef: 2.5,
      interval: 0,
      repetition: 0,
      due: '2026-09-24',
    });
  });
});

describe('review', () => {
  const today = '2026-09-24';
  const base = newCard('s1', today);

  it('follows the 1 -> 6 -> round(interval * EF) schedule on good answers', () => {
    const r1 = review(base, 5, today);
    expect(r1).toMatchObject({ repetition: 1, interval: 1, due: '2026-09-25' });
    expect(r1.ef).toBeCloseTo(2.6);

    const r2 = review(r1, 5, '2026-09-25');
    expect(r2).toMatchObject({ repetition: 2, interval: 6, due: '2026-10-01' });
    expect(r2.ef).toBeCloseTo(2.7);

    const r3 = review(r2, 4, '2026-10-01');
    expect(r3.ef).toBeCloseTo(2.7);
    expect(r3).toMatchObject({ repetition: 3, interval: 16, due: '2026-10-17' });
  });

  it('applies the SM-2 EF formula for q = 3', () => {
    const r = review(base, 3, today);
    expect(r.ef).toBeCloseTo(2.36);
    expect(r.interval).toBe(1);
  });

  it('resets repetitions and interval on a failing grade without changing EF', () => {
    const learned: Card = { ...base, ef: 2.2, interval: 20, repetition: 4, due: today };
    const r = review(learned, 2, today);
    expect(r).toEqual({ ...learned, repetition: 0, interval: 1, due: '2026-09-25' });
  });

  it('never lets EF drop below 1.3', () => {
    let card: Card = { ...base, ef: 1.35 };
    for (let i = 0; i < 5; i++) card = review(card, 3, today);
    expect(card.ef).toBe(1.3);
  });

  it('records the accuracy when provided', () => {
    expect(review(base, 4, today, 88).lastAccuracy).toBe(88);
  });

  it('rejects an invalid quality', () => {
    expect(() => review(base, 6, today)).toThrow(RangeError);
    expect(() => review(base, 2.5, today)).toThrow(RangeError);
  });

  it('does not mutate the input card', () => {
    const copy = { ...base };
    review(base, 5, today);
    expect(base).toEqual(copy);
  });
});

describe('isDue', () => {
  it('is due on or after the due date', () => {
    const card = { ...newCard('s1', '2026-09-24'), due: '2026-09-25' };
    expect(isDue(card, '2026-09-24')).toBe(false);
    expect(isDue(card, '2026-09-25')).toBe(true);
    expect(isDue(card, '2026-10-01')).toBe(true);
  });
});
