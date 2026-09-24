export type RecorderErrorCode = 'denied' | 'no-mic' | 'unsupported' | 'unknown';

export interface Recording {
  /** Object URL for in-memory playback. Never persisted or uploaded. */
  url: string;
  /** Revoke the object URL and free memory. */
  dispose(): void;
}

export interface RecorderSession {
  /** Stops recording, releases the microphone and resolves with the recording. */
  stop(): Promise<Recording | null>;
}

/** Platform boundary for recording the learner's voice (self-grading playback). */
export interface Recorder {
  readonly supported: boolean;
  /** Must be called inside a user gesture handler (iOS). */
  start(): Promise<RecorderSession>;
}

export class RecorderError extends Error {
  constructor(readonly code: RecorderErrorCode) {
    super(code);
  }
}
