import { RecorderError, type Recorder, type RecorderSession, type Recording } from './types';

const MIME_CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

export function createWebRecorder(): Recorder {
  const supported =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined';

  return {
    supported,
    async start(): Promise<RecorderSession> {
      if (!supported) throw new RecorderError('unsupported');
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        const name = (e as DOMException).name;
        throw new RecorderError(
          name === 'NotAllowedError' ? 'denied' : name === 'NotFoundError' ? 'no-mic' : 'unknown',
        );
      }
      // Release the mic so iOS switches the audio route back to the speaker for TTS.
      const release = () => stream.getTracks().forEach((t) => t.stop());
      const chunks: Blob[] = [];
      let recorder: MediaRecorder;
      try {
        const mimeType = pickMime();
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.start();
      } catch {
        // Never leave the microphone on after a failure (docs/review-stage4.md S1).
        release();
        throw new RecorderError('unknown');
      }

      return {
        stop: () =>
          new Promise<Recording | null>((resolve) => {
            recorder.onstop = () => {
              release();
              if (!chunks.length) return resolve(null);
              const url = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
              resolve({ url, dispose: () => URL.revokeObjectURL(url) });
            };
            if (recorder.state === 'inactive') recorder.onstop(new Event('stop'));
            else recorder.stop();
          }),
      };
    },
  };
}
