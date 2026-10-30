// Loose equality (`=`, equal?) and ordering (`<`, sort).
//
// `equal?` is what people mean by "the same": numbers compare by value across
// integer!, decimal!, percent! and money!, text and chars ignore case, words
// compare by symbol whatever their type. `strictEqual` in values.ts is `==`.

import { K, isAnyBlock, isAnyString, isAnyWord } from './kinds.ts';
import { canon } from './symbols.ts';
import * as I64 from './int64.ts';
import { decCmp, decFromNumber, decFromBig, type Dec } from './dec.ts';
import { strictEqual, type Cell, type BlockCell, type StringCell, type WordCell } from './values.ts';

const isNumeric = (c: Cell): boolean =>
  c.t === K.Integer || c.t === K.Decimal || c.t === K.Percent || c.t === K.Money;

/** An exact decimal for any numeric cell (null for NaN/infinity). */
export function toDec(c: Cell): Dec | null {
  switch (c.t) {
    case K.Integer: return typeof c.v === 'bigint' ? decFromBig(c.v) : decFromNumber(c.v);
    case K.Decimal: case K.Percent: return decFromNumber(c.v);
    case K.Money: return c.v;
  }
  return null;
}

function numCmp(a: Cell, b: Cell): -1 | 0 | 1 | null {
  if (a.t === K.Integer && b.t === K.Integer) return I64.cmp(a.v, b.v);
  if (a.t === K.Money && b.t === K.Money && a.cur !== '' && b.cur !== '' &&
      a.cur.toUpperCase() !== b.cur.toUpperCase()) return null;
  const x = toDec(a);
  const y = toDec(b);
  if (x === null || y === null) {
    const fx = a.t === K.Decimal || a.t === K.Percent ? a.v : NaN;
    const fy = b.t === K.Decimal || b.t === K.Percent ? b.v : NaN;
    if (Number.isNaN(fx) || Number.isNaN(fy)) return null;
    return fx < fy ? -1 : fx > fy ? 1 : 0;
  }
  return decCmp(x, y);
}

function textCmp(a: StringCell, b: StringCell): -1 | 0 | 1 {
  const x = a.s.data;
  const y = b.s.data;
  const n = Math.min(x.length - a.i, y.length - b.i);
  for (let k = 0; k < n; k++) {
    const p = foldCase(x[a.i + k]!);
    const q = foldCase(y[b.i + k]!);
    if (p !== q) return p < q ? -1 : 1;
  }
  const la = x.length - a.i;
  const lb = y.length - b.i;
  return la < lb ? -1 : la > lb ? 1 : 0;
}

/** Lowercase code point for case-insensitive comparison. */
export function foldCase(cp: number): number {
  if (cp >= 65 && cp <= 90) return cp + 32;
  if (cp < 128) return cp;
  const lower = String.fromCodePoint(cp).toLowerCase();
  return lower.length === 1 || lower.codePointAt(0)! > 0xffff ? lower.codePointAt(0)! : cp;
}

export function isEqual(a: Cell, b: Cell): boolean {
  if (a === b) return true;
  if (isNumeric(a) && isNumeric(b)) return numCmp(a, b) === 0;
  if (isAnyString(a.t) && isAnyString(b.t)) return textCmp(a as StringCell, b as StringCell) === 0;
  if (a.t === K.Char && b.t === K.Char) return foldCase(a.v) === foldCase(b.v);
  if (isAnyWord(a.t) && isAnyWord(b.t)) return canon((a as WordCell).sym) === canon((b as WordCell).sym);
  if (isAnyBlock(a.t) && a.t === b.t) {
    const x = a as BlockCell;
    const y = b as BlockCell;
    const n = x.s.data.length - x.i;
    if (n !== y.s.data.length - y.i) return false;
    for (let k = 0; k < n; k++) if (!isEqual(x.s.data[x.i + k]!, y.s.data[y.i + k]!)) return false;
    return true;
  }
  return strictEqual(a, b);
}

/** Ordering for `<`, `>` and sort; null when the two cannot be ordered. */
export function compare(a: Cell, b: Cell): -1 | 0 | 1 | null {
  if (isNumeric(a) && isNumeric(b)) return numCmp(a, b);
  if (isAnyString(a.t) && isAnyString(b.t)) return textCmp(a as StringCell, b as StringCell);
  if (a.t === K.Char && b.t === K.Char) {
    const x = foldCase(a.v);
    const y = foldCase(b.v);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (a.t === K.Time && b.t === K.Time) return a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
  if (a.t === K.Date && b.t === K.Date) {
    const x = dateKey(a.v);
    const y = dateKey(b.v);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (a.t === K.Pair && b.t === K.Pair) {
    if (a.y !== b.y) return a.y < b.y ? -1 : 1;
    return a.x < b.x ? -1 : a.x > b.x ? 1 : 0;
  }
  if (a.t === K.Tuple && b.t === K.Tuple) {
    const n = Math.max(a.v.length, b.v.length);
    for (let k = 0; k < n; k++) {
      const x = a.v[k] ?? 0;
      const y = b.v[k] ?? 0;
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }
  if (a.t === K.Logic && b.t === K.Logic) return a.v === b.v ? 0 : a.v ? 1 : -1;
  return null;
}

/** UTC milliseconds for ordering dates; a date without zone counts as UTC. */
function dateKey(d: { y: number; m: number; d: number; time: number | null; zone: number | null }): number {
  return Date.UTC(d.y, d.m - 1, d.d) + (d.time ?? 0) / 1e6 - (d.zone ?? 0) * 60000;
}
