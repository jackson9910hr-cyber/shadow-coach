import { countNewToday, streakDays, todayStats, type AttemptRecord } from './stats';

const a = (sentenceId: string, date: string, accuracy: number, segment = false): AttemptRecord => ({
  sentenceId,
  date,
  accuracy,
  segment,
});

describe('streakDays', () => {
  it('is 0 with no study days', () => {
    expect(streakDays([], '2026-09-24')).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(streakDays(['2026-09-22', '2026-09-23', '2026-09-24'], '2026-09-24')).toBe(3);
  });

  it('keeps the streak alive through yesterday if today has no study yet', () => {
    expect(streakDays(['2026-09-22', '2026-09-23'], '2026-09-24')).toBe(2);
  });

  it('breaks on a gap and ignores duplicates and future dates', () => {
    expect(
      streakDays(
        ['2026-09-20', '2026-09-22', '2026-09-24', '2026-09-24', '2026-09-25'],
        '2026-09-24',
      ),
    ).toBe(1);
  });

  it('is 0 when the last study day was two or more days ago', () => {
    expect(streakDays(['2026-09-21', '2026-09-22'], '2026-09-24')).toBe(0);
  });

  it('crosses month boundaries', () => {
    expect(streakDays(['2026-08-31', '2026-09-01'], '2026-09-01')).toBe(2);
  });
});

describe('todayStats', () => {
  const today = '2026-09-24';

  it('returns zeros and null average when nothing was studied', () => {
    expect(todayStats([], today)).toEqual({
      sentences: 0,
      attempts: 0,
      averageAccuracy: null,
      streak: 0,
    });
  });

  it('counts distinct sentences and averages full-sentence attempts only', () => {
    const stats = todayStats(
      [
        a('s1', today, 80),
        a('s1', today, 90),
        a('s1', today, 10, true), // segment retry: excluded from average
        a('s2', today, 71),
        a('s3', '2026-09-23', 100), // yesterday
      ],
      today,
    );
    expect(stats).toEqual({ sentences: 2, attempts: 3, averageAccuracy: 80, streak: 2 });
  });

  it('counts a sentence practiced only via segment retries', () => {
    expect(todayStats([a('s1', today, 50, true)], today)).toEqual({
      sentences: 1,
      attempts: 0,
      averageAccuracy: null,
      streak: 1,
    });
  });
});

describe('countNewToday', () => {
  it('counts sentences whose first ever attempt is today', () => {
    expect(
      countNewToday(
        [
          a('s1', '2026-09-23', 50),
          a('s1', '2026-09-24', 60), // seen before
          a('s2', '2026-09-24', 70),
          a('s2', '2026-09-24', 80, true),
          a('s3', '2026-09-24', 90, true),
        ],
        '2026-09-24',
      ),
    ).toBe(2);
  });
});
