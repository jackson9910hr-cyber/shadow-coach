/**
 * Word-level alignment between a reference and a hypothesis (recognized speech),
 * using minimum edit distance (Levenshtein) with a deterministic backtrace.
 */

export type DiffOp =
  | { op: 'match'; ref: string; hyp: string; refIndex: number }
  | { op: 'sub'; ref: string; hyp: string; refIndex: number }
  | { op: 'del'; ref: string; refIndex: number }
  | { op: 'ins'; hyp: string };

/** Inclusive range of reference indices. */
export interface Segment {
  start: number;
  end: number;
}

export interface SegmentOptions {
  /** Correct words to include on each side of an error run. Default 1. */
  context?: number;
  /** Error runs separated by at most this many correct words are merged. Default 1. */
  mergeGap?: number;
}

export function alignWords(ref: readonly string[], hyp: readonly string[]): DiffOp[] {
  const n = ref.length;
  const m = hyp.length;
  // dist[i][j] = edit distance between ref[0..i) and hyp[0..j)
  const dist: number[][] = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number) => (dist[i] as number[])[j] as number;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = ref[i - 1] === hyp[j - 1] ? 0 : 1;
      (dist[i] as number[])[j] = Math.min(
        at(i - 1, j - 1) + cost,
        at(i - 1, j) + 1,
        at(i, j - 1) + 1,
      );
    }
  }

  const ops: DiffOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const r = ref[i - 1] as string;
    const h = hyp[j - 1] as string;
    if (i > 0 && j > 0 && r === h && at(i, j) === at(i - 1, j - 1)) {
      ops.push({ op: 'match', ref: r, hyp: h, refIndex: i - 1 });
      i--;
      j--;
    } else if (i > 0 && j > 0 && at(i, j) === at(i - 1, j - 1) + 1) {
      ops.push({ op: 'sub', ref: r, hyp: h, refIndex: i - 1 });
      i--;
      j--;
    } else if (i > 0 && at(i, j) === at(i - 1, j) + 1) {
      ops.push({ op: 'del', ref: r, refIndex: i - 1 });
      i--;
    } else {
      ops.push({ op: 'ins', hyp: h });
      j--;
    }
  }
  return ops.reverse();
}

/** Groups non-matching reference words into retry segments (reference index ranges). */
export function errorSegments(ops: readonly DiffOp[], options: SegmentOptions = {}): Segment[] {
  const { context = 1, mergeGap = 1 } = options;
  const refOps = ops.filter((o): o is Exclude<DiffOp, { op: 'ins' }> => o.op !== 'ins');
  const lastIndex = refOps.length - 1;

  const runs: Segment[] = [];
  for (const o of refOps) {
    if (o.op === 'match') continue;
    const prev = runs[runs.length - 1];
    if (prev && o.refIndex - prev.end - 1 <= mergeGap) prev.end = o.refIndex;
    else runs.push({ start: o.refIndex, end: o.refIndex });
  }

  const segments: Segment[] = [];
  for (const run of runs) {
    const start = Math.max(0, run.start - context);
    const end = Math.min(lastIndex, run.end + context);
    const prev = segments[segments.length - 1];
    if (prev && start <= prev.end + 1) prev.end = end;
    else segments.push({ start, end });
  }
  return segments;
}
