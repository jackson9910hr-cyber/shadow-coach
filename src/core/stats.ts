import { addDays, type DateKey } from './date';

export interface AttemptRecord {
  sentenceId: string;
  date: DateKey;
  accuracy: number;
  /** True when the attempt was a retry of an error segment, not the whole sentence. */
  segment?: boolean;
}

export interface TodayStats {
  /** Distinct sentences practiced today (whole or segment). */
  sentences: number;
  /** Whole-sentence attempts today. */
  attempts: number;
  /** Mean accuracy of today's whole-sentence attempts, rounded; null if none. */
  averageAccuracy: number | null;
  streak: number;
}

/**
 * Consecutive study days ending today. If today has no study yet, the streak
 * still counts back from yesterday so it is not shown as broken before the day ends.
 */
export function streakDays(studyDates: Iterable<DateKey>, today: DateKey): number {
  const days = new Set(studyDates);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function todayStats(attempts: readonly AttemptRecord[], today: DateKey): TodayStats {
  const todays = attempts.filter((a) => a.date === today);
  const whole = todays.filter((a) => !a.segment);
  const sum = whole.reduce((acc, a) => acc + a.accuracy, 0);
  return {
    sentences: new Set(todays.map((a) => a.sentenceId)).size,
    attempts: whole.length,
    averageAccuracy: whole.length ? Math.round(sum / whole.length) : null,
    streak: streakDays(
      attempts.map((a) => a.date),
      today,
    ),
  };
}
