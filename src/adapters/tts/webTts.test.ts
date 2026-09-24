import { createWebTts } from './webTts';

class FakeUtterance {
  lang = '';
  rate = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {}
}

const voice = (name: string, lang: string, localService = true) =>
  ({ name, lang, voiceURI: `uri:${name}`, localService, default: false }) as SpeechSynthesisVoice;

function fakeSynth(voices: SpeechSynthesisVoice[]) {
  const target = new EventTarget();
  const spoken: FakeUtterance[] = [];
  const synth = {
    getVoices: () => voices,
    speak: vi.fn((u: FakeUtterance) => spoken.push(u)),
    cancel: vi.fn(),
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
  return { synth: synth as unknown as SpeechSynthesis, spoken, raw: synth };
}

beforeAll(() => vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance));
afterAll(() => vi.unstubAllGlobals());

describe('createWebTts', () => {
  const voices = [
    voice('Thomas', 'fr-FR'),
    voice('Daniel', 'en-GB'),
    voice('Fred', 'en-US'),
    voice('Samantha', 'en-US'),
  ];

  it('lists English voices only', () => {
    const { synth } = fakeSynth(voices);
    expect(
      createWebTts(synth)
        .voices()
        .map((v) => v.name),
    ).toEqual(['Daniel', 'Fred', 'Samantha']);
  });

  it('cancels pending speech, then speaks with rate and a preferred en-US voice', () => {
    const { synth, spoken, raw } = fakeSynth(voices);
    const tts = createWebTts(synth);
    expect(tts.supported).toBe(true);
    tts.speak('Hello', { rate: 0.7 });
    expect(raw.cancel).toHaveBeenCalled();
    expect(spoken[0]).toMatchObject({ text: 'Hello', rate: 0.7, lang: 'en-US' });
    expect((spoken[0]?.voice as SpeechSynthesisVoice).name).toBe('Samantha');
  });

  it('honors an explicit voiceURI and falls back when it is missing', () => {
    const { synth, spoken } = fakeSynth(voices);
    const tts = createWebTts(synth);
    tts.speak('a', { rate: 1, voiceURI: 'uri:Daniel' });
    tts.speak('b', { rate: 1, voiceURI: 'uri:gone' });
    expect((spoken[0]?.voice as SpeechSynthesisVoice).name).toBe('Daniel');
    expect((spoken[1]?.voice as SpeechSynthesisVoice).name).toBe('Samantha');
  });

  it('falls back to any local en-US voice, then any English voice, then none', () => {
    const a = fakeSynth([voice('Fred', 'en-US', false), voice('Zed', 'en_US')]);
    createWebTts(a.synth).speak('x', { rate: 1 });
    expect((a.spoken[0]?.voice as SpeechSynthesisVoice).name).toBe('Zed');

    const b = fakeSynth([voice('Daniel', 'en-GB')]);
    createWebTts(b.synth).speak('x', { rate: 1 });
    expect((b.spoken[0]?.voice as SpeechSynthesisVoice).name).toBe('Daniel');

    const c = fakeSynth([]);
    createWebTts(c.synth).speak('x', { rate: 1 });
    expect(c.spoken[0]?.voice).toBeNull();
  });

  it('calls onEnd once on end or error', () => {
    const { synth, spoken } = fakeSynth(voices);
    const onEnd = vi.fn();
    createWebTts(synth).speak('x', { rate: 1, onEnd });
    spoken[0]?.onend?.();
    spoken[0]?.onerror?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('notifies voice changes and unsubscribes', () => {
    const { synth, raw } = fakeSynth(voices);
    const listener = vi.fn();
    const off = createWebTts(synth).onVoicesChanged(listener);
    raw.dispatchEvent(new Event('voiceschanged'));
    off();
    raw.dispatchEvent(new Event('voiceschanged'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('degrades gracefully without speechSynthesis', () => {
    const tts = createWebTts(undefined);
    const onEnd = vi.fn();
    expect(tts.supported).toBe(false);
    tts.speak('x', { rate: 1, onEnd });
    tts.cancel();
    expect(onEnd).toHaveBeenCalled();
    expect(tts.voices()).toEqual([]);
    tts.onVoicesChanged(() => {})();
  });
});
