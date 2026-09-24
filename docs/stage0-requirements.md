# Stage 0 — 요구사항 · 리스크 · 스택 · 구조

> 작성일: 2026-09-24 (KST) · 상태: **승인 대기**

## 1. 요구사항 재정리

### 1.1 사용자 & 사용 맥락
| 항목 | 내용 |
|---|---|
| 주 사용자 | 교회 영어사역 리더 (1인, 추후 사역팀 공유 가능) |
| 기기 | iPhone Safari (홈 화면 추가 PWA) → 추후 Capacitor iOS 앱 |
| 상황 | 출퇴근 이동 중 · 한 손 조작 · 이어폰 · 네트워크 불안정 · 짧은 세션(5~15분) |
| 핵심 루프 | 듣기(TTS) → 따라 말하기(녹음/인식) → 비교(diff·정확도) → 틀린 구간 재시도 → SM-2로 다음 복습일 결정 |

### 1.2 기능 요구사항 (MVP)
| # | 기능 | 수용 기준 (Acceptance Criteria) |
|---|---|---|
| F1 | 문장 세트 로드 | JSON 스키마 검증 통과. 기본 세트 30문장(비즈니스 15 / 교회·일상 15) 번들 포함. 잘못된 JSON은 오류 메시지 표시 후 무시 |
| F2 | TTS 재생 | `speechSynthesis`, 속도 0.7 / 1.0 토글. en-US 음성 우선 선택, 없으면 `en-*` 폴백. 재생/정지 버튼 |
| F3 | 녹음 → 인식 → diff → 정확도 | Web Speech API 인식 결과를 원문과 **단어 단위** 정렬(LCS 기반). 정확도 = 일치 단어 수 / 원문 단어 수 × 100 (정수 반올림) |
| F4 | 틀린 단어 하이라이트 + 구간 재시도 | 누락/대체/삽입을 색+아이콘+텍스트로 구분(색만으로 구분 금지). 연속 오류 구간 탭 → 해당 구간만 TTS 재생 + 재녹음, 구간 정확도 별도 산출 |
| F5 | SM-2 스케줄 | 정확도 → 품질(q 0~5) 매핑 후 SM-2(EF ≥ 1.3) 적용. 오늘 복습 대상 큐 = `due <= today` |
| F6 | 오프라인 | IndexedDB에 진도/기록 저장. Service Worker로 앱 셸+문장 세트 프리캐시. 비행기 모드에서 TTS·복습·통계 동작 (**음성인식은 제외 — 아래 리스크 R1**) |
| F7 | 오늘 통계 | 오늘 학습 문장 수, 평균 정확도, 연속 학습 일수(KST 자정 기준, 로컬 타임존 사용) |

### 1.3 비기능 요구사항
- 모바일 퍼스트, 다크모드(`prefers-color-scheme` + 수동 토글), 터치 타깃 ≥ 44×44pt (Apple HIG)
- 접근성: WCAG 2.2 AA, ARIA live region으로 결과 낭독, 키보드/VoiceOver 포커스 순서
- 품질: 핵심 로직(diff·정확도·SM-2·통계) 커버리지 ≥ 90%, Lighthouse Accessibility·Best Practices ≥ 90
- 개인정보: 음성 데이터는 기기 밖으로 **저장·전송하지 않음**(단, Safari 음성인식 자체는 Apple 서버 사용 가능 — 고지 필요)
- Capacitor 전환 대비: 음성/TTS/저장소를 **어댑터 인터페이스**로 분리

---

## 2. iOS Safari 제약 — 리스크 & 대안

| ID | 영역 | 리스크 | 영향 | 대안 / 완화 |
|---|---|---|---|---|
| R1 | 음성인식 지원 | iOS Safari는 `webkitSpeechRecognition`만 제공(표준 `SpeechRecognition` 미보장). Siri/받아쓰기 **서버 기반** → 오프라인 불가. `continuous`·`interimResults` 동작 불안정 | 🔴 높음 | ① 기능 감지 후 미지원/오프라인 시 **자가채점 모드**(내 녹음 재생 + ✅/❌ 단어 탭) ② 인식 1회당 1문장 짧게(`continuous=false`) ③ Capacitor 단계에서 네이티브 `SFSpeechRecognizer`(온디바이스 지원) 플러그인으로 교체 |
| R2 | 홈 화면 PWA(standalone) | standalone 모드에서 음성인식이 Safari 탭과 다르게 동작/미동작한 이력 있음 | 🔴 높음 | 실기기 스모크 테스트 체크리스트(Safari 탭 vs 홈 화면) 작성. 실패 시 R1 폴백 자동 전환 |
| R3 | WKWebView(Capacitor) | WKWebView에는 Web Speech 인식이 **없음** → PWA 코드 그대로 앱에서 인식 불가 | 🔴 높음 | `SpeechRecognizer` 인터페이스 추상화: `WebSpeechRecognizer` / `NativeSpeechRecognizer`(Stage 5 문서화, 이후 구현) |
| R4 | 마이크 권한 | HTTPS + 사용자 제스처 필요. standalone PWA는 **세션마다 재요청**되는 경우 있음. 거부 시 재요청 API 없음 | 🟠 중간 | 첫 사용 전 설명 화면(왜 필요한지) → 탭으로 요청. 거부 상태 감지 시 "설정 > Safari > 마이크" 안내 |
| R5 | 오디오 자동재생 | 사용자 제스처 없이 `speechSynthesis.speak()` 무시됨. 백그라운드/화면 잠금 시 TTS 중단 | 🟠 중간 | 모든 재생은 탭 이벤트 핸들러에서 동기 호출. 자동 연속재생 없음(MVP). 탭 복귀 시 상태 리셋 |
| R6 | TTS 음성·속도 | 음성 목록이 비동기 로드(`voiceschanged`), `rate` 체감 속도가 플랫폼별 상이 | 🟡 낮음 | 음성 로딩 대기 유틸 + 타임아웃. 0.7/1.0은 설정값으로 두고 실기기 튜닝 |
| R7 | 오디오 세션 충돌 | 녹음/인식 직후 TTS 볼륨이 작아지거나 수화기 스피커로 출력되는 iOS 동작 | 🟠 중간 | 인식 종료 → 스트림 트랙 `stop()` 확실히 해제 → 짧은 지연 후 TTS. 실기기 검증 항목에 포함 |
| R8 | 저장소 축출 | Safari는 미사용 시 스크립트 쓰기 저장소를 삭제할 수 있음(홈 화면 앱은 예외 취급). Safari 탭과 홈 화면 앱은 저장소 분리 | 🟠 중간 | `navigator.storage.persist()` 요청, 홈 화면 설치 유도, **JSON 내보내기/가져오기** 백업 기능 |
| R9 | 인식 결과 정규화 | 인식기가 숫자("2"), 축약("I'm"), 대소문자, 구두점을 임의 변환 | 🟡 낮음 | 정규화 파이프라인(소문자·구두점 제거·축약 전개·숫자→단어 기본표) — TDD 대상 |
| R10 | 무음 스위치 | 무음 모드에서 웹 오디오 출력 영향 가능 | 🟡 낮음 | 실기기 확인 후 안내 문구 |

> ⚠️ R1·R2·R7은 브라우저 버전별 차이가 커서 **실기기 확인 전에는 확정하지 않음**. Stage 2 종료 시 iPhone 스모크 테스트 체크리스트 제공 예정.

---

## 3. 스택 제안

| 영역 | 선택 | 이유 | 대안(기각 이유) |
|---|---|---|---|
| 빌드 | **Vite 6+** | 빠른 HMR, PWA 플러그인 생태계, Capacitor 공식 가이드와 궁합 | Webpack(느림·설정 과다) |
| 언어 | **TypeScript (strict)** | diff/SM-2 로직 타입 안정성, 어댑터 인터페이스 명시 | JS(리팩터링 리스크) |
| UI | **Preact + @preact/signals** (~5KB) | React 문법 그대로(학습비용 0, 레퍼런스 풍부), 초경량 → 저사양/모바일 TTI 유리, signals로 전역 상태 단순화 | Svelte 5(좋지만 별도 문법 학습), React(번들 ~45KB), Vanilla(상태·접근성 관리 비용 증가) |
| 스타일 | 순수 CSS + CSS 변수(디자인 토큰) | 다크모드 토큰 전환 간단, 런타임 0 | Tailwind(빌드 복잡도 대비 이득 작음) |
| 저장소 | **idb** (~1KB IndexedDB 래퍼) | Promise API, 스키마 버전 마이그레이션 | Dexie(기능 과다), localStorage(용량·동기 I/O) |
| PWA | **vite-plugin-pwa (Workbox)** | manifest·SW 생성, precache/runtime 전략 선언적 설정 | 수작업 SW(유지보수 부담) |
| 테스트 | **Vitest + @vitest/coverage-v8**, @testing-library/preact, fake-indexeddb | Vite 설정 공유, 빠름, 커버리지 임계값 강제 | Jest(ESM·Vite 설정 중복) |
| 품질 | ESLint(flat config, typescript-eslint, jsx-a11y) + Prettier | 접근성 규칙 정적 검사 | — |
| 배포 | GitHub Actions → GitHub Pages | 무료, HTTPS 기본(마이크 권한 필수 조건 충족) | — |
| 앱화 | Capacitor 7+ (Stage 5 문서) | 동일 웹 코드 재사용, 네이티브 플러그인으로 R3 해결 | React Native(재작성 필요) |

---

## 4. 핵심 알고리즘 설계 (Stage 1 TDD 대상)

### 4.1 정규화 → 토큰화
`"I'm going to the office at 9."` → `["i","am","going","to","the","office","at","nine"]`
- 소문자, 유니코드 따옴표 통일, 구두점 제거(단어 내부 하이픈은 공백 처리), 축약 전개(기본 표), 0~20·10단위 숫자 → 단어

### 4.2 단어 diff (LCS 기반 정렬)
- 출력: `{ op: 'match' | 'sub' | 'del' | 'ins', ref?: string, hyp?: string, refIndex?: number }[]`
- `del` = 원문에 있는데 말하지 않음, `ins` = 원문에 없는 말, `sub` = 인접 del+ins 쌍 병합
- **정확도** = `match 수 / 원문 단어 수 × 100` (원문 0단어면 0 반환)
- **재시도 구간** = 연속된 비-match 원문 인덱스 구간 `[start, end]`, 앞뒤 1단어 문맥 포함 옵션

### 4.3 정확도 → SM-2 품질 매핑
| 정확도 | q |
|---|---|
| ≥ 95 | 5 |
| ≥ 85 | 4 |
| ≥ 70 | 3 |
| ≥ 50 | 2 |
| ≥ 30 | 1 |
| < 30 | 0 |

SM-2: q < 3 → repetition=0, interval=1 · q ≥ 3 → 1 → 6 → round(interval × EF) · EF' = EF + (0.1 − (5−q)(0.08 + (5−q)·0.02)), 최소 1.3

---

## 5. 파일 구조 (계획)

```
shadow-coach/
├─ CLAUDE.md
├─ README.md                      # Stage 5
├─ index.html
├─ package.json / tsconfig.json / vite.config.ts / eslint.config.js / .prettierrc
├─ public/
│  ├─ icons/                      # Stage 3: 아이콘 자리 (192/512/maskable/apple-touch)
│  └─ sets/default.json           # 기본 30문장
├─ src/
│  ├─ main.tsx                    # 엔트리 + SW 등록
│  ├─ app/                        # 화면 컴포넌트 (Stage 2)
│  │  ├─ App.tsx
│  │  ├─ screens/ (Home, Practice, Stats, Settings)
│  │  └─ components/ (DiffView, RecordButton, SpeedToggle, ...)
│  ├─ core/                       # 순수 로직 — DOM 의존 0, 커버리지 ≥ 90%
│  │  ├─ normalize.ts
│  │  ├─ diff.ts
│  │  ├─ accuracy.ts
│  │  ├─ sm2.ts
│  │  ├─ stats.ts                 # 오늘 통계, 연속 일수
│  │  ├─ sentenceSet.ts           # JSON 스키마 검증
│  │  └─ date.ts                  # 로컬 날짜 키(YYYY-MM-DD)
│  ├─ adapters/                   # 플랫폼 경계 — Capacitor 교체 지점
│  │  ├─ speech/ (types.ts, webRecognizer.ts, nativeRecognizer.ts[후속])
│  │  ├─ tts/ (types.ts, webTts.ts)
│  │  └─ storage/ (db.ts, repo.ts)
│  ├─ state/                      # signals 스토어
│  └─ styles/ (tokens.css, base.css)
├─ tests/                         # 또는 src/**/*.test.ts 동일 위치
├─ docs/
│  ├─ stage0-requirements.md
│  ├─ ios.md                      # Stage 5
│  └─ device-smoke-test.md        # Stage 2~3
└─ .github/workflows/deploy.yml   # Stage 5
```

### 데이터 모델 (IndexedDB `shadow-coach`, v1)
| store | key | 주요 필드 |
|---|---|---|
| `sets` | `id` | `title, lang, sentences[]` |
| `cards` | `sentenceId` | `ef, interval, repetition, due(YYYY-MM-DD), lastAccuracy` |
| `attempts` | auto | `sentenceId, date, accuracy, segment?, createdAt` (음성 원본 **미저장**) |
| `settings` | `key` | `rate, theme, voiceURI` |

### 문장 세트 JSON 스키마
```json
{
  "id": "default-v1",
  "title": "Default Set",
  "version": 1,
  "sentences": [
    { "id": "biz-001", "text": "Could you share the updated delivery schedule by Friday?", "ko": "금요일까지 수정된 납기 일정을 공유해 주시겠어요?", "category": "business", "tags": ["schedule"] }
  ]
}
```

---

## 6. Stage별 커밋 계획
| Stage | 커밋 단위 예시 |
|---|---|
| 0 | `docs: stage 0 requirements, risks, stack, CLAUDE.md` |
| 1 | `chore: scaffold vite+preact+ts` → `chore: eslint/prettier/vitest` → `test+feat: normalize` → `test+feat: diff/accuracy` → `test+feat: sm2` → `test+feat: stats` → `feat: default sentence set` |
| 2 | 토큰/레이아웃 → 연습 화면 → diff 뷰/재시도 → 통계/설정 → a11y 패스 |
| 3 | manifest/아이콘 → SW 캐시 전략 → 오프라인 테스트 |
| 4 | 리뷰 이슈 목록 문서 → 이슈별 수정 커밋 |
| 5 | 배포 워크플로 → README → docs/ios.md |
