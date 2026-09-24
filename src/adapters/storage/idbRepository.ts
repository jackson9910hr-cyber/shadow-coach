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

export function openShadowDb(name = DB_NAME): Promise<IDBPDatabase<ShadowDB>> {
  return openDB<ShadowDB>(name, 1, {
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
  const dbPromise = openShadowDb(name);

  return {
    async load(): Promise<Snapshot> {
      const db = await dbPromise;
      const [cards, attempts, settings, sets] = await Promise.all([
        db.getAll('cards'),
        db.getAll('attempts'),
        db.get('settings', SETTINGS_KEY),
        db.getAll('sets'),
      ]);
      return { cards, attempts, settings: settings ?? null, sets };
    },
    async putCard(card) {
      await (await dbPromise).put('cards', card);
    },
    async addAttempt(attempt) {
      await (await dbPromise).add('attempts', attempt);
    },
    async putSettings(settings) {
      await (await dbPromise).put('settings', settings, SETTINGS_KEY);
    },
    async putSet(set) {
      await (await dbPromise).put('sets', set);
    },
    async deleteSet(id) {
      await (await dbPromise).delete('sets', id);
    },
    async replaceAll(snapshot) {
      const db = await dbPromise;
      const tx = db.transaction(STORES, 'readwrite');
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
    },
    async clearAll() {
      const db = await dbPromise;
      const tx = db.transaction(STORES, 'readwrite');
      await Promise.all(STORES.map((s) => tx.objectStore(s).clear()));
      await tx.done;
    },
  };
}
