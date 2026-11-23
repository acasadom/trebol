// The time axis of a chart: rows placed at the moment they name, round steps of the calendar for the axis
// (hours, days, months, years), how each step and each point is said in a language, and which points of a
// long line are worth drawing at the width it has. No DOM here, so the tests run it in Node.

import type { Cell, Sym } from '../core/index.ts';
import { rowField } from './rows.ts';
import { momentOf } from './timeline-days.ts';

/** Rows in the order of their moments, each moment in milliseconds, and whether every one is a whole day. */
export interface Timed { rows: Cell[]; times: number[]; allDay: boolean }

/**
 * The rows of a chart on a time axis, oldest first, when the first column of every row names a moment (a
 * date!, or a text in ISO form); none when one of them does not, and the chart labels its points instead.
 * Rows at the same moment keep the order of the data.
 */
export function byTime(rows: Cell[], field: Sym): Timed | null {
  if (rows.length === 0) return null;
  const at: Array<{ row: Cell; ms: number; k: number }> = [];
  let allDay = true;
  for (let k = 0; k < rows.length; k++) {
    const m = momentOf(rowField(rows[k]!, field));
    if (m === null) return null;
    if (!m.allDay) allDay = false;
    at.push({ row: rows[k]!, ms: m.ms, k });
  }
  at.sort((a, b) => a.ms - b.ms || a.k - b.k);
  return { rows: at.map(a => a.row), times: at.map(a => a.ms), allDay };
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type Unit = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

/** The steps an axis may take, shortest first; months and years go by the calendar, not by milliseconds. */
const STEPS: Array<[Unit, number]> = [
  ['second', 1], ['second', 5], ['second', 15], ['second', 30],
  ['minute', 1], ['minute', 5], ['minute', 15], ['minute', 30],
  ['hour', 1], ['hour', 3], ['hour', 6], ['hour', 12],
  ['day', 1], ['day', 2], ['day', 7],
  ['month', 1], ['month', 3], ['month', 6],
  ['year', 1], ['year', 2], ['year', 5], ['year', 10], ['year', 25], ['year', 50], ['year', 100],
];

const LENGTH: Record<Unit, number> = { second: SECOND, minute: MINUTE, hour: HOUR, day: DAY, month: 30 * DAY, year: 365 * DAY };

/** The first step of a unit at or before a moment, on the clock where the page is: 9:15 for 9:17 in steps of 15 minutes. */
function floorTo(ms: number, unit: Unit, n: number): Date {
  const d = new Date(ms);
  switch (unit) {
    case 'second': d.setMilliseconds(0); d.setSeconds(d.getSeconds() - (d.getSeconds() % n)); break;
    case 'minute': d.setSeconds(0, 0); d.setMinutes(d.getMinutes() - (d.getMinutes() % n)); break;
    case 'hour': d.setMinutes(0, 0, 0); d.setHours(d.getHours() - (d.getHours() % n)); break;
    case 'day': d.setHours(0, 0, 0, 0); if (n > 1) d.setDate(d.getDate() - ((d.getDate() - 1) % n)); break;
    case 'month': d.setHours(0, 0, 0, 0); d.setDate(1); d.setMonth(d.getMonth() - (d.getMonth() % n)); break;
    case 'year': d.setHours(0, 0, 0, 0); d.setMonth(0, 1); d.setFullYear(d.getFullYear() - (d.getFullYear() % n)); break;
  }
  return d;
}

/** The next step after one; days in steps of 7 start again on the 1st, so the axis reads 1, 8, 15, 22, 29, 1. */
function nextStep(d: Date, unit: Unit, n: number): Date {
  const e = new Date(d.getTime());
  switch (unit) {
    case 'second': e.setSeconds(e.getSeconds() + n); break;
    case 'minute': e.setMinutes(e.getMinutes() + n); break;
    case 'hour': e.setHours(e.getHours() + n); break;
    case 'day': {
      const month = e.getMonth();
      e.setDate(e.getDate() + n);
      if (n > 1 && e.getMonth() !== month) e.setDate(1);
      break;
    }
    case 'month': e.setMonth(e.getMonth() + n); break;
    case 'year': e.setFullYear(e.getFullYear() + n); break;
  }
  return e;
}

/** A step of the axis: its moment and its text. */
export interface TimeTick { ms: number; text: string }

/**
 * The steps of a time axis from one moment to another: the shortest round step of the calendar whose texts
 * fit side by side in the width, each said in the language. A step of hours says the day at midnight, and a
 * step of months says the year in January, so the reader always knows where the axis is.
 */
export function timeTicks(from: number, to: number, width: number, lang: string, charPx = 7.2): TimeTick[] {
  if (!(to > from)) return [{ ms: from, text: pointText(from, 0, false, lang) }];
  for (const [unit, n] of STEPS) {
    if ((to - from) / (LENGTH[unit] * n) > width / 40) continue;
    const out: TimeTick[] = [];
    for (let d = floorTo(from, unit, n); d.getTime() <= to; d = nextStep(d, unit, n)) {
      if (d.getTime() >= from) out.push({ ms: d.getTime(), text: tickText(d, unit, lang) });
      if (out.length > 400) break;
    }
    const widest = Math.max(0, ...out.map(t => t.text.length));
    if (out.length * (widest * charPx + 16) <= width) return out;
  }
  const last = STEPS[STEPS.length - 1]!;
  return [floorTo(from, last[0], last[1])].map(d => ({ ms: d.getTime(), text: tickText(d, 'year', lang) }));
}

function tickText(d: Date, unit: Unit, lang: string): string {
  const say = (o: Intl.DateTimeFormatOptions): string => format(d.getTime(), o, lang);
  const midnight = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
  switch (unit) {
    case 'second': return say({ hour: 'numeric', minute: '2-digit', second: '2-digit' });
    case 'minute':
    case 'hour': return midnight ? say({ day: 'numeric', month: 'short' }) : say({ hour: 'numeric', minute: '2-digit' });
    case 'day': return say({ day: 'numeric', month: 'short' });
    case 'month': return d.getMonth() === 0 ? say({ year: 'numeric' }) : say({ month: 'short' });
    case 'year': return say({ year: 'numeric' });
  }
}

/**
 * A point of a time axis as its tooltip says it: the day of a whole day, else the day and the time on the
 * clock, with seconds when the axis covers less than five minutes.
 */
export function pointText(ms: number, span: number, allDay: boolean, lang: string): string {
  const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  if (!allDay) {
    o.hour = 'numeric';
    o.minute = '2-digit';
    if (span < 5 * MINUTE) o.second = '2-digit';
  }
  return format(ms, o, lang);
}

function format(ms: number, o: Intl.DateTimeFormatOptions, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, o).format(ms);
  } catch {
    return new Intl.DateTimeFormat('en', o).format(ms);
  }
}

/**
 * The points of a line worth drawing at the width it has: in each column of pixels, its first, lowest, highest
 * and last point, so a line of a hundred thousand points looks as it would drawn in full, with a few thousand.
 * Points with no value are left out, as the line leaves them out. `xs` is in order, left to right.
 */
export function thinned(xs: number[], ys: Array<number | null>): number[] {
  const out: number[] = [];
  let col = NaN;
  let first = -1;
  let lo = -1;
  let hi = -1;
  let last = -1;
  const flush = (): void => {
    if (first < 0) return;
    for (const i of [...new Set([first, lo, hi, last])].sort((a, b) => a - b)) out.push(i);
  };
  for (let i = 0; i < xs.length; i++) {
    const y = ys[i];
    if (y === null || y === undefined) continue;
    const c = Math.floor(xs[i]!);
    if (c !== col) {
      flush();
      col = c;
      first = lo = hi = last = i;
      continue;
    }
    last = i;
    if (y < ys[lo]!) lo = i;
    if (y > ys[hi]!) hi = i;
  }
  flush();
  return out;
}

/** The point nearest a place on the axis, by a search of the places in order: -1 when there are none. */
export function nearest(xs: number[], x: number): number {
  if (xs.length === 0) return -1;
  let a = 0;
  let b = xs.length - 1;
  while (b - a > 1) {
    const m = (a + b) >> 1;
    if (xs[m]! < x) a = m; else b = m;
  }
  return Math.abs(xs[a]! - x) <= Math.abs(xs[b]! - x) ? a : b;
}
