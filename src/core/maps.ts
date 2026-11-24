// Maps keep their pairs in one series: key, value, key, value. A map with more than a few keys also
// keeps a hash index from key to offset, so finding or adding a key takes about the same time at any
// size, where walking the pairs made filling a map one key at a time take the square of its size.
//
// The index is good while the series has the data array and the version it was made for: a change
// made anywhere else (every change goes through `touch`) leaves it stale, and the next lookup makes
// it again. Adding a key here keeps it up to date.
//
// The hash is coarse: two keys that are the same always get one hash, and keys with one hash are
// then told apart by `sameKey`. A key with no hash (a block, money, an object...) goes in `loose`
// and is compared one by one; such a key is never the same as one with a hash.
//
// As in R3, a text key is copied when it goes into a map, and words-of, foreach and to block! give
// copies of the text keys, so no one holds a key the map holds and changes it behind the index.

import { K, isAnyWord, isAnyString } from './kinds.ts';
import { canon } from './symbols.ts';
import { strictEqual, touch, type Cell, type Series, type MapIndex, type WordCell, type StringCell } from './values.ts';

/** Maps with fewer pairs than this are searched one by one. */
const MIN_INDEXED = 8;

/** Keys of maps and selects: words by symbol (any word type), the rest strictly. */
export function sameKey(a: Cell, b: Cell): boolean {
  if (isAnyWord(a.t) && isAnyWord(b.t)) return canon((a as WordCell).sym) === canon((b as WordCell).sym);
  return strictEqual(a, b);
}

function textOf(data: readonly number[], from: number): string {
  let out = '';
  for (let k = from; k < data.length; k++) out += String.fromCodePoint(data[k]!);
  return out;
}

/** The hash of a key: equal for keys that are the same; null for a key compared one by one. */
function hashOf(c: Cell): string | null {
  if (isAnyWord(c.t)) return 'w' + canon((c as WordCell).sym);
  if (isAnyString(c.t) || c.t === K.Binary) return c.t + ':' + textOf((c as StringCell).s.data, (c as StringCell).i);
  switch (c.t) {
    case K.None: return 'n';
    case K.Integer: case K.Decimal: case K.Percent: case K.Char: case K.Logic: case K.Time:
      return c.t + ':' + String(c.v);
    case K.Pair: return c.t + ':' + c.x + ',' + c.y;
    case K.Tuple: return c.t + ':' + c.v.join('.');
    case K.Date: { const d = c.v; return c.t + ':' + [d.y, d.m, d.d, d.time, d.zone].join(','); }
    case K.Datatype: return c.t + ':' + c.k;
  }
  return null;
}

function build(s: Series<Cell>): MapIndex {
  const ix: MapIndex = { data: s.data, ver: s.ver ?? 0, at: new Map(), loose: [] };
  for (let j = 0; j < s.data.length; j += 2) note(ix, s.data[j]!, j);
  s.index = ix;
  return ix;
}

function note(ix: MapIndex, key: Cell, j: number): void {
  const h = hashOf(key);
  if (h === null) {
    ix.loose.push(j);
    return;
  }
  const list = ix.at.get(h);
  if (list === undefined) ix.at.set(h, [j]);
  else list.push(j);
}

/** The index of a map series, made again when stale; null for a small map. */
function indexOf(s: Series<Cell>): MapIndex | null {
  if (s.data.length < 2 * MIN_INDEXED) return null;
  const ix = s.index;
  return ix !== undefined && ix.data === s.data && ix.ver === (s.ver ?? 0) ? ix : build(s);
}

/** Offset of the first key in a map series that is the same as `key`, or -1. */
function keyAt(s: Series<Cell>, key: Cell): number {
  const ix = indexOf(s);
  if (ix === null) {
    for (let j = 0; j < s.data.length; j += 2) if (sameKey(s.data[j]!, key)) return j;
    return -1;
  }
  const h = hashOf(key);
  const list = h === null ? ix.loose : ix.at.get(h) ?? [];
  for (const j of list) if (sameKey(s.data[j]!, key)) return j;
  return -1;
}

/** Index of the value slot for `key` in a map series, or -1. */
export function mapFind(s: Series<Cell>, key: Cell): number {
  const j = keyAt(s, key);
  return j < 0 ? -1 : j + 1;
}

/** A key as a map holds it: any word as a word, text copied. */
export function keyIn(c: Cell): Cell {
  if (isAnyWord(c.t)) return c.t === K.Word && (c as WordCell).bind === null ? c : { t: K.Word, sym: (c as WordCell).sym, bind: null };
  return keyOut(c);
}

/** A key of a map to give out: text copied, so changing it leaves the map as it was. */
export function keyOut(c: Cell): Cell {
  if (isAnyString(c.t) || c.t === K.Binary) {
    const x = c as StringCell;
    return { t: x.t, s: { data: x.s.data.slice(x.i) }, i: 0 } as Cell;
  }
  return c;
}

/** Sets `key` to `v` in a map series: the value replaced, or the pair added at the tail. */
export function mapSet(s: Series<Cell>, key: Cell, v: Cell): void {
  const j = keyAt(s, key);
  if (j >= 0) {
    s.data[j + 1] = v;
    touch(s);
    return;
  }
  const ix = indexOf(s);
  const k = keyIn(key);
  s.data.push(k, v);
  touch(s);
  if (ix !== null) {
    note(ix, k, s.data.length - 2);
    ix.ver = s.ver ?? 0;
  }
}

/** The data of a map made from key value pairs: as R3, a key given twice keeps its first place and its last value. */
export function mapData(pairs: readonly Cell[]): Cell[] {
  const s: Series<Cell> = { data: [] };
  for (let j = 0; j + 1 < pairs.length; j += 2) mapSet(s, pairs[j]!, pairs[j + 1]!);
  return s.data;
}
