import { diffDays, type DateKey } from '../core/date';
import type { Category } from '../core/sentenceSet';

export const CATEGORY_LABEL: Record<Category, string> = {
  business: '비즈니스',
  church: '교회',
  daily: '일상',
};

export function formatDue(due: DateKey, today: DateKey): string {
  const days = diffDays(today, due);
  if (days <= 0) return '오늘';
  if (days === 1) return '내일';
  const [, m, d] = due.split('-').map(Number);
  return `${days}일 후 (${m}월 ${d}일)`;
}

export type Level = 'good' | 'ok' | 'bad';

export function accuracyLevel(accuracy: number): Level {
  if (accuracy >= 85) return 'good';
  if (accuracy >= 60) return 'ok';
  return 'bad';
}

export const LEVEL_MESSAGE: Record<Level, string> = {
  good: '훌륭해요!',
  ok: '좋아요, 조금만 더!',
  bad: '천천히 다시 들어보세요',
};
