// Set natives: unique, union, intersect, difference and exclude.
//
// Values are kept in a hash index so a set operation takes time in proportion
// to the length of its series, not its square. The index key is coarse: two
// values that are equal always get the same key, and values with the same key
// are then told apart by the real equality. A value with no key (a decimal,
// percent or money, which equal each other within a tolerance or across
// currencies) is compared one by one.
//
// As in R3, two values of a series are the same only when they are of one
// datatype (words of any kind count as one): 1 and 1.0 are both kept. Inside
// blocks `=` decides, so [1] and [1.0] are one. /case tells apart the case of
// text and words, and with it the values in blocks must be of one datatype
// too, though decimals there still compare within a tolerance, as in R3.

import { K, isAnyBlock, isAnyString, isAnyWord, type Kind } from '../kinds.ts';
import * as I64 from '../int64.ts';
import { canon, spell } from '../symbols.ts';
import { TRUE, strictEqual, time, bitset, type Cell, type BlockCell, type StringCell, type WordCell, type BitsetCell } from '../values.ts';
import { isEqual, foldCase } from '../compare.ts';
import { dateDiff } from './math.ts';
import type { SeriesCell, Item } from '../series.ts';
import type { Step, NativeFrame } from '../eval.ts';
import { native, value, fail } from './define.ts';
import { utcDayMs } from '../days.ts';

const used = (c: Cell): boolean => c === TRUE;

type Eq = (a: Item, b: Item) => boolean;
type Key = (x: Item) => string | number | null;

function sameKind(a: Cell, b: Cell): boolean {
  return a.t === b.t || (isAnyWord(a.t) && isAnyWord(b.t));
}

// Of two values of one kind, whether they are the same with /case.
function casedEqual(a: Cell, b: Cell): boolean {
  if (isAnyWord(a.t)) return spell((a as WordCell).sym) === spell((b as WordCell).sym);
  if (isAnyString(a.t) || a.t === K.Char) return strictEqual(a, b);
  if (isAnyBlock(a.t)) {
    const x = a as BlockCell;
    const y = b as BlockCell;
    const n = x.s.data.length - x.i;
    if (n !== y.s.data.length - y.i) return false;
    for (let k = 0; k < n; k++) {
      const p = x.s.data[x.i + k]!;
      const q = y.s.data[y.i + k]!;
      if (p !== q && (p.t !== q.t || !casedEqual(p, q))) return false;
    }
    return true;
  }
  return isEqual(a, b);
}

function itemEq(t: Kind, cased: boolean): Eq {
  if (isAnyBlock(t)) {
    return (a, b) => sameKind(a as Cell, b as Cell) && (cased ? casedEqual(a as Cell, b as Cell) : isEqual(a as Cell, b as Cell));
  }
  if (cased || t === K.Binary) return (a, b) => a === b;
  return (a, b) => foldCase(a as number) === foldCase(b as number);
}

function folded(s: StringCell): string {
  let out = '';
  for (let k = s.i; k < s.s.data.length; k++) out += String.fromCodePoint(foldCase(s.s.data[k] as number));
  return out;
}

// The key of a value that is neither a number nor a block, or null when it has none.
function scalarKey(c: Cell): string | null {
  if (isAnyString(c.t)) return 's' + folded(c as StringCell);
  if (isAnyWord(c.t)) return 'w' + canon((c as WordCell).sym);
  switch (c.t) {
    case K.Char: return 'c' + foldCase(c.v);
    case K.Logic: return 'l' + c.v;
    case K.Time: return 't' + c.v;
    case K.Pair: return 'p' + c.x + ',' + c.y;
    case K.Tuple: { const v = [...c.v]; while (v.at(-1) === 0) v.pop(); return 'u' + v.join('.'); }
    case K.Date: { const d = c.v; return 'd' + (utcDayMs(d.y, d.m, d.d) + (d.time ?? 0) / 1e6 - (d.zone ?? 0) * 60000); }
  }
  return 'x' + c.t;
}

// A block's key holds its kind, its length and the keys of its first values; a block
// inside gives only its kind and length (so a block that holds itself ends). A block
// whose first values hold one with no key has none either: [1] = [1.0].
function blockKey(b: BlockCell, cased: boolean): string | null {
  const n = b.s.data.length - b.i;
  let out = 'b' + b.t + ':' + n;
  for (let k = 0; k < Math.min(n, 8); k++) {
    const c = b.s.data[b.i + k]!;
    const key = isAnyBlock(c.t) ? 'b' + c.t + ':' + ((c as BlockCell).s.data.length - (c as BlockCell).i) : cellKey(c, cased);
    if (key === null) return null;
    out += '|' + key;
  }
  return out;
}

function cellKey(c: Cell, cased: boolean): string | null {
  switch (c.t) {
    case K.Integer: return 'n' + I64.toString(c.v);
    case K.Decimal: case K.Percent: case K.Money: return null;
  }
  if (isAnyBlock(c.t)) return blockKey(c as BlockCell, cased);
  return scalarKey(c);
}

function itemKey(t: Kind, cased: boolean): Key {
  if (isAnyBlock(t)) return x => cellKey(x as Cell, cased);
  if (cased || t === K.Binary) return x => x as number;
  return x => foldCase(x as number);
}

/** The values put in so far, found by key. */
class Held {
  readonly keyed = new Map<string | number, Item[]>();
  readonly loose: Item[] = [];
  readonly all: Item[] = [];
  readonly eq: Eq;
  readonly key: Key;
  constructor(eq: Eq, key: Key) {
    this.eq = eq;
    this.key = key;
  }

  has(x: Item): boolean {
    const k = this.key(x);
    if (k === null) return this.all.some(y => this.eq(x, y));
    return this.keyed.get(k)?.some(y => this.eq(x, y)) === true || this.loose.some(y => this.eq(x, y));
  }

  add(x: Item): void {
    const k = this.key(x);
    this.all.push(x);
    if (k === null) { this.loose.push(x); return; }
    const b = this.keyed.get(k);
    if (b === undefined) this.keyed.set(k, [x]);
    else b.push(x);
  }
}

type Sets = { eq: Eq; key: Key };

function held(list: Item[], s: Sets): Held {
  const h = new Held(s.eq, s.key);
  for (const x of list) h.add(x);
  return h;
}

function distinct(list: Item[], s: Sets): Item[] {
  const h = new Held(s.eq, s.key);
  for (const x of list) if (!h.has(x)) h.add(x);
  return h.all;
}

function setResult(like: SeriesCell, list: Item[]): Cell {
  return { t: like.t, s: { data: list }, i: 0 } as Cell;
}

// Of two bitsets, the one holding what op says of being in each. A complemented bitset
// (neg) holds what its bits do not, so each side is flipped before op and the result after.
function bitsetOp(a: BitsetCell, b: BitsetCell, op: (x: number, y: number) => number): Cell {
  const neg = op(a.neg ? 1 : 0, b.neg ? 1 : 0) !== 0;
  const n = Math.max(a.s.data.length, b.s.data.length);
  const bytes: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = (a.s.data[i] ?? 0) ^ (a.neg ? 0xff : 0);
    const y = (b.s.data[i] ?? 0) ^ (b.neg ? 0xff : 0);
    bytes.push((op(x, y) ^ (neg ? 0xff : 0)) & 0xff);
  }
  return bitset(bytes, neg);
}

function setOp(f: NativeFrame, two: boolean, pick: (a: Item[], b: Item[], s: Sets) => Item[], bits?: (x: number, y: number) => number): Step {
  if (two && (f.args[0]!.t === K.Bitset || f.args[1]!.t === K.Bitset)) {
    const [x, y] = f.args as [Cell, Cell];
    if (x.t !== K.Bitset || y.t !== K.Bitset || bits === undefined) return fail('script', 'bad-set', 'a bitset goes only with another bitset');
    return value(bitsetOp(x, y, bits));
  }
  const a = f.args[0] as SeriesCell;
  const b = two ? f.args[1] as SeriesCell : null;
  if (b !== null && isAnyBlock(a.t) !== isAnyBlock(b.t)) return fail('script', 'bad-set', 'both series must be of the same kind');
  const cased = used(f.args[two ? 2 : 1]!);
  const s = { eq: itemEq(a.t, cased), key: itemKey(a.t, cased) };
  const xs = (a.s.data as Item[]).slice(a.i);
  const ys = b === null ? [] : (b.s.data as Item[]).slice(b.i);
  return value(setResult(a, pick(xs, ys, s)));
}

const within = (list: Item[], other: Item[], s: Sets, keep: boolean): Item[] => {
  const h = held(other, s);
  return list.filter(x => h.has(x) === keep);
};

native('unique', '["The values of the series, each once." set [series!] /case]', (_t, f) => setOp(f, false, (a, _b, s) => distinct(a, s)));
native('union', '["The values that are in either series, each once." a [series! bitset!] b [series! bitset!] /case]', (_t, f) =>
  setOp(f, true, (a, b, s) => distinct([...a, ...b], s), (x, y) => x | y));
native('intersect', '["The values that are in both series." a [series! bitset!] b [series! bitset!] /case]', (_t, f) =>
  setOp(f, true, (a, b, s) => distinct(within(a, b, s, true), s), (x, y) => x & y));
// Of two dates, the time between them (R3).
native('difference', '["The values that are in one series but not the other; of two dates, the time between them." a [series! date! bitset!] b [series! date! bitset!] /case]', (_t, f) => {
  const [a, b] = f.args as [Cell, Cell];
  if (a.t === K.Date || b.t === K.Date) {
    if (a.t !== K.Date || b.t !== K.Date) return fail('script', 'bad-set', 'difference takes two dates or two series');
    return value(time(dateDiff(a.v, b.v)));
  }
  return setOp(f, true, (xs, ys, s) => distinct([...within(xs, ys, s, false), ...within(ys, xs, s, false)], s), (x, y) => x ^ y);
});
native('exclude', '["The values of the first series that are not in the second." a [series! bitset!] b [series! bitset!] /case]', (_t, f) =>
  setOp(f, true, (a, b, s) => distinct(within(a, b, s, false), s), (x, y) => x & ~y));
