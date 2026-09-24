import { alignWords, errorSegments, type DiffOp, type SegmentOptions } from './diff';
import { splitDisplayWords, tokenize, type Token } from './normalize';

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

function buildScore(
  reference: string,
  ops: DiffOp[],
  refTokens: Token[],
  segmentOptions?: SegmentOptions,
): AttemptScore {
  const displayWords = splitDisplayWords(reference);
  const sourceOf = (tokenIndex: number) => (refTokens[tokenIndex] as Token).source;

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

/** Scores a recognizer transcript against the reference sentence. */
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
  return buildScore(reference, ops, refTokens, segmentOptions);
}

/** Scores a self-graded attempt: every token of a marked display word counts as missed. */
export function scoreSelfGrade(
  reference: string,
  wrongDisplayIndices: readonly number[],
  segmentOptions?: SegmentOptions,
): AttemptScore {
  const wrong = new Set(wrongDisplayIndices);
  const refTokens = tokenize(reference);
  const ops: DiffOp[] = refTokens.map((t, refIndex) =>
    wrong.has(t.source)
      ? { op: 'del', ref: t.word, refIndex }
      : { op: 'match', ref: t.word, hyp: t.word, refIndex },
  );
  return buildScore(reference, ops, refTokens, segmentOptions);
}

/** Picks the recognizer alternative that best matches the reference (first wins on ties). */
export function pickBestTranscript(
  reference: string,
  alternatives: readonly string[],
): { transcript: string; score: AttemptScore } {
  let best = { transcript: '', score: scoreAttempt(reference, '') };
  alternatives.forEach((transcript, i) => {
    const score = scoreAttempt(reference, transcript);
    if (i === 0 || score.accuracy > best.score.accuracy) best = { transcript, score };
  });
  return best;
}
