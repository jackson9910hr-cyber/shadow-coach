import { batch, computed, signal } from '@preact/signals';
import defaultSetJson from '../data/default-set.json';
import { createBackup, parseBackup, type Backup } from '../core/backup';
import { toDateKey, type DateKey } from '../core/date';
import { buildQueue } from '../core/queue';
import {
  DEFAULT_SET_ID,
  parseSentenceSet,
  type Category,
  type Sentence,
  type SentenceSet,
} from '../core/sentenceSet';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '../core/settings';
import { newCard, qualityFromAccuracy, review, type Card } from '../core/sm2';
import { countNewToday, todayStats } from '../core/stats';
import { createMemoryRepository } from '../adapters/storage/memoryRepository';
import type { Repository, StoredAttempt } from '../adapters/storage/types';

/** A sentence with a globally unique id: `${setId}/${sentence.id}`. */
export interface PracticeSentence extends Sentence {
  setId: string;
  localId: string;
}

const parsedDefault = parseSentenceSet(defaultSetJson);
/* v8 ignore next -- guarded by the bundled-set unit test */
if (!parsedDefault.ok) throw new Error(`Invalid default set: ${parsedDefault.errors.join(', ')}`);
export const DEFAULT_SET: SentenceSet = parsedDefault.set;

function flatten(set: SentenceSet): PracticeSentence[] {
  return set.sentences.map((s) => ({
    ...s,
    id: `${set.id}/${s.id}`,
    setId: set.id,
    localId: s.id,
  }));
}

export interface RecordInput {
  sentenceId: string;
  accuracy: number;
  segment?: boolean;
}

export interface RecordOutcome {
  /** True when this attempt updated the SM-2 schedule (first whole attempt of the day). */
  graded: boolean;
  card: Card | null;
  /** Resolves when the attempt is persisted (UI does not need to wait for it). */
  saved: Promise<void>;
}

export type ImportResult = { ok: true; message: string } | { ok: false; message: string };

export function createStore(initialRepo: Repository, clock: () => Date = () => new Date()) {
  let repo = initialRepo;
  const ready = signal(false);
  /** Set when persistent storage failed and data lives in memory only. */
  const storageError = signal(false);
  const today = signal<DateKey>(toDateKey(clock()));
  const settings = signal<Settings>(DEFAULT_SETTINGS);
  const userSets = signal<SentenceSet[]>([]);
  const cards = signal<Record<string, Card>>({});
  const attempts = signal<StoredAttempt[]>([]);

  const sentences = computed(() => [DEFAULT_SET, ...userSets.value].flatMap(flatten));
  const stats = computed(() => todayStats(attempts.value, today.value));
  const newToday = computed(() => countNewToday(attempts.value, today.value));

  function queueFor(category: Category | 'all' = 'all'): PracticeSentence[] {
    return buildQueue(sentences.value, cards.value, today.value, {
      newLimit: settings.value.newPerDay,
      newIntroducedToday: newToday.value,
      category,
    });
  }

  async function safely(op: () => Promise<void>) {
    try {
      await op();
    } catch {
      storageError.value = true;
    }
  }

  async function init() {
    try {
      const snap = await repo.load();
      batch(() => {
        cards.value = Object.fromEntries(snap.cards.map((c) => [c.sentenceId, c]));
        attempts.value = snap.attempts;
        settings.value = sanitizeSettings(snap.settings ?? DEFAULT_SETTINGS);
        userSets.value = snap.sets;
      });
    } catch {
      storageError.value = true;
      repo = createMemoryRepository();
    }
    ready.value = true;
  }

  /** Re-read the calendar day (call when the app returns to the foreground). */
  function refreshToday() {
    today.value = toDateKey(clock());
  }

  /** Updates state immediately and persists in the background (one transaction). */
  function recordAttempt(input: RecordInput): RecordOutcome {
    refreshToday();
    const date = today.value;
    const attempt: StoredAttempt = {
      sentenceId: input.sentenceId,
      date,
      accuracy: input.accuracy,
      createdAt: clock().getTime(),
    };
    if (input.segment) attempt.segment = true;

    let graded = false;
    let card: Card | null = cards.value[input.sentenceId] ?? null;
    let changed: Card | null = null;
    if (!input.segment) {
      const current = card ?? newCard(input.sentenceId, date);
      graded = current.lastReviewed !== date;
      changed = graded
        ? review(current, qualityFromAccuracy(input.accuracy), date, input.accuracy)
        : { ...current, lastAccuracy: input.accuracy };
      card = changed;
    }
    batch(() => {
      attempts.value = [...attempts.value, attempt];
      if (changed) cards.value = { ...cards.value, [changed.sentenceId]: changed };
    });
    const saved = safely(() => repo.record(attempt, changed));
    return { graded, card, saved };
  }

  async function updateSettings(patch: Partial<Settings>) {
    const next = sanitizeSettings({ ...settings.value, ...patch });
    settings.value = next;
    await safely(() => repo.putSettings(next));
  }

  async function importSet(json: string): Promise<ImportResult> {
    const r = parseSentenceSet(json);
    if (!r.ok) return { ok: false, message: `세트 형식 오류: ${r.errors.slice(0, 3).join('; ')}` };
    if (r.set.id === DEFAULT_SET_ID) {
      return { ok: false, message: '기본 세트와 같은 id는 사용할 수 없습니다.' };
    }
    userSets.value = [...userSets.value.filter((s) => s.id !== r.set.id), r.set];
    await safely(() => repo.putSet(r.set));
    return {
      ok: true,
      message: `"${r.set.title}" 세트(${r.set.sentences.length}문장)를 추가했습니다.`,
    };
  }

  async function deleteSet(id: string) {
    userSets.value = userSets.value.filter((s) => s.id !== id);
    await safely(() => repo.deleteSet(id));
  }

  function exportBackup(): Backup {
    return createBackup(
      {
        cards: Object.values(cards.value),
        attempts: attempts.value.map(({ sentenceId, date, accuracy, segment }) =>
          segment ? { sentenceId, date, accuracy, segment } : { sentenceId, date, accuracy },
        ),
        settings: settings.value,
        sets: userSets.value,
      },
      clock().toISOString(),
    );
  }

  async function importBackup(json: string): Promise<ImportResult> {
    const r = parseBackup(json);
    if (!r.ok) return { ok: false, message: `백업 파일 오류: ${r.error}` };
    const now = clock().getTime();
    const restored: StoredAttempt[] = r.data.attempts.map((a) => ({ ...a, createdAt: now }));
    batch(() => {
      cards.value = Object.fromEntries(r.data.cards.map((c) => [c.sentenceId, c]));
      attempts.value = restored;
      settings.value = r.data.settings;
      userSets.value = r.data.sets;
    });
    await safely(() =>
      repo.replaceAll({
        cards: r.data.cards,
        attempts: restored,
        settings: r.data.settings,
        sets: r.data.sets,
      }),
    );
    return {
      ok: true,
      message: `복원 완료: 카드 ${r.data.cards.length}개, 기록 ${r.data.attempts.length}개`,
    };
  }

  async function resetAll() {
    batch(() => {
      cards.value = {};
      attempts.value = [];
      settings.value = DEFAULT_SETTINGS;
      userSets.value = [];
    });
    await safely(() => repo.clearAll());
  }

  return {
    ready,
    storageError,
    today,
    settings,
    userSets,
    cards,
    attempts,
    sentences,
    stats,
    init,
    refreshToday,
    queueFor,
    recordAttempt,
    updateSettings,
    importSet,
    deleteSet,
    exportBackup,
    importBackup,
    resetAll,
  };
}

export type Store = ReturnType<typeof createStore>;
