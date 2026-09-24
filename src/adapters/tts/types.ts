export interface VoiceInfo {
  uri: string;
  name: string;
  lang: string;
}

export interface SpeakOptions {
  rate: number;
  voiceURI?: string | undefined;
  lang?: string;
  onEnd?: () => void;
}

/** Platform boundary for text-to-speech. */
export interface Tts {
  readonly supported: boolean;
  /** Must be called synchronously inside a user gesture handler (iOS). */
  speak(text: string, options: SpeakOptions): void;
  cancel(): void;
  /** English voices available on this device. */
  voices(): VoiceInfo[];
  /** Subscribe to voice list changes (voices load asynchronously). Returns an unsubscribe fn. */
  onVoicesChanged(listener: () => void): () => void;
}
