// Picking and poking by key: what paths do at each segment, and what the
// `pick`, `select` and `poke` natives build on.
//
// Both return an error message string instead of throwing; the caller turns
// it into a Trebol error.

import { K, isAnyBlock, isAnyString, isAnyWord, aKindName } from './kinds.ts';
import { canon, spell } from './symbols.ts';
import * as I64 from './int64.ts';
import {
  NONE, integer, char, decimal, time, date, pair, tuple, strictEqual, codePoints, fromCodePoints,
  type Cell, type Series, type BlockCell, type StringCell, type WordCell,
} from './values.ts';
import { ctxFind, ctxSet } from './ctx.ts';
import { mold } from './mold.ts';

/** Keys of maps and selects: words by symbol (any word type), the rest strictly. */
export function sameKey(a: Cell, b: Cell): boolean {
  if (isAnyWord(a.t) && isAnyWord(b.t)) return canon((a as WordCell).sym) === canon((b as WordCell).sym);
  return strictEqual(a, b);
}

/** Index of the value slot for `key` in a map series, or -1. */
export function mapFind(s: Series<Cell>, key: Cell): number {
  for (let j = 0; j < s.data.length; j += 2) if (sameKey(s.data[j]!, key)) return j + 1;
  return -1;
}

/** Position of the first element equal to `key` (as a key) from `from`, or -1. */
export function blockFind(s: Series<Cell>, from: number, key: Cell): number {
  for (let j = from; j < s.data.length; j++) if (sameKey(s.data[j]!, key)) return j;
  return -1;
}

/** 0-based offset for a 1-based integer index, or null if it is not one. */
function offset(key: Cell): number | null {
  if (key.t !== K.Integer) return null;
  return I64.toNumber(key.v) - 1;
}

const DATE_PARTS = ['year', 'month', 'day', 'time', 'zone', 'date', 'weekday', 'yearday', 'hour', 'minute', 'second'] as const;
const TIME_PARTS = ['hour', 'minute', 'second'] as const;
const NS_HOUR = 3600e9;
const NS_MIN = 60e9;
const DAY_MS = 86400000;

function partName(key: Cell): string | null {
  return isAnyWord(key.t) ? spell(canon((key as WordCell).sym)) : null;
}

export function pick(cur: Cell, key: Cell): Cell | string {
  switch (cur.t) {
    case K.Url: case K.File:
      // url/segment and file/segment build a longer path
      if (isAnyWord(key.t) || isAnyString(key.t) || key.t === K.Integer) {
        const base = (cur as StringCell).s.data.slice((cur as StringCell).i);
        const seg = codePoints(isAnyWord(key.t) ? spell((key as WordCell).sym) : isAnyString(key.t) ? fromCodePoints((key as StringCell).s.data, (key as StringCell).i) : mold(key));
        const slash = base[base.length - 1] === 47 ? [] : [47];
        const tail = seg[0] === 47 ? seg.slice(1) : seg;
        return { t: cur.t, s: { data: [...base, ...slash, ...tail] }, i: 0 };
      }
      break;
    case K.Email: {
      // email/user and email/host, as in R3
      const p = partName(key);
      if (p === 'user' || p === 'host') {
        const cps = (cur as StringCell).s.data.slice((cur as StringCell).i);
        const at = cps.indexOf(64);
        const part = p === 'user' ? (at < 0 ? cps : cps.slice(0, at)) : at < 0 ? [] : cps.slice(at + 1);
        return { t: K.String, s: { data: part }, i: 0 };
      }
      break;
    }
    case K.Object: case K.Error: {
      if (!isAnyWord(key.t)) return `cannot pick ${mold(key)} in an object`;
      const i = ctxFind(cur.ctx, (key as WordCell).sym);
      if (i < 0) return `${mold(key)} is not a field of the object`;
      return cur.ctx.vals[i]!;
    }
    case K.Map: {
      const i = mapFind(cur.s, key);
      return i < 0 ? NONE : cur.s.data[i]!;
    }
    case K.Pair: {
      const p = partName(key);
      const n = offset(key);
      if (p === 'x' || n === 0) return decimalOrInt(cur.x);
      if (p === 'y' || n === 1) return decimalOrInt(cur.y);
      return `cannot pick ${mold(key)} in a pair`;
    }
    case K.Tuple: {
      const n = offset(key);
      if (n === null) return `cannot pick ${mold(key)} in a tuple`;
      const x = cur.v[n];
      return x === undefined ? NONE : integer(x);
    }
    case K.Date: {
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
        case 'weekday': return integer(((Date.UTC(d.y, d.m - 1, d.d) / DAY_MS) % 7 + 10) % 7 + 1);
        case 'yearday': return integer((Date.UTC(d.y, d.m - 1, d.d) - Date.UTC(d.y, 0, 1)) / DAY_MS + 1);
        case 'hour': case 'minute': case 'second':
          return d.time === null ? NONE : pick(time(d.time), key.t === K.Integer ? integer(TIME_PARTS.indexOf(p) + 1) : key);
      }
      return `cannot pick ${mold(key)} in a date`;
    }
    case K.Time: {
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
      return `cannot pick ${mold(key)} in a time`;
    }
  }
  if (isAnyBlock(cur.t)) {
    const b = cur as BlockCell;
    const n = offset(key);
    if (n !== null) {
      const v = n >= 0 ? b.s.data[b.i + n] : undefined;
      return v ?? NONE;
    }
    const at = blockFind(b.s, b.i, key);
    return at < 0 ? NONE : b.s.data[at + 1] ?? NONE;
  }
  if (isAnyString(cur.t) || cur.t === K.Binary) {
    const s = cur as StringCell;
    const n = offset(key);
    if (n === null) return `cannot pick ${mold(key)} in ${aKindName(cur.t)}`;
    const cp = n >= 0 ? s.s.data[s.i + n] : undefined;
    if (cp === undefined) return NONE;
    return cur.t === K.Binary ? integer(cp) : char(cp);
  }
  return `cannot pick ${mold(key)} in ${aKindName(cur.t)}`;
}

function decimalOrInt(n: number): Cell {
  return Number.isInteger(n) ? integer(n) : decimal(n);
}

/** Sets `key` in `cur` to `v`. Returns null on success, or an error message. */
export function poke(cur: Cell, key: Cell, v: Cell): string | null {
  switch (cur.t) {
    case K.Object: case K.Error: {
      if (!isAnyWord(key.t)) return `cannot set ${mold(key)} in an object`;
      const i = ctxFind(cur.ctx, (key as WordCell).sym);
      if (i < 0) return `${mold(key)} is not a field of the object`;
      ctxSet(cur.ctx, i, v);
      return null;
    }
    case K.Map: {
      const i = mapFind(cur.s, key);
      if (i >= 0) {
        cur.s.data[i] = v;
      } else {
        const k = isAnyWord(key.t) ? { t: K.Word, sym: (key as WordCell).sym, bind: null } as Cell : key;
        cur.s.data.push(k, v);
      }
      return null;
    }
  }
  if (isAnyBlock(cur.t)) {
    const b = cur as BlockCell;
    const n = offset(key);
    if (n !== null) {
      if (n < 0 || b.i + n >= b.s.data.length) return `index ${n + 1} is out of range`;
      b.s.data[b.i + n] = v;
      return null;
    }
    const at = blockFind(b.s, b.i, key);
    if (at < 0 || at + 1 >= b.s.data.length) return `${mold(key)} not found in the block`;
    b.s.data[at + 1] = v;
    return null;
  }
  if (cur.t === K.String) {
    const s = cur as StringCell;
    const n = offset(key);
    if (n === null || v.t !== K.Char) return `cannot set ${mold(key)} in a string`;
    if (n < 0 || s.i + n >= s.s.data.length) return `index ${n + 1} is out of range`;
    s.s.data[s.i + n] = v.v;
    return null;
  }
  return `cannot set ${mold(key)} in ${aKindName(cur.t)}`;
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
      const p = partName(key) ?? (['x', 'y'] as const)[offset(key) ?? -1] ?? null;
      if (p !== 'x' && p !== 'y') return `cannot set ${mold(key)} in a pair`;
      if (n === null) return `a pair's ${p} is a number, not ${mold(v)}`;
      return p === 'x' ? pair(n, cur.y) : pair(cur.x, n);
    }
    case K.Tuple: {
      const i = offset(key);
      if (i === null || i < 0 || i >= 10) return `cannot set ${mold(key)} in a tuple`;
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
          const u = new Date(Date.UTC(2000, m - 1, day));
          u.setUTCFullYear(y + u.getUTCFullYear() - 2000);
          return date({ ...d, y: u.getUTCFullYear(), m: u.getUTCMonth() + 1, d: u.getUTCDate() });
        }
        case 'time':
          if (v.t === K.None) return date({ ...d, time: null, zone: null });
          if (v.t !== K.Time) return `a date's time is a time, not ${mold(v)}`;
          return date({ ...d, time: v.v });
        case 'zone':
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
