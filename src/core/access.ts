// Picking and poking by key: what paths do at each segment, and what the
// `pick`, `select` and `poke` natives build on.
//
// Both return an error message string instead of throwing; the caller turns
// it into a Trebol error.

import { K, isAnyBlock, isAnyString, isAnyWord, kindName } from './kinds.ts';
import { canon, spell } from './symbols.ts';
import * as I64 from './int64.ts';
import {
  NONE, integer, char, decimal, time, strictEqual,
  type Cell, type Series, type BlockCell, type StringCell, type WordCell,
} from './values.ts';
import { ctxFind } from './ctx.ts';
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

const DATE_PARTS = ['year', 'month', 'day', 'time', 'zone'] as const;
const TIME_PARTS = ['hour', 'minute', 'second'] as const;
const NS_HOUR = 3600e9;
const NS_MIN = 60e9;

function partName(key: Cell): string | null {
  return isAnyWord(key.t) ? spell(canon((key as WordCell).sym)) : null;
}

export function pick(cur: Cell, key: Cell): Cell | string {
  switch (cur.t) {
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
    if (n === null) return `cannot pick ${mold(key)} in a ${kindName(cur.t)}`;
    const cp = n >= 0 ? s.s.data[s.i + n] : undefined;
    if (cp === undefined) return NONE;
    return cur.t === K.Binary ? integer(cp) : char(cp);
  }
  return `cannot pick ${mold(key)} in a ${kindName(cur.t)}`;
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
      cur.ctx.vals[i] = v;
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
  return `cannot set ${mold(key)} in a ${kindName(cur.t)}`;
}
