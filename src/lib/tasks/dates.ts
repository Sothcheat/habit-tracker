/**
 * Calendar-date helpers. Dates are "YYYY-MM-DD" strings, never Date objects:
 * a date column has no time zone, and round-tripping it through Date invites
 * off-by-one bugs at midnight and across DST changes. All arithmetic goes
 * through UTC, where every day is exactly 24 hours.
 */

export type ISODate = string;

const DAY_MS = 86_400_000;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    // en-CA formats as YYYY-MM-DD.
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** The calendar date it currently is in `timeZone` — not in UTC. */
export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  try {
    return formatterFor(timeZone).format(now);
  } catch {
    // An unknown zone name throws; the device's own zone is the best guess.
    return formatterFor(browserTimeZone()).format(now);
  }
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function toUtcMs(date: ISODate): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday, matching tasks.repeat_days and week_start. */
export function weekdayOf(date: ISODate): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

/** "Sep 23, 2026" — formatted from the parts, so no zone can shift the day. */
export function formatDate(date: ISODate): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(toUtcMs(date)));
}
