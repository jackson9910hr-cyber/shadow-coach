# CLAUDE.md — shadow-coach

영어 섀도잉 코치 PWA. iPhone Safari(홈 화면 PWA)가 1차 타깃이며, 이후 Capacitor로 감싸 App Store에 제출한다.

## 명령어

```bash
npm run dev          # Vite 개발 서버
npm run build        # 타입체크 + 프로덕션 빌드
npm run preview      # 빌드 결과 미리보기 (SW 동작 확인용)
npm test             # Vitest (watch 아님)
npm run coverage     # 커버리지 — src/core 90% 미만이면 실패
npm run lint         # ESLint (jsx-a11y 포함)
npm run format       # Prettier
```

커밋 전 `npm run lint && npm test && npm run build` 모두 통과해야 한다.

## 아키텍처 원칙

- `src/core/` — 순수 함수만. DOM·브라우저 API·IndexedDB import 금지. **테스트 먼저(TDD)** 작성.
- `src/adapters/` — 플랫폼 경계(음성인식, TTS, 저장소). UI는 인터페이스(`types.ts`)에만 의존한다. Capacitor 전환 시 이 계층만 교체.
- `src/app/` — Preact 컴포넌트. 비즈니스 로직을 넣지 말고 `core`/`state` 호출.
- `src/state/` — `@preact/signals` 스토어.

## iOS Safari 규칙 (반드시 지킬 것)

- `speechSynthesis.speak()`, 마이크 요청, 인식 시작은 **사용자 탭 핸들러 안에서 동기적으로** 호출한다(await 이후 호출 금지).
- 음성인식은 `window.SpeechRecognition ?? window.webkitSpeechRecognition` 기능 감지. 없거나 오프라인이면 자가채점 모드로 폴백.
- `continuous = false`, 문장 단위 짧은 인식.
- 인식/녹음 종료 시 `MediaStreamTrack.stop()`으로 마이크 해제 후 TTS 재생.
- 음성 원본(오디오 Blob)은 저장·전송하지 않는다. 저장은 텍스트 결과와 점수만.

## 코드 규칙

- TypeScript `strict`. `any` 금지(불가피하면 사유 주석).
- 날짜는 로컬 타임존 `YYYY-MM-DD` 문자열 키(`core/date.ts`)로 통일. `Date` 직접 비교 금지.
- 테스트 파일은 대상 옆에 `*.test.ts(x)`.
- 접근성: 인터랙티브 요소는 네이티브 `<button>` 우선, 터치 타깃 ≥ 44px, 색만으로 정보 전달 금지, 결과는 `aria-live="polite"`로 알림.
- 스타일은 `src/styles/tokens.css`의 CSS 변수만 사용(하드코딩 색상 금지). 다크모드는 토큰 재정의로 처리.

## 품질 기준

- `src/core` 라인·브랜치 커버리지 ≥ 90%
- Lighthouse Accessibility ≥ 90, Best Practices ≥ 90
- Stage별 의미 단위 커밋(Conventional Commits: `feat:`, `fix:`, `test:`, `chore:`, `docs:`)

## 작업 방식

- 각 Stage 끝에서 멈추고 사용자 승인을 받는다.
- 불확실하면 추측하지 말고 질문한다.
- 참고 문서: `docs/stage0-requirements.md`(요구사항·리스크·데이터 모델)
