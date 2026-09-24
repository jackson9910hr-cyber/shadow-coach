import type { SentenceSet } from '../../core/sentenceSet';
import type { Settings } from '../../core/settings';
import type { Card } from '../../core/sm2';
import type { AttemptRecord } from '../../core/stats';

/** Only the score is stored — never audio or the recognized text (docs/review-stage4.md S2). */
export interface StoredAttempt extends AttemptRecord {
  createdAt: number;
}

export interface Snapshot {
  cards: Card[];
  attempts: StoredAttempt[];
  settings: Settings | null;
  sets: SentenceSet[];
}

/** Platform boundary for persistence. */
export interface Repository {
  load(): Promise<Snapshot>;
  /** Saves an attempt and, when given, its updated card in one transaction. */
  record(attempt: StoredAttempt, card: Card | null): Promise<void>;
  putSettings(settings: Settings): Promise<void>;
  putSet(set: SentenceSet): Promise<void>;
  deleteSet(id: string): Promise<void>;
  /** Replace all learning data (used by backup import). */
  replaceAll(snapshot: Snapshot): Promise<void>;
  clearAll(): Promise<void>;
}
