import type { Recorder } from '../adapters/recorder/types';
import type { SpeechRecognizer } from '../adapters/speech/types';
import type { Tts } from '../adapters/tts/types';

/** Platform services injected into the app (swap for Capacitor/native or test fakes). */
export interface Services {
  tts: Tts;
  recognizer: SpeechRecognizer;
  recorder: Recorder;
  isOnline(): boolean;
}
