import { BACKUP_FORMAT, createBackup, parseBackup } from './backup';
import { DEFAULT_SETTINGS } from './settings';

const card = { sentenceId: 'x/1', ef: 2.5, interval: 1, repetition: 1, due: '2026-09-25' };
const attempt = { sentenceId: 'x/1', date: '2026-09-24', accuracy: 80 };

describe('createBackup', () => {
  it('wraps data with format and timestamp', () => {
    const b = createBackup(
      { cards: [card], attempts: [attempt], settings: DEFAULT_SETTINGS, sets: [] },
      '2026-09-24T00:00:00.000Z',
    );
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(b.exportedAt).toBe('2026-09-24T00:00:00.000Z');
  });
});

describe('parseBackup', () => {
  const valid = createBackup(
    { cards: [card], attempts: [attempt], settings: DEFAULT_SETTINGS, sets: [] },
    '2026-09-24T00:00:00.000Z',
  );

  it('round-trips a valid backup, via object or JSON string', () => {
    expect(parseBackup(valid)).toEqual({
      ok: true,
      data: { cards: [card], attempts: [attempt], settings: DEFAULT_SETTINGS, sets: [] },
    });
    expect(parseBackup(JSON.stringify(valid)).ok).toBe(true);
  });

  it('rejects malformed JSON, wrong format and wrong shapes', () => {
    expect(parseBackup('{')).toEqual({ ok: false, error: 'Invalid JSON' });
    expect(parseBackup(null)).toEqual({ ok: false, error: 'Not a Shadow Coach backup' });
    expect(parseBackup({ ...valid, format: 'other' })).toEqual({
      ok: false,
      error: 'Not a Shadow Coach backup',
    });
    expect(parseBackup({ ...valid, cards: 'x' }).ok).toBe(false);
    expect(parseBackup({ ...valid, attempts: [{ ...attempt, accuracy: 101 }] }).ok).toBe(false);
    expect(parseBackup({ ...valid, attempts: [{ ...attempt, date: '2026-13-01' }] }).ok).toBe(
      false,
    );
    expect(parseBackup({ ...valid, cards: [{ ...card, ef: 1 }] }).ok).toBe(false);
    expect(parseBackup({ ...valid, cards: [{ ...card, due: 'x' }] }).ok).toBe(false);
    expect(parseBackup({ ...valid, cards: [5] }).ok).toBe(false);
    expect(parseBackup({ ...valid, attempts: [5] }).ok).toBe(false);
    expect(parseBackup({ ...valid, sets: [{ id: 'bad' }] }).ok).toBe(false);
    expect(parseBackup({ ...valid, sets: 'x' }).ok).toBe(false);
  });

  it('fills missing settings with defaults and drops unknown keys', () => {
    const r = parseBackup({ ...valid, settings: { rate: 0.7, evil: '<script>' } });
    expect(r.ok && r.data.settings).toEqual({ ...DEFAULT_SETTINGS, rate: 0.7 });
  });

  it('accepts valid imported sentence sets', () => {
    const set = {
      id: 's',
      title: 'T',
      version: 1,
      sentences: [{ id: '1', text: 'Hi.', category: 'daily' }],
    };
    const r = parseBackup({ ...valid, sets: [set] });
    expect(r.ok && r.data.sets).toEqual([set]);
  });
});

describe('parseBackup optional fields', () => {
  const base = createBackup(
    { cards: [], attempts: [], settings: DEFAULT_SETTINGS, sets: [] },
    '2026-09-24T00:00:00.000Z',
  );

  it('keeps optional card and attempt fields and strips unknown ones', () => {
    const fullCard = { ...card, lastAccuracy: 90, lastReviewed: '2026-09-24', junk: 1 };
    const fullAttempt = { ...attempt, segment: true, junk: 2 };
    const r = parseBackup({ ...base, cards: [fullCard], attempts: [fullAttempt] });
    expect(r.ok && r.data.cards[0]).toEqual({
      ...card,
      lastAccuracy: 90,
      lastReviewed: '2026-09-24',
    });
    expect(r.ok && r.data.attempts[0]).toEqual({ ...attempt, segment: true });
  });

  it('rejects invalid optional fields', () => {
    expect(parseBackup({ ...base, cards: [{ ...card, lastAccuracy: 'x' }] }).ok).toBe(false);
    expect(parseBackup({ ...base, cards: [{ ...card, lastReviewed: 5 }] }).ok).toBe(false);
    expect(parseBackup({ ...base, attempts: [{ ...attempt, segment: 'no' }] }).ok).toBe(false);
    expect(parseBackup({ ...base, attempts: [{ ...attempt, accuracy: 'x' }] }).ok).toBe(false);
  });

  it('treats a missing sets field as empty', () => {
    const { sets: _omit, ...withoutSets } = base;
    void _omit;
    const r = parseBackup(withoutSets);
    expect(r.ok && r.data.sets).toEqual([]);
  });
});

describe('parseBackup set rules', () => {
  const base = createBackup(
    { cards: [], attempts: [], settings: DEFAULT_SETTINGS, sets: [] },
    '2026-09-24T00:00:00.000Z',
  );
  const set = (id: string) => ({
    id,
    title: 'T',
    version: 1,
    sentences: [{ id: '1', text: 'Hi.', category: 'daily' }],
  });

  it('rejects the reserved default set id and duplicate set ids', () => {
    expect(parseBackup({ ...base, sets: [set('default-v1')] })).toEqual({
      ok: false,
      error: 'Invalid sentence sets',
    });
    expect(parseBackup({ ...base, sets: [set('a'), set('a')] })).toEqual({
      ok: false,
      error: 'Invalid sentence sets',
    });
  });
});
