// Picking and poking by key: what paths do at each segment, and what the
// `pick`, `select` and `poke` natives build on.
//
// Both return a Miss (an error id and message) instead of throwing; the caller
// turns it into a Trebol error.

import { K, isAnyBlock, isAnyString, isAnyWord, aKindName } from './kinds.ts';
import { canon, spell } from './symbols.ts';
import * as I64 from './int64.ts';
import {
  NONE, integer, char, decimal, time, date, pair, tuple, codePoints, fromCodePoints,
  type Cell, type Series, type BlockCell, type StringCell, type WordCell, type DateVal,
} from './values.ts';
import { ctxFind, ctxSet } from './ctx.ts';
import { mold } from './mold.ts';
import { touch } from './values.ts';
import { daysOf, civilOf } from './days.ts';
import { sameKey, mapFind, mapSet } from './maps.ts';

export { sameKey, mapFind };

/** Position of the first element equal to `key` (as a key) from `from`, or -1. */
export function blockFind(s: Series<Cell>, from: number, key: Cell): number {
  for (let j = from; j < s.data.length; j++) if (sameKey(s.data[j]!, key)) return j;
  return -1;
}

/** Why a pick or poke failed: the error id (script type) and its message. */
export interface Miss { readonly miss: string; readonly msg: string }

export function isMiss(r: Cell | Miss | null): r is Miss {
  return r !== null && 'miss' in r;
}

const miss = (id: string, msg: string): Miss => ({ miss: id, msg });

/** 0-based offset for a 1-based integer index, or null if it is not one (date and time parts). */
function offset(key: Cell): number | null {
  if (key.t !== K.Integer) return null;
  return I64.toNumber(key.v) - 1;
}

const POS_MAX = 2147483647;
const POS_MIN = -2147483648;

/**
 * A position as R3 takes one in pick, poke, at and paths: an integer, or a decimal or percent
 * cut toward zero (2.9 is 2, 150% is 1), and with `logic` true as 1 and false as 2. Gives null
 * when the key is no position, 'range' past 32 bits (as R3: its positions are 32-bit), else
 * the 1-based number, which may be 0 or count back when negative.
 */
export function posOf(key: Cell, logic: boolean): number | 'range' | null {
  let n: number;
  if (key.t === K.Integer) n = I64.toNumber(key.v);
  else if (key.t === K.Decimal || key.t === K.Percent) n = key.v;
  else if (key.t === K.Logic && logic) return key.v ? 1 : 2;
  else return null;
  if (Number.isNaN(n)) return 0;
  if (n > POS_MAX || n < POS_MIN) return 'range';
  return Math.trunc(n) + 0;
}

/**
 * Where position `n` from `i` falls in a series, as R3 counts it: 1 is the value at `i`, -1 the
 * one just before it; 0 is no place (-1 here), as is anything before the head.
 */
export function placeOf(i: number, n: number): number {
  if (n === 0) return -1;
  const at = n > 0 ? i + n - 1 : i + n;
  return at < 0 ? -1 : at;
}

const DATE_PARTS = ['year', 'month', 'day', 'time', 'zone', 'date', 'weekday', 'yearday', 'hour', 'minute', 'second'] as const;
const TIME_PARTS = ['hour', 'minute', 'second'] as const;
const NS_HOUR = 3600e9;
const NS_MIN = 60e9;
const DAY_NS = 86400e9;

/** The same moment in UTC, as R3's date/utc: a date with no time or no zone stays as it is. */
function utcOf(d: Readonly<DateVal>): Cell {
  if (d.time === null || d.zone === null) return date(d);
  const ns = d.time - d.zone * NS_MIN;
  const shift = Math.floor(ns / DAY_NS);
  return date({ ...civilOf(daysOf(d.y, d.m, d.d) + shift), time: ns - shift * DAY_NS, zone: 0 });
}

function partName(key: Cell): string | null {
  return isAnyWord(key.t) ? spell(canon((key as WordCell).sym)) : null;
}

/**
 * What a path segment gives: url/segment and file/segment build a longer path, as in R3
 * (`%a/b`, `%a/1`); every other value is picked as `pick` does. The `pick` native and
 * series accessors use `pick`, where a file or url is a string of characters.
 */
export function pathPick(cur: Cell, key: Cell): Cell | Miss {
  if (cur.t === K.Url || cur.t === K.File) {
    if (isAnyWord(key.t) || isAnyString(key.t) || key.t === K.Integer) {
      const base = (cur as StringCell).s.data.slice((cur as StringCell).i);
      const seg = codePoints(isAnyWord(key.t) ? spell((key as WordCell).sym) : isAnyString(key.t) ? fromCodePoints((key as StringCell).s.data, (key as StringCell).i) : mold(key));
      const slash = base[base.length - 1] === 47 ? [] : [47];
      const tail = seg[0] === 47 ? seg.slice(1) : seg;
      return { t: cur.t, s: { data: [...base, ...slash, ...tail] }, i: 0 };
    }
  }
  if (cur.t === K.Email) {
    // email/user and email/host, as in R3
    const p = partName(key);
    if (p === 'user' || p === 'host') {
      const cps = (cur as StringCell).s.data.slice((cur as StringCell).i);
      const at = cps.indexOf(64);
      const part = p === 'user' ? (at < 0 ? cps : cps.slice(0, at)) : at < 0 ? [] : cps.slice(at + 1);
      return { t: K.String, s: { data: part }, i: 0 };
    }
  }
  if (isAnyBlock(cur.t) && posOf(key, false) === null) {
    // block/key is the value after the key, as select gives it; true there is a key too (R3)
    const b = cur as BlockCell;
    const at = blockFind(b.s, b.i, key);
    return at < 0 ? NONE : b.s.data[at + 1] ?? NONE;
  }
  return pick(cur, key);
}

export function pick(cur: Cell, key: Cell): Cell | Miss {
  switch (cur.t) {
    case K.Object: case K.Error: {
      if (!isAnyWord(key.t)) return miss('bad-pick', `cannot pick ${mold(key)} in an object`);
      const i = ctxFind(cur.ctx, (key as WordCell).sym);
      if (i < 0) return miss('bad-pick', `${mold(key)} is not a field of the object`);
      return cur.ctx.vals[i]!;
    }
    case K.Map: {
      const i = mapFind(cur.s, key);
      return i < 0 ? NONE : cur.s.data[i]!;
    }
    case K.Pair: {
      const p = partName(key);
      const n = posOf(key, true);
      if (p === 'x' || n === 1) return decimalOrInt(cur.x);
      if (p === 'y' || n === 2) return decimalOrInt(cur.y);
      // a pair has only 1 and 2, as R3
      if (n !== null) return miss('out-of-range', `a pair has no position ${mold(key)}`);
      return miss('bad-pick', `cannot pick ${mold(key)} in a pair`);
    }
    case K.Tuple: {
      const n = posOf(key, true);
      if (n === 'range') return miss('out-of-range', `index ${mold(key)} is out of range`);
      if (n === null) return miss('bad-pick', `cannot pick ${mold(key)} in a tuple`);
      const x = n > 0 ? cur.v[n - 1] : undefined;
      return x === undefined ? NONE : integer(x);
    }
    case K.Date: {
      // a number other than a whole one names no part: none, as R3
      if (posOf(key, true) !== null && key.t !== K.Integer) return NONE;
      if (key.t === K.Integer && DATE_PARTS[offset(key)!] === undefined) return NONE;
      const p = partName(key) ?? DATE_PARTS[offset(key) ?? -1] ?? null;
      const d = cur.v;
      switch (p) {
        case 'year': return integer(d.y);
        case 'month': return integer(d.m);
        case 'day': return integer(d.d);
        case 'time': return d.time === null ? NONE : time(d.time);
        case 'zone': return d.zone === null ? NONE : time(d.zone * NS_MIN);
        case 'date': return date({ y: d.y, m: d.m, d: d.d, time: null, zone: null });
        // ISO weekday: Monday is 1, Sunday 7; 1970-01-01 was a Thursday
        case 'weekday': return integer((daysOf(d.y, d.m, d.d) % 7 + 10) % 7 + 1);
        case 'yearday': return integer(daysOf(d.y, d.m, d.d) - daysOf(d.y, 1, 1) + 1);
        case 'utc': return utcOf(d);
        case 'hour': case 'minute': case 'second':
          return d.time === null ? NONE : pick(time(d.time), key.t === K.Integer ? integer(TIME_PARTS.indexOf(p) + 1) : key);
      }
      return miss('bad-pick', `cannot pick ${mold(key)} in a date`);
    }
    case K.Time: {
      // as R3: a whole number past its parts is none, any other number an invalid path
      if (posOf(key, true) !== null && key.t !== K.Integer) return miss('invalid-path', `cannot pick ${mold(key)} in a time`);
      if (key.t === K.Integer && TIME_PARTS[offset(key)!] === undefined) return NONE;
      const p = partName(key) ?? TIME_PARTS[offset(key) ?? -1] ?? null;
      const ns = Math.abs(cur.v);
      const sign = cur.v < 0 ? -1 : 1;
      switch (p) {
        case 'hour': return integer(sign * Math.floor(ns / NS_HOUR));
        case 'minute': return integer(sign * Math.floor((ns % NS_HOUR) / NS_MIN));
        case 'second': {
          const s = (ns % NS_MIN) / 1e9;
          return Number.isInteger(s) ? integer(sign * s) : decimal(sign * s);
        }
      }
      return miss('bad-pick', `cannot pick ${mold(key)} in a time`);
    }
  }
  if (isAnyBlock(cur.t) || isAnyString(cur.t) || cur.t === K.Binary) {
    const s = cur as BlockCell | StringCell;
    const n = posOf(key, true);
    // a key is no position in a block or text: select, put and paths find keys (R3)
    if (n === null) return miss(cur.t === K.Binary ? 'bad-pick' : 'invalid-arg', `cannot pick ${mold(key)} in ${aKindName(cur.t)}`);
    if (n === 'range') return miss('out-of-range', `index ${mold(key)} is out of range`);
    const at = placeOf(s.i, n);
    const x = at < 0 ? undefined : s.s.data[at];
    if (x === undefined) return NONE;
    if (isAnyBlock(cur.t)) return x as Cell;
    return cur.t === K.Binary ? integer(x as number) : char(x as number);
  }
  return miss('bad-pick', `cannot pick ${mold(key)} in ${aKindName(cur.t)}`);
}

function decimalOrInt(n: number): Cell {
  return Number.isInteger(n) ? integer(n) : decimal(n);
}

/** What a set-path sets: as `poke`, and also the value after a key in a block (`b/name: v`). */
export function pathPoke(cur: Cell, key: Cell, v: Cell): Miss | null {
  if (isAnyBlock(cur.t) && posOf(key, false) === null) {
    const b = cur as BlockCell;
    const at = blockFind(b.s, b.i, key);
    if (at < 0 || at + 1 >= b.s.data.length) return miss('bad-path-set', `${mold(key)} not found in the block`);
    b.s.data[at + 1] = v;
    touch(b.s);
    return null;
  }
  return poke(cur, key, v);
}

const CP_MAX = 0x10ffff;

/** What a code point or byte `v` stands for in text or binary, or a Miss, as R3's poke takes it. */
function unitOf(cur: Cell, v: Cell): number | Miss {
  const max = cur.t === K.Binary ? 255 : CP_MAX;
  if (v.t === K.Char) return v.v <= max ? v.v : miss('out-of-range', `${mold(v)} does not fit in ${aKindName(cur.t)}`);
  if (v.t === K.Integer) {
    const n = I64.toNumber(v.v);
    if (n < 0 || (cur.t !== K.Binary && n > CP_MAX)) return miss('invalid-arg', `${mold(v)} is not a character`);
    return n <= max ? n : miss('out-of-range', `${mold(v)} does not fit in a byte`);
  }
  return miss('invalid-arg', `cannot put ${mold(v)} in ${aKindName(cur.t)}`);
}

/** Sets `key` in `cur` to `v`. Returns null on success, or a Miss. */
export function poke(cur: Cell, key: Cell, v: Cell): Miss | null {
  switch (cur.t) {
    case K.Object: case K.Error: {
      if (!isAnyWord(key.t)) return miss('bad-poke', `cannot set ${mold(key)} in an object`);
      const i = ctxFind(cur.ctx, (key as WordCell).sym);
      if (i < 0) return miss('bad-poke', `${mold(key)} is not a field of the object`);
      ctxSet(cur.ctx, i, v);
      return null;
    }
    case K.Map:
      mapSet(cur.s, key, v);
      return null;
  }
  if (isAnyBlock(cur.t) || isAnyString(cur.t) || cur.t === K.Binary) {
    const s = cur as BlockCell | StringCell;
    const n = posOf(key, true);
    if (n === null) return miss(cur.t === K.Binary ? 'bad-poke' : 'invalid-arg', `cannot set ${mold(key)} in ${aKindName(cur.t)}`);
    const at = n === 'range' ? -1 : placeOf(s.i, n);
    if (at < 0 || at >= s.s.data.length) return miss('out-of-range', `index ${mold(key)} is out of range`);
    if (isAnyBlock(cur.t)) {
      (s as BlockCell).s.data[at] = v;
    } else {
      const u = unitOf(cur, v);
      if (typeof u !== 'number') return u;
      (s as StringCell).s.data[at] = u;
    }
    touch(s.s);
    return null;
  }
  return miss('bad-poke', `cannot set ${mold(key)} in ${aKindName(cur.t)}`);
}

/** Whether a value is immediate with parts a path can set: x of a pair, 2 of a tuple, year of a date. */
export function hasParts(c: Cell): boolean {
  return c.t === K.Pair || c.t === K.Tuple || c.t === K.Date || c.t === K.Time;
}

function numberOf(v: Cell): number | null {
  if (v.t === K.Integer) return I64.toNumber(v.v);
  if (v.t === K.Decimal) return v.v;
  return null;
}

/**
 * The value `cur` (a pair, tuple, date or time) becomes with its part `key` set to `v`, as R3
 * gives it: `s/y: 5` on 1x2 makes 1x5, and a date's day past its month goes on to the next.
 * Cells are immutable, so the caller stores the new value where `cur` was.
 */
export function pokeValue(cur: Cell, key: Cell, v: Cell): Cell | string {
  const n = numberOf(v);
  switch (cur.t) {
    case K.Pair: {
      const at = posOf(key, true);
      const p = partName(key) ?? (at === 1 ? 'x' : at === 2 ? 'y' : null);
      if (p !== 'x' && p !== 'y') return `cannot set ${mold(key)} in a pair`;
      if (n === null) return `a pair's ${p} is a number, not ${mold(v)}`;
      return p === 'x' ? pair(n, cur.y) : pair(cur.x, n);
    }
    case K.Tuple: {
      const at = posOf(key, true);
      const i = typeof at === 'number' ? at - 1 : -1;
      if (i < 0 || i >= 10) return `cannot set ${mold(key)} in a tuple`;
      if (n === null || !Number.isInteger(n) || n < 0 || n > 255) return `a tuple's part is a whole number from 0 to 255, not ${mold(v)}`;
      const parts = [...cur.v];
      while (parts.length <= i) parts.push(0);
      parts[i] = n;
      return tuple(parts);
    }
    case K.Time: {
      const p = partName(key) ?? TIME_PARTS[offset(key) ?? -1] ?? null;
      if (p !== 'hour' && p !== 'minute' && p !== 'second') return `cannot set ${mold(key)} in a time`;
      if (n === null) return `a time's ${p} is a number, not ${mold(v)}`;
      const sign = cur.v < 0 ? -1 : 1;
      const ns = Math.abs(cur.v);
      let h = Math.floor(ns / NS_HOUR), m = Math.floor((ns % NS_HOUR) / NS_MIN), sec = (ns % NS_MIN) / 1e9;
      if (p === 'hour') h = n; else if (p === 'minute') m = n; else sec = n;
      return time(sign * Math.round(h * NS_HOUR + m * NS_MIN + sec * 1e9));
    }
    case K.Date: {
      const p = partName(key) ?? DATE_PARTS[offset(key) ?? -1] ?? null;
      const d = { ...cur.v };
      switch (p) {
        case 'year': case 'month': case 'day': {
          if (n === null || !Number.isInteger(n)) return `a date's ${p} is a whole number, not ${mold(v)}`;
          const y = p === 'year' ? n : d.y, m = p === 'month' ? n : d.m, day = p === 'day' ? n : d.d;
          // past the end of its month or year, a date goes on, as R3's does
          return date({ ...d, ...civilOf(daysOf(y, m, day)) });
        }
        case 'time':
          if (v.t === K.None) return date({ ...d, time: null, zone: null });
          if (v.t !== K.Time) return `a date's time is a time, not ${mold(v)}`;
          return date({ ...d, time: v.v });
        case 'zone':
          // none drops the zone and keeps the clock, as R3 does
          if (v.t === K.None) return date({ ...d, zone: null, time: d.time ?? 0 });
          if (v.t !== K.Time) return `a date's zone is a time, not ${mold(v)}`;
          return date({ ...d, zone: Math.round(v.v / NS_MIN), time: d.time ?? 0 });
        case 'hour': case 'minute': case 'second': {
          const t = pokeValue(time(d.time ?? 0), key.t === K.Integer ? integer(TIME_PARTS.indexOf(p) + 1) : key, v);
          if (typeof t === 'string') return t;
          return date({ ...d, time: (t as { v: number }).v });
        }
      }
      return `cannot set ${mold(key)} in a date`;
    }
  }
  return `cannot set ${mold(key)} in ${aKindName(cur.t)}`;
}
