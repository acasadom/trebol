// PARSE: a PEG-style rule interpreter over blocks, strings and binaries.
//
// Like the evaluator, it never recurses on the JS stack: rules run on an
// explicit stack of frames that talk through one result register
// (`st.res`: true, false, or null while a frame is just starting). A paren
// action returns a `do` Step to the evaluator and the native continues
// with its value, so an action can `fetch` (await) in the middle of a parse.
//
// Rules are ordered choice (`a | b`), greedy repetition and no
// backtracking into an item that already matched, as in PEG.
//
// `remove`, `insert` and `change` edit the input in place, as in R3 and Red;
// a failing alternative does not undo an edit it made.

import { K, isAnyBlock, isAnyString, kindBit } from '../kinds.ts';
import { intern, canon } from '../symbols.ts';
import * as I64 from '../int64.ts';
import {
  NONE, TRUE, logic, strictEqual,
  type Cell, type BlockCell, type StringCell, type WordCell, type Series, type BitsetCell,
} from '../values.ts';
import { getWord, setWord } from '../ctx.ts';
import { isEqual, foldCase } from '../compare.ts';
import { bitHas, bitsFrom } from '../bitset.ts';
import { itemsFor, splice, type SeriesCell, type Item } from '../series.ts';
import type { Step } from '../eval.ts';
import { native, value, fail, truthy } from './define.ts';

const KW = {
  Some: 0, Any: 1, Opt: 2, While: 3, Not: 4, Ahead: 5, To: 6, Thru: 7, Set: 8, Copy: 9,
  Into: 10, If: 11, Collect: 12, Keep: 13, End: 14, Skip: 15, None: 16, Fail: 17, Break: 18, Quote: 19, Bar: 20,
  Remove: 21, Insert: 22, Change: 23, Only: 24,
} as const;

const KEYWORDS = new Map<number, number>([
  ['some', KW.Some], ['any', KW.Any], ['opt', KW.Opt], ['while', KW.While], ['not', KW.Not],
  ['ahead', KW.Ahead], ['to', KW.To], ['thru', KW.Thru], ['set', KW.Set], ['copy', KW.Copy],
  ['into', KW.Into], ['if', KW.If], ['collect', KW.Collect], ['keep', KW.Keep], ['end', KW.End],
  ['skip', KW.Skip], ['none', KW.None], ['fail', KW.Fail], ['break', KW.Break], ['quote', KW.Quote],
  ['remove', KW.Remove], ['insert', KW.Insert], ['change', KW.Change], ['only', KW.Only],
  ['|', KW.Bar],
].map(([name, k]) => [canon(intern(name as string)), k as number]));

function kw(c: Cell | undefined): number {
  return c !== undefined && c.t === K.Word ? KEYWORDS.get(canon(c.sym)) ?? -1 : -1;
}

/** Index just past the rule item starting at `ip`, or -1 if the rules end too early. */
function itemEnd(d: readonly Cell[], ip: number): number {
  for (;;) {
    const c = d[ip];
    if (c === undefined) return -1;
    if (c.t === K.Integer) {
      ip += d[ip + 1]?.t === K.Integer ? 2 : 1;
      continue;
    }
    switch (kw(c)) {
      case KW.Some: case KW.Any: case KW.Opt: case KW.While: case KW.Not: case KW.Ahead:
      case KW.To: case KW.Thru: case KW.Into: case KW.Keep: case KW.Remove:
        ip += 1;
        continue;
      case KW.Insert: {
        const v = ip + (kw(d[ip + 1]) === KW.Only ? 2 : 1);
        return v < d.length ? v + 1 : -1;
      }
      case KW.Change: {
        const end = itemEnd(d, ip + (kw(d[ip + 1]) === KW.Only ? 2 : 1));
        return end >= 0 && end < d.length ? end + 1 : -1;
      }
      case KW.Set: case KW.Copy:
        ip += 2;
        continue;
      case KW.Collect:
        ip += kw(d[ip + 1]) === KW.Set ? 3 : 1;
        continue;
      case KW.If:
        return d[ip + 1]?.t === K.Paren ? ip + 2 : -1;
      case KW.Quote:
        return ip + 1 < d.length ? ip + 2 : -1;
    }
    return ip + 1;
  }
}

// --- frames --------------------------------------------------------------------

const PF = { Block: 0, Rep: 1, Look: 2, Scan: 3, Cap: 4, Into: 5, Coll: 6, Act: 7, Edit: 8 } as const;

/** A rule block: alternatives of sequences. */
interface BlockF { k: typeof PF.Block; rules: Series<Cell>; ip: number; next: number; alt: number; mark: Cell[] | null; markLen: number; started: boolean }
/** some, any, opt, while, N and N M. */
interface RepF { k: typeof PF.Rep; rules: Series<Cell>; sub: number; min: number; max: number; n: number; from: number; edits: number }
/** not and ahead: match without advancing. */
interface LookF { k: typeof PF.Look; rules: Series<Cell>; sub: number; not: boolean; from: number }
/** to and thru: try the rule at each position from here. */
interface ScanF { k: typeof PF.Scan; rules: Series<Cell>; sub: number; thru: boolean; start: number; at: number }
/** set, copy and keep of a matched rule. */
interface CapF { k: typeof PF.Cap; rules: Series<Cell>; sub: number; how: 'set' | 'copy' | 'keep'; word: WordCell | null; from: number }
/** into: parse a nested series, which must match to its end. */
interface IntoF { k: typeof PF.Into; outer: SeriesCell; outerPos: number }
/** collect: gather keeps into a new block. */
interface CollF { k: typeof PF.Coll; rules: Series<Cell>; sub: number; word: WordCell | null }
/** remove and change of a matched rule; `val` is the index of change's value. */
interface EditF { k: typeof PF.Edit; rules: Series<Cell>; sub: number; val: number; only: boolean; from: number }
/** A paren being evaluated: an action, an `if` condition, a `keep` value or the value an edit puts in. */
type ActF =
  | { k: typeof PF.Act; how: 'action' | 'if' | 'keep' }
  | { k: typeof PF.Act; how: 'put'; from: number; to: number; only: boolean };

type Frame = BlockF | RepF | LookF | ScanF | CapF | IntoF | CollF | ActF | EditF;

interface PState {
  input: SeriesCell;
  pos: number;
  stack: Frame[];
  res: boolean | null;
  colls: Cell[][];
  /** The block of a top-level collect, which becomes parse's result. */
  out: Cell | null;
  cased: boolean;
  /** Set when a rule is malformed; stops the parse. */
  err: string | null;
  /** Counts edits of the input, so a repetition that edits without moving goes on. */
  edits: number;
}

/** Records a malformed-rule error; the native turns it into a Trebol error. */
function ruleErr(st: PState, msg: string): null {
  st.err = msg;
  return null;
}

const lenOf = (st: PState): number => st.input.s.data.length;

/** The matched part of the input from `from` to the current position. */
function slice(st: PState, from: number): Cell {
  const d = (st.input.s.data as Item[]).slice(from, st.pos);
  return { t: st.input.t, s: { data: d }, i: 0 } as Cell;
}

function elementAt(st: PState, i: number): Cell {
  const x = st.input.s.data[i];
  if (x === undefined) return NONE;
  if (isAnyBlock(st.input.t)) return x as Cell;
  return st.input.t === K.Binary ? { t: K.Integer, v: x as number } : { t: K.Char, v: x as number };
}

/** Matches a terminal value at the current position; returns the new position or -1. */
function term(st: PState, v: Cell): number {
  const d = st.input.s.data;
  const pos = st.pos;
  if (isAnyBlock(st.input.t)) {
    const el = d[pos] as Cell | undefined;
    if (el === undefined) return -1;
    switch (v.t) {
      case K.Datatype: return el.t === v.k ? pos + 1 : -1;
      case K.Typeset: return (v.bits & kindBit(el.t)) !== 0n ? pos + 1 : -1;
      case K.LitWord:
        return el.t === K.Word && canon(el.sym) === canon(v.sym) ? pos + 1 : -1;
    }
    return (st.cased ? strictEqual(el, v) : isEqual(el, v)) ? pos + 1 : -1;
  }
  const bytes = st.input.t === K.Binary;
  const eq = (a: number, b: number) => (st.cased || bytes ? a === b : foldCase(a) === foldCase(b));
  if (v.t === K.Bitset) {
    const cp = d[pos] as number | undefined;
    return cp !== undefined && bitHas(v as BitsetCell, cp) ? pos + 1 : -1;
  }
  if (v.t === K.Char || isAnyString(v.t) || v.t === K.Binary || (bytes && v.t === K.Integer)) {
    const run = itemsFor(st.input.t, v, false).add as number[];
    if (pos + run.length > d.length) return -1;
    for (let k = 0; k < run.length; k++) if (!eq(d[pos + k] as number, run[k]!)) return -1;
    return pos + run.length;
  }
  ruleErr(st, `cannot match ${v.t === K.Integer ? 'an integer' : 'that value'} in a string`);
  return -1;
}

/** Replaces the input from `from` to `to` with `v` and moves past it. */
function put(st: PState, from: number, to: number, v: Cell, only: boolean): null {
  const { add, nl } = itemsFor(st.input.t, v, only);
  splice(st.input.s as Series<Item>, from, to - from, add, nl);
  st.pos = from + add.length;
  st.edits++;
  return done(st, true);
}

/** The value an insert or change puts in: a paren is evaluated, a word gives its value. */
function putValue(st: PState, rules: Series<Cell>, ip: number, from: number, to: number, only: boolean): Step | null {
  const c = rules.data[ip]!;
  if (c.t === K.Paren) {
    st.stack.push({ k: PF.Act, how: 'put', from, to, only });
    return { k: 'do', s: c.s, i: c.i };
  }
  if (c.t === K.Word) {
    const v = getWord(c);
    if (v === null || v.t === K.Unset) return ruleErr(st, 'the value to put in has no value');
    return put(st, from, to, v, only);
  }
  return put(st, from, to, c, only);
}

/** Sets the result register. */
function done(st: PState, ok: boolean): null {
  st.res = ok;
  return null;
}

function subBlock(st: PState, rules: Series<Cell>, ip: number): BlockCell | null {
  const c = rules.data[ip];
  if (c !== undefined && c.t === K.Block) return c;
  if (c !== undefined && c.t === K.Word) {
    const v = getWord(c);
    if (v !== null && v.t === K.Block) return v;
  }
  return ruleErr(st, 'into needs a rule block');
}

function pushBlock(st: PState, b: BlockCell): null {
  st.stack.push({ k: PF.Block, rules: b.s, ip: b.i, next: 0, alt: 0, mark: null, markLen: 0, started: false });
  return null;
}

/** Starts the rule item at `ip`: either finishes it at once or pushes a frame. */
function startItem(st: PState, rules: Series<Cell>, ip: number): Step | null {
  const d = rules.data;
  const c = d[ip]!;
  switch (c.t) {
    case K.Integer: {
      const min = I64.toNumber(c.v);
      const second = d[ip + 1];
      const two = second?.t === K.Integer;
      st.stack.push({ k: PF.Rep, rules, sub: ip + (two ? 2 : 1), min, max: two ? I64.toNumber((second as { v: I64.I64 }).v) : min, n: 0, from: st.pos, edits: st.edits });
      return null;
    }
    case K.SetWord:
      setWord(c, { ...st.input, i: st.pos } as Cell);
      return done(st, true);
    case K.GetWord: {
      const v = getWord(c);
      if (v === null || !(isAnyBlock(v.t) || isAnyString(v.t)) || (v as SeriesCell).s !== st.input.s) {
        return ruleErr(st, 'a get-word in parse must refer to a position in the input');
      }
      st.pos = (v as SeriesCell).i;
      return done(st, true);
    }
    case K.Paren:
      st.stack.push({ k: PF.Act, how: 'action' });
      return { k: 'do', s: c.s, i: c.i };
    case K.Block:
      return pushBlock(st, c);
    case K.Word:
      break;
    default: {
      const to = term(st, c);
      if (to < 0) return done(st, false);
      st.pos = to;
      return done(st, true);
    }
  }
  const w = c as WordCell;
  switch (kw(w)) {
    case KW.Some: st.stack.push({ k: PF.Rep, rules, sub: ip + 1, min: 1, max: Infinity, n: 0, from: st.pos, edits: st.edits }); return null;
    case KW.Any: case KW.While: st.stack.push({ k: PF.Rep, rules, sub: ip + 1, min: 0, max: Infinity, n: 0, from: st.pos, edits: st.edits }); return null;
    case KW.Opt: st.stack.push({ k: PF.Rep, rules, sub: ip + 1, min: 0, max: 1, n: 0, from: st.pos, edits: st.edits }); return null;
    case KW.Not: case KW.Ahead:
      st.stack.push({ k: PF.Look, rules, sub: ip + 1, not: kw(w) === KW.Not, from: st.pos });
      return null;
    case KW.To: case KW.Thru:
      st.stack.push({ k: PF.Scan, rules, sub: ip + 1, thru: kw(w) === KW.Thru, start: st.pos, at: st.pos });
      return null;
    case KW.Set: case KW.Copy: {
      const word = d[ip + 1];
      if (word === undefined || word.t !== K.Word) return ruleErr(st, `${kw(w) === KW.Set ? 'set' : 'copy'} needs a word`);
      st.stack.push({ k: PF.Cap, rules, sub: ip + 2, how: kw(w) === KW.Set ? 'set' : 'copy', word, from: st.pos });
      return null;
    }
    case KW.Keep: {
      const next = d[ip + 1];
      if (next !== undefined && next.t === K.Paren) {
        st.stack.push({ k: PF.Act, how: 'keep' });
        return { k: 'do', s: next.s, i: next.i };
      }
      st.stack.push({ k: PF.Cap, rules, sub: ip + 1, how: 'keep', word: null, from: st.pos });
      return null;
    }
    case KW.Collect: {
      const named = kw(d[ip + 1]) === KW.Set;
      const word = named ? d[ip + 2] : undefined;
      if (named && (word === undefined || word.t !== K.Word)) return ruleErr(st, 'collect set needs a word');
      st.stack.push({ k: PF.Coll, rules, sub: ip + (named ? 3 : 1), word: (word as WordCell | undefined) ?? null });
      return null;
    }
    case KW.Into: {
      const el = st.input.s.data[st.pos] as Cell | undefined;
      const rule = subBlock(st, rules, ip + 1);
      if (rule === null) return null;
      if (!isAnyBlock(st.input.t) || el === undefined || !(isAnyBlock(el.t) || isAnyString(el.t))) return done(st, false);
      st.stack.push({ k: PF.Into, outer: st.input, outerPos: st.pos });
      st.input = el as SeriesCell;
      st.pos = (el as SeriesCell).i;
      return pushBlock(st, rule);
    }
    case KW.If: {
      const p = d[ip + 1] as BlockCell;
      st.stack.push({ k: PF.Act, how: 'if' });
      return { k: 'do', s: p.s, i: p.i };
    }
    case KW.End: return done(st, st.pos >= lenOf(st));
    case KW.Skip:
      if (st.pos >= lenOf(st)) return done(st, false);
      st.pos++;
      return done(st, true);
    case KW.None: return done(st, true);
    case KW.Fail: return done(st, false);
    case KW.Break: {
      // leave the innermost repetition, successfully
      while (st.stack.length > 0) {
        const f = st.stack.pop()!;
        if (f.k === PF.Rep && f.max > 1) return done(st, true); // opt is not a loop
        if (f.k === PF.Into) {
          st.input = f.outer;
          st.pos = f.outerPos;
        }
      }
      return ruleErr(st, 'break outside of a repetition');
    }
    case KW.Quote: {
      const to = term(st, d[ip + 1]!);
      if (to < 0) return done(st, false);
      st.pos = to;
      return done(st, true);
    }
    case KW.Remove:
      st.stack.push({ k: PF.Edit, rules, sub: ip + 1, val: -1, only: false, from: st.pos });
      return null;
    case KW.Insert: {
      const only = kw(d[ip + 1]) === KW.Only;
      return putValue(st, rules, ip + (only ? 2 : 1), st.pos, st.pos, only);
    }
    case KW.Change: {
      const only = kw(d[ip + 1]) === KW.Only;
      const sub = ip + (only ? 2 : 1);
      st.stack.push({ k: PF.Edit, rules, sub, val: itemEnd(d, sub), only, from: st.pos });
      return null;
    }
    case KW.Only:
      return ruleErr(st, 'only goes after insert or change');
    case KW.Bar:
      return ruleErr(st, 'misplaced |');
  }
  const v = getWord(w);
  if (v === null || v.t === K.Unset || v.t === K.None) return ruleErr(st, `rule word has no value`);
  if (v.t === K.Block) return pushBlock(st, v);
  const to = term(st, v);
  if (to < 0) return done(st, false);
  st.pos = to;
  return done(st, true);
}

/** Runs frames until the parse finishes (null) or an action needs the evaluator. */
function runParse(st: PState, actionValue: Cell | null): Step | null {
  if (actionValue !== null) {
    const f = st.stack.pop() as ActF;
    switch (f.how) {
      case 'action': st.res = true; break;
      case 'if': st.res = truthy(actionValue); break;
      case 'keep': {
        const into = st.colls[st.colls.length - 1];
        if (into === undefined) return ruleErr(st, 'keep outside of collect');
        if (actionValue.t !== K.Unset) into.push(actionValue);
        st.res = true;
        break;
      }
      case 'put':
        if (actionValue.t === K.Unset) return ruleErr(st, 'the value to put in has no value');
        put(st, f.from, f.to, actionValue, f.only);
        break;
    }
  }
  for (;;) {
    const f = st.stack[st.stack.length - 1];
    if (f === undefined) return null;
    const r = st.res;
    st.res = null;
    const step = frame(st, f, r);
    if (step !== null || st.err !== null) return step;
  }
}

function frame(st: PState, f: Frame, r: boolean | null): Step | null {
  const pop = (ok: boolean) => {
    st.stack.pop();
    return done(st, ok);
  };
  switch (f.k) {
    case PF.Block: {
      const d = f.rules.data;
      if (!f.started) {
        f.started = true;
        f.alt = st.pos;
        f.mark = st.colls[st.colls.length - 1] ?? null;
        f.markLen = f.mark?.length ?? 0;
      } else if (r === true) {
        f.ip = f.next;
      } else if (r === false) {
        let bar = f.ip;
        while (bar < d.length && kw(d[bar]) !== KW.Bar) bar++;
        st.pos = f.alt;
        if (f.mark !== null) f.mark.length = f.markLen;
        if (bar >= d.length) return pop(false);
        f.ip = bar + 1;
      }
      if (f.ip >= d.length || kw(d[f.ip]) === KW.Bar) return pop(true);
      f.next = itemEnd(d, f.ip);
      if (f.next < 0) return ruleErr(st, 'rule ends too early');
      return startItem(st, f.rules, f.ip);
    }
    case PF.Rep: {
      if (r === null) {
        f.from = st.pos;
        return startItem(st, f.rules, f.sub);
      }
      if (r === false) {
        st.pos = f.from;
        return pop(f.n >= f.min);
      }
      f.n++;
      // a match that did not advance (nor edit) would repeat forever: stop here
      if ((st.pos === f.from && st.edits === f.edits) || f.n >= f.max) return pop(true);
      f.from = st.pos;
      f.edits = st.edits;
      return startItem(st, f.rules, f.sub);
    }
    case PF.Look: {
      if (r === null) {
        f.from = st.pos;
        return startItem(st, f.rules, f.sub);
      }
      st.pos = f.from;
      return pop(f.not ? !r : r);
    }
    case PF.Scan: {
      if (r === true) {
        if (!f.thru) st.pos = f.at;
        return pop(true);
      }
      if (r === false) {
        f.at++;
        if (f.at > lenOf(st)) {
          st.pos = f.start;
          return pop(false);
        }
      }
      st.pos = f.at;
      return startItem(st, f.rules, f.sub);
    }
    case PF.Cap: {
      if (r === null) {
        f.from = st.pos;
        return startItem(st, f.rules, f.sub);
      }
      if (r === false) return pop(false);
      if (f.how === 'set') {
        setWord(f.word!, st.pos > f.from ? elementAt(st, f.from) : NONE);
      } else if (f.how === 'copy') {
        setWord(f.word!, slice(st, f.from));
      } else {
        const into = st.colls[st.colls.length - 1];
        if (into === undefined) return ruleErr(st, 'keep outside of collect');
        if (st.pos - f.from === 1) into.push(elementAt(st, f.from));
        else if (st.pos > f.from) into.push(slice(st, f.from));
      }
      return pop(true);
    }
    case PF.Into: {
      const ok = r === true && st.pos >= lenOf(st);
      st.input = f.outer;
      st.pos = ok ? f.outerPos + 1 : f.outerPos;
      return pop(ok);
    }
    case PF.Coll: {
      if (r === null) {
        st.colls.push([]);
        return startItem(st, f.rules, f.sub);
      }
      const out = st.colls.pop()!;
      if (r) {
        const b: Cell = { t: K.Block, s: { data: out }, i: 0 };
        if (f.word !== null) setWord(f.word, b);
        else if (st.colls.length > 0) st.colls[st.colls.length - 1]!.push(b);
        else st.out = b;
      }
      return pop(r);
    }
    case PF.Edit: {
      if (r === null) {
        f.from = st.pos;
        return startItem(st, f.rules, f.sub);
      }
      if (r === false) return pop(false);
      st.stack.pop();
      if (f.val < 0) {
        splice(st.input.s as Series<Item>, f.from, st.pos - f.from, []);
        st.pos = f.from;
        st.edits++;
        return done(st, true);
      }
      return putValue(st, f.rules, f.val, f.from, st.pos, f.only);
    }
    case PF.Act:
      return ruleErr(st, 'internal: action frame without a value');
  }
}

native('parse', '[input [series!] rules [block!] /case]', (_t, f, v) => {
  if (f.phase === 0) {
    f.phase = 1;
    const input = f.args[0] as SeriesCell;
    const st: PState = { input, pos: input.i, stack: [], res: null, colls: [], out: null, cased: f.args[2] === TRUE, err: null, edits: 0 };
    pushBlock(st, f.args[1] as BlockCell);
    f.data = st;
  }
  const st = f.data as PState;
  const step = runParse(st, v);
  if (st.err !== null) return fail('script', 'parse', st.err);
  if (step !== null) return step;
  if (st.out !== null) return value(st.out);
  return value(logic(st.res === true && st.pos >= lenOf(st)));
});

// --- bitsets -------------------------------------------------------------------

native('charset', '[spec [char! integer! any-string! binary! block!]]', (_t, f) => {
  const bytes: number[] = [];
  const err = bitsFrom(f.args[0]!, bytes);
  return err !== null ? fail('script', 'bad-bitset', err) : value({ t: K.Bitset, s: { data: bytes }, neg: false });
});

native('complement', '[value [bitset! logic! integer!]]', (_t, f) => {
  const x = f.args[0]!;
  if (x.t === K.Bitset) return value({ t: K.Bitset, s: { data: x.s.data.slice() }, neg: !x.neg });
  if (x.t === K.Logic) return value(logic(!x.v));
  const r = I64.fromBig(~BigInt((x as { v: I64.I64 }).v));
  return value(r === null ? NONE : { t: K.Integer, v: r });
});
