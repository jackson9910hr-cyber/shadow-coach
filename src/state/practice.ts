import { batch, computed, signal } from '@preact/signals';
import {
  pickBestTranscript,
  scoreSelfGrade,
  type AttemptScore,
  type RetrySegment,
} from '../core/accuracy';
import type { RecognitionErrorCode, RecognitionSession } from '../adapters/speech/types';
import { RecorderError, type RecorderSession, type Recording } from '../adapters/recorder/types';
import type { Card } from '../core/sm2';
import type { Services } from './services';
import type { PracticeSentence, Store } from './store';

export type Phase =
  | 'ready' // waiting for the learner
  | 'listening' // speech recognition active
  | 'recording' // self-grade mode: recording for playback
  | 'grading' // self-grade mode: marking wrong words
  | 'result'
  | 'done';

export type Target = { kind: 'full' } | { kind: 'segment'; segment: RetrySegment };

export interface Result {
  score: AttemptScore;
  transcript: string | null;
  /** For whole-sentence attempts: whether the SM-2 schedule changed, and the resulting card. */
  graded: boolean;
  card: Card | null;
}

export const ERROR_MESSAGES: Record<RecognitionErrorCode | 'recorder', string> = {
  denied:
    '마이크 또는 음성인식 권한이 없습니다. 설정 › Safari › 마이크를 허용하고, 설정 › Siri에서 받아쓰기가 켜져 있는지 확인해 주세요.',
  'no-speech': '음성이 들리지 않았어요. 🎤를 누르고 문장을 말해 주세요.',
  network: '음성인식 서버에 연결할 수 없어 자가채점 모드로 전환했습니다.',
  'no-mic': '마이크를 찾을 수 없습니다.',
  unknown: '음성인식 중 문제가 생겼어요. 다시 시도하거나 자가채점으로 진행하세요.',
  recorder: '녹음을 시작할 수 없어요. 녹음 없이 자가채점을 진행합니다.',
};

const LANG = 'en-US';

export function createPractice(store: Store, services: Services, queue: PracticeSentence[]) {
  const { tts, recognizer, recorder } = services;

  const index = signal(0);
  const phase = signal<Phase>(queue.length ? 'ready' : 'done');
  /** TTS is currently speaking (independent of phase so results stay visible). */
  const playing = signal(false);
  const target = signal<Target>({ kind: 'full' });
  const interim = signal('');
  const result = signal<Result | null>(null);
  /** Last whole-sentence result, kept while practicing its segments. */
  const fullResult = signal<Result | null>(null);
  const error = signal<string | null>(null);
  const marks = signal<ReadonlySet<number>>(new Set());
  const recording = signal<Recording | null>(null);
  /** Switched on after a network failure so the session continues offline. */
  const forceSelf = signal(false);
  const completed = signal(0);

  const current = computed(() => queue[index.value] ?? null);
  const targetText = computed(() => {
    const t = target.value;
    return t.kind === 'segment' ? t.segment.text : (current.value?.text ?? '');
  });
  const mode = computed<'auto' | 'self'>(() =>
    store.settings.value.grading === 'self' || forceSelf.value || !recognizer.supported
      ? 'self'
      : 'auto',
  );

  let recognition: RecognitionSession | null = null;
  let recorderSession: Promise<RecorderSession | null> | null = null;

  function clearRecording() {
    recording.value?.dispose();
    recording.value = null;
  }

  function resetAttempt() {
    batch(() => {
      interim.value = '';
      error.value = null;
      marks.value = new Set();
      result.value = null;
      phase.value = 'ready';
    });
    clearRecording();
  }

  /** Tap handler: play the current target with TTS. */
  function listen() {
    if (phase.value === 'listening' || phase.value === 'recording') return;
    playing.value = true;
    tts.speak(targetText.value, {
      rate: store.settings.value.rate,
      voiceURI: store.settings.value.voiceURI,
      lang: LANG,
      onEnd: () => {
        playing.value = false;
      },
    });
  }

  function stopAudio() {
    tts.cancel();
    playing.value = false;
  }

  async function finish(score: AttemptScore, transcript: string | null) {
    const sentence = current.value as PracticeSentence;
    const segment = target.value.kind === 'segment';
    const outcome = await store.recordAttempt({
      sentenceId: sentence.id,
      accuracy: score.accuracy,
      segment,
      ...(transcript !== null ? { transcript } : {}),
    });
    const r: Result = { score, transcript, graded: outcome.graded, card: outcome.card };
    batch(() => {
      result.value = r;
      if (!segment) fullResult.value = r;
      phase.value = 'result';
    });
  }

  function startRecognition() {
    phase.value = 'listening';
    recognition = recognizer.start(LANG, {
      onInterim: (text) => {
        interim.value = text;
      },
      onFinal: (alternatives) => {
        const best = pickBestTranscript(targetText.value, alternatives);
        void finish(best.score, best.transcript);
      },
      onError: (code) => {
        if (code === 'network') forceSelf.value = true;
        batch(() => {
          error.value = ERROR_MESSAGES[code];
          phase.value = 'ready';
        });
      },
      onEnd: () => {
        recognition = null;
      },
    });
  }

  function startRecording() {
    phase.value = 'recording';
    if (!recorder.supported) {
      recorderSession = Promise.resolve(null);
      return;
    }
    recorderSession = recorder.start().catch((e: unknown) => {
      if (e instanceof RecorderError && phase.value === 'recording') {
        batch(() => {
          error.value = ERROR_MESSAGES.recorder;
          phase.value = 'grading';
        });
      }
      return null;
    });
  }

  /** Tap handler: start speaking (recognition or recording, depending on mode). */
  function startSpeaking() {
    if (!current.value) return;
    stopAudio();
    resetAttempt();
    if (!services.isOnline() && mode.value === 'auto') forceSelf.value = true;
    if (mode.value === 'auto') startRecognition();
    else startRecording();
  }

  /** Tap handler: stop speaking. */
  async function stopSpeaking() {
    if (phase.value === 'listening') {
      recognition?.stop();
      return;
    }
    if (phase.value !== 'recording') return;
    phase.value = 'grading';
    const session = await recorderSession;
    recorderSession = null;
    const rec = session ? await session.stop() : null;
    recording.value = rec;
  }

  function toggleMark(displayIndex: number) {
    const next = new Set(marks.value);
    if (next.has(displayIndex)) next.delete(displayIndex);
    else next.add(displayIndex);
    marks.value = next;
  }

  async function submitSelfGrade() {
    if (phase.value !== 'grading') return;
    await finish(scoreSelfGrade(targetText.value, [...marks.value]), null);
  }

  function practiceSegment(segment: RetrySegment) {
    stopAudio();
    target.value = { kind: 'segment', segment };
    resetAttempt();
  }

  function backToFull() {
    stopAudio();
    target.value = { kind: 'full' };
    resetAttempt();
    if (fullResult.value) {
      result.value = fullResult.value;
      phase.value = 'result';
    }
  }

  function retry() {
    stopAudio();
    resetAttempt();
  }

  function next() {
    stopAudio();
    recognition?.abort();
    if (fullResult.value) completed.value++;
    batch(() => {
      target.value = { kind: 'full' };
      fullResult.value = null;
      index.value++;
      resetAttempt();
      if (index.value >= queue.length) phase.value = 'done';
    });
  }

  function dispose() {
    stopAudio();
    recognition?.abort();
    void recorderSession?.then((s) => s?.stop().then((r) => r?.dispose()));
    clearRecording();
  }

  return {
    queue,
    index,
    phase,
    playing,
    target,
    targetText,
    current,
    interim,
    result,
    fullResult,
    error,
    marks,
    recording,
    mode,
    completed,
    listen,
    stopAudio,
    startSpeaking,
    stopSpeaking,
    toggleMark,
    submitSelfGrade,
    practiceSegment,
    backToFull,
    retry,
    next,
    dispose,
  };
}

export type Practice = ReturnType<typeof createPractice>;
