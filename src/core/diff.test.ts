import { alignWords, errorSegments, type DiffOp } from './diff';

const w = (s: string) => (s ? s.split(' ') : []);

describe('alignWords', () => {
  it('returns all matches for identical input', () => {
    expect(alignWords(w('a b c'), w('a b c'))).toEqual([
      { op: 'match', ref: 'a', hyp: 'a', refIndex: 0 },
      { op: 'match', ref: 'b', hyp: 'b', refIndex: 1 },
      { op: 'match', ref: 'c', hyp: 'c', refIndex: 2 },
    ]);
  });

  it('detects a substitution', () => {
    expect(alignWords(w('i need the report'), w('i need a report'))).toEqual([
      { op: 'match', ref: 'i', hyp: 'i', refIndex: 0 },
      { op: 'match', ref: 'need', hyp: 'need', refIndex: 1 },
      { op: 'sub', ref: 'the', hyp: 'a', refIndex: 2 },
      { op: 'match', ref: 'report', hyp: 'report', refIndex: 3 },
    ]);
  });

  it('detects a deletion (word not spoken)', () => {
    const ops = alignWords(w('please send it today'), w('please send today'));
    expect(ops).toContainEqual({ op: 'del', ref: 'it', refIndex: 2 });
    expect(ops.filter((o) => o.op === 'match')).toHaveLength(3);
  });

  it('detects an insertion (extra word spoken)', () => {
    const ops = alignWords(w('thank you'), w('thank you very'));
    expect(ops).toEqual([
      { op: 'match', ref: 'thank', hyp: 'thank', refIndex: 0 },
      { op: 'match', ref: 'you', hyp: 'you', refIndex: 1 },
      { op: 'ins', hyp: 'very' },
    ]);
  });

  it('handles empty inputs', () => {
    expect(alignWords([], [])).toEqual([]);
    expect(alignWords(w('a b'), [])).toEqual([
      { op: 'del', ref: 'a', refIndex: 0 },
      { op: 'del', ref: 'b', refIndex: 1 },
    ]);
    expect(alignWords([], w('x'))).toEqual([{ op: 'ins', hyp: 'x' }]);
  });

  it('covers every reference index exactly once, in order', () => {
    const ref = w('the lord is my shepherd i shall not want');
    const ops = alignWords(ref, w('lord is my shepard i shall want now'));
    const indices = ops.flatMap((o) => (o.op === 'ins' ? [] : [o.refIndex]));
    expect(indices).toEqual(ref.map((_, i) => i));
  });
});

describe('errorSegments', () => {
  const ops = (spec: string): DiffOp[] =>
    [...spec].map((c, i) =>
      c === '+'
        ? { op: 'ins', hyp: 'x' }
        : { op: c === '.' ? 'match' : c === 's' ? 'sub' : 'del', ref: `w${i}`, refIndex: i },
    ) as DiffOp[];

  it('returns no segments for a perfect attempt', () => {
    expect(errorSegments(ops('.....'))).toEqual([]);
  });

  it('returns one segment per error run without context', () => {
    expect(errorSegments(ops('.s..dd.'), { context: 0, mergeGap: 0 })).toEqual([
      { start: 1, end: 1 },
      { start: 4, end: 5 },
    ]);
  });

  it('merges runs separated by at most mergeGap matches', () => {
    expect(errorSegments(ops('.s.d...s'), { context: 0, mergeGap: 1 })).toEqual([
      { start: 1, end: 3 },
      { start: 7, end: 7 },
    ]);
  });

  it('adds context words and clamps to sentence bounds', () => {
    expect(errorSegments(ops('s....d'), { context: 1, mergeGap: 0 })).toEqual([
      { start: 0, end: 1 },
      { start: 4, end: 5 },
    ]);
  });

  it('merges segments that overlap after adding context', () => {
    expect(errorSegments(ops('.s..s.'), { context: 1, mergeGap: 0 })).toEqual([
      { start: 0, end: 5 },
    ]);
  });

  it('ignores insertions when computing reference segments', () => {
    expect(errorSegments(ops('..+..'))).toEqual([]);
  });

  it('uses context=1, mergeGap=1 by default', () => {
    expect(errorSegments(ops('...s.s...'))).toEqual([{ start: 2, end: 6 }]);
  });
});
