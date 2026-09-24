import {
  createWebRecognizer,
  findRecognitionCtor,
  type WebSpeechRecognition,
} from './webRecognizer';

class FakeRecognition implements WebSpeechRecognition {
  static last: FakeRecognition;
  lang = '';
  continuous = true;
  interimResults = false;
  maxAlternatives = 1;
  onresult: WebSpeechRecognition['onresult'] = null;
  onerror: WebSpeechRecognition['onerror'] = null;
  onend: WebSpeechRecognition['onend'] = null;
  started = false;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onerror?.({ error: 'aborted' });
    this.onend?.();
  }
  emit(alts: string[][], isFinal: boolean) {
    const results = alts.map((a, i) =>
      Object.assign(
        a.map((transcript) => ({ transcript })),
        { isFinal: i === alts.length - 1 ? isFinal : true },
      ),
    );
    this.onresult?.({ results: results as never });
  }
}

const handlers = () => ({ onInterim: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() });

describe('findRecognitionCtor', () => {
  it('prefers the standard constructor, falls back to webkit, else null', () => {
    const A = function A() {};
    const B = function B() {};
    expect(findRecognitionCtor({ SpeechRecognition: A, webkitSpeechRecognition: B })).toBe(A);
    expect(findRecognitionCtor({ webkitSpeechRecognition: B })).toBe(B);
    expect(findRecognitionCtor({})).toBeNull();
  });
});

describe('createWebRecognizer', () => {
  it('reports unsupported and fails gracefully without a constructor', () => {
    const r = createWebRecognizer(null);
    expect(r.supported).toBe(false);
    const h = handlers();
    r.start('en-US', h).stop();
    expect(h.onError).toHaveBeenCalledWith('unknown');
    expect(h.onEnd).toHaveBeenCalled();
  });

  it('configures single-utterance recognition and delivers interim then final alternatives', () => {
    const h = handlers();
    createWebRecognizer(FakeRecognition).start('en-US', h);
    const rec = FakeRecognition.last;
    expect(rec).toMatchObject({
      lang: 'en-US',
      continuous: false,
      interimResults: true,
      maxAlternatives: 3,
      started: true,
    });

    rec.emit([['we love']], false);
    expect(h.onInterim).toHaveBeenCalledWith('we love');

    rec.emit([['we love him', 'we loved him', 'we love him']], true);
    rec.stop();
    expect(h.onFinal).toHaveBeenCalledTimes(1);
    expect(h.onFinal).toHaveBeenCalledWith(['we love him', 'we loved him']);
    expect(h.onEnd).toHaveBeenCalledTimes(1);
  });

  it('joins multiple result chunks per alternative', () => {
    const h = handlers();
    createWebRecognizer(FakeRecognition).start('en-US', h);
    FakeRecognition.last.emit(
      [['rejoice always'], ['pray without ceasing', 'pray with out ceasing']],
      true,
    );
    expect(h.onFinal).toHaveBeenCalledWith([
      'rejoice always pray without ceasing',
      'rejoice always pray with out ceasing',
    ]);
  });

  it('delivers the last interim result as final when iOS never flags isFinal', () => {
    const h = handlers();
    const session = createWebRecognizer(FakeRecognition).start('en-US', h);
    FakeRecognition.last.emit([['good morning']], false);
    session.stop();
    expect(h.onFinal).toHaveBeenCalledWith(['good morning']);
  });

  it('reports no-speech when the session ends with nothing heard', () => {
    const h = handlers();
    createWebRecognizer(FakeRecognition).start('en-US', h).stop();
    expect(h.onError).toHaveBeenCalledWith('no-speech');
    expect(h.onFinal).not.toHaveBeenCalled();
  });

  it.each([
    ['not-allowed', 'denied'],
    ['service-not-allowed', 'denied'],
    ['network', 'network'],
    ['audio-capture', 'no-mic'],
    ['bad-grammar', 'unknown'],
  ])('maps error %s -> %s once', (raw, code) => {
    const h = handlers();
    createWebRecognizer(FakeRecognition).start('en-US', h);
    FakeRecognition.last.onerror?.({ error: raw });
    FakeRecognition.last.stop();
    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onError).toHaveBeenCalledWith(code);
  });

  it('abort discards results and reports no error', () => {
    const h = handlers();
    const session = createWebRecognizer(FakeRecognition).start('en-US', h);
    FakeRecognition.last.emit([['half']], false);
    session.abort();
    expect(h.onFinal).not.toHaveBeenCalled();
    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onEnd).toHaveBeenCalled();
  });

  it('auto-stops after the listening time limit', () => {
    vi.useFakeTimers();
    const h = handlers();
    createWebRecognizer(FakeRecognition).start('en-US', h);
    FakeRecognition.last.emit([['long']], false);
    vi.advanceTimersByTime(15_000);
    expect(h.onFinal).toHaveBeenCalledWith(['long']);
    vi.useRealTimers();
  });
});
