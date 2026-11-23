// Dates said for people: the moment a value names, the day it falls on where the page is, and how a day and a
// moment are said in a language (day-label, time-ago), and how a machine reads them (<time datetime>). No DOM
// here, so the tests run it in Node.

import { K, text, native, value, string, date, utcDayMs, daysOf, type Cell, type StringCell } from '../core/index.ts';
import { activeLanguage } from './locale.ts';

const NS_PER_MS = 1e6;

/**
 * The moment a clock where the page is reads a calendar date and a time of day in nanoseconds: the clock's
 * own reading, so a day when the clocks change is right. new Date(y, m, d) would read 0 to 99 as 19xx.
 */
function localMs(y: number, m: number, d: number, ns = 0): number {
  const t = new Date(2000, 0, 1);
  t.setFullYear(y, m - 1, d);
  t.setHours(0, 0, 0, ns / NS_PER_MS);
  return t.getTime();
}

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
    if (d.time === null) return { ms: localMs(d.y, d.m, d.d), allDay: true };
    if (d.zone !== null) return { ms: utcDayMs(d.y, d.m, d.d) + d.time / NS_PER_MS - d.zone * 60000, allDay: false };
    return { ms: localMs(d.y, d.m, d.d, d.time), allDay: false };
  }
  if (v.t === K.String) {
    const s = text(v as StringCell).trim();
    if (!ISO.test(s)) return null;
    if (s.length === 10) {
      const [y, m, d] = s.split('-').map(Number);
      return { ms: localMs(y!, m!, d!), allDay: true };
    }
    const ms = Date.parse(s.replace(' ', 'T'));
    return Number.isNaN(ms) ? null : { ms, allDay: false };
  }
  return null;
}

/** How many days from one day to another, counting midnights where the page is. */
function daysBetween(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  // counted with daysOf: Date.UTC would read the years 0 to 99 as 19xx
  return daysOf(b.getFullYear(), b.getMonth() + 1, b.getDate()) - daysOf(a.getFullYear(), a.getMonth() + 1, a.getDate());
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

const DAY_NS = 24 * 3600 * 1e9;
const two = (n: number): string => String(n).padStart(2, '0');

/** A time of day as HTML's datetime writes it: 09:30, 09:30:15, 09:30:15.250. Below a millisecond is cut, never
 * rounded, so the last instant of a day stays 23:59:59.999 and never becomes 24:00. */
function clockIso(ns: number): string {
  const ms = Math.floor(ns / NS_PER_MS);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, frac = ms % 1000;
  let out = `${two(h)}:${two(m)}`;
  if (s !== 0 || frac !== 0) out += `:${two(s)}`;
  if (frac !== 0) out += `.${String(frac).padStart(3, '0')}`;
  return out;
}

/**
 * A date! or a time of day as HTML's datetime writes it, so a machine reads the moment a text shows:
 * 2026-11-23, 2026-11-23T09:30, 2026-11-23T09:30+02:00, 09:30. Null for anything else.
 */
export function isoOf(v: Cell): string | null {
  if (v.t === K.Time) return v.v >= 0 && v.v < DAY_NS ? clockIso(v.v) : null;
  if (v.t !== K.Date) return null;
  const d = v.v;
  if (d.y < 1 || d.y > 9999) return null;
  let out = `${String(d.y).padStart(4, '0')}-${two(d.m)}-${two(d.d)}`;
  if (d.time === null) return out;
  out += `T${clockIso(d.time)}`;
  if (d.zone !== null) {
    const z = Math.abs(d.zone);
    out += `${d.zone < 0 ? '-' : '+'}${two(Math.floor(z / 60))}:${two(z % 60)}`;
  }
  return out;
}

/** A date! said in full in a language, as its clock reads it: Monday, November 23, 2026 at 9:30 AM. Null for anything else. */
export function fullDateText(v: Cell, lang: string): string | null {
  if (v.t !== K.Date || v.v.y < 100) return null;
  const d = v.v;
  const ms = utcDayMs(d.y, d.m, d.d) + (d.time ?? 0) / NS_PER_MS;
  const opts: Intl.DateTimeFormatOptions = { dateStyle: 'full', timeZone: 'UTC' };
  if (d.time !== null) opts.timeStyle = 'short';
  try { return new Intl.DateTimeFormat(lang, opts).format(ms); } catch { return null; }
}

// The zone of the result is the clock's own at that moment, so the moment is never lost: in the hour the clocks go
// back, 1:45-4:00 and 1:15-5:00 are told apart and ordered as they happened.
native('local-date', '["The same moment as the clock where the page is reads it then, with that clock\'s zone: in New York 1-Jul-2026/4:30+0:00 is 1-Jul-2026/0:30-4:00, and 1-Dec-2026/4:30+0:00 is 30-Nov-2026/23:30-5:00. A date with no zone is the time on that clock, and gets its zone: 1-Jul-2026/0:30 is 1-Jul-2026/0:30-4:00; a time the clock skips when it goes forward is read an hour on, 8-Mar-2026/2:30 is 8-Mar-2026/3:30-4:00. A date with no time stays as it is." date [date!]]', (_t, f) => {
  const v = f.args[0]!;
  if (v.t !== K.Date || v.v.time === null) return value(v);
  const moment = momentOf(v)!.ms;
  // a zone holds whole minutes; an old one of the clock in seconds (Madrid in 1890 was -0:14:44) is cut to
  // them, and the time is read from the moment with that zone, so the moment stays exact
  const zone = Math.trunc(-new Date(moment).getTimezoneOffset());
  const at = new Date(moment + zone * 60000);
  const ms = ((at.getUTCHours() * 60 + at.getUTCMinutes()) * 60 + at.getUTCSeconds()) * 1000 + at.getUTCMilliseconds();
  const time = ms * NS_PER_MS + v.v.time % NS_PER_MS;
  return value(date({ y: at.getUTCFullYear(), m: at.getUTCMonth() + 1, d: at.getUTCDate(), time, zone }));
});

native('day-label', '["The day of a date said in the active language, from today where the page is: Today, Yesterday, Tomorrow, or its weekday and date, with the year when it is another." date [date!]]', (t, f) => {
  const at = momentOf(f.args[0]!)!;
  return value(string(dayLabel(at.ms, Date.now(), activeLanguage(t.rt))));
});

native('time-ago', '["How long ago a date was, or how long until it, in the active language: now, 5 minutes ago, 3 hours ago, in 2 days. A date with no time is said in days." date [date!]]', (t, f) => {
  const at = momentOf(f.args[0]!)!;
  return value(string(relativeText(at, Date.now(), activeLanguage(t.rt))));
});
