import { createStore } from './store';
import { createMemoryRepository } from '../adapters/storage/memoryRepository';
import type { Repository } from '../adapters/storage/types';
import { DEFAULT_SETTINGS } from '../core/settings';

const at = (iso: string) => () => new Date(iso);
const firstId = 'default-v1/biz-001';

async function setup(
  clock = at('2026-09-24T08:00:00'),
  repo: Repository = createMemoryRepository(),
) {
  const store = createStore(repo, clock);
  await store.init();
  return { store, repo };
}

describe('store', () => {
  it('loads the default 30-sentence set with namespaced ids', async () => {
    const { store } = await setup();
    expect(store.ready.value).toBe(true);
    expect(store.sentences.value).toHaveLength(30);
    expect(store.sentences.value[0]).toMatchObject({
      id: firstId,
      setId: 'default-v1',
      localId: 'biz-001',
    });
  });

  it('builds today queue limited by new sentences per day and category', async () => {
    const { store } = await setup();
    expect(store.queueFor('all')).toHaveLength(10);
    expect(store.queueFor('church').map((s) => s.localId)).toEqual([
      'chu-001',
      'chu-002',
      'chu-003',
      'chu-004',
      'chu-005',
      'chu-006',
      'chu-007',
      'chu-008',
    ]);
  });

  it('grades only the first whole attempt per day and persists it', async () => {
    const { store, repo } = await setup();
    const first = store.recordAttempt({ sentenceId: firstId, accuracy: 78 });
    expect(first.graded).toBe(true);
    expect(first.card).toMatchObject({
      repetition: 1,
      interval: 1,
      due: '2026-09-25',
      lastAccuracy: 78,
    });

    const second = store.recordAttempt({ sentenceId: firstId, accuracy: 100 });
    expect(second.graded).toBe(false);
    expect(second.card).toMatchObject({ due: '2026-09-25', lastAccuracy: 100 });

    const seg = store.recordAttempt({ sentenceId: firstId, accuracy: 50, segment: true });
    expect(seg.graded).toBe(false);
    await seg.saved;

    expect(store.stats.value).toEqual({
      sentences: 1,
      attempts: 2,
      averageAccuracy: 89,
      streak: 1,
    });
    expect(store.queueFor('all')).toHaveLength(9); // 1 of 10 new used; it is due tomorrow
    const snap = await repo.load();
    expect(snap.attempts).toHaveLength(3);
    expect(snap.attempts[0]).toEqual({
      sentenceId: firstId,
      date: '2026-09-24',
      accuracy: 78,
      createdAt: new Date('2026-09-24T08:00:00').getTime(),
    });
    expect(snap.cards[0]?.lastAccuracy).toBe(100);
  });

  it('returns null card for a segment attempt on an unseen sentence', async () => {
    const { store } = await setup();
    expect(store.recordAttempt({ sentenceId: firstId, accuracy: 10, segment: true })).toMatchObject(
      {
        graded: false,
        card: null,
      },
    );
  });

  it('picks up a new calendar day', async () => {
    let now = new Date('2026-09-24T23:59:00');
    const { store } = await setup(() => now);
    now = new Date('2026-09-25T00:01:00');
    store.refreshToday();
    expect(store.today.value).toBe('2026-09-25');
  });

  it('updates and sanitizes settings', async () => {
    const { store, repo } = await setup();
    await store.updateSettings({ rate: 0.7, newPerDay: 999 });
    expect(store.settings.value).toEqual({ ...DEFAULT_SETTINGS, rate: 0.7 });
    expect((await repo.load()).settings?.rate).toBe(0.7);
  });

  it('imports, replaces and deletes user sentence sets', async () => {
    const { store } = await setup();
    const set = {
      id: 'sermon',
      title: 'Sermon',
      version: 1,
      sentences: [{ id: '1', text: 'Grace.', category: 'church' }],
    };
    expect((await store.importSet(JSON.stringify(set))).ok).toBe(true);
    expect(store.sentences.value).toHaveLength(31);
    await store.importSet(JSON.stringify({ ...set, title: 'Sermon 2' }));
    expect(store.userSets.value.map((s) => s.title)).toEqual(['Sermon 2']);
    expect((await store.importSet('{')).ok).toBe(false);
    expect((await store.importSet(JSON.stringify({ ...set, id: 'default-v1' }))).message).toMatch(
      /기본 세트/,
    );
    await store.deleteSet('sermon');
    expect(store.sentences.value).toHaveLength(30);
  });

  it('exports a backup and restores it into a fresh store', async () => {
    const { store } = await setup();
    store.recordAttempt({ sentenceId: firstId, accuracy: 90 });
    store.recordAttempt({ sentenceId: firstId, accuracy: 40, segment: true });
    const backup = store.exportBackup();
    expect(backup.attempts).toEqual([
      { sentenceId: firstId, date: '2026-09-24', accuracy: 90 },
      { sentenceId: firstId, date: '2026-09-24', accuracy: 40, segment: true },
    ]);

    const { store: other } = await setup();
    const r = await other.importBackup(JSON.stringify(backup));
    expect(r).toEqual({ ok: true, message: '복원 완료: 카드 1개, 기록 2개' });
    expect(other.cards.value[firstId]?.lastAccuracy).toBe(90);
    expect((await other.importBackup('nope')).ok).toBe(false);
  });

  it('resets everything', async () => {
    const { store, repo } = await setup();
    await store.recordAttempt({ sentenceId: firstId, accuracy: 90 }).saved;
    await store.resetAll();
    expect(store.attempts.value).toEqual([]);
    expect(await repo.load()).toEqual({ cards: [], attempts: [], settings: null, sets: [] });
  });

  it('falls back to memory and flags storage errors', async () => {
    const broken = createMemoryRepository();
    broken.load = () => Promise.reject(new Error('blocked'));
    const { store } = await setup(undefined, broken);
    expect(store.storageError.value).toBe(true);
    expect(store.ready.value).toBe(true);
    await store.recordAttempt({ sentenceId: firstId, accuracy: 90 }).saved;
    expect(store.attempts.value).toHaveLength(1);

    const flaky = createMemoryRepository();
    flaky.record = () => Promise.reject(new Error('quota'));
    const { store: s2 } = await setup(undefined, flaky);
    await s2.recordAttempt({ sentenceId: firstId, accuracy: 90 }).saved;
    expect(s2.storageError.value).toBe(true);
  });
});
