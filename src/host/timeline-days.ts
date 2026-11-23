// The rows of a timeline: the moment each one happened, the order they go in, the days they fall under,
// and how a day and a moment are said in a language. No DOM here, so the tests run it in Node.

import { K, text, type Cell, type Sym, type StringCell } from '../core/index.ts';
import { rowField } from './rows.ts';

const NS_PER_MS = 1e6;

/** When a row happened: the moment in milliseconds since 1970, and whether it was a whole day, with no time. */
export interface Moment { ms: number; allDay: boolean }

/** A date written in ISO form, as servers send it: 2026-11-23, 2026-11-23T09:30, 2026-11-23T09:30:00Z. */
const ISO = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * The moment a value names: a date! (with a zone it is that moment anywhere; without one, it is the time on the
 * clock where the page is), or a text in ISO form. Anything else is no moment.
 */
export function momentOf(v: Cell): Moment | null {
  if (v.t === K.Date) {
    const d = v.v;
    if (d.time === null) return { ms: new Date(d.y, d.m - 1, d.d).getTime(), allDay: true };
    if (d.zone !== null) return { ms: Date.UTC(d.y, d.m - 1, d.d) + d.time / NS_PER_MS - d.zone * 60000, allDay: false };
    const local = new Date(d.y, d.m - 1, d.d);
    return { ms: local.getTime() + d.time / NS_PER_MS, allDay: false };
  }
  if (v.t === K.String) {
    const s = text(v as StringCell).trim();
    if (!ISO.test(s)) return null;
    if (s.length === 10) {
      const [y, m, d] = s.split('-').map(Number);
      return { ms: new Date(y!, m! - 1, d!).getTime(), allDay: true };
    }
    const ms = Date.parse(s.replace(' ', 'T'));
    return Number.isNaN(ms) ? null : { ms, allDay: false };
  }
  return null;
}

/** The day a moment falls on where the page is, as a number that orders days: 20261123. */
export function dayOf(ms: number): number {
  const d = new Date(ms);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** How many days from one day to another, counting midnights where the page is. */
function daysBetween(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}

/** A row of a timeline with its moment; rows with no moment have none. */
export interface Dated { row: Cell; at: Moment | null }

/** The rows of a day: its number (0 for the rows with no moment) and its rows in order. */
export interface Day { day: number; ms: number; rows: Dated[] }

/**
 * The rows under their days, newest first or oldest first, the rows of a day in the same order; rows at the same
 * moment keep the order of the data. Rows with no moment go last, as they come, under no day.
 */
export function timelineDays(rows: Cell[], field: Sym, newest: boolean): Day[] {
  const dated: Dated[] = rows.map(row => ({ row, at: momentOf(rowField(row, field)) }));
  const known = dated.filter(r => r.at !== null);
  const sign = newest ? -1 : 1;
  // a whole day goes before the times of that day when oldest first, after them when newest first
  const key = (r: Dated): number => r.at!.ms + (r.at!.allDay ? 0 : 0.5);
  known.sort((a, b) => sign * (key(a) - key(b)));
  const days: Day[] = [];
  for (const r of known) {
    const day = dayOf(r.at!.ms);
    const last = days[days.length - 1];
    if (last !== undefined && last.day === day) last.rows.push(r);
    else days.push({ day, ms: r.at!.ms, rows: [r] });
  }
  const unknown = dated.filter(r => r.at === null);
  if (unknown.length > 0) days.push({ day: 0, ms: 0, rows: unknown });
  return days;
}

/** A text with its first letter in capitals, as a heading starts: "today" -> "Today". */
function capital(s: string, lang: string): string {
  const [first = '', ...rest] = [...s];
  let up = first;
  try { up = first.toLocaleUpperCase(lang); } catch { up = first.toUpperCase(); }
  return up + rest.join('');
}

function safe(f: () => string, fallback: string): string {
  try { return f(); } catch { return fallback; }
}

/**
 * The heading of a day in a language, from where the page is now: Today, Yesterday, Tomorrow; a day of this
 * year by its weekday and date, Saturday, 21 November; of another year, with the year.
 */
export function dayLabel(ms: number, now: number, lang: string): string {
  const n = daysBetween(now, ms);
  if (Math.abs(n) <= 1) {
    return capital(safe(() => new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(n, 'day'),
      new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(n, 'day')), lang);
  }
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  if (new Date(ms).getFullYear() !== new Date(now).getFullYear()) opts.year = 'numeric';
  return capital(safe(() => new Intl.DateTimeFormat(lang, opts).format(ms), new Date(ms).toDateString()), lang);
}

/** The time on the clock of a moment, where the page is: 9:30, 09:30 or 9:30 AM, as the language writes it. */
export function clockText(ms: number, lang: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return safe(() => new Intl.DateTimeFormat(lang, opts).format(ms), new Date(ms).toTimeString().slice(0, 5));
}

/**
 * The time a row of a timeline shows: none for a whole day, as its day says it; with relative, how long ago it
 * was while that is under a day (5 minutes ago), else the time on the clock, since the day is said above it.
 */
export function timeText(at: Moment, now: number, lang: string, relative: boolean): string | null {
  if (at.allDay) return null;
  return relative && Math.abs(at.ms - now) < 86400000 ? relativeText(at, now, lang) : clockText(at.ms, lang);
}

/**
 * How long ago a moment was, or how long until it, in a language: now, 5 minutes ago, 3 hours ago, yesterday,
 * in 2 days. A whole day is said in days.
 */
export function relativeText(at: Moment, now: number, lang: string): string {
  const say = (n: number, unit: Intl.RelativeTimeFormatUnit): string =>
    safe(() => new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(n, unit),
      new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(n, unit));
  if (at.allDay) return say(daysBetween(now, at.ms), 'day');
  const s = (at.ms - now) / 1000;
  const a = Math.abs(s);
  const r = (x: number): number => Math.sign(s) * Math.max(1, Math.floor(x));
  if (a < 45) return say(0, 'second');
  if (a < 3570) return say(Math.sign(s) * Math.max(1, Math.round(a / 60)), 'minute');
  if (a < 86400) return say(r(a / 3600), 'hour');
  const days = daysBetween(now, at.ms);
  if (Math.abs(days) < 7) return say(days, 'day');
  if (Math.abs(days) < 30) return say(r(a / (7 * 86400)), 'week');
  if (Math.abs(days) < 365) return say(r(a / (30 * 86400)), 'month');
  return say(r(a / (365 * 86400)), 'year');
}
