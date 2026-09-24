import type { SentenceSet } from '../../core/sentenceSet';
import type { Settings } from '../../core/settings';
import type { Card } from '../../core/sm2';
import type { AttemptRecord } from '../../core/stats';

export interface StoredAttempt extends AttemptRecord {
  /** Recognized text (never audio). Absent for self-graded attempts. */
  transcript?: string;
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
  putCard(card: Card): Promise<void>;
  addAttempt(attempt: StoredAttempt): Promise<void>;
  putSettings(settings: Settings): Promise<void>;
  putSet(set: SentenceSet): Promise<void>;
  deleteSet(id: string): Promise<void>;
  /** Replace all learning data (used by backup import). */
  replaceAll(snapshot: Snapshot): Promise<void>;
  clearAll(): Promise<void>;
}
