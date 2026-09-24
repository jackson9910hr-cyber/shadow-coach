import 'fake-indexeddb/auto';
import { createIdbRepository } from './idbRepository';
import { createMemoryRepository } from './memoryRepository';
import { DEFAULT_SETTINGS } from '../../core/settings';
import type { Repository } from './types';

const card = {
  sentenceId: 'default-v1/biz-001',
  ef: 2.5,
  interval: 1,
  repetition: 1,
  due: '2026-09-25',
};
const attempt = { sentenceId: card.sentenceId, date: '2026-09-24', accuracy: 80, createdAt: 1 };
const set = {
  id: 'mine',
  title: 'Mine',
  version: 1,
  sentences: [{ id: '1', text: 'Hi.', category: 'daily' as const }],
};

let n = 0;
describe.each([
  ['idb', () => createIdbRepository(`test-${n++}`)],
  ['memory', () => createMemoryRepository()],
] as [string, () => Repository][])('%s repository', (_name, make) => {
  it('starts empty', async () => {
    expect(await make().load()).toEqual({ cards: [], attempts: [], settings: null, sets: [] });
  });

  it('persists cards (upsert), attempts, settings and sets', async () => {
    const repo = make();
    await repo.putCard(card);
    await repo.putCard({ ...card, interval: 6 });
    await repo.addAttempt(attempt);
    await repo.addAttempt({ ...attempt, accuracy: 90 });
    await repo.putSettings({ ...DEFAULT_SETTINGS, rate: 0.7 });
    await repo.putSet(set);
    const snap = await repo.load();
    expect(snap.cards).toEqual([{ ...card, interval: 6 }]);
    expect(snap.attempts.map((a) => a.accuracy)).toEqual([80, 90]);
    expect(snap.settings?.rate).toBe(0.7);
    expect(snap.sets).toEqual([set]);
  });

  it('deletes sets, replaces and clears everything', async () => {
    const repo = make();
    await repo.putSet(set);
    await repo.deleteSet('mine');
    expect((await repo.load()).sets).toEqual([]);

    await repo.addAttempt(attempt);
    await repo.replaceAll({ cards: [card], attempts: [], settings: DEFAULT_SETTINGS, sets: [set] });
    expect(await repo.load()).toEqual({
      cards: [card],
      attempts: [],
      settings: DEFAULT_SETTINGS,
      sets: [set],
    });

    await repo.replaceAll({ cards: [], attempts: [attempt], settings: null, sets: [] });
    expect((await repo.load()).settings).toBeNull();

    await repo.clearAll();
    expect(await repo.load()).toEqual({ cards: [], attempts: [], settings: null, sets: [] });
  });
});
