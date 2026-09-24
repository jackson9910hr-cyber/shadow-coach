import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { VoiceInfo } from '../../adapters/tts/types';
import type { Grading, Rate, Theme } from '../../core/settings';
import { Segmented } from '../components/Segmented';
import { useApp } from '../context';

const SAMPLE_SET = `{
  "id": "sermon-2026-09",
  "title": "9월 설교 문장",
  "version": 1,
  "sentences": [
    { "id": "1", "text": "God is faithful.", "ko": "하나님은 신실하십니다.", "category": "church" }
  ]
}`;

/**
 * Saves a JSON file. On iOS the share sheet ("파일에 저장") is the reliable path, especially in
 * a home-screen app; otherwise fall back to a download link (docs/review-stage4.md S4).
 */
async function saveJson(filename: string, text: string) {
  const file = new File([text], filename, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  // Keep the URL alive while Safari shows its download sheet.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function readFile(e: Event, maxBytes: number): Promise<string | null> {
  const input = e.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || file.size > maxBytes) return null;
  return file.text();
}

export function Settings() {
  const { store, services } = useApp();
  const settings = store.settings.value;
  const voices = useSignal<VoiceInfo[]>(services.tts.voices());
  const message = useSignal<{ ok: boolean; text: string } | null>(null);

  useEffect(
    () =>
      services.tts.onVoicesChanged(() => {
        voices.value = services.tts.voices();
      }),
    [services.tts, voices],
  );

  const report = (r: { ok: boolean; message: string }) => {
    // Clear first so an identical message is announced again.
    message.value = null;
    setTimeout(() => {
      message.value = { ok: r.ok, text: r.message };
    }, 50);
  };
  const focusHeading = () => document.querySelector<HTMLElement>('#s-sets')?.focus();

  return (
    <div class="stack">
      <h1 tabIndex={-1}>설정</h1>

      <div aria-live="polite">
        {message.value && (
          <p class={`banner ${message.value.ok ? 'banner-info' : 'banner-err'}`}>
            {message.value.text}
          </p>
        )}
      </div>

      <section class="card" aria-labelledby="s-play">
        <h2 id="s-play">듣기</h2>
        <div class="field">
          <Segmented<Rate>
            label="기본 재생 속도"
            hideLabel={false}
            options={[
              { value: 0.7, label: '0.7× 느리게' },
              { value: 1, label: '1.0× 보통' },
            ]}
            value={settings.rate}
            onChange={(rate) => void store.updateSettings({ rate })}
          />
        </div>
        <div class="field">
          <label class="field-label" htmlFor="voice">
            음성
          </label>
          <select
            id="voice"
            value={settings.voiceURI ?? ''}
            onChange={(e) => {
              const v = (e.currentTarget as HTMLSelectElement).value;
              void store.updateSettings({ voiceURI: v || undefined });
            }}
          >
            <option value="">자동 (미국 영어)</option>
            {voices.value.map((v) => (
              <option key={v.uri} value={v.uri}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
          <button
            type="button"
            class="btn"
            style={{ marginTop: 'var(--space-2)' }}
            onClick={() =>
              services.tts.speak('Hello! Let’s practice English together.', {
                rate: settings.rate,
                voiceURI: settings.voiceURI,
              })
            }
          >
            <span aria-hidden="true">🔊</span> 음성 미리 듣기
          </button>
        </div>
      </section>

      <section class="card" aria-labelledby="s-learn">
        <h2 id="s-learn">학습</h2>
        <div class="field">
          <Segmented<Grading>
            label="채점 방식"
            hideLabel={false}
            options={[
              { value: 'auto', label: '음성인식 자동' },
              { value: 'self', label: '자가채점' },
            ]}
            value={settings.grading}
            onChange={(grading) => void store.updateSettings({ grading })}
          />
          {!services.recognizer.supported && (
            <p class="small muted">
              이 브라우저는 음성인식을 지원하지 않아 항상 자가채점을 사용합니다.
            </p>
          )}
        </div>
        <div class="field">
          <label class="field-label" htmlFor="new-per-day">
            하루 새 문장 수
          </label>
          <select
            id="new-per-day"
            value={String(settings.newPerDay)}
            onChange={(e) =>
              void store.updateSettings({
                newPerDay: Number((e.currentTarget as HTMLSelectElement).value),
              })
            }
          >
            {[3, 5, 10, 15, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
        </div>
        <div class="field">
          <label class="switch">
            한국어 뜻 기본 표시
            <input
              type="checkbox"
              checked={settings.showKo}
              onChange={(e) =>
                void store.updateSettings({ showKo: (e.currentTarget as HTMLInputElement).checked })
              }
            />
          </label>
        </div>
      </section>

      <section class="card" aria-labelledby="s-theme">
        <h2 id="s-theme">화면</h2>
        <Segmented<Theme>
          label="테마"
          options={[
            { value: 'system', label: '시스템' },
            { value: 'light', label: '라이트' },
            { value: 'dark', label: '다크' },
          ]}
          value={settings.theme}
          onChange={(theme) => void store.updateSettings({ theme })}
        />
      </section>

      <section class="card stack" aria-labelledby="s-sets">
        <h2 id="s-sets" tabIndex={-1}>
          문장 세트
        </h2>
        <ul class="list">
          <li class="list-item">
            <p>기본 세트 (30문장)</p>
            <span class="badge">기본</span>
          </li>
          {store.userSets.value.map((set) => (
            <li key={set.id} class="list-item">
              <p>
                {set.title} ({set.sentences.length}문장)
              </p>
              <button
                type="button"
                class="btn btn-danger"
                aria-label={`${set.title} 세트 삭제`}
                onClick={() => {
                  if (confirm(`"${set.title}" 세트를 삭제할까요? 학습 기록은 유지됩니다.`)) {
                    void store.deleteSet(set.id);
                    focusHeading();
                  }
                }}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
        <label class="btn btn-block file-button">
          <span aria-hidden="true">＋</span> JSON 파일로 세트 추가
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const text = await readFile(e, 5_000_000);
              if (text === null)
                return report({ ok: false, message: '파일을 읽을 수 없습니다 (5MB 이하 JSON).' });
              report(await store.importSet(text));
            }}
          />
        </label>
        <details>
          <summary class="summary small">세트 JSON 형식 보기</summary>
          <pre class="small" style={{ overflowX: 'auto' }}>
            {SAMPLE_SET}
          </pre>
          <p class="small muted">category: business | church | daily · ko, tags, source는 선택</p>
        </details>
      </section>

      <section class="card stack" aria-labelledby="s-data">
        <h2 id="s-data">데이터</h2>
        <p class="small muted">
          학습 기록은 이 기기에만 저장됩니다. 녹음된 음성은 저장하지 않습니다. Safari는 오래
          사용하지 않은 사이트의 데이터를 지울 수 있으니 가끔 백업하세요.
        </p>
        <button
          type="button"
          class="btn btn-block"
          onClick={() =>
            void saveJson(
              `shadow-coach-backup-${store.today.value}.json`,
              JSON.stringify(store.exportBackup()),
            )
          }
        >
          <span aria-hidden="true">⬇</span> 백업 내보내기
        </button>
        <label class="btn btn-block file-button">
          <span aria-hidden="true">⬆</span> 백업 가져오기
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const text = await readFile(e, 20_000_000);
              if (text === null) {
                return report({ ok: false, message: '파일을 읽을 수 없습니다 (20MB 이하 JSON).' });
              }
              if (!confirm('현재 학습 기록을 백업 파일 내용으로 바꿀까요?')) return;
              report(await store.importBackup(text));
            }}
          />
        </label>
        <button
          type="button"
          class="btn btn-danger btn-block"
          onClick={() => {
            if (confirm('모든 학습 기록과 설정을 삭제할까요? 되돌릴 수 없습니다.')) {
              void store.resetAll().then(() => report({ ok: true, message: '초기화했습니다.' }));
            }
          }}
        >
          모든 기록 초기화
        </button>
      </section>

      <section class="card" aria-labelledby="s-privacy">
        <h2 id="s-privacy">개인정보</h2>
        <ul class="small muted" style={{ paddingLeft: 'var(--space-4)', margin: 0 }}>
          <li>음성인식은 브라우저(iOS의 경우 Apple 음성 서비스)가 처리합니다.</li>
          <li>
            앱은 인식된 텍스트와 점수만 기기 안(IndexedDB)에 저장하며 외부 서버로 전송하지 않습니다.
          </li>
          <li>자가채점 녹음은 메모리에서만 재생되고 저장되지 않습니다.</li>
        </ul>
        <p class="small muted">버전 {__APP_VERSION__}</p>
      </section>
    </div>
  );
}
