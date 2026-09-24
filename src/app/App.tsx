import { effect } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { UpdateBanner } from './components/UpdateBanner';
import { AppContext, type AppContextValue } from './context';
import { hrefFor, route, type Route } from './router';
import { Home } from './screens/Home';
import { Library } from './screens/Library';
import { Practice } from './screens/Practice';
import { Settings } from './screens/Settings';

const TITLES: Record<Route, string> = {
  home: '홈',
  practice: '연습',
  library: '문장 목록',
  settings: '설정',
};

const NAV: { route: Route; label: string }[] = [
  { route: 'home', label: '홈' },
  { route: 'library', label: '문장' },
  { route: 'settings', label: '설정' },
];

function Screen({ current }: { current: Route }) {
  switch (current) {
    case 'practice':
      return <Practice />;
    case 'library':
      return <Library />;
    case 'settings':
      return <Settings />;
    default:
      return <Home />;
  }
}

export function App({ value }: { value: AppContextValue }) {
  const { store } = value;
  const current = route.value;
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Apply the theme preference to <html data-theme>.
  useEffect(
    () =>
      effect(() => {
        const theme = store.settings.value.theme;
        if (theme === 'system') delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = theme;
      }),
    [store],
  );

  // Move focus to the new screen's heading so screen readers announce navigation.
  useEffect(() => {
    document.title = `${TITLES[current]} – Shadow Coach`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = mainRef.current?.querySelector<HTMLElement>('h1');
    heading?.focus();
    window.scrollTo(0, 0);
  }, [current]);

  return (
    <AppContext.Provider value={value}>
      <div class="app">
        <a
          class="skip-link"
          href="#main"
          onClick={(e) => {
            e.preventDefault();
            mainRef.current?.focus();
          }}
        >
          본문으로 건너뛰기
        </a>
        <header class="app-header">
          <div class="app-header-inner">
            <p class="brand">
              <span aria-hidden="true">🗣 </span>Shadow Coach
            </p>
            <nav class="nav" aria-label="주요 메뉴">
              {NAV.map((n) => (
                <a
                  key={n.route}
                  href={hrefFor(n.route)}
                  aria-current={current === n.route ? 'page' : undefined}
                >
                  {n.label}
                </a>
              ))}
            </nav>
          </div>
        </header>
        <main id="main" ref={mainRef} tabIndex={-1}>
          <UpdateBanner />
          {store.storageError.value && (
            <p class="banner banner-warn" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
              이 브라우저에서 저장소를 사용할 수 없어 기록이 저장되지 않습니다. (개인정보 보호
              모드인지 확인해 주세요)
            </p>
          )}
          {store.ready.value ? <Screen current={current} /> : <p aria-busy="true">불러오는 중…</p>}
        </main>
      </div>
    </AppContext.Provider>
  );
}
