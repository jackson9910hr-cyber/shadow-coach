import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SentenceSet } from '../../core/sentenceSet';
import type { Settings } from '../../core/settings';
import type { Card } from '../../core/sm2';
import type { Repository, Snapshot, StoredAttempt } from './types';

interface ShadowDB extends DBSchema {
  cards: { key: string; value: Card };
  attempts: { key: number; value: StoredAttempt; indexes: { date: string } };
  settings: { key: string; value: Settings };
  sets: { key: string; value: SentenceSet };
}

const DB_NAME = 'shadow-coach';
const SETTINGS_KEY = 'settings';
const STORES = ['cards', 'attempts', 'settings', 'sets'] as const;

export function openShadowDb(
  name = DB_NAME,
  onTerminated?: () => void,
): Promise<IDBPDatabase<ShadowDB>> {
  return openDB<ShadowDB>(name, 1, {
    // iOS can drop the connection while the app is suspended.
    terminated: onTerminated,
    upgrade(db) {
      db.createObjectStore('cards', { keyPath: 'sentenceId' });
      const attempts = db.createObjectStore('attempts', { autoIncrement: true });
      attempts.createIndex('date', 'date');
      db.createObjectStore('settings');
      db.createObjectStore('sets', { keyPath: 'id' });
    },
  });
}

export function createIdbRepository(name = DB_NAME): Repository {
  let dbPromise: Promise<IDBPDatabase<ShadowDB>> | null = null;
  const db = () => (dbPromise ??= openShadowDb(name, () => (dbPromise = null)));

  /** Runs an operation, reopening the database and retrying once if the connection was lost. */
  async function run<T>(op: (d: IDBPDatabase<ShadowDB>) => Promise<T>): Promise<T> {
    try {
      return await op(await db());
    } catch (e) {
      const name = (e as DOMException | undefined)?.name;
      if (name !== 'InvalidStateError' && name !== 'UnknownError') throw e;
      dbPromise = null;
      return op(await db());
    }
  }

  return {
    load: () =>
      run(async (d) => {
        const [cards, attempts, settings, sets] = await Promise.all([
          d.getAll('cards'),
          d.getAll('attempts'),
          d.get('settings', SETTINGS_KEY),
          d.getAll('sets'),
        ]);
        return { cards, attempts, settings: settings ?? null, sets } satisfies Snapshot;
      }),
    record: (attempt, card) =>
      run(async (d) => {
        const tx = d.transaction(['attempts', 'cards'], 'readwrite');
        await Promise.all([
          tx.objectStore('attempts').add(attempt),
          ...(card ? [tx.objectStore('cards').put(card)] : []),
          tx.done,
        ]);
      }),
    putSettings: (settings) =>
      run(async (d) => {
        await d.put('settings', settings, SETTINGS_KEY);
      }),
    putSet: (set) =>
      run(async (d) => {
        await d.put('sets', set);
      }),
    deleteSet: (id) =>
      run(async (d) => {
        await d.delete('sets', id);
      }),
    replaceAll: (snapshot) =>
      run(async (d) => {
        const tx = d.transaction(STORES, 'readwrite');
        await Promise.all(STORES.map((s) => tx.objectStore(s).clear()));
        await Promise.all([
          ...snapshot.cards.map((c) => tx.objectStore('cards').put(c)),
          ...snapshot.attempts.map((a) => tx.objectStore('attempts').add(a)),
          ...snapshot.sets.map((s) => tx.objectStore('sets').put(s)),
          ...(snapshot.settings
            ? [tx.objectStore('settings').put(snapshot.settings, SETTINGS_KEY)]
            : []),
        ]);
        await tx.done;
      }),
    clearAll: () =>
      run(async (d) => {
        const tx = d.transaction(STORES, 'readwrite');
        await Promise.all(STORES.map((s) => tx.objectStore(s).clear()));
        await tx.done;
      }),
  };
}
