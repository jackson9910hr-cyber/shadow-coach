import type { SpeakOptions, Tts, VoiceInfo } from './types';

/** Prefer natural-sounding US voices commonly shipped on iOS/macOS. */
const PREFERRED = ['Samantha', 'Ava', 'Allison', 'Susan', 'Alex', 'Google US English'];

function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
  voiceURI?: string,
): SpeechSynthesisVoice | undefined {
  if (voiceURI) {
    const chosen = voices.find((v) => v.voiceURI === voiceURI);
    if (chosen) return chosen;
  }
  const exact = voices.filter((v) => v.lang.replace('_', '-') === lang);
  for (const name of PREFERRED) {
    const hit = exact.find((v) => v.name.startsWith(name));
    if (hit) return hit;
  }
  return (
    exact.find((v) => v.localService) ?? exact[0] ?? voices.find((v) => v.lang.startsWith('en'))
  );
}

export function createWebTts(synth: SpeechSynthesis | undefined = globalThis.speechSynthesis): Tts {
  const english = (): SpeechSynthesisVoice[] =>
    synth ? synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en')) : [];

  return {
    supported: Boolean(synth) && typeof SpeechSynthesisUtterance !== 'undefined',
    speak(text: string, { rate, voiceURI, lang = 'en-US', onEnd }: SpeakOptions) {
      if (!synth) {
        onEnd?.();
        return;
      }
      // Cancel first: iOS queues utterances and can get stuck behind a paused one.
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = rate;
      const voice = pickVoice(english(), lang, voiceURI);
      if (voice) u.voice = voice;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        onEnd?.();
      };
      u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
    },
    cancel() {
      synth?.cancel();
    },
    voices(): VoiceInfo[] {
      return english().map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang }));
    },
    onVoicesChanged(listener) {
      if (!synth) return () => {};
      synth.addEventListener('voiceschanged', listener);
      return () => synth.removeEventListener('voiceschanged', listener);
    },
  };
}
