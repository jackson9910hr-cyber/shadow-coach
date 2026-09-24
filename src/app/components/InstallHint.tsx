import { useSignal } from '@preact/signals';

const KEY = 'shadow-coach:install-hint-dismissed';

function isIos(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    /iPhone|iPad|iPod/.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** iOS Safari has no install prompt; explain "Add to Home Screen" once. */
export function InstallHint() {
  const hidden = useSignal(readDismissed() || !isIos() || isStandalone());
  if (hidden.value) return null;
  return (
    <aside class="banner banner-info" aria-label="앱 설치 안내">
      <p style={{ margin: 0 }}>
        <strong>홈 화면에 추가</strong>하면 앱처럼 전체 화면으로 열리고 기록이 더 안전하게
        보관됩니다. Safari 하단의 <span aria-hidden="true">⎋</span> <strong>공유</strong> 버튼 →{' '}
        <strong>홈 화면에 추가</strong>를 누르세요.
      </p>
      <button
        type="button"
        class="btn btn-ghost small"
        onClick={() => {
          hidden.value = true;
          document.getElementById('main')?.focus();
          try {
            localStorage.setItem(KEY, '1');
          } catch {
            /* storage unavailable: hide for this session only */
          }
        }}
      >
        닫기
      </button>
    </aside>
  );
}
