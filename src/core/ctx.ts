// Contexts and definitional binding.
//
// A word carries a reference to the context it is bound to, fixed when code
// is loaded or when a function or object is made, never at evaluation time.
// Binding a block replaces its word cells with bound copies in place: the
// series is mutable, the cells are not.
//
// Only the user context has a parent (lib). A word bound to user that has no
// key there is looked up in lib; assigning it adds the key to user, so user
// code can shadow lib without touching it.

import { K, isAnyBlock } from './kinds.ts';
import { canon, intern, type Sym } from './symbols.ts';
import { UNSET, type Cell, type Ctx, type Series, type BlockCell, type WordCell } from './values.ts';

/** Below this many keys a linear scan beats building a hash index. */
const SCAN_LIMIT = 8;

/** Index of `sym` in `ctx` (case-insensitive), or -1. Ignores the parent. */
export function ctxFind(ctx: Ctx, sym: Sym): number {
  const c = canon(sym);
  const keys = ctx.keys;
  if (keys.length <= SCAN_LIMIT && ctx.idx === undefined) {
    for (let i = 0; i < keys.length; i++) if (canon(keys[i]!) === c) return i;
    return -1;
  }
  let idx = ctx.idx;
  let n = ctx.idxN ?? 0;
  if (idx === undefined) {
    idx = new Map();
    ctx.idx = idx;
    n = 0;
  }
  for (; n < keys.length; n++) {
    const k = canon(keys[n]!);
    if (!idx.has(k)) idx.set(k, n);
  }
  ctx.idxN = n;
  return idx.get(c) ?? -1;
}

/** Appends a key (which must not exist yet) and returns its index. */
export function ctxAdd(ctx: Ctx, sym: Sym, v: Cell = UNSET): number {
  ctx.keys.push(sym);
  ctx.vals.push(v);
  return ctx.keys.length - 1;
}

/** Index of `sym`, adding it (unset) when missing. */
export function ctxEnsure(ctx: Ctx, sym: Sym): number {
  const i = ctxFind(ctx, sym);
  return i >= 0 ? i : ctxAdd(ctx, sym);
}

/** The value of a bound word, following the parent chain; null if unbound or absent. */
export function getWord(w: WordCell): Cell | null {
  for (let ctx = w.bind; ctx !== null; ctx = ctx.parent) {
    const i = ctxFind(ctx, w.sym);
    if (i >= 0) return ctx.vals[i]!;
    if (ctx.self === true && canon(w.sym) === SELF) return { t: K.Object, ctx };
  }
  return null;
}

const SELF = canon(intern('self'));

/** Binds every `self` word in a block, deeply, to an object context. */
export function bindSelf(s: Series<Cell>, ctx: Ctx, seen = new Set<Series<Cell>>()): void {
  if (seen.has(s)) return;
  seen.add(s);
  const data = s.data;
  for (let i = 0; i < data.length; i++) {
    const c = data[i]!;
    if (isBindable(c) && canon(c.sym) === SELF) data[i] = { t: c.t, sym: c.sym, bind: ctx };
    else if (isAnyBlock(c.t)) bindSelf((c as BlockCell).s, ctx, seen);
  }
}

/** Sets a bound word in its own context, adding the key if needed. False if unbound. */
export function setWord(w: WordCell, v: Cell): boolean {
  const ctx = w.bind;
  if (ctx === null) return false;
  ctx.vals[ctxEnsure(ctx, w.sym)] = v;
  return true;
}

// --- binding -----------------------------------------------------------------

export function isBindable(c: Cell): c is WordCell {
  return c.t === K.Word || c.t === K.SetWord || c.t === K.GetWord || c.t === K.LitWord;
}

/**
 * Binds the words of a block, deeply and in place.
 * With `all`, every word is bound to `ctx`; otherwise only words whose
 * symbol is a key of `ctx`.
 */
export function bindSeries(s: Series<Cell>, ctx: Ctx, all = false, seen = new Set<Series<Cell>>()): void {
  if (seen.has(s)) return;
  seen.add(s);
  const data = s.data;
  for (let i = 0; i < data.length; i++) {
    const c = data[i]!;
    if (isBindable(c)) {
      if (c.bind !== ctx && (all || ctxFind(ctx, c.sym) >= 0)) data[i] = { t: c.t, sym: c.sym, bind: ctx };
    } else if (isAnyBlock(c.t)) {
      bindSeries((c as BlockCell).s, ctx, all, seen);
    }
  }
}

/** Adds every top-level set-word of a block to `ctx` (unset), as `make object!` does. */
export function collectSetWords(s: Series<Cell>, from: number, ctx: Ctx): void {
  const data = s.data;
  for (let i = from; i < data.length; i++) {
    const c = data[i]!;
    if (c.t === K.SetWord) ctxEnsure(ctx, c.sym);
  }
}

// --- copying -------------------------------------------------------------------

/**
 * Deep copy of the block-like series reachable from `s[from..]`; strings and
 * other series are shared. Words bound to `from` are rebound to `to` on the
 * way, which is how a function body is instantiated for each call.
 */
export function copyDeep(s: Series<Cell>, start = 0, rebindFrom: Ctx | null = null, rebindTo: Ctx | null = null): Series<Cell> {
  return copyRec(s, start, rebindFrom, rebindTo, new Map());
}

function copyRec(
  s: Series<Cell>, start: number, from: Ctx | null, to: Ctx | null,
  done: Map<Series<Cell>, Series<Cell>>,
): Series<Cell> {
  const whole = start === 0;
  if (whole) {
    const prev = done.get(s);
    if (prev !== undefined) return prev;
  }
  const out: Series<Cell> = { data: [] };
  if (whole) done.set(s, out);
  if (s.nl) out.nl = s.nl.slice(start);
  if (s.pos) out.pos = s.pos.slice(start);
  if (s.file !== undefined) out.file = s.file;
  const data = s.data;
  for (let i = start; i < data.length; i++) {
    const c = data[i]!;
    if (from !== null && isBindable(c) && c.bind === from) {
      out.data.push({ t: c.t, sym: c.sym, bind: to });
    } else if (isAnyBlock(c.t)) {
      const b = c as BlockCell;
      out.data.push({ t: b.t, s: copyRec(b.s, 0, from, to, done), i: b.i });
    } else {
      out.data.push(c);
    }
  }
  return out;
}
