# Shadow Coach — 영어 섀도잉 코치 PWA

듣고 → 따라 말하고 → **단어 단위로 틀린 곳을 확인**하고 → 틀린 구간만 다시 연습하는 영어 섀도잉 앱입니다.
iPhone Safari(홈 화면 앱)용으로 설계했고, 오프라인에서도 동작합니다.

**앱 주소**: https://jackson9910hr-cyber.github.io/shadow-coach/ (배포 설정 후)

## 기능

| 기능             | 설명                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| 문장 세트        | 기본 30문장 (비즈니스 15 · 교회 8 · 일상 7, 한국어 뜻 포함). JSON 세트 추가 가능           |
| 원문 듣기        | 기기 내장 TTS, 속도 0.7× / 1.0×, 음성 선택                                                 |
| 발음 채점        | 음성인식 → 원문과 단어 단위 비교 → 정확도 % (대소문자·구두점·축약형·숫자 표기 차이는 무시) |
| 틀린 구간 재시도 | 틀린 단어 + 앞뒤 1단어를 구간으로 묶어 그 부분만 듣고 다시 말하기                          |
| 간격 반복        | SM-2 알고리즘. 정확도 → 품질(0~5) → 다음 복습일 자동 계산                                  |
| 자가채점         | 음성인식 미지원·오프라인 시 녹음 → 내 목소리 듣기 → 틀린 단어 탭                           |
| 오늘 통계        | 학습 문장 수, 평균 정확도, 연속 학습일                                                     |
| 오프라인         | Service Worker 프리캐시 + IndexedDB 저장                                                   |
| 백업             | JSON 내보내기 / 가져오기                                                                   |

## 시작하기

```bash
npm ci
npm run dev          # http://localhost:5173/shadow-coach/
npm test             # 단위·통합 테스트
npm run coverage     # src/core 커버리지 90% 게이트
npm run test:e2e     # Playwright (빌드 → 오프라인 포함 E2E)
npm run lint && npm run build
```

> 마이크·음성인식은 **HTTPS**(또는 localhost)에서만 동작합니다. iPhone 실기기 테스트는 배포 URL로 하세요.

## 배포 (GitHub Pages)

1. GitHub 저장소 › **Settings › Pages › Build and deployment › Source: GitHub Actions** 선택 (최초 1회)
2. `main` 또는 `claude/shadow-coach-pwa-lrtfvc` 브랜치에 push → `.github/workflows/ci-deploy.yml`이 테스트 후 배포
3. iPhone Safari에서 접속 → 공유 → **홈 화면에 추가**

## 아키텍처

```
src/
├─ core/       순수 로직 (정규화·diff·정확도·SM-2·큐·통계·검증) — DOM 의존 0, TDD
├─ adapters/   플랫폼 경계 — 음성인식·TTS·녹음·IndexedDB (Capacitor 전환 시 교체 지점)
├─ state/      @preact/signals 스토어 + 연습 세션 상태 머신
├─ app/        Preact 화면 (홈·연습·문장·설정)
├─ data/       기본 문장 세트 (번들 포함 → 항상 오프라인)
└─ styles/     디자인 토큰(라이트/다크) + 기본 스타일
```

스택: Vite · TypeScript(strict) · Preact · @preact/signals · idb · vite-plugin-pwa(Workbox) · Vitest · Playwright

## 문장 세트 JSON 형식

```json
{
  "id": "sermon-2026-09",
  "title": "9월 설교 문장",
  "version": 1,
  "sentences": [
    {
      "id": "1",
      "text": "God is faithful.",
      "ko": "하나님은 신실하십니다.",
      "category": "church",
      "tags": ["sermon"]
    }
  ]
}
```

`category`: `business` | `church` | `daily` · `ko`, `tags`, `source`는 선택. 설정 › 문장 세트 › JSON 파일로 세트 추가.

## 개인정보

- 문장별 점수·날짜·복습 일정만 **기기 안(IndexedDB)** 에 저장합니다. 인식된 문장과 음성은 저장하지 않고, 외부 서버로 보내지 않습니다.
- 음성인식은 브라우저 제조사의 음성 서비스가 처리합니다 (iPhone은 Apple, Chrome은 Google).
- [개인정보처리방침](public/privacy.html) · 배포 시 `/shadow-coach/privacy.html`
- 보안 권장: `*.github.io`는 같은 계정의 다른 Pages 사이트와 저장소(origin)를 공유합니다. 계정에 다른 Pages 사이트를 올릴 계획이면 **커스텀 도메인**을 연결하세요.
- 자가채점 녹음은 메모리에서만 재생되고 저장되지 않습니다.

## 라이선스·출처

- 영어 문장·한국어 번역: 자체 작성
- 성경 구절 영문: World English Bible (퍼블릭 도메인)
- 성경 구절 한국어 뜻: 자체 번역 (개역개정·새번역 등 **저작권 있는 번역본은 추가하지 않습니다**)

## 문서

- [요구사항·리스크·설계](docs/stage0-requirements.md)
- [iPhone 실기기 점검표](docs/device-smoke-test.md)
- [iOS 앱 전환 (Capacitor · App Store)](docs/ios.md)
- [Stage 4 리뷰 결과](docs/review-stage4.md)
