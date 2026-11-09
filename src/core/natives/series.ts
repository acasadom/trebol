// Series natives: navigation, editing, searching, ordering and set operations.
//
// Blocks hold cells, strings code points and binaries bytes; the helpers in
// series.ts hide the difference. Searching is case-insensitive unless /case,
// as `=` is.

import { K, isAnyBlock, kindBit, type Kind } from '../kinds.ts';
import * as I64 from '../int64.ts';
import {
  NONE, TRUE, integer, char, logic, strictEqual,
  type Cell, type BlockCell, type StringCell, type Series,
} from '../values.ts';
import { bindSeries, copyDeep } from '../ctx.ts';
import { isEqual, compare, foldCase } from '../compare.ts';
import { pick } from '../access.ts';
import { context, time } from '../values.ts';
import { dateDiff } from './math.ts';
import {
  splice, itemsFor, lengthOf, at, clampIndex,
  type SeriesCell, type Item,
} from '../series.ts';
import { T, type Step, type NativeFrame } from '../eval.ts';
import { native, value, fail, truthy, doBlock } from './define.ts';

const num = (c: Cell): number => I64.toNumber((c as { v: I64.I64 }).v);
const used = (c: Cell): boolean => c === TRUE;

/** The cell for element `i` of a series. */
export function cellAt(s: SeriesCell, i: number): Cell {
  const x = s.s.data[i];
  if (x === undefined) return NONE;
  if (isAnyBlock(s.t)) return x as Cell;
  return s.t === K.Binary ? integer(x as number) : char(x as number);
}

/** End index for a /part argument: a count or a position in the same series. */
function partEnd(s: SeriesCell, part: Cell | null): number {
  if (part === null || part.t === K.None) return s.s.data.length;
  if (part.t === K.Integer) return clampIndex(s, s.i + num(part));
  return clampIndex(s, (part as SeriesCell).i);
}

/**
 * The span a /part argument covers, as R3 reads it: a negative count, or a
 * position before the series' own, goes back from where the series is.
 */
function partSpan(s: SeriesCell, part: Cell): [number, number] {
  const e = part.t === K.Integer ? clampIndex(s, s.i + num(part)) : clampIndex(s, (part as SeriesCell).i);
  return e < s.i ? [e, s.i] : [s.i, e];
}

/** What insert, append and change put in: /part limits the value, /dup repeats it. */
function toPut(s: SeriesCell, v: Cell, only: boolean, part: Cell | null, dup: Cell | null): { add: Item[]; nl?: boolean[] } {
  let { add, nl } = itemsFor(s.t, v, only);
  if (part !== null) {
    const n = part.t === K.Integer ? Math.max(0, num(part)) : Math.max(0, (part as SeriesCell).i - (v as SeriesCell).i);
    add = add.slice(0, n);
    nl = nl?.slice(0, n);
  }
  if (dup !== null) {
    const times = Math.max(0, num(dup));
    const one = add;
    const oneNl = nl;
    add = [];
    nl = oneNl === undefined ? undefined : [];
    for (let k = 0; k < times; k++) {
      add.push(...one);
      if (nl !== undefined) nl.push(...oneNl!);
    }
  }
  return nl === undefined ? { add } : { add, nl };
}

// --- navigation ------------------------------------------------------------------

native('next', '["The series one position on." series [series!]]', (_t, f) => value(at(f.args[0] as SeriesCell, (f.args[0] as SeriesCell).i + 1)));
native('back', '["The series one position back." series [series!]]', (_t, f) => value(at(f.args[0] as SeriesCell, (f.args[0] as SeriesCell).i - 1)));
native('head', '["The series at its first position." series [series!]]', (_t, f) => value(at(f.args[0] as SeriesCell, 0)));
native('tail', '["The series just past its last value." series [series!]]', (_t, f) => value(at(f.args[0] as SeriesCell, Infinity)));
native('skip', '["The series moved on, or back, by an offset." series [series!] offset [integer!]]', (_t, f) => {
  const s = f.args[0] as SeriesCell;
  return value(at(s, s.i + num(f.args[1]!)));
});
native('at', '["The series at a position, counted from where it is." series [series!] index [integer!]]', (_t, f) => {
  const s = f.args[0] as SeriesCell;
  const n = num(f.args[1]!);
  return value(at(s, s.i + (n > 0 ? n - 1 : n)));
});
native('index?', '["The position of the series, from 1." series [series!]]', (_t, f) => value(integer((f.args[0] as SeriesCell).i + 1)));
native('head?', '["True if the series is at its head." series [series!]]', (_t, f) => value(logic((f.args[0] as SeriesCell).i === 0)));
native('tail?', '["True if the series is at its tail." series [series!]]', (_t, f) => value(logic(lengthOf(f.args[0] as SeriesCell) === 0)));

// --- editing ---------------------------------------------------------------------

const PUT_SPEC = 'series [series!] value [any-value!] /part "Put in only part of the value" range [integer! series!] /only "A block goes in as one value" /dup "Put it in several times" count [integer!]';
const putArgs = (f: NativeFrame) => toPut(f.args[0] as SeriesCell, f.args[1]!, used(f.args[4]!),
  used(f.args[2]!) ? f.args[3]! : null, used(f.args[5]!) ? f.args[6]! : null);

native('append', `["Puts a value at the tail of a series; gives the series at its head." ${PUT_SPEC}]`, (_t, f) => {
  const s = f.args[0] as SeriesCell;
  const { add, nl } = putArgs(f);
  splice(s.s as Series<Item>, s.s.data.length, 0, add, nl);
  return value(at(s, 0));
});

native('insert', `["Puts a value where the series is; gives the series just after it." ${PUT_SPEC}]`, (_t, f) => {
  const s = f.args[0] as SeriesCell;
  const { add, nl } = putArgs(f);
  splice(s.s as Series<Item>, s.i, 0, add, nl);
  return value(at(s, s.i + add.length));
});

native('change', '["Puts a value over what the series holds where it is; gives the series just after it." series [series!] value [any-value!] /part "Change this much of the series" range [integer! series!] /only "A block goes in as one value" /dup "Put the value in several times" count [integer!]]', (_t, f) => {
  const s = f.args[0] as SeriesCell;
  const { add, nl } = toPut(s, f.args[1]!, used(f.args[4]!), null, used(f.args[5]!) ? f.args[6]! : null);
  const end = used(f.args[2]!) ? partEnd(s, f.args[3]!) : Math.min(s.s.data.length, s.i + add.length);
  splice(s.s as Series<Item>, s.i, Math.max(0, end - s.i), add, nl);
  return value(at(s, s.i + add.length));
});

native('remove', '["Removes what the series holds where it is; gives the series." series [series!] /part "Remove this much" range [integer! series!]]', (_t, f) => {
  const s = f.args[0] as SeriesCell;
  const [from, end] = used(f.args[1]!) ? partSpan(s, f.args[2]!) : [s.i, Math.min(s.s.data.length, s.i + 1)];
  splice(s.s as Series<Item>, from, Math.max(0, end - from), []);
  return value(at(s, from));
});

native('clear', '["Removes everything from the series\' position to its tail." series [series! map!]]', (_t, f) => {
  const x = f.args[0]!;
  if (x.t === K.Map) {
    x.s.data.length = 0;
    return value(x);
  }
  const s = x as SeriesCell;
  splice(s.s as Series<Item>, s.i, s.s.data.length - s.i, []);
  return value(s);
});

native('copy', '["A copy of the series, map, object or bitset." value [series! map! object! bitset!] /part length [integer! series!] /deep]', (_t, f) => {
  const x = f.args[0]!;
  const deep = used(f.args[3]!);
  if (x.t === K.Map) return value({ t: K.Map, s: deep ? copyDeep(x.s) : { data: x.s.data.slice() } });
  if (x.t === K.Object || x.t === K.Error) {
    const ctx = context(x.ctx.keys.slice(), x.ctx.vals.slice());
    if (x.ctx.self) ctx.self = true;
    return value({ t: x.t, ctx });
  }
  if (x.t === K.Bitset) return value({ t: K.Bitset, s: { data: x.s.data.slice() }, neg: x.neg });
  const s = x as SeriesCell;
  const [from, end] = used(f.args[1]!) ? partSpan(s, f.args[2]!) : [s.i, s.s.data.length];
  if (isAnyBlock(s.t)) {
    const b = s as BlockCell;
    const part: Series<Cell> = { data: b.s.data.slice(from, end) };
    if (b.s.nl) part.nl = b.s.nl.slice(from, end);
    return value({ t: b.t, s: deep ? copyDeep(part) : part, i: 0 });
  }
  return value({ t: s.t, s: { data: (s.s.data as number[]).slice(from, end) }, i: 0 } as StringCell);
});

native('reverse', '["Reverses the order of the values from the series\' position." series [series!] /part length [integer! series!]]', (_t, f) => {
  const s = f.args[0] as SeriesCell;
  const end = used(f.args[1]!) ? partEnd(s, f.args[2]!) : s.s.data.length;
  const d = s.s.data as Item[];
  const nl = s.s.nl;
  for (let a = s.i, b = end - 1; a < b; a++, b--) {
    [d[a], d[b]] = [d[b]!, d[a]!];
    if (nl) [nl[a], nl[b]] = [nl[b]!, nl[a]!];
  }
  return value(s);
});

// --- searching -------------------------------------------------------------------

/** Does block element `el` match `v`? Datatypes and typesets match by kind. */
function matchCell(el: Cell, v: Cell, cased: boolean): boolean {
  if (v.t === K.Datatype && el.t !== K.Datatype) return el.t === v.k;
  if (v.t === K.Typeset && el.t !== K.Typeset) return (v.bits & kindBit(el.t)) !== 0n;
  return cased ? strictEqual(el, v) : isEqual(el, v);
}

/** What to look for: a run of elements, matched with `eq`. */
function needle(s: SeriesCell, v: Cell, only: boolean, cased: boolean): { run: Item[]; eq: (a: Item, b: Item) => boolean } {
  if (isAnyBlock(s.t)) {
    const run = !only && isAnyBlock(v.t) ? (v as BlockCell).s.data.slice((v as BlockCell).i) : [v];
    return { run, eq: (a, b) => matchCell(a as Cell, b as Cell, cased) };
  }
  const run = itemsFor(s.t, v, false).add;
  const eq = cased || s.t === K.Binary
    ? (a: Item, b: Item) => a === b
    : (a: Item, b: Item) => foldCase(a as number) === foldCase(b as number);
  return { run, eq };
}

interface FindOpts {
  only: boolean; cased: boolean; skip: number; last: boolean; match: boolean; end: number;
  /** Search back from just before the series' position. */
  reverse?: boolean;
  /** In a string, * matches any run of characters and ? any one. */
  wild?: boolean;
}

const STAR = 0x2a;
const QUESTION = 0x3f;

/**
 * Length of the shortest match of a wildcard pattern at `i`, or -1. Each *
 * tries the shortest run first; the backtracking keeps one entry per *.
 */
function wildAt(d: Item[], i: number, end: number, run: Item[], eq: (a: Item, b: Item) => boolean): number {
  const stars: Array<[number, number]> = [];
  let p = 0;
  let k = i;
  for (;;) {
    if (p === run.length) return k - i;
    const c = run[p]!;
    if (c === STAR) {
      stars.push([p + 1, k]);
      p++;
      continue;
    }
    if (k < end && (c === QUESTION || eq(d[k]!, c))) {
      p++;
      k++;
      continue;
    }
    // let the last * take one more character, or fail
    const last = stars.pop();
    if (last === undefined || last[1] >= end) return -1;
    p = last[0];
    k = last[1] + 1;
    stars.push([p, k]);
  }
}

/** Index where the run starts, or -1. */
function findIn(s: SeriesCell, v: Cell, o: FindOpts): { at: number; len: number } {
  const d = s.s.data as Item[];
  const { run, eq } = needle(s, v, o.only, o.cased);
  const wild = o.wild === true && !isAnyBlock(s.t);
  let len = run.length;
  const fits = (i: number) => {
    if (wild) {
      len = wildAt(d, i, o.end, run, eq);
      return len >= 0;
    }
    if (i + run.length > o.end) return false;
    for (let k = 0; k < run.length; k++) if (!eq(d[i + k]!, run[k]!)) return false;
    return true;
  };
  if (o.match) return { at: fits(s.i) ? s.i : -1, len };
  if (o.reverse) {
    for (let i = s.i - o.skip; i >= 0; i -= o.skip) if (fits(i)) return { at: i, len };
  } else if (o.last) {
    for (let i = o.end - (wild ? 0 : run.length); i >= s.i; i--) if ((i - s.i) % o.skip === 0 && fits(i)) return { at: i, len };
  } else {
    for (let i = s.i; i + (wild ? 0 : run.length) <= o.end; i += o.skip) if (fits(i)) return { at: i, len };
  }
  return { at: -1, len };
}

native('find', '["Finds a value in a series; gives the series where it is, or none." series [series! none! typeset!] value [any-type!] /part "Look only this far" length [integer! series!] /only "A block is one value" /case "Capitals matter" /skip "Look only at every so many" size [integer!] /last "Find the last one" /tail "Give the series just after it" /match "Only where the series is" /reverse "Look back from where the series is" /any "In a string, * is any run of characters and ? any one"]', (_t, f) => {
  const x = f.args[0]!;
  if (x.t === K.None) return value(NONE);
  if (x.t === K.Typeset) {
    const v = f.args[1]!;
    return value(logic(v.t === K.Datatype && (x.bits & kindBit(v.k)) !== 0n));
  }
  const s = x as SeriesCell;
  const a = f.args;
  const o: FindOpts = {
    only: used(a[4]!), cased: used(a[5]!), skip: used(a[6]!) ? Math.max(1, num(a[7]!)) : 1,
    last: used(a[8]!), match: used(a[10]!), end: used(a[2]!) ? partEnd(s, a[3]!) : s.s.data.length,
    reverse: used(a[11]!), wild: used(a[12]!),
  };
  const r = findIn(s, a[1]!, o);
  if (r.at < 0) return value(NONE);
  return value(at(s, used(a[9]!) || o.match ? r.at + r.len : r.at));
});

native('select', '["The value after the one found, or none." series [series! map! object! none!] value [any-type!] /only /case /skip size [integer!] /last]', (_t, f) => {
  const x = f.args[0]!;
  const a = f.args;
  if (x.t === K.None) return value(NONE);
  if (x.t === K.Map || x.t === K.Object || x.t === K.Error) {
    const r = pick(x, a[1]!);
    return value(typeof r === 'string' ? NONE : r);
  }
  const s = x as SeriesCell;
  const skip = used(a[4]!) ? Math.max(1, num(a[5]!)) : 1;
  const r = findIn(s, a[1]!, { only: used(a[2]!), cased: used(a[3]!), skip, last: used(a[6]!), match: false, end: s.s.data.length });
  if (r.at < 0) return value(NONE);
  return value(cellAt(s, r.at + r.len));
});

// --- ordering --------------------------------------------------------------------

interface SortState {
  src: Item[][];
  dst: Item[][];
  width: number;
  lo: number;
  mid: number;
  hi: number;
  i: number;
  j: number;
  k: number;
  merging: boolean;
}

/**
 * Bottom-up merge sort as a resumable state machine: it stops whenever it
 * needs a comparison from a Trebol function, and continues with the answer.
 * `before(a, b)` returns true/false, or null when it must ask the comparator.
 */
function sortRun(st: SortState, before: (a: Item[], b: Item[]) => boolean | null, answer: boolean | null): [Item[], Item[]] | null {
  const n = st.src.length;
  for (;;) {
    if (st.width >= n) return null;
    if (!st.merging) {
      if (st.lo >= n) {
        [st.src, st.dst] = [st.dst, st.src];
        st.width *= 2;
        st.lo = 0;
        continue;
      }
      st.mid = Math.min(st.lo + st.width, n);
      st.hi = Math.min(st.lo + 2 * st.width, n);
      st.i = st.lo;
      st.j = st.mid;
      st.k = st.lo;
      st.merging = true;
    }
    while (st.k < st.hi) {
      if (st.i < st.mid && st.j < st.hi) {
        // take from the right only when it must come strictly first (stable)
        let rightFirst = answer;
        answer = null;
        if (rightFirst === null) rightFirst = before(st.src[st.j]!, st.src[st.i]!);
        if (rightFirst === null) return [st.src[st.j]!, st.src[st.i]!];
        st.dst[st.k++] = rightFirst ? st.src[st.j++]! : st.src[st.i++]!;
      } else if (st.i < st.mid) {
        st.dst[st.k++] = st.src[st.i++]!;
      } else {
        st.dst[st.k++] = st.src[st.j++]!;
      }
    }
    st.merging = false;
    st.lo += 2 * st.width;
  }
}

// As in R3 and Red, /compare takes a function or, with /skip, the position of the field to sort by.
native('sort', '["Sorts the series in place." series [series!] /case /skip size [integer!] /compare comparator [any-function! integer!] /reverse]', (_t, f, v) => {
  const s = f.args[0] as SeriesCell;
  const a = f.args;
  const cased = used(a[1]!);
  const size = used(a[2]!) ? Math.max(1, num(a[3]!)) : 1;
  const by = used(a[4]!) && a[5]!.t === K.Integer ? num(a[5]!) : null;
  if (by !== null && (by < 1 || by > size)) return fail('script', 'out-of-range', `sort cannot compare field ${by} of records of ${size}`);
  const custom = used(a[4]!) && by === null ? a[5]! : null;
  const rev = used(a[6]!);
  if (f.phase === 0) {
    const d = s.s.data as Item[];
    const recs: Item[][] = [];
    for (let i = s.i; i < d.length; i += size) recs.push(d.slice(i, i + size));
    f.data = { src: recs, dst: recs.slice(), width: 1, lo: 0, mid: 0, hi: 0, i: 0, j: 0, k: 0, merging: false } satisfies SortState;
    f.phase = 1;
  }
  const st = f.data as SortState;
  let answer: boolean | null = null;
  if (v !== null) {
    answer = v.t === K.Integer ? num(v) < 0 : truthy(v);
    if (rev) answer = !answer;
  }
  const cellOf = (r: Item[], at = 0): Cell => cellAt({ ...s, s: { data: r }, i: 0 } as SeriesCell, at);
  let bad = false;
  const before = (x: Item[], y: Item[]): boolean | null => {
    if (custom !== null) return null;
    const at = by === null ? 0 : by - 1;
    const c = sortCompare(cellOf(x, at), cellOf(y, at), cased);
    if (c === null) bad = true;
    return rev ? (c ?? 0) > 0 : (c ?? 0) < 0;
  };
  const ask = sortRun(st, before, answer);
  if (bad) return fail('script', 'bad-compare', 'sort cannot compare those values');
  if (ask !== null) return { k: 'call', fn: custom!, args: [cellOf(ask[0]), cellOf(ask[1])] };
  const flat = st.src.flat();
  const d = s.s.data as Item[];
  for (let k = 0; k < flat.length; k++) d[s.i + k] = flat[k]!;
  if (s.s.nl) s.s.nl.fill(false, s.i);
  return value(s);
});

/** Order for sort: like `<`, case-sensitive with /case, kinds ordered by id when mixed. */
function sortCompare(a: Cell, b: Cell, cased: boolean): -1 | 0 | 1 | null {
  if (cased && a.t === K.String && b.t === K.String) {
    const x = (a as StringCell).s.data.slice(a.i);
    const y = (b as StringCell).s.data.slice(b.i);
    for (let k = 0; k < Math.min(x.length, y.length); k++) if (x[k] !== y[k]) return x[k]! < y[k]! ? -1 : 1;
    return x.length < y.length ? -1 : x.length > y.length ? 1 : 0;
  }
  if (cased && a.t === K.Char && b.t === K.Char) return a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
  const c = compare(a, b);
  if (c !== null) return c;
  if (a.t !== b.t) return a.t < b.t ? -1 : 1;
  if (a.t === K.None) return 0;
  return null;
}

// --- iteration that edits or builds --------------------------------------------

/** Shared setup for remove-each and map-each: a context for the words and a bound body copy. */
function eachSetup(f: NativeFrame) {
  const words = f.args[0]!;
  const list = words.t === K.Block ? words.s.data.slice(words.i) : [words];
  const ctx = context(list.map(w => (w as { sym: number }).sym), list.map(() => NONE));
  const body = f.args[2] as BlockCell;
  const s = copyDeep(body.s, body.i);
  bindSeries(s, ctx);
  return { ctx, body: { t: K.Block, s, i: 0 } as BlockCell };
}

interface EachState {
  ctx: ReturnType<typeof context>;
  body: BlockCell;
  pos: number;
  out: Cell[];
  keep: Item[];
}

function eachNext(f: NativeFrame, st: EachState, data: SeriesCell): Step | null {
  const d = data.s.data as Item[];
  if (st.pos >= d.length) return null;
  for (let k = 0; k < st.ctx.vals.length; k++) st.ctx.vals[k] = cellAt(data, st.pos + k);
  st.pos += st.ctx.vals.length;
  f.trap = (1 << T.Break) | (1 << T.Continue);
  return doBlock(st.body);
}

native('remove-each', "[\"Removes the values of a series for which the block gives true.\" 'word [word! block!] data [series!] body [block!]]", (_t, f, v) => {
  const data = f.args[1] as SeriesCell;
  if (f.phase === 0) {
    f.phase = 1;
    f.data = { ...eachSetup(f), pos: data.i, out: [], keep: (data.s.data as Item[]).slice(0, data.i) } satisfies EachState;
  }
  const st = f.data as EachState;
  const n = st.ctx.vals.length;
  const th = f.thrown;
  f.thrown = null;
  const broke = th !== null && th.kind === T.Break;
  if (v !== null || th !== null) {
    const from = st.pos - n;
    const chunk = (data.s.data as Item[]).slice(from, Math.min(from + n, data.s.data.length));
    if (broke || v === null || !truthy(v)) st.keep.push(...chunk);
  }
  const step = broke ? null : eachNext(f, st, data);
  if (step !== null) return step;
  if (broke) st.keep.push(...(data.s.data as Item[]).slice(st.pos));
  splice(data.s as Series<Item>, 0, data.s.data.length, st.keep);
  return value(data);
});

native('map-each', "[\"A block of what the block gives for each value of a series.\" 'word [word! block!] data [series!] body [block!]]", (_t, f, v) => {
  const data = f.args[1] as SeriesCell;
  if (f.phase === 0) {
    f.phase = 1;
    f.data = { ...eachSetup(f), pos: data.i, out: [], keep: [] } satisfies EachState;
  }
  const st = f.data as EachState;
  const th = f.thrown;
  f.thrown = null;
  if (th !== null && th.kind === T.Break) return value({ t: K.Block, s: { data: st.out }, i: 0 });
  if (v !== null && v.t !== K.Unset) {
    if (v.t === K.Block) st.out.push(...v.s.data.slice(v.i));
    else st.out.push(v);
  }
  return eachNext(f, st, data) ?? value({ t: K.Block, s: { data: st.out }, i: 0 });
});

// --- set operations ----------------------------------------------------------------

function itemEq(t: Kind, cased: boolean): (a: Item, b: Item) => boolean {
  if (isAnyBlock(t)) return (a, b) => (cased ? strictEqual(a as Cell, b as Cell) : isEqual(a as Cell, b as Cell));
  if (cased || t === K.Binary) return (a, b) => a === b;
  return (a, b) => foldCase(a as number) === foldCase(b as number);
}

function distinct(list: Item[], eq: (a: Item, b: Item) => boolean): Item[] {
  const out: Item[] = [];
  for (const x of list) if (!out.some(y => eq(x, y))) out.push(x);
  return out;
}

function setResult(like: SeriesCell, list: Item[]): Cell {
  return { t: like.t, s: { data: list }, i: 0 } as Cell;
}

function setOp(f: NativeFrame, two: boolean, pick: (a: Item[], b: Item[], eq: (x: Item, y: Item) => boolean) => Item[]): Step {
  const a = f.args[0] as SeriesCell;
  const b = two ? f.args[1] as SeriesCell : null;
  if (b !== null && isAnyBlock(a.t) !== isAnyBlock(b.t)) return fail('script', 'bad-set', 'both series must be of the same kind');
  const eq = itemEq(a.t, used(f.args[two ? 2 : 1]!));
  const xs = (a.s.data as Item[]).slice(a.i);
  const ys = b === null ? [] : (b.s.data as Item[]).slice(b.i);
  return value(setResult(a, pick(xs, ys, eq)));
}

native('unique', '["The values of the series, each once." set [series!] /case]', (_t, f) => setOp(f, false, (a, _b, eq) => distinct(a, eq)));
native('union', '["The values that are in either series, each once." a [series!] b [series!] /case]', (_t, f) => setOp(f, true, (a, b, eq) => distinct([...a, ...b], eq)));
native('intersect', '["The values that are in both series." a [series!] b [series!] /case]', (_t, f) =>
  setOp(f, true, (a, b, eq) => distinct(a.filter(x => b.some(y => eq(x, y))), eq)));
// Of two dates, the time between them (R3).
native('difference', '["The values that are in one series but not the other; of two dates, the time between them." a [series! date!] b [series! date!] /case]', (_t, f) => {
  const [a, b] = f.args as [Cell, Cell];
  if (a.t === K.Date || b.t === K.Date) {
    if (a.t !== K.Date || b.t !== K.Date) return fail('script', 'bad-set', 'difference takes two dates or two series');
    return value(time(dateDiff(a.v, b.v)));
  }
  return setOp(f, true, (xs, ys, eq) => distinct([...xs.filter(x => !ys.some(y => eq(x, y))), ...ys.filter(y => !xs.some(x => eq(x, y)))], eq));
});
native('exclude', '["The values of the first series that are not in the second." a [series!] b [series!] /case]', (_t, f) =>
  setOp(f, true, (a, b, eq) => distinct(a.filter(x => !b.some(y => eq(x, y))), eq)));
