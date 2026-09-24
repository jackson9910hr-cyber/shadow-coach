import { alignWords, errorSegments, type DiffOp, type SegmentOptions } from './diff';
import { splitDisplayWords, tokenize } from './normalize';

export interface RetrySegment {
  /** Inclusive display-word range. */
  start: number;
  end: number;
  /** Text to play back and practice again. */
  text: string;
}

export interface AttemptScore {
  accuracy: number;
  ops: DiffOp[];
  displayWords: string[];
  /** Display-word indices that contain at least one missed or substituted token. */
  wrongDisplayIndices: number[];
  segments: RetrySegment[];
}

/** Percent of reference words spoken correctly (0–100, rounded). Insertions are not penalized. */
export function accuracyOf(ops: readonly DiffOp[]): number {
  let refCount = 0;
  let matches = 0;
  for (const o of ops) {
    if (o.op === 'ins') continue;
    refCount++;
    if (o.op === 'match') matches++;
  }
  return refCount === 0 ? 0 : Math.round((matches / refCount) * 100);
}

const EDGE_PUNCTUATION = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

export function scoreAttempt(
  reference: string,
  transcript: string,
  segmentOptions?: SegmentOptions,
): AttemptScore {
  const refTokens = tokenize(reference);
  const ops = alignWords(
    refTokens.map((t) => t.word),
    tokenize(transcript).map((t) => t.word),
  );
  const displayWords = splitDisplayWords(reference);
  const sourceOf = (tokenIndex: number) => (refTokens[tokenIndex] as { source: number }).source;

  const wrong = new Set<number>();
  for (const o of ops) {
    if (o.op === 'sub' || o.op === 'del') wrong.add(sourceOf(o.refIndex));
  }

  const segments = errorSegments(ops, segmentOptions).map(({ start, end }) => {
    const s = sourceOf(start);
    const e = sourceOf(end);
    const text = displayWords
      .slice(s, e + 1)
      .join(' ')
      .replace(EDGE_PUNCTUATION, '');
    return { start: s, end: e, text };
  });

  return {
    accuracy: accuracyOf(ops),
    ops,
    displayWords,
    wrongDisplayIndices: [...wrong].sort((a, b) => a - b),
    segments,
  };
}
