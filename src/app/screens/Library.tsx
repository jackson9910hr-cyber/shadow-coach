import { useSignal } from '@preact/signals';
import type { Category } from '../../core/sentenceSet';
import { Segmented } from '../components/Segmented';
import { useApp } from '../context';
import { CATEGORY_LABEL, formatDue } from '../format';
import { startPractice } from '../router';

const FILTERS: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  ...(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => ({
    value: c,
    label: CATEGORY_LABEL[c],
  })),
];

export function Library() {
  const { store } = useApp();
  const filter = useSignal<Category | 'all'>('all');
  const today = store.today.value;
  const items = store.sentences.value.filter(
    (s) => filter.value === 'all' || s.category === filter.value,
  );

  return (
    <div class="stack">
      <h1 tabIndex={-1}>문장 목록</h1>
      <Segmented
        label="카테고리 필터"
        options={FILTERS}
        value={filter.value}
        onChange={(v) => {
          filter.value = v;
        }}
      />
      <p class="small muted" aria-live="polite">
        {items.length}문장
      </p>
      <ul class="list">
        {items.map((s) => {
          const card = store.cards.value[s.id];
          return (
            <li key={s.id} class="card list-item">
              <div>
                <p lang="en">
                  <strong>{s.text}</strong>
                </p>
                {s.ko && store.settings.value.showKo && <p class="small muted">{s.ko}</p>}
                <p class="small muted">
                  {card
                    ? `복습: ${formatDue(card.due, today)}${
                        card.lastAccuracy !== undefined ? ` · 최근 ${card.lastAccuracy}%` : ''
                      }`
                    : '새 문장'}
                  {s.source ? ` · ${s.source}` : ''}
                </p>
              </div>
              <button
                type="button"
                class="btn"
                aria-label={`연습: ${s.text}`}
                onClick={() => startPractice({ kind: 'single', sentenceId: s.id })}
              >
                연습
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
