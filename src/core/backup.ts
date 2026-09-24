import { isDateKey } from './date';
import { DEFAULT_SET_ID, parseSentenceSet, type SentenceSet } from './sentenceSet';
import { sanitizeSettings, type Settings } from './settings';
import type { Card } from './sm2';
import type { AttemptRecord } from './stats';

export const BACKUP_FORMAT = 'shadow-coach-backup';

export interface BackupData {
  cards: Card[];
  attempts: AttemptRecord[];
  settings: Settings;
  /** User-imported sentence sets (the bundled default set is not included). */
  sets: SentenceSet[];
}

export interface Backup extends BackupData {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
}

export type BackupResult = { ok: true; data: BackupData } | { ok: false; error: string };

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
const isAccuracy = (v: unknown) => typeof v === 'number' && v >= 0 && v <= 100;

export function createBackup(data: BackupData, exportedAt: string): Backup {
  return { format: BACKUP_FORMAT, version: 1, exportedAt, ...data };
}

function parseCard(v: unknown): Card | null {
  if (!isObject(v)) return null;
  const ok =
    typeof v.sentenceId === 'string' &&
    typeof v.ef === 'number' &&
    v.ef >= 1.3 &&
    isCount(v.interval) &&
    isCount(v.repetition) &&
    typeof v.due === 'string' &&
    isDateKey(v.due) &&
    (v.lastAccuracy === undefined || isAccuracy(v.lastAccuracy)) &&
    (v.lastReviewed === undefined ||
      (typeof v.lastReviewed === 'string' && isDateKey(v.lastReviewed)));
  if (!ok) return null;
  const card: Card = {
    sentenceId: v.sentenceId as string,
    ef: v.ef as number,
    interval: v.interval as number,
    repetition: v.repetition as number,
    due: v.due as string,
  };
  if (v.lastAccuracy !== undefined) card.lastAccuracy = v.lastAccuracy as number;
  if (v.lastReviewed !== undefined) card.lastReviewed = v.lastReviewed as string;
  return card;
}

function parseAttempt(v: unknown): AttemptRecord | null {
  if (!isObject(v)) return null;
  const ok =
    typeof v.sentenceId === 'string' &&
    typeof v.date === 'string' &&
    isDateKey(v.date) &&
    isAccuracy(v.accuracy) &&
    (v.segment === undefined || typeof v.segment === 'boolean');
  if (!ok) return null;
  const attempt: AttemptRecord = {
    sentenceId: v.sentenceId as string,
    date: v.date as string,
    accuracy: v.accuracy as number,
  };
  if (v.segment !== undefined) attempt.segment = v.segment as boolean;
  return attempt;
}

function parseList<T>(v: unknown, parse: (x: unknown) => T | null): T[] | null {
  if (!Array.isArray(v)) return null;
  const out: T[] = [];
  for (const item of v) {
    const parsed = parse(item);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

/** Validates an untrusted backup file. Rejects the whole file on any invalid record. */
export function parseBackup(input: unknown): BackupResult {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return { ok: false, error: 'Invalid JSON' };
    }
  }
  if (!isObject(data) || data.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'Not a Shadow Coach backup' };
  }
  const cards = parseList(data.cards, parseCard);
  if (!cards) return { ok: false, error: 'Invalid cards' };
  const attempts = parseList(data.attempts, parseAttempt);
  if (!attempts) return { ok: false, error: 'Invalid attempts' };
  const sets = parseList(data.sets ?? [], (s) => {
    const r = parseSentenceSet(s);
    return r.ok ? r.set : null;
  });
  const setIds = new Set(sets?.map((s) => s.id));
  if (!sets || setIds.size !== sets.length || setIds.has(DEFAULT_SET_ID)) {
    return { ok: false, error: 'Invalid sentence sets' };
  }
  return { ok: true, data: { cards, attempts, settings: sanitizeSettings(data.settings), sets } };
}
