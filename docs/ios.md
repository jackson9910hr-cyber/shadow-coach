# iOS 앱 전환 가이드 (Capacitor → App Store)

이 문서는 PWA를 **Capacitor**로 감싸 App Store에 제출하는 절차입니다.
웹 코드는 그대로 쓰고, **플랫폼 경계(`src/adapters/`)만 네이티브 구현으로 교체**하는 것이 핵심입니다.

> ⚠️ 표시 항목은 작성 시점(2026-09) 기준이며, 제출 전에 Apple 공식 문서로 다시 확인하세요.

## 1. PWA와 앱의 차이 (왜 어댑터를 바꿔야 하나)

| 기능           | Safari PWA                             | Capacitor(WKWebView)                    | 조치                                                            |
| -------------- | -------------------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| 음성인식       | `webkitSpeechRecognition` (Apple 서버) | **없음**                                | `NativeSpeechRecognizer` 어댑터 추가 (SFSpeechRecognizer)       |
| TTS            | `speechSynthesis`                      | 동작                                    | 그대로 사용 (문제 시 `@capacitor-community/text-to-speech`)     |
| 녹음           | `getUserMedia` + `MediaRecorder`       | iOS 14.3+ 동작                          | 그대로 사용, Info.plist 권한 문구 필수                          |
| Service Worker | 동작                                   | `capacitor://` 스킴에서는 동작하지 않음 | 불필요 (모든 파일이 앱에 포함). 등록 코드는 네이티브에서 건너뜀 |
| 저장소         | IndexedDB (축출 가능)                  | IndexedDB (앱 데이터로 보존)            | 그대로 사용                                                     |
| 오디오 라우팅  | 제어 불가 (R7)                         | `AVAudioSession` 제어 가능              | `playAndRecord` + `defaultToSpeaker` 설정                       |

## 2. 프로젝트 셋업

```bash
npm i @capacitor/core
npm i -D @capacitor/cli
npm i @capacitor/ios
npx cap init "Shadow Coach" com.<your-id>.shadowcoach --web-dir dist

# 앱용 빌드는 상대 경로(./)로
BASE_PATH=./ npm run build
npx cap add ios
npx cap sync ios
npx cap open ios   # Xcode (macOS 필요)
```

`package.json`에 추가 권장:

```json
"build:app": "BASE_PATH=./ vite build && cap sync ios"
```

## 3. 네이티브 음성인식 어댑터

후보 플러그인: `@capacitor-community/speech-recognition` (SFSpeechRecognizer 기반).
⚠️ 온디바이스 인식(`requiresOnDeviceRecognition`) 옵션 노출 여부는 플러그인 버전마다 다릅니다. 없으면 20~40줄짜리 Swift 커스텀 플러그인으로 구현하세요.

`src/adapters/speech/nativeRecognizer.ts` 스켈레톤:

```ts
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import type { SpeechRecognizer } from './types';

export function createNativeRecognizer(): SpeechRecognizer {
  return {
    supported: true,
    start(lang, handlers) {
      let cancelled = false;
      void (async () => {
        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== 'granted') {
          handlers.onError('denied');
          return handlers.onEnd();
        }
        const listener = await SpeechRecognition.addListener('partialResults', (d) =>
          handlers.onInterim?.(d.matches?.[0] ?? ''),
        );
        try {
          const r = await SpeechRecognition.start({
            language: lang,
            maxResults: 3,
            partialResults: false,
            popup: false,
          });
          if (!cancelled) handlers.onFinal(r.matches ?? []);
        } catch {
          if (!cancelled) handlers.onError('unknown');
        } finally {
          await listener.remove();
          handlers.onEnd();
        }
      })();
      return {
        stop: () => void SpeechRecognition.stop(),
        abort: () => {
          cancelled = true;
          void SpeechRecognition.stop();
        },
      };
    },
  };
}
```

`src/main.tsx`에서 플랫폼에 따라 주입:

```ts
import { Capacitor } from '@capacitor/core';
const native = Capacitor.isNativePlatform();
recognizer: native ? createNativeRecognizer() : createWebRecognizer(),
// Service Worker: BASE_PATH=./ 빌드는 __NATIVE_SHELL__=true 로 PWA 플러그인과 등록을 모두 끔
```

## 4. Info.plist (필수 — 누락 시 크래시/리젝)

| 키                                    | 값 (예시)                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `NSMicrophoneUsageDescription`        | 영어 문장을 따라 말한 발음을 인식하고, 자가채점을 위해 내 목소리를 다시 듣기 위해 마이크를 사용합니다. |
| `NSSpeechRecognitionUsageDescription` | 따라 말한 문장을 원문과 비교해 정확도를 알려주기 위해 음성인식을 사용합니다.                           |
| `ITSAppUsesNonExemptEncryption`       | `NO` (암호화 기능 없음)                                                                                |

`AppDelegate.swift`에서 오디오 세션 (R7 해결):

```swift
try? AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .spokenAudio,
     options: [.defaultToSpeaker, .allowBluetoothA2DP])
```

## 5. App Store 제출 체크리스트

### 계정·설정

- [ ] Apple Developer Program 가입 (연 $99)
- [ ] App Store Connect에서 앱 생성, Bundle ID 일치 (`com.<your-id>.shadowcoach`)
- [ ] 카테고리: 교육(Education), 연령 등급 설문 (4+ 예상)

### 에셋

- [ ] 앱 아이콘 1024×1024 PNG, **알파 채널 없음** (`public/icons/icon.svg`에서 생성: `npm run icons` 확장)
- [ ] 런치 스크린 (Xcode `LaunchScreen.storyboard`, 배경 `#2b55c8`)
- [ ] 스크린샷: ⚠️ 현재 요구 사이즈(6.9" iPhone 필수 여부)를 App Store Connect에서 확인
- [ ] iPad 지원 여부 결정 (미지원 시 Xcode에서 iPhone only)

### 개인정보

- [ ] **개인정보처리방침 URL** (필수) — `https://jackson9910hr-cyber.github.io/shadow-coach/privacy.html` (`public/privacy.html`) ✅
- [ ] App Privacy(영양 라벨): 앱이 개발자 서버로 수집하는 데이터 **없음**
  - ⚠️ 음성인식을 Apple 서버로 처리할 때의 표기는 Apple 가이드 확인. 온디바이스 인식을 강제하면 "Data Not Collected"가 명확해짐
- [ ] 녹음·기록은 기기에만 저장된다는 안내가 앱 내(설정 › 개인정보)에 있음 ✅

### 리뷰 리스크

- [ ] **Guideline 4.2 (최소 기능)**: 단순 웹 래퍼로 보이면 리젝 위험. 다음 네이티브 기능이 차별점:
  - 온디바이스 음성인식(오프라인 채점)
  - 복습 알림 (`@capacitor/local-notifications`로 "오늘 복습 N문장")
  - 햅틱 피드백 (`@capacitor/haptics`)
- [ ] 리뷰 노트: 마이크/음성인식 사용 목적, 로그인 불필요, 테스트 방법(홈 → 학습 시작 → 🎤)
- [ ] 성경 본문: World English Bible(퍼블릭 도메인), 한국어 뜻은 자체 번역 → 저작권 문제 없음. **개역개정 등 저작권 번역본을 추가하지 말 것**

### 빌드·배포

- [ ] Xcode › Signing & Capabilities: 팀 선택, 자동 서명
- [ ] 버전(`package.json` version ↔ `CFBundleShortVersionString`) 일치
- [ ] Product › Archive → TestFlight 업로드 → 내부 테스트 (교회 사역팀)
- [ ] `docs/device-smoke-test.md` 전 항목을 TestFlight 빌드로 재확인
- [ ] 심사 제출

## 6. 권장 로드맵

1. **PWA로 2~4주 실사용** (교회 사역팀 몇 명) → 문장 세트·정확도 기준 검증
2. Capacitor 셸 + 네이티브 음성인식 어댑터 → TestFlight
3. 로컬 알림·햅틱 추가 (4.2 대응) → App Store 제출
