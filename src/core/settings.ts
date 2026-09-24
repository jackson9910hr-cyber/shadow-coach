export type Theme = 'system' | 'light' | 'dark';
export type Grading = 'auto' | 'self';
export const RATES = [0.7, 1] as const;
export type Rate = (typeof RATES)[number];

export interface Settings {
  /** TTS playback rate. */
  rate: Rate;
  theme: Theme;
  /** Show the Korean meaning under each sentence. */
  showKo: boolean;
  /** New sentences introduced per day. */
  newPerDay: number;
  /** 'auto' uses speech recognition when available; 'self' always uses self-grading. */
  grading: Grading;
  /** Preferred TTS voice; absent means automatic selection. */
  voiceURI?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  rate: 1,
  theme: 'system',
  showKo: true,
  newPerDay: 10,
  grading: 'auto',
};

const THEMES: readonly Theme[] = ['system', 'light', 'dark'];
const GRADINGS: readonly Grading[] = ['auto', 'self'];

/** Builds a valid Settings object from untrusted input, falling back to defaults per field. */
export function sanitizeSettings(input: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (typeof input !== 'object' || input === null) return out;
  const raw = input as Record<string, unknown>;
  if (RATES.includes(raw.rate as Rate)) out.rate = raw.rate as Rate;
  if (THEMES.includes(raw.theme as Theme)) out.theme = raw.theme as Theme;
  if (typeof raw.showKo === 'boolean') out.showKo = raw.showKo;
  if (
    Number.isInteger(raw.newPerDay) &&
    (raw.newPerDay as number) >= 0 &&
    (raw.newPerDay as number) <= 50
  ) {
    out.newPerDay = raw.newPerDay as number;
  }
  if (GRADINGS.includes(raw.grading as Grading)) out.grading = raw.grading as Grading;
  if (typeof raw.voiceURI === 'string') out.voiceURI = raw.voiceURI;
  return out;
}
