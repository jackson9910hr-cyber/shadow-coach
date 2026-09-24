export const CATEGORIES = ['business', 'church', 'daily'] as const;
/** Id of the bundled set; imported sets may not reuse it. */
export const DEFAULT_SET_ID = 'default-v1';

/** Limits keep imported files from freezing the UI (see docs/review-stage4.md S7). */
export const LIMITS = {
  sentences: 2000,
  text: 500,
  title: 120,
  tags: 20,
  tag: 40,
  errors: 20,
} as const;

/** Ids are joined as `${setId}/${sentenceId}`, so '/' and other separators are not allowed. */
const ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const ID_MESSAGE = 'must match [A-Za-z0-9_.-]{1,64}';
export type Category = (typeof CATEGORIES)[number];

export interface Sentence {
  id: string;
  text: string;
  category: Category;
  /** Korean meaning. */
  ko?: string;
  tags?: string[];
  /** Attribution, e.g. "Philippians 4:13 (WEB)". */
  source?: string;
}

export interface SentenceSet {
  id: string;
  title: string;
  version: number;
  sentences: Sentence[];
}

export type ParseResult = { ok: true; set: SentenceSet } | { ok: false; errors: string[] };

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function parseSentence(raw: unknown, path: string, errors: string[]): Sentence | null {
  if (!isObject(raw)) {
    errors.push(`${path} must be an object`);
    return null;
  }
  const before = errors.length;
  if (!isNonEmptyString(raw.id)) errors.push(`${path}.id must be a non-empty string`);
  else if (!ID_PATTERN.test(raw.id)) errors.push(`${path}.id ${ID_MESSAGE}`);
  if (!isNonEmptyString(raw.text)) errors.push(`${path}.text must be a non-empty string`);
  else if (raw.text.length > LIMITS.text) {
    errors.push(`${path}.text must be at most ${LIMITS.text} characters`);
  }
  if (!CATEGORIES.includes(raw.category as Category)) {
    errors.push(`${path}.category must be one of ${CATEGORIES.join(', ')}`);
  }
  for (const key of ['ko', 'source'] as const) {
    const value = raw[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') errors.push(`${path}.${key} must be a string`);
    else if (value.length > LIMITS.text) {
      errors.push(`${path}.${key} must be at most ${LIMITS.text} characters`);
    }
  }
  if (raw.tags !== undefined) {
    if (!(Array.isArray(raw.tags) && raw.tags.every((t) => typeof t === 'string'))) {
      errors.push(`${path}.tags must be an array of strings`);
    } else if (raw.tags.length > LIMITS.tags || raw.tags.some((t) => t.length > LIMITS.tag)) {
      errors.push(
        `${path}.tags must have at most ${LIMITS.tags} items of up to ${LIMITS.tag} characters`,
      );
    }
  }
  if (errors.length > before) return null;

  const sentence: Sentence = {
    id: raw.id as string,
    text: (raw.text as string).trim(),
    category: raw.category as Category,
  };
  if (raw.ko !== undefined) sentence.ko = raw.ko as string;
  if (raw.tags !== undefined) sentence.tags = [...(raw.tags as string[])];
  if (raw.source !== undefined) sentence.source = raw.source as string;
  return sentence;
}

/** Validates an untrusted sentence set (object or JSON string). */
export function parseSentenceSet(input: unknown): ParseResult {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return { ok: false, errors: ['Invalid JSON'] };
    }
  }
  if (!isObject(data)) return { ok: false, errors: ['Set must be an object'] };

  const errors: string[] = [];
  if (!isNonEmptyString(data.id)) errors.push('id must be a non-empty string');
  else if (!ID_PATTERN.test(data.id)) errors.push(`id ${ID_MESSAGE}`);
  if (!isNonEmptyString(data.title)) errors.push('title must be a non-empty string');
  else if (data.title.length > LIMITS.title) {
    errors.push(`title must be at most ${LIMITS.title} characters`);
  }
  if (!(Number.isInteger(data.version) && (data.version as number) > 0)) {
    errors.push('version must be a positive integer');
  }
  if (!Array.isArray(data.sentences) || data.sentences.length === 0) {
    errors.push('sentences must be a non-empty array');
    return { ok: false, errors };
  }
  if (data.sentences.length > LIMITS.sentences) {
    return { ok: false, errors: [`sentences must have at most ${LIMITS.sentences} items`] };
  }

  const sentences: Sentence[] = [];
  const seen = new Set<string>();
  for (const [i, raw] of data.sentences.entries()) {
    if (errors.length >= LIMITS.errors) break;
    const s = parseSentence(raw, `sentences[${i}]`, errors);
    if (!s) continue;
    if (seen.has(s.id)) errors.push(`duplicate sentence id "${s.id}"`);
    seen.add(s.id);
    sentences.push(s);
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    set: {
      id: data.id as string,
      title: data.title as string,
      version: data.version as number,
      sentences,
    },
  };
}
