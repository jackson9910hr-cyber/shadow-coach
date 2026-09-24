import { needRefresh, offlineReady, applyUpdate } from '../pwa';

export function UpdateBanner() {
  if (needRefresh.value) {
    return (
      <div class="banner banner-info row" role="status" style={{ marginBottom: 'var(--space-4)' }}>
        <span style={{ flex: 1 }}>새 버전이 준비됐어요.</span>
        <button type="button" class="btn btn-primary" onClick={applyUpdate}>
          업데이트
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          onClick={() => {
            needRefresh.value = false;
          }}
        >
          나중에
        </button>
      </div>
    );
  }
  if (offlineReady.value) {
    return (
      <div class="banner banner-info row" role="status" style={{ marginBottom: 'var(--space-4)' }}>
        <span style={{ flex: 1 }}>오프라인에서도 사용할 수 있어요.</span>
        <button
          type="button"
          class="btn btn-ghost"
          onClick={() => {
            offlineReady.value = false;
          }}
        >
          확인
        </button>
      </div>
    );
  }
  return null;
}
