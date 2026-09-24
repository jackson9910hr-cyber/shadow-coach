import type {
  RecognitionErrorCode,
  RecognitionHandlers,
  RecognitionSession,
  SpeechRecognizer,
} from './types';

/* Minimal Web Speech API typings (not in TypeScript's DOM lib). */
interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternative;
}
interface SpeechResultList {
  readonly length: number;
  [index: number]: SpeechResult;
}
export interface WebSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type WebSpeechRecognitionCtor = new () => WebSpeechRecognition;

const MAX_ALTERNATIVES = 3;
/** Safety net: iOS sometimes keeps listening after the user stops talking. */
const MAX_LISTEN_MS = 15_000;

const ERROR_MAP: Record<string, RecognitionErrorCode> = {
  'not-allowed': 'denied',
  'service-not-allowed': 'denied',
  'no-speech': 'no-speech',
  network: 'network',
  'audio-capture': 'no-mic',
};

export function findRecognitionCtor(scope: object = globalThis): WebSpeechRecognitionCtor | null {
  const s = scope as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return (s.SpeechRecognition ??
    s.webkitSpeechRecognition ??
    null) as WebSpeechRecognitionCtor | null;
}

function collectAlternatives(results: SpeechResultList): string[] {
  const alternatives: string[] = [];
  for (let k = 0; k < MAX_ALTERNATIVES; k++) {
    const parts: string[] = [];
    let found = false;
    for (let i = 0; i < results.length; i++) {
      const result = results[i] as SpeechResult;
      const alt = result[k] ?? result[0];
      if (result[k]) found = true;
      if (alt) parts.push(alt.transcript.trim());
    }
    if (k > 0 && !found) break;
    const text = parts.join(' ').trim();
    if (text && !alternatives.includes(text)) alternatives.push(text);
  }
  return alternatives;
}

export function createWebRecognizer(
  Ctor: WebSpeechRecognitionCtor | null = findRecognitionCtor(),
): SpeechRecognizer {
  return {
    supported: Ctor !== null,
    start(lang: string, handlers: RecognitionHandlers): RecognitionSession {
      if (!Ctor) {
        handlers.onError('unknown');
        handlers.onEnd();
        return { stop() {}, abort() {} };
      }
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = MAX_ALTERNATIVES;

      let latest: string[] = [];
      let settled = false;
      let aborted = false;
      const timer = setTimeout(() => rec.stop(), MAX_LISTEN_MS);

      const deliverFinal = (alternatives: string[]) => {
        if (settled || aborted) return;
        settled = true;
        handlers.onFinal(alternatives);
      };

      rec.onresult = (e) => {
        const alternatives = collectAlternatives(e.results);
        latest = alternatives;
        const last = e.results[e.results.length - 1];
        if (last?.isFinal) deliverFinal(alternatives);
        else handlers.onInterim?.(alternatives[0] ?? '');
      };
      rec.onerror = (e) => {
        if (e.error === 'aborted' || settled || aborted) return;
        settled = true;
        handlers.onError(ERROR_MAP[e.error] ?? 'unknown');
      };
      rec.onend = () => {
        clearTimeout(timer);
        // iOS Safari may end without ever flagging a result as final.
        if (latest.length) deliverFinal(latest);
        else if (!settled && !aborted) {
          settled = true;
          handlers.onError('no-speech');
        }
        handlers.onEnd();
      };

      try {
        rec.start();
      } catch {
        // e.g. InvalidStateError when a previous session is still shutting down.
        clearTimeout(timer);
        settled = true;
        handlers.onError('unknown');
        handlers.onEnd();
      }
      return {
        stop: () => rec.stop(),
        abort: () => {
          aborted = true;
          rec.abort();
        },
      };
    },
  };
}
