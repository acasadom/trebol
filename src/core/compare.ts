// Loose equality (`=`, equal?) and ordering (`<`, sort).
//
// `equal?` is what people mean by "the same": numbers compare by value across
// integer!, decimal!, percent! and money!, text and chars ignore case, words
// compare by symbol whatever their type. `strictEqual` in values.ts is `==`.

import { K, isAnyBlock, isAnyString, isAnyWord } from './kinds.ts';
import { canon, spell } from './symbols.ts';
import * as I64 from './int64.ts';
import { decCmp, decFromNumber, decFromBig, type Dec } from './dec.ts';
import { strictEqual, enterPair, leavePair, type EqPath, type Cell, type BlockCell, type StringCell, type WordCell } from './values.ts';
import { utcDayMs } from './days.ts';

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

// Decimals are binary fractions, so as in R3 two of them are equal when they
// are at most 10 representable numbers apart: 0.1 + 0.2 = 0.3. `==` stays exact.
const ULPS = 10n;
const f64 = new Float64Array(1);
const i64 = new BigInt64Array(f64.buffer);

/** Position of a float on a line where neighbouring floats are 1 apart. */
function ordinal(x: number): bigint {
  f64[0] = x;
  const n = i64[0]!;
  return n < 0n ? -(n & 0x7fffffffffffffffn) : n;
}

function almostEqual(x: number, y: number): boolean {
  if (x === y) return true;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const d = ordinal(x) - ordinal(y);
  return (d < 0n ? -d : d) <= ULPS;
}

const isFloat = (c: Cell): boolean => c.t === K.Decimal || c.t === K.Percent;

/** A block being compared item by item: xs[at..end) against ys from at + off. */
type EqFrame = { xs: readonly Cell[]; ys: readonly Cell[]; at: number; end: number; off: number; left: object };

/** `=` (equal?): blocks are walked with an explicit work stack, so nesting as deep as the
 * heap allows never reaches the JS stack limit. A pair of blocks met again at the same
 * positions on its own path is a cycle: equal there, as `==` does. */
export function isEqual(a: Cell, b: Cell): boolean {
  const path: EqPath = new Map();
  const stack: EqFrame[] = [];
  if (!equalStep(a, b, path, stack)) return false;
  while (stack.length > 0) {
    const f = stack[stack.length - 1]!;
    if (f.at === f.end) {
      leavePair(path, f.left);
      stack.pop();
      continue;
    }
    const k = f.at++;
    const x = f.xs[k]!;
    const y = f.ys[k + f.off]!;
    if (!sameSort(x, y) || !equalStep(x, y, path, stack)) return false;
  }
  return true;
}

/** Compares two cells one level deep: false when they differ, true when they are equal or
 * when their items are left on the stack to compare. */
function equalStep(a: Cell, b: Cell, path: EqPath, stack: EqFrame[]): boolean {
  if (a === b) return true;
  if (isNumeric(a) && isNumeric(b)) {
    if ((isFloat(a) || isFloat(b)) && a.t !== K.Money && b.t !== K.Money) {
      // an integer past 2^53 has no decimal of its own: compared exactly, as `<` and `>` do
      const big = (c: Cell): boolean => c.t === K.Integer && !Number.isSafeInteger(I64.toNumber(c.v));
      if (big(a) || big(b)) return numCmp(a, b) === 0;
      const n = (c: Cell): number => (c.t === K.Integer ? I64.toNumber(c.v) : (c as { v: number }).v);
      return almostEqual(n(a), n(b));
    }
    return numCmp(a, b) === 0;
  }
  if (isAnyString(a.t) && isAnyString(b.t)) return textCmp(a as StringCell, b as StringCell) === 0;
  if (a.t === K.Char && b.t === K.Char) return foldCase(a.v) === foldCase(b.v);
  if (isAnyWord(a.t) && isAnyWord(b.t)) return canon((a as WordCell).sym) === canon((b as WordCell).sym);
  if (isAnyBlock(a.t) && a.t === b.t) {
    const x = a as BlockCell;
    const y = b as BlockCell;
    const n = x.s.data.length - x.i;
    if (n !== y.s.data.length - y.i) return false;
    if ((x.s === y.s && x.i === y.i) || enterPair(path, x.s, x.i, y.s, y.i)) return true;
    stack.push({ xs: x.s.data, ys: y.s.data, at: x.i, end: x.s.data.length, off: y.i - x.i, left: x.s });
    return true;
  }
  // a date without time is the same day at midnight and two zones the same moment;
  // a tuple is as long as it needs to be: 1.2.3 = 1.2.3.0 (R3)
  if ((a.t === K.Date || a.t === K.Tuple) && a.t === b.t) return compare(a, b) === 0;
  return strictEqual(a, b);
}

/** Of two values, whether they are of one kind for `=` inside a block, where words of
 * any kind go together and numbers of any kind too, but "ab" is not <ab> (R3). */
export function sameSort(a: Cell, b: Cell): boolean {
  return a.t === b.t || (isNumeric(a) && isNumeric(b)) || (isAnyWord(a.t) && isAnyWord(b.t));
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
  if (isAnyWord(a.t) && isAnyWord(b.t)) {
    const x = spell(canon((a as WordCell).sym));
    const y = spell(canon((b as WordCell).sym));
    return x < y ? -1 : x > y ? 1 : 0;
  }
  return null;
}

/** UTC milliseconds for ordering dates; a date without zone counts as UTC. */
function dateKey(d: { y: number; m: number; d: number; time: number | null; zone: number | null }): number {
  return utcDayMs(d.y, d.m, d.d) + (d.time ?? 0) / 1e6 - (d.zone ?? 0) * 60000;
}
