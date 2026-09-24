import { accuracyLevel, formatDue } from './format';
import { parseHash } from './router';

describe('formatDue', () => {
  it('describes due dates relative to today', () => {
    expect(formatDue('2026-09-20', '2026-09-24')).toBe('오늘');
    expect(formatDue('2026-09-24', '2026-09-24')).toBe('오늘');
    expect(formatDue('2026-09-25', '2026-09-24')).toBe('내일');
    expect(formatDue('2026-10-01', '2026-09-24')).toBe('7일 후 (10월 1일)');
  });
});

describe('accuracyLevel', () => {
  it('buckets accuracy', () => {
    expect(accuracyLevel(85)).toBe('good');
    expect(accuracyLevel(60)).toBe('ok');
    expect(accuracyLevel(59)).toBe('bad');
  });
});

describe('parseHash', () => {
  it('maps hashes to routes, defaulting to home', () => {
    expect(parseHash('')).toBe('home');
    expect(parseHash('#/')).toBe('home');
    expect(parseHash('#/practice')).toBe('practice');
    expect(parseHash('#/library')).toBe('library');
    expect(parseHash('#/settings')).toBe('settings');
    expect(parseHash('#/nope')).toBe('home');
  });
});
