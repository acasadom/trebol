// Control natives: evaluation, conditionals, loops, exits and errors.
//
// Each one is a small state machine over `f.phase`: phase 0 is the first
// call with the arguments; later phases receive the value of the block or
// expression the native asked the evaluator for.

import { K } from '../kinds.ts';
import * as I64 from '../int64.ts';
import { NONE, UNSET, block, context, type Cell, type BlockCell, type Ctx, type WordCell } from '../values.ts';
import { bindSeries, copyDeep } from '../ctx.ts';
import { T, type Feed, type NativeFrame, type Thrown } from '../eval.ts';
import { isEqual } from '../compare.ts';
import { native, value, fail, truthy, doBlock } from './define.ts';
import { loadUser } from './data.ts';

const LOOP_TRAP = (1 << T.Break) | (1 << T.Continue);

/** Takes the pending throw of a trapping native. */
function caught(f: NativeFrame): Thrown | null {
  const th = f.thrown;
  f.thrown = null;
  return th;
}

// --- evaluation ------------------------------------------------------------------

native('do', '[value [any-type!]]', (t, f, v) => {
  if (f.phase === 1) return value(v!);
  const x = f.args[0]!;
  switch (x.t) {
    case K.Block: case K.Paren:
      f.phase = 1;
      return { k: 'do', s: x.s, i: x.i };
    case K.String: {
      const b = loadUser(t.rt, x);
      if (b.k !== 'value') return b;
      f.phase = 1;
      return doBlock(b.v as BlockCell);
    }
    case K.Error:
      return { k: 'throw', e: { kind: T.Error, v: x, name: null } };
  }
  return value(x);
});

native('reduce', '[value [any-value!]]', (_t, f, v) => {
  const x = f.args[0]!;
  if (x.t !== K.Block) return value(x);
  if (f.phase === 0) {
    f.phase = 1;
    f.data = { feed: { s: x.s, i: x.i }, out: [] };
  }
  const st = f.data as { feed: Feed; out: Cell[] };
  if (v !== null) st.out.push(v);
  if (st.feed.i >= st.feed.s.data.length) return value(block(st.out));
  return { k: 'expr', feed: st.feed };
});

native('quote', '[:value [any-type!]]', (_t, f) => value(f.args[0]!));

// --- conditionals ----------------------------------------------------------------

native('if', '[condition [any-value!] body [block!]]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);
  if (!truthy(f.args[0]!)) return value(NONE);
  f.phase = 1;
  return doBlock(f.args[1] as BlockCell);
});

native('unless', '[condition [any-value!] body [block!]]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);
  if (truthy(f.args[0]!)) return value(NONE);
  f.phase = 1;
  return doBlock(f.args[1] as BlockCell);
});

native('either', '[condition [any-value!] true-body [block!] false-body [block!]]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  return doBlock(f.args[truthy(f.args[0]!) ? 1 : 2] as BlockCell);
});

native('not', '[value [any-value!]]', (_t, f) => value({ t: K.Logic, v: !truthy(f.args[0]!) }));

/** `all` and `any`: evaluate expressions until one is false (all) or true (any). */
function shortCircuit(f: NativeFrame, v: Cell | null, stopOn: boolean) {
  const b = f.args[0] as BlockCell;
  if (f.phase === 0) {
    f.phase = 1;
    f.data = { s: b.s, i: b.i } satisfies Feed;
  }
  const feed = f.data as Feed;
  if (v !== null) {
    if (truthy(v) === stopOn) return value(stopOn ? v : NONE);
    if (feed.i >= feed.s.data.length) return value(stopOn ? NONE : v);
  } else if (feed.i >= feed.s.data.length) {
    return value(stopOn ? NONE : { t: K.Logic, v: true });
  }
  return { k: 'expr', feed } as const;
}

native('all', '[block [block!]]', (_t, f, v) => shortCircuit(f, v, false));
native('any', '[block [block!]]', (_t, f, v) => shortCircuit(f, v, true));

native('case', '[cases [block!] /all]', (_t, f, v) => {
  const b = f.args[0] as BlockCell;
  const every = f.args[1]!.t === K.Logic;
  if (f.phase === 0) f.data = { feed: { s: b.s, i: b.i }, out: NONE };
  const st = f.data as { feed: Feed; out: Cell };
  const data = st.feed.s.data;
  if (f.phase === 1) {
    // v is a condition
    const body = data[st.feed.i];
    if (body === undefined) return fail('script', 'case-body', 'case condition has no block after it');
    st.feed.i++;
    if (truthy(v!)) {
      if (body.t !== K.Block) return value(body);
      f.phase = 2;
      return doBlock(body);
    }
  } else if (f.phase === 2) {
    // v is the result of a body
    if (!every) return value(v!);
    st.out = v!;
  }
  if (st.feed.i >= data.length) return value(st.out);
  f.phase = 1;
  return { k: 'expr', feed: st.feed };
});

native('switch', '[value [any-value!] cases [block!] /default case [block!]]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);
  const x = f.args[0]!;
  const cases = f.args[1] as BlockCell;
  const data = cases.s.data;
  for (let i = cases.i; i < data.length; i++) {
    const c = data[i]!;
    if (c.t !== K.Block && isEqual(c, x)) {
      let j = i + 1;
      while (j < data.length && data[j]!.t !== K.Block) j++;
      const body = data[j];
      if (body === undefined) return value(NONE);
      f.phase = 1;
      return doBlock(body as BlockCell);
    }
  }
  if (f.args[2]!.t === K.Logic) {
    f.phase = 1;
    return doBlock(f.args[3] as BlockCell);
  }
  return value(NONE);
});

// --- loops -----------------------------------------------------------------------

interface LoopState { left: number; out: Cell }

/** Shared break/continue handling. Returns a final Step on break, else null. */
function loopThrow(f: NativeFrame, st: { out: Cell }, v: Cell | null) {
  const th = caught(f);
  if (th !== null) {
    if (th.kind === T.Break) return value(th.v);
  } else if (v !== null) {
    st.out = v;
  }
  return null;
}

native('loop', '[count [integer!] body [block!]]', (_t, f, v) => {
  if (f.phase === 0) {
    f.phase = 1;
    f.trap = LOOP_TRAP;
    f.data = { left: I64.toNumber((f.args[0] as { v: I64.I64 }).v), out: NONE } satisfies LoopState;
  }
  const st = f.data as LoopState;
  const stop = loopThrow(f, st, v);
  if (stop !== null) return stop;
  if (st.left <= 0) return value(st.out);
  st.left--;
  return doBlock(f.args[1] as BlockCell);
});

/** A fresh context for loop words, and the body copied and bound to it. */
function loopBody(words: Cell, body: BlockCell): { ctx: Ctx; body: BlockCell } {
  const list = words.t === K.Block ? words.s.data.slice(words.i) : [words];
  const ctx = context(list.map(w => (w as WordCell).sym), list.map(() => NONE));
  const s = copyDeep(body.s, body.i);
  bindSeries(s, ctx);
  return { ctx, body: { t: K.Block, s, i: 0 } };
}

native('repeat', "['word [word!] count [integer!] body [block!]]", (_t, f, v) => {
  if (f.phase === 0) {
    f.phase = 1;
    f.trap = LOOP_TRAP;
    const n = I64.toNumber((f.args[1] as { v: I64.I64 }).v);
    f.data = { ...loopBody(f.args[0]!, f.args[2] as BlockCell), n, i: 0, out: NONE };
  }
  const st = f.data as { ctx: Ctx; body: BlockCell; n: number; i: number; out: Cell };
  const stop = loopThrow(f, st, v);
  if (stop !== null) return stop;
  if (st.i >= st.n) return value(st.out);
  st.i++;
  st.ctx.vals[0] = { t: K.Integer, v: st.i };
  return doBlock(st.body);
});

native('foreach', "['word [word! block!] data [series!] body [block!]]", (_t, f, v) => {
  const data = f.args[1]!;
  if (f.phase === 0) {
    f.phase = 1;
    f.trap = LOOP_TRAP;
    const words = f.args[0]!;
    if (words.t === K.Block && (words.s.data.length === words.i || words.s.data.slice(words.i).some(w => w.t !== K.Word))) {
      return fail('script', 'bad-words', 'foreach needs one or more words');
    }
    f.data = { ...loopBody(words, f.args[2] as BlockCell), at: (data as BlockCell).i, out: NONE };
  }
  const st = f.data as { ctx: Ctx; body: BlockCell; at: number; out: Cell };
  const stop = loopThrow(f, st, v);
  if (stop !== null) return stop;
  const items = (data as BlockCell).s.data as unknown[];
  if (st.at >= items.length) return value(st.out);
  for (let k = 0; k < st.ctx.vals.length; k++) st.ctx.vals[k] = itemAt(data, st.at + k);
  st.at += st.ctx.vals.length;
  return doBlock(st.body);
});

/** Element `i` of any series as a cell, or none past the end. */
function itemAt(series: Cell, i: number): Cell {
  if (series.t === K.Binary) {
    const b = series.s.data[i];
    return b === undefined ? NONE : { t: K.Integer, v: b };
  }
  if (series.t >= K.String && series.t <= K.Tag) {
    const cp = (series as { s: { data: number[] } }).s.data[i];
    return cp === undefined ? NONE : { t: K.Char, v: cp };
  }
  return (series as BlockCell).s.data[i] ?? NONE;
}

native('while', '[condition [block!] body [block!]]', (_t, f, v) => {
  if (f.phase === 0) {
    f.trap = LOOP_TRAP;
    f.data = { out: NONE };
  }
  const st = f.data as { out: Cell };
  const th = caught(f);
  if (th !== null && th.kind === T.Break) return value(th.v);
  if (f.phase === 1 && th === null) {
    // v is the condition
    if (!truthy(v!)) return value(st.out);
    f.phase = 2;
    return doBlock(f.args[1] as BlockCell);
  }
  if (f.phase === 2 && th === null) st.out = v!;
  f.phase = 1;
  return doBlock(f.args[0] as BlockCell);
});

native('until', '[body [block!]]', (_t, f, v) => {
  const th = caught(f);
  if (th !== null && th.kind === T.Break) return value(th.v);
  if (f.phase === 1 && th === null && truthy(v!)) return value(v!);
  f.phase = 1;
  f.trap = LOOP_TRAP;
  return doBlock(f.args[0] as BlockCell);
});

native('break', '[/return value [any-value!]]', (_t, f) =>
  ({ k: 'throw', e: { kind: T.Break, v: f.args[0]!.t === K.Logic ? f.args[1]! : NONE, name: null } }));

native('continue', '[]', () => ({ k: 'throw', e: { kind: T.Continue, v: UNSET, name: null } }));

// --- functions -------------------------------------------------------------------

native('return', '[value [any-type!]]', (_t, f) =>
  ({ k: 'throw', e: { kind: T.Return, v: f.args[0]!, name: null } }));

native('exit', '[]', () => ({ k: 'throw', e: { kind: T.Return, v: UNSET, name: null } }));

// --- errors and throws -----------------------------------------------------------

native('try', '[body [block!]]', (_t, f, v) => {
  const th = caught(f);
  if (th !== null) return value(th.v);
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  f.trap = 1 << T.Error;
  return doBlock(f.args[0] as BlockCell);
});

native('attempt', '[body [block!]]', (_t, f, v) => {
  if (caught(f) !== null) return value(NONE);
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  f.trap = 1 << T.Error;
  return doBlock(f.args[0] as BlockCell);
});

native('catch', '[body [block!] /name word [word! block!]]', (_t, f, v) => {
  const th = caught(f);
  if (th !== null) {
    const named = f.args[1]!.t === K.Logic;
    const names = f.args[2]!;
    const list = names.t === K.Block ? names.s.data.slice(names.i) : [names];
    const match = named
      ? th.name !== null && list.some(n => isEqual(n, th.name!))
      : th.name === null;
    return match ? value(th.v) : { k: 'throw', e: th };
  }
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  f.trap = 1 << T.Throw;
  return doBlock(f.args[0] as BlockCell);
});

native('throw', '[value [any-value!] /name word [word!]]', (_t, f) =>
  ({ k: 'throw', e: { kind: T.Throw, v: f.args[0]!, name: f.args[1]!.t === K.Logic ? f.args[2]! : null } }));
