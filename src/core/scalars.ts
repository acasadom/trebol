// Number-like tokens: integer, decimal, percent, money, pair, tuple, time and date.
//
// Pure functions on the token text, used by the lexer for a value on its own and for a path
// segment. A malformed token that is clearly meant as one of these gives an error message;
// a token that is none of them gives null.

import * as I64 from './int64.ts';
import { parseDec } from './dec.ts';
import {
  integer, decimal, percent, money, pair, tuple, date, time, type Cell, type DateVal,
} from './values.ts';

const NUM = String.raw`[+-]?(?:\d[\d']*(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?`;

export const NUMBER_RE = {
  integer: /^[+-]?\d[\d']*$/,
  decimal: new RegExp(`^${NUM}$`, 'i'),
  percent: new RegExp(`^(${NUM})%$`, 'i'),
  pair: new RegExp(`^(${NUM})x(${NUM})$`, 'i'),
  tuple: /^\d+(?:\.\d+){2,11}$/,
  time: /^([+-]?)(\d+):(\d+)(?::(\d+(?:[.,]\d+)?))?$/,
  date: /^(\d+)([-/])([A-Za-z]+|\d+)\2(\d+)(?:[/T](.+))?$/,
  dateTime: /^(\d+):(\d+)(?::(\d+(?:[.,]\d+)?))?(Z|[+-]\d{1,2}(?::?\d{2})?)?$/i,
  money: /^([+-]?)([A-Za-z]{3})?\$([+-]?)(\d[\d']*(?:[.,]\d*)?|[.,]\d+)$/,
} as const;

const RE = NUMBER_RE;

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
];

const NS_PER_SEC = 1e9;

/** Numbers, money, percent, pair, tuple, time and date: the cell, an error message, or null if none matches. */
export function scalarOf(text: string): Cell | string | null {
  let m: RegExpExecArray | null;
  if (RE.integer.test(text)) {
    const v = I64.parse(text);
    return v === null ? `integer out of 64-bit range: ${text}` : integer(v);
  }
  if (RE.decimal.test(text)) return decimal(num(text));
  if ((m = RE.percent.exec(text))) return percent(shiftDecimal(m[1]!, -2));
  if ((m = RE.money.exec(text))) {
    const v = parseDec(m[4]!)!;
    const negative = (m[1] === '-') !== (m[3] === '-');
    return money(negative ? { d: -v.d, e: v.e } : v, (m[2] ?? '').toUpperCase());
  }
  if ((m = RE.pair.exec(text))) return pair(num(m[1]!), num(m[2]!));
  if (RE.tuple.test(text)) {
    const parts = text.split('.').map(Number);
    if (parts.some(p => p > 255)) return `tuple values must be 0-255: ${text}`;
    return tuple(parts);
  }
  if ((m = RE.time.exec(text))) {
    const ns = timeNs(m[2]!, m[3]!, m[4]);
    return time(m[1] === '-' ? -ns : ns);
  }
  if ((m = RE.date.exec(text))) return dateCell(m, text);
  return null;
}

function dateCell(m: RegExpExecArray, text: string): Cell | string {
  const [, a, , monthText, b, rest] = m;
  let y: number;
  let d: number;
  if (a!.length >= 3) { y = Number(a); d = Number(b); } else { d = Number(a); y = b!.length <= 2 ? fullYear(Number(b)) : Number(b); }
  let mon: number;
  if (/^\d+$/.test(monthText!)) {
    mon = Number(monthText);
  } else {
    const lower = monthText!.toLowerCase();
    mon = lower.length >= 3 ? MONTHS.findIndex(n => n.startsWith(lower)) + 1 : 0;
  }
  if (mon < 1 || mon > 12 || d < 1 || d > daysInMonth(y, mon)) return `invalid date: ${text}`;
  const v: DateVal = { y, m: mon, d, time: null, zone: null };
  if (rest !== undefined) {
    const t = RE.dateTime.exec(rest);
    if (!t) return `invalid time in date: ${text}`;
    v.time = timeNs(t[1]!, t[2]!, t[3]);
    if (t[4] !== undefined) v.zone = parseZone(t[4]);
  }
  return date(v);
}

function num(text: string): number {
  return Number(text.replace(/'/g, '').replace(',', '.'));
}

/** The number in `text` times 10^shift, rounded once (15% is exactly 0.15). */
function shiftDecimal(text: string, shift: number): number {
  const clean = text.replace(/'/g, '').replace(',', '.');
  const m = /^(.*?)(?:e([+-]?\d+))?$/i.exec(clean)!;
  return Number(`${m[1]}e${Number(m[2] ?? 0) + shift}`);
}

/**
 * The year a year of one or two digits names, as R3 reads it: the one at most 50 years from now, so in 2026
 * 1-Jan-76 is 2076 and 1-Jan-77 is 1977. Three digits or more are the year as written: 1-Jan-0099 is 99.
 */
export function fullYear(n: number, thisYear = new Date().getUTCFullYear()): number {
  const last = thisYear + 50;
  const y = Math.floor(last / 100) * 100 + n;
  return y > last ? y - 100 : y;
}

function daysInMonth(y: number, m: number): number {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

function timeNs(h: string, m: string, sec: string | undefined): number {
  const seconds = Number(h) * 3600 + Number(m) * 60;
  const frac = sec === undefined ? 0 : num(sec);
  // Round to whole nanoseconds to keep values exact and comparable.
  return Math.round(seconds * NS_PER_SEC + frac * NS_PER_SEC);
}

function parseZone(z: string): number {
  if (z === 'Z' || z === 'z') return 0;
  const m = /^([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(z)!;
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === '-' ? -minutes : minutes;
}
