import type { Repository, Snapshot } from './types';

/** In-memory repository for tests and as a fallback when IndexedDB is unavailable. */
export function createMemoryRepository(initial?: Partial<Snapshot>): Repository {
  let data: Snapshot = { cards: [], attempts: [], settings: null, sets: [], ...initial };
  const clone = <T>(v: T): T => structuredClone(v);
  return {
    async load() {
      return clone(data);
    },
    async record(attempt, card) {
      data.attempts = [...data.attempts, clone(attempt)];
      if (card) {
        data.cards = [...data.cards.filter((c) => c.sentenceId !== card.sentenceId), clone(card)];
      }
    },
    async putSettings(settings) {
      data.settings = clone(settings);
    },
    async putSet(set) {
      data.sets = [...data.sets.filter((s) => s.id !== set.id), clone(set)];
    },
    async deleteSet(id) {
      data.sets = data.sets.filter((s) => s.id !== id);
    },
    async replaceAll(snapshot) {
      data = clone(snapshot);
    },
    async clearAll() {
      data = { cards: [], attempts: [], settings: null, sets: [] };
    },
  };
}
