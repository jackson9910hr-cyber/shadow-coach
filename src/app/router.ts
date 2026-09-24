import { signal } from '@preact/signals';
import type { Category } from '../core/sentenceSet';

export type Route = 'home' | 'practice' | 'library' | 'settings';

export type PracticeRequest =
  { kind: 'today'; category: Category | 'all' } | { kind: 'single'; sentenceId: string };

const ROUTES: Record<string, Route> = {
  '': 'home',
  '/': 'home',
  '/practice': 'practice',
  '/library': 'library',
  '/settings': 'settings',
};

export function parseHash(hash: string): Route {
  return ROUTES[hash.replace(/^#/, '')] ?? 'home';
}

export const route = signal<Route>(
  typeof location === 'undefined' ? 'home' : parseHash(location.hash),
);
export const practiceRequest = signal<PracticeRequest | null>(null);

export function hrefFor(r: Route): string {
  return r === 'home' ? '#/' : `#/${r}`;
}

export function navigate(r: Route) {
  if (location.hash !== hrefFor(r)) location.hash = hrefFor(r);
  route.value = r;
}

export function startPractice(req: PracticeRequest) {
  practiceRequest.value = req;
  navigate('practice');
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    route.value = parseHash(location.hash);
  });
}
