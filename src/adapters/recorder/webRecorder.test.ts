import { createWebRecorder } from './webRecorder';
import { RecorderError } from './types';

function fakeStream() {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
}

class FakeMediaRecorder {
  static isTypeSupported = (m: string) => m === 'audio/mp4';
  static fail = false;
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/mp4';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: ((e: Event) => void) | null = null;
  constructor(_stream: MediaStream, options?: { mimeType?: string }) {
    if (FakeMediaRecorder.fail) throw new DOMException('bad', 'NotSupportedError');
    this.mimeType = options?.mimeType ?? '';
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.ondataavailable?.({ data: new Blob(['x']) });
    this.state = 'inactive';
    this.onstop?.(new Event('stop'));
  }
}

function install(getUserMedia: () => Promise<MediaStream>) {
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  URL.createObjectURL = vi.fn(() => 'blob:rec');
  URL.revokeObjectURL = vi.fn();
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeMediaRecorder.fail = false;
});

describe('createWebRecorder', () => {
  it('is unsupported without MediaRecorder/getUserMedia', async () => {
    vi.stubGlobal('navigator', {});
    const r = createWebRecorder();
    expect(r.supported).toBe(false);
    await expect(r.start()).rejects.toEqual(new RecorderError('unsupported'));
  });

  it('records in memory, releases the mic on stop and disposes the URL', async () => {
    const { stream, track } = fakeStream();
    install(() => Promise.resolve(stream));
    const session = await createWebRecorder().start();
    const rec = await session.stop();
    expect(track.stop).toHaveBeenCalled();
    expect(rec?.url).toBe('blob:rec');
    rec?.dispose();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:rec');
  });

  it.each([
    ['NotAllowedError', 'denied'],
    ['NotFoundError', 'no-mic'],
    ['AbortError', 'unknown'],
  ])('maps getUserMedia %s to %s', async (name, code) => {
    install(() => Promise.reject(new DOMException('x', name)));
    await expect(createWebRecorder().start()).rejects.toEqual(new RecorderError(code as never));
  });

  it('releases the microphone when MediaRecorder cannot start', async () => {
    const { stream, track } = fakeStream();
    install(() => Promise.resolve(stream));
    FakeMediaRecorder.fail = true;
    await expect(createWebRecorder().start()).rejects.toEqual(new RecorderError('unknown'));
    expect(track.stop).toHaveBeenCalled();
  });
});
