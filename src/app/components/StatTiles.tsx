import type { TodayStats } from '../../core/stats';

export function StatTiles({ stats }: { stats: TodayStats }) {
  return (
    <dl class="stats">
      <div class="stat">
        <dt>오늘 문장</dt>
        <dd>{stats.sentences}</dd>
      </div>
      <div class="stat">
        <dt>평균 정확도</dt>
        <dd>{stats.averageAccuracy === null ? '–' : `${stats.averageAccuracy}%`}</dd>
      </div>
      <div class="stat">
        <dt>연속 학습</dt>
        <dd>
          {stats.streak}
          <span class="small">일</span>
        </dd>
      </div>
    </dl>
  );
}
