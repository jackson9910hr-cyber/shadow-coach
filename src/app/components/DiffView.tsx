import type { AttemptScore } from '../../core/accuracy';
import type { Token } from '../../core/normalize';
import { tokenize } from '../../core/normalize';

interface Props {
  reference: string;
  score: AttemptScore;
  /** Self-graded results have no transcript, so wrong words are labeled as marked. */
  selfGraded?: boolean;
}

/** What the recognizer heard for each wrong display word ('' = not spoken). */
function heardByDisplayWord(reference: string, score: AttemptScore): Map<number, string[]> {
  const tokens: Token[] = tokenize(reference);
  const heard = new Map<number, string[]>();
  for (const o of score.ops) {
    if (o.op === 'match' || o.op === 'ins') continue;
    const source = (tokens[o.refIndex] as Token).source;
    const list = heard.get(source) ?? [];
    if (o.op === 'sub') list.push(o.hyp);
    heard.set(source, list);
  }
  return heard;
}

/** Renders the reference with wrong words marked by color, wavy underline, and text. */
export function DiffView({ reference, score, selfGraded = false }: Props) {
  const heard = heardByDisplayWord(reference, score);
  const wrong = new Set(score.wrongDisplayIndices);
  return (
    <>
      <ol class="words" aria-label="단어별 결과">
        {score.displayWords.map((word, i) => {
          if (!wrong.has(i)) {
            return (
              <li key={i} class="word">
                {word}
              </li>
            );
          }
          const said = heard.get(i) ?? [];
          const hint = selfGraded ? '직접 표시' : said.length ? `→ ${said.join(' ')}` : '→ (빠짐)';
          const spoken = selfGraded
            ? '틀림으로 표시함'
            : said.length
              ? `틀림, 들린 말: ${said.join(' ')}`
              : '틀림, 말하지 않음';
          return (
            <li key={i} class="word">
              <span class="word-wrong">
                <span aria-hidden="true">✗ </span>
                {word}
              </span>
              <span class="word-heard" aria-hidden="true">
                {hint}
              </span>
              <span class="visually-hidden">{spoken}</span>
            </li>
          );
        })}
      </ol>
      <p class="legend">
        <span>
          <span aria-hidden="true">✗ </span>빨간 물결 밑줄 = 다시 연습할 단어
        </span>
      </p>
    </>
  );
}
