// The evaluator.
//
// A loop over an explicit stack of frames: evaluation never nests on the JS
// stack, so a task can stop at any point (a native returning `await`, or the
// step budget running out) and continue later from exactly the same place.
//
// Frames communicate through one register, `task.v`: a frame that needs a
// value pushes a child frame and leaves `task.v` null; when the child pops it
// puts its result in `task.v` and the parent, back on top, consumes it.
//
// Natives get their arguments already evaluated and answer with a Step. To
// evaluate code (`if`, `loop`, `try`...) they return `do` or `expr` and are
// called again with the result; they never call the evaluator themselves.
// Errors, `break`, `return` and `throw` travel as a `Thrown` that unwinds
// frames until a native that traps it, or a function call for `return`.

import { K, kindName, kindBit } from './kinds.ts';
import { spell, canon, type Sym } from './symbols.ts';
import {
  NONE, UNSET, TRUE, string, blockOf,
  type Cell, type Ctx, type Series, type BlockCell, type WordCell, type ObjectCell, type OpaqueCell,
} from './values.ts';
import { getWord, setWord, copyDeep } from './ctx.ts';
import { makeError, fillErrorField } from './errors.ts';
import { P, type Spec, type FuncDef, type NativeDef, type OpDef } from './func.ts';
import { pick, poke } from './access.ts';
import { sourceOf } from './mold.ts';

// --- steps and throws ------------------------------------------------------------

/** What a thrown value is: an error, or one of the non-local exits. */
export const T = { Error: 0, Break: 1, Continue: 2, Return: 3, Throw: 4 } as const;
export type TKind = (typeof T)[keyof typeof T];

export interface Thrown {
  readonly kind: TKind;
  /** The error!, the `break/return` or `return` value, or the thrown value. */
  readonly v: Cell;
  /** `throw/name` only. */
  readonly name: Cell | null;
}

/** A read position in a block, shared by the frames evaluating from it. */
export interface Feed {
  s: Series<Cell>;
  i: number;
}

export type Step =
  /** Finished, with this result. */
  | { readonly k: 'value'; readonly v: Cell }
  /** Evaluate this block, then call me again with its result. */
  | { readonly k: 'do'; readonly s: Series<Cell>; readonly i: number }
  /** Evaluate one expression from this feed, then call me again with it. */
  | { readonly k: 'expr'; readonly feed: Feed }
  /**
   * Call a function with these arguments, then call me again with the result.
   * With `full`, `args` follows the whole spec as `apply` does: refinements
   * take a truthy value to be used, followed by their own arguments.
   */
  | { readonly k: 'call'; readonly fn: Cell; readonly args: readonly Cell[]; readonly full?: boolean }
  /** Park the task until the host resumes it with the promise's value. */
  | { readonly k: 'await'; readonly p: Promise<Cell> }
  /** Unwind with an error or a non-local exit. */
  | { readonly k: 'throw'; readonly e: Thrown };

// --- frames ----------------------------------------------------------------------

export const F = { Do: 0, Expr: 1, Set: 2, Args: 3, Native: 4, Call: 5, Path: 6 } as const;

/** Evaluates expressions until the end of the feed; the result is the last one. */
interface DoFrame { readonly k: typeof F.Do; readonly feed: Feed; out: Cell }

/** One expression: a primary value, then any infix operators after it. */
interface ExprFrame {
  readonly k: typeof F.Expr;
  readonly feed: Feed;
  /** False for the right operand of an op, which takes no infix of its own. */
  readonly infix: boolean;
  start: number;
  state: 0 | 1;
}

/** Waits for a value to assign to a set-word. */
interface SetFrame { readonly k: typeof F.Set; readonly w: WordCell }

/** Gathers the arguments of a call. */
interface ArgsFrame {
  readonly k: typeof F.Args;
  readonly feed: Feed | null;
  readonly fn: OpaqueCell;
  readonly spec: Spec;
  /** The frame values, laid out as `spec.params`. */
  readonly vals: Cell[];
  /** Indexes into `vals` still to gather, in order. */
  readonly plan: number[];
  n: number;
  readonly name: Sym | null;
  readonly op: boolean;
}

/** A native running; it may evaluate code and be called again. */
export interface NativeFrame {
  readonly k: typeof F.Native;
  readonly def: NativeDef;
  /** Arguments laid out as the native's spec. */
  readonly args: Cell[];
  /** Free for the native: where it is in its work. Starts at 0. */
  phase: number;
  /** Free for the native: state kept between calls. */
  data: unknown;
  /** Bitmask of thrown kinds (`1 << T.x`) the native wants to catch. */
  trap: number;
  /** Set when a trapped throw arrives; the native is then called with v = null. */
  thrown: Thrown | null;
  readonly name: Sym | null;
}

/** A function body running; catches `return`. */
interface CallFrame { readonly k: typeof F.Call; readonly def: FuncDef; readonly name: Sym | null }

const PM = { Call: 0, Get: 1, Set: 2 } as const;
type PathMode = (typeof PM)[keyof typeof PM];
const PS = { Start: 0, Walk: 1, WaitKey: 2, WaitValue: 3 } as const;

/** Evaluates a path: picks segment by segment, and calls a function at the end. */
interface PathFrame {
  readonly k: typeof F.Path;
  readonly feed: Feed;
  readonly path: BlockCell;
  readonly mode: PathMode;
  state: (typeof PS)[keyof typeof PS];
  j: number;
  cur: Cell;
  setv: Cell;
}

type Frame = DoFrame | ExprFrame | SetFrame | ArgsFrame | NativeFrame | CallFrame | PathFrame;

// --- natives ---------------------------------------------------------------------

/**
 * A native: called first with `v` null and `f.phase` 0, then again with the
 * result of each `do`, `expr`, `call` or `await` it returns.
 */
export type NativeFn = (t: Task, f: NativeFrame, v: Cell | null) => Step;

interface NativeEntry { readonly def: NativeDef; readonly fn: NativeFn }

const NATIVES: NativeEntry[] = [];

/** Adds a native to the global table. `boot` installs every registered native in lib. */
export function registerNative(def: Omit<NativeDef, 'id'>, fn: NativeFn): OpaqueCell {
  const full: NativeDef = { ...def, id: NATIVES.length };
  NATIVES.push({ def: full, fn });
  return { t: K.Native, p: full };
}

export function registeredNatives(): readonly NativeDef[] {
  return NATIVES.map(n => n.def);
}

// --- tasks -----------------------------------------------------------------------

export interface Runtime {
  readonly lib: Ctx;
  readonly user: Ctx;
}

export interface Task {
  readonly rt: Runtime;
  readonly stack: Frame[];
  /** The value register. */
  v: Cell | null;
  thrown: Thrown | null;
  /** Set while parked on an `await`. */
  waiting: Promise<Cell> | null;
}

export type RunResult =
  | { readonly k: 'done'; readonly v: Cell }
  | { readonly k: 'error'; readonly e: ObjectCell }
  | { readonly k: 'await'; readonly p: Promise<Cell> }
  | { readonly k: 'yield' };

/** A task that evaluates `block`. */
export function newTask(rt: Runtime, s: Series<Cell>, i = 0): Task {
  const t: Task = { rt, stack: [], v: null, thrown: null, waiting: null };
  pushDo(t, s, i);
  return t;
}

/** Continues a parked task with the awaited value. */
export function resume(t: Task, v: Cell): void {
  t.waiting = null;
  t.v = v;
}

/** Continues a parked task with an error (a rejected promise). */
export function resumeError(t: Task, e: ObjectCell): void {
  t.waiting = null;
  t.thrown = { kind: T.Error, v: e, name: null };
}

/**
 * Runs a task for at most `budget` steps. Returns `yield` when the budget
 * runs out (call again to continue) and `await` when a native parked it.
 */
export function run(t: Task, budget = Infinity): RunResult {
  if (t.waiting !== null) return { k: 'await', p: t.waiting };
  for (let n = 0; n < budget; n++) {
    if (t.thrown !== null) {
      const done = unwind(t);
      if (done !== null) return done;
      continue;
    }
    const f = t.stack[t.stack.length - 1];
    if (f === undefined) return { k: 'done', v: t.v ?? UNSET };
    switch (f.k) {
      case F.Do: doFrame(t, f); break;
      case F.Expr: if (f.state === 0) exprStart(t, f); else exprInfix(t, f); break;
      case F.Set: setFrame(t, f); break;
      case F.Args: argsFrame(t, f); break;
      case F.Native: {
        const v = t.v;
        t.v = null;
        applyStep(t, f, NATIVES[f.def.id]!.fn(t, f, v));
        break;
      }
      case F.Call: {
        const v = t.v ?? UNSET;
        t.v = null;
        t.stack.pop();
        finishCall(t, f, v);
        break;
      }
      case F.Path: pathFrame(t, f); break;
    }
    if (t.waiting !== null) return { k: 'await', p: t.waiting };
  }
  return { k: 'yield' };
}

/** The file of the innermost code being evaluated, if it was loaded from one. */
export function currentFile(t: Task): string | null {
  for (let i = t.stack.length - 1; i >= 0; i--) {
    const f = t.stack[i]!;
    if ((f.k === F.Do || f.k === F.Expr) && f.feed.s.file !== undefined) return f.feed.s.file;
  }
  return null;
}

// --- errors ----------------------------------------------------------------------

export function throwError(type: string, id: string, message: string): Step {
  return { k: 'throw', e: { kind: T.Error, v: makeError(type, id, message), name: null } };
}

function fail(t: Task, type: string, id: string, message: string): void {
  t.v = null;
  t.thrown = { kind: T.Error, v: makeError(type, id, message), name: null };
}

const nameOf = (s: Sym | null): string => (s === null ? 'function' : spell(s));

function unwind(t: Task): RunResult | null {
  const th = t.thrown!;
  const f = t.stack[t.stack.length - 1];
  if (f === undefined) {
    t.thrown = null;
    return { k: 'error', e: uncaught(th) };
  }
  const e = th.kind === T.Error ? th.v as ObjectCell : null;
  switch (f.k) {
    case F.Native:
      if (f.trap & (1 << th.kind)) {
        f.thrown = th;
        t.thrown = null;
        t.v = null;
        applyStep(t, f, NATIVES[f.def.id]!.fn(t, f, null));
        return null;
      }
      if (e !== null && f.name !== null) fillErrorField(e, 'where', { t: K.Word, sym: f.name, bind: null });
      break;
    case F.Call:
      if (th.kind === T.Return) {
        t.stack.pop();
        t.thrown = null;
        finishCall(t, f, th.v);
        return null;
      }
      if (th.kind === T.Break || th.kind === T.Continue) {
        t.thrown = { kind: T.Error, v: uncaught(th), name: null };
        return null;
      }
      if (e !== null && f.name !== null) fillErrorField(e, 'where', { t: K.Word, sym: f.name, bind: null });
      break;
    case F.Args:
      if (e !== null && f.name !== null) fillErrorField(e, 'where', { t: K.Word, sym: f.name, bind: null });
      break;
    case F.Expr:
      if (e !== null) {
        const s = f.feed.s;
        const end = Math.max(f.feed.i, f.start + 1);
        fillErrorField(e, 'near', blockOf(K.Block, s.data.slice(f.start, Math.min(end, f.start + 4))));
        const at = sourceOf(s, f.start);
        if (at !== null) fillErrorField(e, 'at', string(at));
      }
      break;
  }
  t.stack.pop();
  return null;
}

/** A throw that reached the top: errors as they are, other exits become errors. */
function uncaught(th: Thrown): ObjectCell {
  switch (th.kind) {
    case T.Error: return th.v as ObjectCell;
    case T.Break: return makeError('script', 'no-loop', 'break used outside of a loop');
    case T.Continue: return makeError('script', 'no-loop', 'continue used outside of a loop');
    case T.Return: return makeError('script', 'no-function', 'return used outside of a function');
    default: return makeError('script', 'no-catch', 'throw has no catch');
  }
}

// --- frame handlers --------------------------------------------------------------

function pushDo(t: Task, s: Series<Cell>, i: number): void {
  t.stack.push({ k: F.Do, feed: { s, i }, out: UNSET });
}

function pushExpr(t: Task, feed: Feed, infix: boolean): void {
  t.stack.push({ k: F.Expr, feed, infix, start: feed.i, state: 0 });
}

function doFrame(t: Task, f: DoFrame): void {
  if (t.v !== null) {
    f.out = t.v;
    t.v = null;
  }
  if (f.feed.i >= f.feed.s.data.length) {
    t.stack.pop();
    t.v = f.out;
    return;
  }
  pushExpr(t, f.feed, true);
}

function exprStart(t: Task, f: ExprFrame): void {
  const feed = f.feed;
  const data = feed.s.data;
  f.start = feed.i;
  f.state = 1;
  const c = data[feed.i++]!;
  switch (c.t) {
    case K.Word: {
      const v = getWord(c);
      if (v === null) return unbound(t, c);
      switch (v.t) {
        case K.Function: case K.Native:
          return beginCall(t, feed, v, c.sym, null, null);
        case K.Op:
          return fail(t, 'script', 'no-op-arg', `${spell(c.sym)} operator is missing its left argument`);
        case K.Unset:
          return fail(t, 'script', 'no-value', `${spell(c.sym)} has no value`);
      }
      t.v = v;
      return;
    }
    case K.SetWord:
      if (feed.i >= data.length) return fail(t, 'script', 'need-value', `${spell(c.sym)}: needs a value`);
      t.stack.push({ k: F.Set, w: c });
      pushExpr(t, feed, true);
      return;
    case K.GetWord: {
      const v = getWord(c);
      if (v === null) return unbound(t, c);
      t.v = v;
      return;
    }
    case K.LitWord:
      t.v = { t: K.Word, sym: c.sym, bind: c.bind };
      return;
    case K.Paren:
      pushDo(t, c.s, c.i);
      return;
    case K.Path: case K.GetPath:
      t.stack.push({
        k: F.Path, feed, path: c, mode: c.t === K.Path ? PM.Call : PM.Get,
        state: PS.Start, j: 0, cur: NONE, setv: NONE,
      });
      return;
    case K.SetPath:
      if (feed.i >= data.length) return fail(t, 'script', 'need-value', 'set-path needs a value');
      t.stack.push({ k: F.Path, feed, path: c, mode: PM.Set, state: PS.WaitValue, j: 0, cur: NONE, setv: NONE });
      pushExpr(t, feed, true);
      return;
    case K.LitPath:
      t.v = { t: K.Path, s: c.s, i: c.i };
      return;
  }
  t.v = c;
}

function exprInfix(t: Task, f: ExprFrame): void {
  if (f.infix) {
    const next = f.feed.s.data[f.feed.i];
    if (next !== undefined && next.t === K.Word) {
      const op = getWord(next);
      if (op !== null && op.t === K.Op) {
        f.feed.i++;
        const left = t.v!;
        t.v = null;
        beginCall(t, f.feed, (op.p as OpDef).fn as OpaqueCell, next.sym, null, left);
        return;
      }
    }
  }
  t.stack.pop(); // the value stays in t.v for the parent
}

function setFrame(t: Task, f: SetFrame): void {
  const v = t.v!;
  t.stack.pop();
  if (v.t === K.Unset) return fail(t, 'script', 'need-value', `${spell(f.w.sym)}: needs a value`);
  if (!setWord(f.w, v)) return unbound(t, f.w);
}

function unbound(t: Task, w: WordCell): void {
  if (w.bind === null) fail(t, 'script', 'not-bound', `${spell(w.sym)} is not bound to a context`);
  else fail(t, 'script', 'no-value', `${spell(w.sym)} has no value`);
}

function specOf(fn: OpaqueCell): Spec {
  return fn.t === K.Native ? (fn.p as NativeDef).spec : (fn.p as FuncDef).spec;
}

/**
 * Starts a call: pushes an Args frame that gathers arguments from `feed`.
 * `refs` are the refinement segments of a path call; `left` is the left
 * operand of an op.
 */
function beginCall(t: Task, feed: Feed | null, fn: Cell, name: Sym | null, refs: readonly Cell[] | null, left: Cell | null): void {
  if (fn.t !== K.Function && fn.t !== K.Native) {
    return fail(t, 'script', 'not-function', `${nameOf(name)} is not a function`);
  }
  const spec = specOf(fn as OpaqueCell);
  const vals: Cell[] = spec.params.map(() => NONE);
  const plan = spec.base.slice();
  if (refs !== null) {
    for (const seg of refs) {
      const ri = seg.t === K.Word
        ? spec.params.findIndex(p => p.kind === P.Ref && canon(p.sym) === canon(seg.sym))
        : -1;
      if (ri < 0) {
        const what = seg.t === K.Word ? spell(seg.sym) : 'that';
        return fail(t, 'script', 'bad-refine', `${nameOf(name)} has no refinement called ${what}`);
      }
      vals[ri] = TRUE;
      spec.params.forEach((p, j) => { if (p.ref === ri) plan.push(j); });
    }
  }
  let n = 0;
  if (left !== null) {
    if (plan.length < 2) return fail(t, 'script', 'bad-op', `${nameOf(name)} needs two arguments to be an operator`);
    vals[plan[0]!] = left;
    n = 1;
  }
  t.stack.push({ k: F.Args, feed, fn: fn as OpaqueCell, spec, vals, plan, n, name, op: left !== null });
}

function argsFrame(t: Task, f: ArgsFrame): void {
  if (t.v !== null) {
    f.vals[f.plan[f.n++]!] = t.v;
    t.v = null;
  }
  const params = f.spec.params;
  if (f.n < f.plan.length) {
    const p = params[f.plan[f.n]!]!;
    const feed = f.feed;
    if (feed === null || feed.i >= feed.s.data.length) {
      return fail(t, 'script', 'no-arg', `${nameOf(f.name)} is missing its ${spell(p.sym)} argument`);
    }
    if (p.kind === P.Arg) return pushExpr(t, feed, !f.op);
    const c = feed.s.data[feed.i++]!;
    if (p.kind === P.Lit && c.t === K.Paren) return pushDo(t, c.s, c.i);
    if (p.kind === P.Lit && c.t === K.GetWord) {
      const v = getWord(c);
      if (v === null) return unbound(t, c);
      t.v = v;
      return;
    }
    t.v = c;
    return;
  }
  for (const i of f.plan) {
    const p = params[i]!;
    const v = f.vals[i]!;
    if ((p.types & kindBit(v.t)) === 0n) {
      return fail(t, 'script', 'expect-arg',
        `${nameOf(f.name)} does not allow ${kindName(v.t)} for its ${spell(p.sym)} argument`);
    }
  }
  t.stack.pop();
  if (f.fn.t === K.Native) {
    t.stack.push({
      k: F.Native, def: f.fn.p as NativeDef, args: f.vals,
      phase: 0, data: null, trap: 0, thrown: null, name: f.name,
    });
    return;
  }
  const def = f.fn.p as FuncDef;
  const ctx: Ctx = { keys: def.tmpl.keys, vals: f.vals, parent: null };
  const body = copyDeep(def.body, 0, def.tmpl, ctx);
  t.stack.push({ k: F.Call, def, name: f.name });
  pushDo(t, body, 0);
}

function finishCall(t: Task, f: CallFrame, v: Cell): void {
  const ret = f.def.spec.ret;
  if (ret !== null && (ret & kindBit(v.t)) === 0n) {
    return fail(t, 'script', 'bad-return', `${nameOf(f.name)} does not allow ${kindName(v.t)} as its result`);
  }
  t.v = v;
}

function applyStep(t: Task, f: NativeFrame, step: Step): void {
  switch (step.k) {
    case 'value':
      t.stack.pop();
      t.v = step.v;
      return;
    case 'do':
      pushDo(t, step.s, step.i);
      return;
    case 'expr':
      pushExpr(t, step.feed, true);
      return;
    case 'call': {
      const depth = t.stack.length;
      beginCall(t, null, step.fn, f.name, null, null);
      const a = t.stack[t.stack.length - 1];
      if (t.stack.length > depth && a !== undefined && a.k === F.Args) {
        if (step.full) {
          applyFull(a, step.args);
          return;
        }
        const n = Math.min(step.args.length, a.plan.length);
        for (let i = 0; i < n; i++) a.vals[a.plan[i]!] = step.args[i]!;
        a.n = n;
      }
      return;
    }
    case 'await':
      t.waiting = step.p;
      return;
    case 'throw': {
      // A native that throws is finished: pop it so it cannot trap its own throw.
      const e = step.e;
      if (e.kind === T.Error && f.name !== null) {
        fillErrorField(e.v as ObjectCell, 'where', { t: K.Word, sym: f.name, bind: null });
      }
      t.stack.pop();
      t.thrown = e;
      return;
    }
  }
}

/** Fills an Args frame from arguments laid out as the whole spec (see `call` with `full`). */
function applyFull(a: ArgsFrame, args: readonly Cell[]): void {
  const params = a.spec.params;
  a.plan.length = 0;
  let k = 0;
  let on = true;
  for (let i = 0; i < params.length; i++) {
    const p = params[i]!;
    if (p.kind === P.Local) continue;
    const v = args[k++] ?? NONE;
    if (p.kind === P.Ref) {
      on = v.t !== K.None && !(v.t === K.Logic && !v.v);
      a.vals[i] = on ? TRUE : NONE;
    } else if (p.ref < 0 || on) {
      a.vals[i] = v;
      a.plan.push(i);
    }
  }
  a.n = a.plan.length;
}

// --- paths -----------------------------------------------------------------------

function pathFrame(t: Task, f: PathFrame): void {
  const segs = f.path.s.data;
  switch (f.state) {
    case PS.WaitValue:
      f.setv = t.v!;
      t.v = null;
      if (f.setv.t === K.Unset) return fail(t, 'script', 'need-value', 'set-path needs a value');
      f.state = PS.Start;
      return;
    case PS.Start: {
      const head = segs[f.path.i];
      if (head === undefined || head.t !== K.Word) return fail(t, 'script', 'bad-path', 'a path must start with a word');
      const v = getWord(head);
      if (v === null) return unbound(t, head);
      if (v.t === K.Unset) return fail(t, 'script', 'no-value', `${spell(head.sym)} has no value`);
      f.cur = v;
      f.j = f.path.i + 1;
      f.state = PS.Walk;
      if (f.mode === PM.Call && (v.t === K.Function || v.t === K.Native)) {
        t.stack.pop();
        return beginCall(t, f.feed, v, head.sym, segs.slice(f.j), null);
      }
      return;
    }
    case PS.WaitKey: {
      const key = t.v!;
      t.v = null;
      f.state = PS.Walk;
      return walk(t, f, key);
    }
    case PS.Walk: {
      if (f.j >= segs.length) {
        t.stack.pop();
        t.v = f.cur;
        return;
      }
      const seg = segs[f.j]!;
      if (seg.t === K.Paren) {
        f.state = PS.WaitKey;
        pushDo(t, seg.s, seg.i);
        return;
      }
      if (seg.t === K.GetWord) {
        const v = getWord(seg);
        if (v === null) return unbound(t, seg);
        return walk(t, f, v);
      }
      return walk(t, f, seg);
    }
  }
}

function walk(t: Task, f: PathFrame, key: Cell): void {
  const segs = f.path.s.data;
  const seg = segs[f.j]!;
  f.j++;
  if (f.mode === PM.Set && f.j >= segs.length) {
    const msg = poke(f.cur, key, f.setv);
    if (msg !== null) return fail(t, 'script', 'bad-path-set', msg);
    t.stack.pop();
    t.v = f.setv;
    return;
  }
  const v = pick(f.cur, key);
  if (typeof v === 'string') return fail(t, 'script', 'bad-path', v);
  f.cur = v;
  if (f.mode === PM.Call && (v.t === K.Function || v.t === K.Native)) {
    t.stack.pop();
    beginCall(t, f.feed, v, seg.t === K.Word ? seg.sym : null, segs.slice(f.j), null);
  }
}
