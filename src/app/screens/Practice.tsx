import { useSignal } from '@preact/signals';
import { useEffect, useMemo } from 'preact/hooks';
import type { Rate } from '../../core/settings';
import { createPractice, type Practice as PracticeModel } from '../../state/practice';
import type { PracticeSentence } from '../../state/store';
import { DiffView } from '../components/DiffView';
import { Segmented } from '../components/Segmented';
import { StatTiles } from '../components/StatTiles';
import { useApp } from '../context';
import { accuracyLevel, CATEGORY_LABEL, formatDue, LEVEL_MESSAGE } from '../format';
import { navigate, practiceRequest } from '../router';

const RATE_OPTIONS: { value: Rate; label: string }[] = [
  { value: 0.7, label: '0.7×' },
  { value: 1, label: '1.0×' },
];

export function Practice() {
  const { store, services } = useApp();
  const request = practiceRequest.value;

  // The queue is fixed when the session starts so grading does not reshuffle it.
  const practice = useMemo(() => {
    let queue: PracticeSentence[] = [];
    if (request?.kind === 'today') queue = store.queueFor(request.category);
    if (request?.kind === 'single') {
      queue = store.sentences.value.filter((s) => s.id === request.sentenceId);
    }
    return createPractice(store, services, queue);
  }, [request]);

  useEffect(() => () => practice.dispose(), [practice]);

  if (!request) {
    return (
      <div class="stack">
        <h1 tabIndex={-1}>연습</h1>
        <p>연습할 문장을 먼저 선택하세요.</p>
        <button type="button" class="btn btn-primary" onClick={() => navigate('home')}>
          홈으로
        </button>
      </div>
    );
  }

  if (practice.phase.value === 'done') return <SessionDone practice={practice} />;
  return <PracticeView practice={practice} />;
}

function SessionDone({ practice }: { practice: PracticeModel }) {
  const { store } = useApp();
  return (
    <div class="stack">
      <h1 tabIndex={-1}>
        <span aria-hidden="true">🎉 </span>세션 완료
      </h1>
      <p>
        {practice.queue.length === 0
          ? '지금 연습할 문장이 없습니다.'
          : `${practice.completed.value}문장을 연습했어요. 수고하셨습니다!`}
      </p>
      <StatTiles stats={store.stats.value} />
      <div class="row">
        <button type="button" class="btn btn-primary" onClick={() => navigate('home')}>
          홈으로
        </button>
        <button type="button" class="btn" onClick={() => navigate('library')}>
          문장 목록
        </button>
      </div>
    </div>
  );
}

function PracticeView({ practice }: { practice: PracticeModel }) {
  const { store } = useApp();
  const showKo = useSignal(store.settings.value.showKo);
  const sentence = practice.current.value as PracticeSentence;
  const phase = practice.phase.value;
  const result = practice.result.value;
  const target = practice.target.value;
  const isSegment = target.kind === 'segment';
  const total = practice.queue.length;
  const position = practice.index.value + 1;
  const busy = phase === 'listening' || phase === 'recording';
  const selfGraded = result?.transcript === null;

  return (
    <div>
      <div class="progress">
        <button type="button" class="btn btn-ghost" onClick={() => navigate('home')}>
          <span aria-hidden="true">←</span> 홈
        </button>
        <progress
          max={total}
          value={position - 1}
          aria-label={`진행률 ${total}문장 중 ${position}번째`}
        />
        <span class="small muted" aria-hidden="true">
          {position} / {total}
        </span>
      </div>

      <h1 tabIndex={-1} class="visually-hidden">
        문장 연습 {position} / {total}
      </h1>

      <section class="card" aria-label="연습 문장">
        <div class="row">
          <span class="badge">{CATEGORY_LABEL[sentence.category]}</span>
          {sentence.source && <span class="badge">{sentence.source}</span>}
          {isSegment && <span class="badge">구간 연습</span>}
        </div>

        {phase === 'grading' ? (
          <SelfGrade practice={practice} />
        ) : result ? (
          <DiffView
            reference={practice.targetText.value}
            score={result.score}
            selfGraded={selfGraded}
          />
        ) : (
          <p class="sentence" lang="en">
            {practice.targetText.value}
          </p>
        )}

        {isSegment && <p class="small muted">전체 문장: {sentence.text}</p>}

        {sentence.ko && !isSegment && (
          <div>
            <button
              type="button"
              class="btn btn-ghost small"
              aria-expanded={showKo.value}
              onClick={() => {
                showKo.value = !showKo.value;
              }}
            >
              {showKo.value ? '뜻 숨기기' : '뜻 보기'}
            </button>
            {showKo.value && <p class="ko">{sentence.ko}</p>}
          </div>
        )}
      </section>

      <div class="stack" style={{ marginTop: 'var(--space-4)' }}>
        <div aria-live="assertive">
          {practice.error.value && <p class="banner banner-warn">{practice.error.value}</p>}
        </div>
        {phase === 'listening' && (
          <p class="interim" lang="en">
            {practice.interim.value || '듣는 중… 문장을 말해 주세요.'}
          </p>
        )}
        {phase === 'recording' && <p class="interim">녹음 중… 말을 마치면 ⏹을 누르세요.</p>}
        {result && <ResultPanel practice={practice} />}
      </div>
      <p role="status" class="visually-hidden">
        {phase === 'listening'
          ? '듣는 중'
          : phase === 'recording'
            ? '녹음 중'
            : result
              ? `정확도 ${result.score.accuracy}퍼센트, 틀린 단어 ${result.score.wrongDisplayIndices.length}개`
              : ''}
      </p>

      <div class="controls">
        <div class="controls-row">
          <button
            type="button"
            class="btn btn-block"
            disabled={busy}
            onClick={() => (practice.playing.value ? practice.stopAudio() : practice.listen())}
          >
            <span aria-hidden="true">{practice.playing.value ? '⏸' : '🔊'}</span>
            {practice.playing.value ? '정지' : '원문 듣기'}
          </button>
          <Segmented
            label="재생 속도"
            options={RATE_OPTIONS}
            value={store.settings.value.rate}
            onChange={(rate) => void store.updateSettings({ rate })}
          />
        </div>

        {phase === 'grading' ? (
          <button
            type="button"
            class="btn btn-primary btn-mic"
            onClick={() => void practice.submitSelfGrade()}
          >
            <span aria-hidden="true">✔</span> 채점 완료
          </button>
        ) : busy ? (
          <button
            type="button"
            class="btn btn-mic"
            data-active="true"
            onClick={() => void practice.stopSpeaking()}
          >
            <span aria-hidden="true">⏹</span> 멈추기
          </button>
        ) : (
          <button
            type="button"
            class="btn btn-primary btn-mic"
            onClick={() => practice.startSpeaking()}
          >
            <span aria-hidden="true">🎤</span>
            {result ? '다시 말하기' : '따라 말하기'}
            {practice.mode.value === 'self' && <span class="small">(녹음)</span>}
          </button>
        )}

        {result && (
          <div class="row">
            {isSegment ? (
              <button type="button" class="btn btn-block" onClick={() => practice.backToFull()}>
                <span aria-hidden="true">↩</span> 전체 문장으로
              </button>
            ) : (
              <button type="button" class="btn btn-block" onClick={() => practice.next()}>
                {position < total ? '다음 문장' : '세션 마치기'} <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        )}
        {!result && phase === 'ready' && (
          <button type="button" class="btn btn-ghost small" onClick={() => practice.next()}>
            이 문장 건너뛰기
          </button>
        )}
      </div>
    </div>
  );
}

function SelfGrade({ practice }: { practice: PracticeModel }) {
  const words = practice.targetText.value.split(/\s+/).filter(Boolean);
  const rec = practice.recording.value;
  return (
    <div class="stack">
      {rec && (
        <div>
          <span class="field-label" id="my-recording">
            내 목소리 듣기
          </span>
          {/* The learner's own just-recorded voice: captions are not applicable. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={rec.url} aria-labelledby="my-recording" />
        </div>
      )}
      <p class="small muted" id="self-grade-help">
        원문과 비교해서 <strong>틀리거나 빠뜨린 단어</strong>를 탭하세요.
      </p>
      <div class="words" role="group" aria-labelledby="self-grade-help" lang="en">
        {words.map((w, i) => (
          <button
            key={i}
            type="button"
            class="word-toggle"
            aria-pressed={practice.marks.value.has(i)}
            onClick={() => practice.toggleMark(i)}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultPanel({ practice }: { practice: PracticeModel }) {
  const { store } = useApp();
  const result = practice.result.value;
  if (!result) return null;
  const { score } = result;
  const level = accuracyLevel(score.accuracy);
  const wrongCount = score.wrongDisplayIndices.length;
  const isSegment = practice.target.value.kind === 'segment';

  return (
    <section class="card stack" aria-label="채점 결과">
      <div class="score" data-level={level}>
        <span class="score-value">{score.accuracy}%</span>
        <span>
          {LEVEL_MESSAGE[level]}
          <span class="small muted"> · 틀린 단어 {wrongCount}개</span>
        </span>
      </div>

      {result.transcript !== null && (
        <p class="small">
          <span class="muted">들린 문장: </span>
          <span lang="en">{result.transcript || '(없음)'}</span>
        </p>
      )}

      {!isSegment && result.card && (
        <p class="small muted">
          {result.graded
            ? `다음 복습: ${formatDue(result.card.due, store.today.value)}`
            : '오늘 이미 채점한 문장이라 복습 일정은 그대로입니다.'}
        </p>
      )}

      {score.segments.length > 0 && (
        <div>
          <h2 class="small" style={{ margin: '0 0 var(--space-2)' }}>
            틀린 구간만 다시 연습
          </h2>
          <ul class="list">
            {score.segments.map((seg) => (
              <li key={`${seg.start}-${seg.end}`}>
                <button
                  type="button"
                  class="btn btn-block"
                  onClick={() => practice.practiceSegment(seg)}
                >
                  <span aria-hidden="true">🔁</span>
                  <span lang="en">“{seg.text}”</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
