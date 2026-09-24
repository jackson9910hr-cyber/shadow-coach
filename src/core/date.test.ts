import { addDays, diffDays, isDateKey, toDateKey } from './date';

describe('toDateKey', () => {
  it('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
});

describe('isDateKey', () => {
  it.each([
    ['2026-09-24', true],
    ['2026-02-29', false],
    ['2028-02-29', true],
    ['2026-13-01', false],
    ['2026-9-24', false],
    ['not-a-date', false],
  ])('%s -> %s', (key, expected) => {
    expect(isDateKey(key)).toBe(expected);
  });
});

describe('addDays', () => {
  it('adds and subtracts days across month and year boundaries', () => {
    expect(addDays('2026-09-24', 1)).toBe('2026-09-25');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-09-24', 0)).toBe('2026-09-24');
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01');
  });

  it('throws on an invalid key', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(/Invalid date key/);
  });
});

describe('diffDays', () => {
  it('returns whole days from a to b', () => {
    expect(diffDays('2026-09-24', '2026-09-24')).toBe(0);
    expect(diffDays('2026-09-24', '2026-10-01')).toBe(7);
    expect(diffDays('2026-10-01', '2026-09-24')).toBe(-7);
    // DST transitions in other time zones must not produce fractional days
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2);
  });
});
