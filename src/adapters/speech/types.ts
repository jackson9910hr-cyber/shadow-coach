export type RecognitionErrorCode = 'denied' | 'no-speech' | 'network' | 'no-mic' | 'unknown';

export interface RecognitionHandlers {
  /** Partial transcript while the user is speaking. */
  onInterim?: (text: string) => void;
  /** Final result; alternatives are ordered by recognizer confidence. */
  onFinal: (alternatives: string[]) => void;
  onError: (code: RecognitionErrorCode) => void;
  /** Always called once when the session ends (after onFinal/onError). */
  onEnd: () => void;
}

export interface RecognitionSession {
  /** Stop listening and deliver whatever was heard. */
  stop(): void;
  /** Stop listening and discard the result. */
  abort(): void;
}

/**
 * Platform boundary for speech-to-text. Web: Web Speech API.
 * Capacitor: replace with a native SFSpeechRecognizer-backed implementation.
 */
export interface SpeechRecognizer {
  readonly supported: boolean;
  /** Must be called synchronously inside a user gesture handler (iOS). */
  start(lang: string, handlers: RecognitionHandlers): RecognitionSession;
}
