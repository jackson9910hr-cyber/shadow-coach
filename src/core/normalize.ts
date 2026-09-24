/**
 * Text normalization for comparing a reference sentence with a speech-recognition transcript.
 * Both sides go through the same pipeline so that surface differences the recognizer
 * introduces (case, punctuation, contractions, digits) do not count as mistakes.
 */

export interface Token {
  /** Normalized word used for comparison. */
  word: string;
  /** Index of the display word (whitespace-split original text) this token came from. */
  source: number;
}

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function below1000(n: number): string[] {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) words.push(ONES[hundreds] as string, 'hundred');
  if (rest >= 20) {
    words.push(TENS[Math.floor(rest / 10)] as string);
    if (rest % 10 > 0) words.push(ONES[rest % 10] as string);
  } else if (rest > 0 || hundreds === 0) {
    words.push(ONES[rest] as string);
  }
  return words;
}

/** Converts an integer in [0, 999999] to space-separated English words, else null. */
export function numberToWords(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) return null;
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  if (thousands === 0) return below1000(rest).join(' ');
  const words = [...below1000(thousands), 'thousand'];
  if (rest > 0) words.push(...below1000(rest));
  return words.join(' ');
}

const IRREGULAR_ORDINALS: Record<string, string> = {
  one: 'first',
  two: 'second',
  three: 'third',
  five: 'fifth',
  eight: 'eighth',
  nine: 'ninth',
  twelve: 'twelfth',
};

function ordinalize(words: string): string {
  const parts = words.split(' ');
  const last = parts.pop() as string;
  const ordinal =
    IRREGULAR_ORDINALS[last] ?? (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return [...parts, ordinal].join(' ');
}

/** Whole-word contractions that suffix rules cannot handle. */
const WHOLE_CONTRACTIONS: Record<string, string> = {
  "won't": 'will not',
  "can't": 'can not',
  cannot: 'can not',
  "shan't": 'shall not',
  "let's": 'let us',
  "y'all": 'you all',
  "ain't": 'is not',
};

/** `'s` is only expanded to `is` after these words; elsewhere it is treated as possessive. */
const S_IS_BASES = new Set([
  'it',
  'that',
  'there',
  'here',
  'what',
  'where',
  'who',
  'how',
  'he',
  'she',
  'when',
  'why',
]);

const SUFFIXES: [string, string][] = [
  ["n't", ' not'],
  ["'re", ' are'],
  ["'ve", ' have'],
  ["'ll", ' will'],
  ["'d", ' would'],
  ["'m", ' am'],
];

const ALIASES: Record<string, string> = { ok: 'okay' };

function expandContraction(word: string): string {
  const whole = WHOLE_CONTRACTIONS[word];
  if (whole) return whole;
  for (const [suffix, expansion] of SUFFIXES) {
    if (word.endsWith(suffix) && word.length > suffix.length) {
      return word.slice(0, -suffix.length) + expansion;
    }
  }
  if (word.endsWith("'s")) {
    const base = word.slice(0, -2);
    if (S_IS_BASES.has(base)) return `${base} is`;
  }
  return word;
}

function convertNumeric(part: string): string | null {
  const time = /^(\d{1,2}):(\d{2})$/.exec(part);
  if (time) {
    const hour = numberToWords(Number(time[1])) as string;
    const minute = Number(time[2]);
    if (minute === 0) return hour;
    const minuteWords = numberToWords(minute) as string;
    return minute < 10 ? `${hour} oh ${minuteWords}` : `${hour} ${minuteWords}`;
  }
  const percent = /^(\d[\d,]*)%$/.exec(part);
  if (percent) {
    const words = convertNumeric(percent[1] as string);
    return `${words ?? percent[1]} percent`;
  }
  const ordinal = /^(\d+)(?:st|nd|rd|th)$/.exec(part);
  if (ordinal) {
    const words = numberToWords(Number(ordinal[1]));
    return words ? ordinalize(words) : null;
  }
  const decimal = /^(\d+)\.(\d+)$/.exec(part);
  if (decimal) {
    const whole = numberToWords(Number(decimal[1]));
    const fraction = [...(decimal[2] as string)].map((d) => ONES[Number(d)]).join(' ');
    return whole ? `${whole} point ${fraction}` : null;
  }
  if (/^\d{1,3}(,\d{3})+$|^\d+$/.test(part)) {
    return numberToWords(Number(part.replace(/,/g, '')));
  }
  return null;
}

function normalizeDisplayWord(display: string): string[] {
  const cleaned = display
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/&/g, ' and ')
    // Trim punctuation at the edges but keep inner ':', '.', ',', '%', "'" for numbers/contractions.
    .replace(/^[^a-z0-9]+|[^a-z0-9%]+$/g, '');
  const out: string[] = [];
  for (const part of cleaned.split(/[\s\-–—/]+/)) {
    const trimmed = part.replace(/^[^a-z0-9]+|[^a-z0-9%]+$/g, '');
    if (!trimmed) continue;
    const expanded = convertNumeric(trimmed) ?? expandContraction(trimmed);
    for (const raw of expanded.split(' ')) {
      const word = raw.replace(/[^a-z0-9]/g, '');
      if (word) out.push(ALIASES[word] ?? word);
    }
  }
  return out;
}

/** Splits text into display words (what the UI renders and highlights). */
export function splitDisplayWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Normalized tokens with a back-reference to their display word. */
export function tokenize(text: string): Token[] {
  return splitDisplayWords(text).flatMap((display, source) =>
    normalizeDisplayWord(display).map((word) => ({ word, source })),
  );
}

/** Normalized comparison words only. */
export function toWords(text: string): string[] {
  return tokenize(text).map((t) => t.word);
}
