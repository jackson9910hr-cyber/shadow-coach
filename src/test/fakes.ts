import {
  RecorderError,
  type Recorder,
  type RecorderSession,
  type Recording,
} from '../adapters/recorder/types';
import type { RecognitionHandlers, SpeechRecognizer } from '../adapters/speech/types';
import type { SpeakOptions, Tts, VoiceInfo } from '../adapters/tts/types';
import type { Services } from '../state/services';

export interface FakeServices extends Services {
  spoken: { text: string; options: SpeakOptions }[];
  /** Handlers of the most recent recognition session. */
  recognition: RecognitionHandlers | null;
  recognitionStops: number;
  recordings: Recording[];
  online: boolean;
  finishSpeech(): void;
}

export function createFakeServices(
  opts: { recognition?: boolean; recorder?: boolean | 'deny'; voices?: VoiceInfo[] } = {},
): FakeServices {
  const { recognition = true, recorder = true, voices = [] } = opts;
  const fake: FakeServices = {
    spoken: [],
    recognition: null,
    recognitionStops: 0,
    recordings: [],
    online: true,
    finishSpeech() {
      fake.spoken[fake.spoken.length - 1]?.options.onEnd?.();
    },
    isOnline: () => fake.online,
    tts: {
      supported: true,
      speak(text, options) {
        fake.spoken.push({ text, options });
      },
      cancel() {},
      voices: () => voices,
      onVoicesChanged: () => () => {},
    } satisfies Tts,
    recognizer: {
      supported: recognition,
      start(_lang, handlers) {
        fake.recognition = handlers;
        return {
          stop() {
            fake.recognitionStops++;
          },
          abort() {},
        };
      },
    } satisfies SpeechRecognizer,
    recorder: {
      supported: recorder !== false,
      async start(): Promise<RecorderSession> {
        if (recorder === 'deny') throw new RecorderError('denied');
        return {
          async stop() {
            const rec = { url: 'blob:fake', dispose: vi.fn() };
            fake.recordings.push(rec);
            return rec;
          },
        };
      },
    } satisfies Recorder,
  };
  return fake;
}
