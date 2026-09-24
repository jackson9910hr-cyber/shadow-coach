import { useSignal } from '@preact/signals';
import type { Category } from '../../core/sentenceSet';
import { InstallHint } from '../components/InstallHint';
import { Segmented } from '../components/Segmented';
import { StatTiles } from '../components/StatTiles';
import { useApp } from '../context';
import { CATEGORY_LABEL } from '../format';
import { navigate, startPractice } from '../router';

const CATEGORY_OPTIONS: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  ...(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => ({
    value: c,
    label: CATEGORY_LABEL[c],
  })),
];

export function Home() {
  const { store, services } = useApp();
  const category = useSignal<Category | 'all'>('all');
  const queueSize = store.queueFor(category.value).length;
  const selfMode = store.settings.value.grading === 'self' || !services.recognizer.supported;

  return (
    <div class="stack">
      <h1 tabIndex={-1}>오늘의 섀도잉</h1>
      <InstallHint />
      <section aria-labelledby="stats-title">
        <h2 id="stats-title" class="visually-hidden">
          오늘 학습 통계
        </h2>
        <StatTiles stats={store.stats.value} />
      </section>

      <section class="card stack" aria-labelledby="queue-title">
        <h2 id="queue-title">
          학습할 문장 <span aria-hidden="true">·</span> {queueSize}개
        </h2>
        <Segmented
          label="카테고리"
          options={CATEGORY_OPTIONS}
          value={category.value}
          onChange={(v) => {
            category.value = v;
          }}
        />
        {queueSize > 0 ? (
          <button
            type="button"
            class="btn btn-primary btn-lg btn-block"
            onClick={() => startPractice({ kind: 'today', category: category.value })}
          >
            <span aria-hidden="true">▶</span> 학습 시작
          </button>
        ) : (
          <div class="stack">
            <p class="muted">오늘 할 문장을 모두 마쳤어요! 문장 목록에서 자유롭게 연습해 보세요.</p>
            <button type="button" class="btn btn-block" onClick={() => navigate('library')}>
              문장 목록 보기
            </button>
          </div>
        )}
      </section>

      {selfMode && (
        <p class="banner banner-info" role="note">
          {services.recognizer.supported
            ? '자가채점 모드: 녹음 후 틀린 단어를 직접 표시합니다.'
            : '이 브라우저는 음성인식을 지원하지 않아 자가채점 모드로 동작합니다. 녹음을 듣고 틀린 단어를 직접 표시하세요.'}
        </p>
      )}
      <p class="muted small">
        새 문장은 하루 {store.settings.value.newPerDay}개씩 추가되고, 정확도에 따라 복습 날짜가
        자동으로 정해집니다.
      </p>
    </div>
  );
}
