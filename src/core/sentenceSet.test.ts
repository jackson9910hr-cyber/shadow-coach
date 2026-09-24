import { parseSentenceSet } from './sentenceSet';
import defaultSet from '../../public/sets/default.json';

const valid = {
  id: 'set-1',
  title: 'Test',
  version: 1,
  sentences: [
    { id: 'a', text: 'Hello there.', category: 'daily' },
    { id: 'b', text: 'Good morning.', ko: '좋은 아침.', category: 'church', tags: ['greeting'] },
  ],
};

describe('parseSentenceSet', () => {
  it('accepts a valid set and trims text', () => {
    const r = parseSentenceSet({
      ...valid,
      sentences: [{ id: 'a', text: '  Hi.  ', category: 'business' }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.set.sentences[0]?.text).toBe('Hi.');
  });

  it('parses JSON strings', () => {
    expect(parseSentenceSet(JSON.stringify(valid)).ok).toBe(true);
  });

  it('reports malformed JSON', () => {
    const r = parseSentenceSet('{ not json');
    expect(r).toEqual({ ok: false, errors: ['Invalid JSON'] });
  });

  it.each([
    [null, 'Set must be an object'],
    [[], 'Set must be an object'],
    [{ ...valid, id: '' }, 'id must be a non-empty string'],
    [{ ...valid, title: 3 }, 'title must be a non-empty string'],
    [{ ...valid, version: 0 }, 'version must be a positive integer'],
    [{ ...valid, sentences: [] }, 'sentences must be a non-empty array'],
    [{ ...valid, sentences: 'x' }, 'sentences must be a non-empty array'],
  ])('rejects invalid set fields (%#)', (input, message) => {
    const r = parseSentenceSet(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain(message);
  });

  it.each([
    [42, 'sentences[0] must be an object'],
    [{ text: 'x', category: 'daily' }, 'sentences[0].id must be a non-empty string'],
    [{ id: 'x', text: '   ', category: 'daily' }, 'sentences[0].text must be a non-empty string'],
    [
      { id: 'x', text: 'x', category: 'sports' },
      'sentences[0].category must be one of business, church, daily',
    ],
    [{ id: 'x', text: 'x', category: 'daily', ko: 1 }, 'sentences[0].ko must be a string'],
    [
      { id: 'x', text: 'x', category: 'daily', tags: [1] },
      'sentences[0].tags must be an array of strings',
    ],
    [{ id: 'x', text: 'x', category: 'daily', source: 1 }, 'sentences[0].source must be a string'],
  ])('rejects invalid sentence fields (%#)', (sentence, message) => {
    const r = parseSentenceSet({ ...valid, sentences: [sentence] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain(message);
  });

  it('rejects duplicate sentence ids', () => {
    const r = parseSentenceSet({
      ...valid,
      sentences: [valid.sentences[0], { ...valid.sentences[1], id: 'a' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain('duplicate sentence id "a"');
  });
});

describe('bundled default set', () => {
  const r = parseSentenceSet(defaultSet);

  it('is valid', () => {
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it('has 30 sentences: 15 business and 15 church/daily, all with Korean', () => {
    if (!r.ok) throw new Error('invalid default set');
    const count = (c: string) => r.set.sentences.filter((s) => s.category === c).length;
    expect(r.set.sentences).toHaveLength(30);
    expect(count('business')).toBe(15);
    expect(count('church') + count('daily')).toBe(15);
    expect(r.set.sentences.every((s) => s.ko)).toBe(true);
  });

  it('cites a public-domain source (WEB) for every Bible verse', () => {
    if (!r.ok) throw new Error('invalid default set');
    const verses = r.set.sentences.filter((s) => s.tags?.includes('verse'));
    expect(verses.length).toBeGreaterThan(0);
    expect(verses.every((s) => s.source?.endsWith('(WEB)'))).toBe(true);
  });
});
