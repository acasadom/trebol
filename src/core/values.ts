// The value model.
//
// Every Trebol value is a Cell: a small, fixed-shape, immutable record tagged
// by `t`. Mutable state lives in Series and Ctx objects, shared by reference,
// exactly as in Rebol 3. Cells are copied freely and never mutated in place,
// which keeps the pausable evaluator simple and maps onto a 16-byte tagged
// union in a future Zig core.

import { K, type Kind } from './kinds.ts';
import { intern, sameSym, type Sym } from './symbols.ts';
import type { I64 } from './int64.ts';
import { decEqual, type Dec } from './dec.ts';

// --- series and contexts ---------------------------------------------------

/**
 * Shared mutable storage behind series values. A cell points at a series plus
 * an index, so `next block` is a new cell over the same series.
 *
 * Strings store Unicode code points (not UTF-16 units) so that indexes and
 * lengths match Rebol and a future UTF-32 Zig implementation. Binaries and
 * bitsets store bytes.
 */
export interface Series<T> {
  data: T[];
  /** Block series only: `nl[i]` is true when a newline precedes element i. */
  nl?: boolean[];
  /** Block series only: source position of element i, see `packPos`. */
  pos?: number[];
  /** Block series only: the file the block was loaded from, if any. */
  file?: string;
  /**
   * Set when `nl` and `pos` are shared with the series this one was copied
   * from (a function body copied for a call); `ownMeta` copies them before
   * anything changes them.
   */
  sharedMeta?: boolean;
  /**
   * Version: set by `touch` on every change of what the series holds, from one
   * clock shared by all series, so a later change always gives a greater
   * number. Undefined (0) for a series never changed since it was made.
   * Binding its words is not a change.
   */
  ver?: number;
  /**
   * Set by a host that shows this series (in a UI face, or read by a reaction):
   * the first change through `touch` pushes the series here and sets `dirty`,
   * as `ctxSet` does for a context, so the host repaints what shows it. The
   * host clears `dirty` when it repaints.
   */
  watch?: Series<unknown>[];
  dirty?: boolean;
}

let clock = 0;

/** Marks a series changed: gives it the next version. Call it on every edit of what a series holds. */
export function touch(s: Series<unknown>): void {
  s.ver = ++clock;
  if (s.watch !== undefined && s.dirty !== true) {
    s.dirty = true;
    s.watch.push(s);
  }
}

/** Gives a series its own `nl` and `pos` before they are changed. Call it before every edit of them. */
export function ownMeta(s: Series<unknown>): void {
  if (s.sharedMeta !== true) return;
  if (s.nl) s.nl = s.nl.slice();
  if (s.pos) s.pos = s.pos.slice();
  s.sharedMeta = undefined;
}

/** A binding context: objects, function frames and the user context. */
export interface Ctx {
  keys: Sym[];
  vals: Cell[];
  parent: Ctx | null;
  /**
   * Lookup cache built lazily by `ctxFind`: canonical symbol to the first
   * index with that key, covering `keys[0 .. idxN)`. Keys are only ever
   * appended, so the cache is extended, never invalidated.
   */
  idx?: Map<Sym, number>;
  /** How many keys `idx` has seen. */
  idxN?: number;
  /** Set on object contexts: the word `self` bound here means the object. */
  self?: boolean;
  /**
   * Set by a host that renders this context (a UI face): the first write
   * through `ctxSet` pushes the context here and sets `dirty`, so the host
   * repaints only what changed. The host clears `dirty` when it repaints.
   */
  watch?: Ctx[];
  dirty?: boolean;
}

// --- dates -----------------------------------------------------------------

export interface DateVal {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
  /** Time of day in nanoseconds, or null for a date without time. */
  time: number | null;
  /** UTC offset in minutes, or null when no zone was given. */
  zone: number | null;
}

// --- cells -----------------------------------------------------------------

export type StringKind =
  | typeof K.String | typeof K.File | typeof K.Email
  | typeof K.Url | typeof K.Tag | typeof K.Binary;

export type WordKind =
  | typeof K.Word | typeof K.SetWord | typeof K.GetWord
  | typeof K.LitWord | typeof K.Refinement | typeof K.Issue;

export type BlockKind =
  | typeof K.Block | typeof K.Paren | typeof K.Path
  | typeof K.SetPath | typeof K.GetPath | typeof K.LitPath;

export type OpaqueKind =
  | typeof K.Function | typeof K.Native | typeof K.Op | typeof K.Handle;

export interface UnsetCell { readonly t: typeof K.Unset }
export interface NoneCell { readonly t: typeof K.None }
export interface LogicCell { readonly t: typeof K.Logic; readonly v: boolean }
export interface IntegerCell { readonly t: typeof K.Integer; readonly v: I64 }
export interface DecimalCell { readonly t: typeof K.Decimal; readonly v: number }
/** `v` is the fraction: 15% is stored as 0.15. */
export interface PercentCell { readonly t: typeof K.Percent; readonly v: number }
export interface MoneyCell { readonly t: typeof K.Money; readonly v: Dec; readonly cur: string }
export interface CharCell { readonly t: typeof K.Char; readonly v: number }
export interface PairCell { readonly t: typeof K.Pair; readonly x: number; readonly y: number }
export interface TupleCell { readonly t: typeof K.Tuple; readonly v: readonly number[] }
export interface DateCell { readonly t: typeof K.Date; readonly v: Readonly<DateVal> }
/** Nanoseconds; may be negative or exceed 24 hours. */
export interface TimeCell { readonly t: typeof K.Time; readonly v: number }
export interface StringCell { readonly t: StringKind; readonly s: Series<number>; readonly i: number }
export interface BitsetCell { readonly t: typeof K.Bitset; readonly s: Series<number>; readonly neg: boolean }
export interface WordCell {
  readonly t: WordKind;
  readonly sym: Sym;
  readonly bind: Ctx | null;
  /**
   * Where the word's key is in `bind`, when known at bind time. Keys are only
   * ever appended, so the index never goes stale: a lookup is one array read.
   */
  readonly idx?: number;
}
export interface BlockCell { readonly t: BlockKind; readonly s: Series<Cell>; readonly i: number }
/** Keys and values alternate in `s`. Hashing arrives with the evaluator. */
export interface MapCell { readonly t: typeof K.Map; readonly s: Series<Cell> }
export interface ObjectCell { readonly t: typeof K.Object | typeof K.Error; readonly ctx: Ctx }
export interface DatatypeCell { readonly t: typeof K.Datatype; readonly k: Kind }
/** Bit `k` is set when kind `k` belongs to the typeset. */
export interface TypesetCell { readonly t: typeof K.Typeset; readonly bits: bigint }
export interface OpaqueCell { readonly t: OpaqueKind; readonly p: unknown }

export type Cell =
  | UnsetCell | NoneCell | LogicCell | IntegerCell | DecimalCell | PercentCell
  | MoneyCell | CharCell | PairCell | TupleCell | DateCell | TimeCell
  | StringCell | BitsetCell | WordCell | BlockCell | MapCell | ObjectCell
  | DatatypeCell | TypesetCell | OpaqueCell;

// --- constructors ----------------------------------------------------------

export const UNSET: UnsetCell = { t: K.Unset };
export const NONE: NoneCell = { t: K.None };
export const TRUE: LogicCell = { t: K.Logic, v: true };
export const FALSE: LogicCell = { t: K.Logic, v: false };

export const logic = (v: boolean): LogicCell => (v ? TRUE : FALSE);
export const integer = (v: I64): IntegerCell => ({ t: K.Integer, v });
export const decimal = (v: number): DecimalCell => ({ t: K.Decimal, v });
export const percent = (v: number): PercentCell => ({ t: K.Percent, v });
export const money = (v: Dec, cur = ''): MoneyCell => ({ t: K.Money, v, cur });
export const char = (v: number): CharCell => ({ t: K.Char, v });
export const pair = (x: number, y: number): PairCell => ({ t: K.Pair, x, y });
export const tuple = (v: readonly number[]): TupleCell => ({ t: K.Tuple, v: [...v] });
export const date = (v: DateVal): DateCell => ({ t: K.Date, v: { ...v } });
export const time = (ns: number): TimeCell => ({ t: K.Time, v: ns });
export const datatype = (k: Kind): DatatypeCell => ({ t: K.Datatype, k });
export const typeset = (bits: bigint): TypesetCell => ({ t: K.Typeset, bits });

/** Converts a JS string to an array of code points. */
export function codePoints(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) out.push(ch.codePointAt(0)!);
  return out;
}

export function series<T>(data: T[]): Series<T> {
  return { data };
}

export function stringOf(t: StringKind, text: string): StringCell {
  return { t, s: series(codePoints(text)), i: 0 };
}

export const string = (text: string): StringCell => stringOf(K.String, text);

export function binary(bytes: number[]): StringCell {
  return { t: K.Binary, s: series(bytes), i: 0 };
}

export function bitset(bytes: number[], neg = false): BitsetCell {
  return { t: K.Bitset, s: series(bytes), neg };
}

export function wordOf(t: WordKind, name: string | Sym, bind: Ctx | null = null): WordCell {
  return { t, sym: typeof name === 'string' ? intern(name) : name, bind };
}

export const word = (name: string): WordCell => wordOf(K.Word, name);

export function blockOf(t: BlockKind, cells: Cell[], i = 0): BlockCell {
  return { t, s: series(cells), i };
}

export const block = (cells: Cell[]): BlockCell => blockOf(K.Block, cells);

export function map(pairs: Cell[]): MapCell {
  return { t: K.Map, s: series(pairs) };
}

export function object(ctx: Ctx): ObjectCell {
  return { t: K.Object, ctx };
}

export function context(keys: Sym[] = [], vals: Cell[] = [], parent: Ctx | null = null): Ctx {
  return { keys, vals, parent };
}

// --- accessors -------------------------------------------------------------

/** The JS string for a string-like cell, from its index to the tail. */
export function text(c: StringCell): string {
  return fromCodePoints(c.s.data, c.i);
}

/** Builds a JS string from code points, in chunks to stay off the JS stack limit. */
export function fromCodePoints(cps: readonly number[], start = 0, end = cps.length): string {
  let out = '';
  for (let i = start; i < end; i += 8192) {
    out += String.fromCodePoint(...cps.slice(i, Math.min(i + 8192, end)));
  }
  return out;
}

/** Packs a source position into one number (line < 2^32, column < 2^20). */
export function packPos(line: number, col: number): number {
  return line * 1048576 + col;
}

export function unpackPos(p: number): { line: number; col: number } {
  return { line: Math.floor(p / 1048576), col: p % 1048576 };
}

// --- strict structural equality ------------------------------------------
//
// Same kind and same contents; strings and word spellings compare by case.
// Used by tests and as the base for `==` (strict-equal?). The looser `=`
// (equal?) arrives with the natives.

/** True if two cells are the very same value: the same series at the same position, the same context. */
export function sameValue(a: Cell, b: Cell): boolean {
  if (a.t !== b.t) return false;
  const x = a as Cell & { ctx?: unknown; s?: unknown; i?: number };
  const y = b as Cell & { ctx?: unknown; s?: unknown; i?: number };
  if (x.ctx !== undefined) return x.ctx === y.ctx;
  if (x.s !== undefined) return x.s === y.s && x.i === y.i;
  return strictEqual(a, b);
}

/** The pairs of series (or contexts) being compared on the current path, each with the two
 * positions: left -> [right, left index, right index] entries, innermost last. A pair met again
 * at the same positions is a cycle, equal there; one side alone met again is not. */
export type EqPath = Map<object, { y: object; i: number; j: number }[]>;

/** Whether x at i against y at j is already being compared on this path; if not, puts it there. */
export function enterPair(path: EqPath, x: object, i: number, y: object, j: number): boolean {
  let list = path.get(x);
  if (list === undefined) path.set(x, (list = []));
  for (const e of list) if (e.y === y && e.i === i && e.j === j) return true;
  list.push({ y, i, j });
  return false;
}

/** Takes the innermost pair of x off the path, when its frame ends. */
export function leavePair(path: EqPath, x: object): void {
  const list = path.get(x)!;
  list.pop();
  if (list.length === 0) path.delete(x);
}

/** A block (or an object's values) being compared item by item: xs[at..end) against ys from at + off.
 * `left` is the left series or context, on the path while the frame lasts. */
type EqFrame = { xs: readonly Cell[]; ys: readonly Cell[]; at: number; end: number; off: number; left: object };

/** Deep compare with an explicit work stack, so nesting as deep as the heap allows never
 * reaches the JS stack limit. A pair of series met again at the same positions on its own
 * path is a cycle: equal there. */
export function strictEqual(a: Cell, b: Cell): boolean {
  const path: EqPath = new Map();
  const stack: EqFrame[] = [];
  if (!eq(a, b, path, stack)) return false;
  while (stack.length > 0) {
    const f = stack[stack.length - 1]!;
    if (f.at === f.end) {
      leavePair(path, f.left);
      stack.pop();
      continue;
    }
    const k = f.at++;
    if (!eq(f.xs[k]!, f.ys[k + f.off]!, path, stack)) return false;
  }
  return true;
}

/** Compares two cells one level deep: false when they differ, true when they are equal or
 * when their items are left on the stack to compare. */
function eq(a: Cell, b: Cell, path: EqPath, stack: EqFrame[]): boolean {
  if (a === b) return true;
  if (a.t !== b.t) return false;
  switch (a.t) {
    case K.Unset:
    case K.None:
      return true;
    case K.Logic:
    case K.Integer:
    case K.Char:
    case K.Time:
      return a.v === (b as typeof a).v;
    case K.Decimal:
    case K.Percent:
      return Object.is(a.v, (b as typeof a).v) || a.v === (b as typeof a).v;
    case K.Money: {
      const o = b as typeof a;
      return a.cur.toUpperCase() === o.cur.toUpperCase() && decEqual(a.v, o.v);
    }
    case K.Pair: {
      const o = b as typeof a;
      return a.x === o.x && a.y === o.y;
    }
    case K.Tuple: {
      const o = b as typeof a;
      return a.v.length === o.v.length && a.v.every((x, i) => x === o.v[i]);
    }
    case K.Date: {
      const x = a.v;
      const y = (b as typeof a).v;
      return x.y === y.y && x.m === y.m && x.d === y.d && x.time === y.time && x.zone === y.zone;
    }
    case K.String: case K.File: case K.Email: case K.Url: case K.Tag: case K.Binary: {
      const o = b as StringCell;
      return arraysEqual(a.s.data, a.i, o.s.data, o.i);
    }
    case K.Bitset: {
      const o = b as typeof a;
      return a.neg === o.neg && arraysEqual(a.s.data, 0, o.s.data, 0);
    }
    case K.Word: case K.SetWord: case K.GetWord: case K.LitWord: case K.Refinement: case K.Issue:
      return a.sym === (b as WordCell).sym;
    case K.Block: case K.Paren: case K.Path: case K.SetPath: case K.GetPath: case K.LitPath: {
      const o = b as BlockCell;
      return cellsEqual(a.s, a.i, o.s, o.i, path, stack);
    }
    case K.Map:
      return cellsEqual(a.s, 0, (b as typeof a).s, 0, path, stack);
    case K.Object:
    case K.Error: {
      const x = a.ctx;
      const y = (b as typeof a).ctx;
      if (x === y) return true;
      if (x.keys.length !== y.keys.length) return false;
      if (!x.keys.every((k, i) => sameSym(k, y.keys[i]!))) return false;
      if (enterPair(path, x, 0, y, 0)) return true;
      stack.push({ xs: x.vals, ys: y.vals, at: 0, end: x.vals.length, off: 0, left: x });
      return true;
    }
    case K.Datatype:
      return a.k === (b as typeof a).k;
    case K.Typeset:
      return a.bits === (b as typeof a).bits;
    default:
      return a === b || (a as OpaqueCell).p === (b as OpaqueCell).p;
  }
}

function arraysEqual(x: number[], i: number, y: number[], j: number): boolean {
  if (x.length - i !== y.length - j) return false;
  for (let n = 0; n < x.length - i; n++) if (x[i + n] !== y[j + n]) return false;
  return true;
}

function cellsEqual(x: Series<Cell>, i: number, y: Series<Cell>, j: number, path: EqPath, stack: EqFrame[]): boolean {
  if (x === y && i === j) return true;
  if (x.data.length - i !== y.data.length - j) return false;
  if (enterPair(path, x, i, y, j)) return true; // cyclic: equal at the cycle
  stack.push({ xs: x.data, ys: y.data, at: i, end: x.data.length, off: j - i, left: x });
  return true;
}
