/**
 * Calendar-day keys ("YYYY-MM-DD") in the user's local time zone.
 * All scheduling and streak logic compares these strings instead of Date objects.
 */

export type DateKey = string;

const KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function toDateKey(date: Date): DateKey {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parts(key: DateKey): [number, number, number] | null {
  const m = KEY_PATTERN.exec(key);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = new Date(Date.UTC(y, mo - 1, d));
  const valid =
    utc.getUTCFullYear() === y && utc.getUTCMonth() === mo - 1 && utc.getUTCDate() === d;
  return valid ? [y, mo, d] : null;
}

export function isDateKey(key: string): boolean {
  return parts(key) !== null;
}

// UTC arithmetic avoids DST shifts; keys carry no time zone, so this is exact.
function toUtcMs(key: DateKey): number {
  const p = parts(key);
  if (!p) throw new RangeError(`Invalid date key: ${key}`);
  return Date.UTC(p[0], p[1] - 1, p[2]);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = new Date(toUtcMs(key) + days * DAY_MS);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Number of days from `a` to `b` (positive when b is later). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}
