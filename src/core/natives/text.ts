// Text and conversion natives: case, trim, split, `to`, `construct`, and the
// block builders `compose` and `collect-words`, plus the iteration natives
// that walk a series held in a word (`forall`, `forskip`) and `apply`.

import { K, isAnyBlock, isAnyString, isAnyWord, kindName, kindBit, kindByName, type Kind } from '../kinds.ts';
import { intern, canon, spell } from '../symbols.ts';
import * as I64 from '../int64.ts';
import { decToNumber } from '../dec.ts';
import {
  ownMeta,
  NONE, TRUE, FALSE, integer, decimal, percent, money, char, logic, pair, tuple, codePoints, text,
  datatype, typeset,
  type Cell, type BlockCell, type StringCell, type WordCell, type Series,
} from '../values.ts';
import { getWord, setWord } from '../ctx.ts';
import { foldCase, toDec } from '../compare.ts';
import { load, LoadError } from '../lexer.ts';
import { typesOf } from '../func.ts';
import { textOf, utf8, at, type SeriesCell } from '../series.ts';
import { T, type Feed, type Step } from '../eval.ts';
import { native, value, fail, truthy, doBlock } from './define.ts';
import { spliceAll } from '../arrays.ts';
import { touch } from '../values.ts';

const used = (c: Cell): boolean => c === TRUE;
const num = (c: Cell): number => I64.toNumber((c as { v: I64.I64 }).v);

const isSpace = (cp: number): boolean => cp === 32 || cp === 9 || cp === 10 || cp === 13 || cp === 0xa0;

// --- case ------------------------------------------------------------------------

function recase(upper: boolean) {
  return (_t: unknown, f: { args: Cell[] }): Step => {
    const x = f.args[0]!;
    const conv = (cp: number) => {
      const s = String.fromCodePoint(cp);
      const r = upper ? s.toUpperCase() : s.toLowerCase();
      return r.length === s.length ? r.codePointAt(0)! : cp;
    };
    if (x.t === K.Char) return value(char(conv(x.v)));
    const s = x as StringCell;
    const end = used(f.args[1]!) ? Math.min(s.s.data.length, s.i + num(f.args[2]!)) : s.s.data.length;
    for (let i = s.i; i < end; i++) s.s.data[i] = conv(s.s.data[i]!);
    if (end > s.i) touch(s.s);
    return value(s);
  };
}

native('uppercase', '["Changes the text to capitals." string [any-string! char!] /part length [integer!]]', recase(true));
native('lowercase', '["Changes the text to small letters." string [any-string! char!] /part length [integer!]]', recase(false));

// --- trim and split --------------------------------------------------------------

native('trim', '["Removes spaces at both ends, or with refinements other spaces too." series [any-string! block!] /head /tail /lines /all]', (_t, f) => {
  const x = f.args[0]!;
  if (x.t === K.Block) {
    const kept = x.s.data.filter((c, i) => i < x.i || c.t !== K.None);
    spliceAll(x.s.data, 0, x.s.data.length, kept);
    ownMeta(x.s);
    touch(x.s);
    if (x.s.nl) x.s.nl.length = 0;
    if (x.s.pos) x.s.pos.length = 0;
    return value(x);
  }
  const s = x as StringCell;
  let cps = s.s.data.slice(s.i);
  const [head, tail, lines, all] = [used(f.args[1]!), used(f.args[2]!), used(f.args[3]!), used(f.args[4]!)];
  if (all) {
    cps = cps.filter(cp => !isSpace(cp));
  } else if (lines) {
    const out: number[] = [];
    for (const cp of cps) {
      if (isSpace(cp)) {
        if (out.length > 0 && out[out.length - 1] !== 32) out.push(32);
      } else {
        out.push(cp);
      }
    }
    if (out[out.length - 1] === 32) out.pop();
    cps = out;
  } else {
    let a = 0;
    let b = cps.length;
    if (head || !tail) while (a < b && isSpace(cps[a]!)) a++;
    if (tail || !head) while (b > a && isSpace(cps[b - 1]!)) b--;
    cps = cps.slice(a, b);
  }
  spliceAll(s.s.data, s.i, s.s.data.length - s.i, cps);
  touch(s.s);
  return value(s);
});

native('split', '["Splits a series at a delimiter, or into pieces of a size." series [any-string! block!] dlm [any-string! char! integer!]]', (_t, f) => {
  const s = f.args[0] as SeriesCell;
  const dlm = f.args[1]!;
  const d = (s.s.data as unknown[]).slice(s.i);
  const piece = (from: number, to: number): Cell => ({ t: s.t, s: { data: d.slice(from, to) }, i: 0 } as Cell);
  const out: Cell[] = [];
  if (dlm.t === K.Integer) {
    const n = Math.max(1, num(dlm));
    for (let i = 0; i < d.length; i += n) out.push(piece(i, i + n));
    return value({ t: K.Block, s: { data: out }, i: 0 });
  }
  if (isAnyBlock(s.t)) return fail('script', 'bad-split', 'a block splits only into pieces of a size');
  const sep = dlm.t === K.Char ? [dlm.v] : (dlm as StringCell).s.data.slice((dlm as StringCell).i);
  if (sep.length === 0) return fail('script', 'bad-split', 'the delimiter is empty');
  let start = 0;
  for (let i = 0; i + sep.length <= d.length;) {
    if (sep.every((cp, k) => foldCase(d[i + k] as number) === foldCase(cp))) {
      out.push(piece(start, i));
      i += sep.length;
      start = i;
    } else {
      i++;
    }
  }
  out.push(piece(start, d.length));
  return value({ t: K.Block, s: { data: out }, i: 0 });
});

// --- to and construct -------------------------------------------------------------

/** Loads text expecting exactly one value of one of the given kinds. */
function loadOne(src: string, kinds: readonly Kind[]): Cell | null {
  try {
    const b = load(src);
    const c = b.s.data[0];
    return b.s.data.length === 1 && c !== undefined && kinds.includes(c.t) ? c : null;
  } catch (e) {
    if (e instanceof LoadError) return null;
    throw e;
  }
}

const NUMBERS: readonly Kind[] = [K.Integer, K.Decimal, K.Percent, K.Money];

function toNumberCell(v: Cell): Cell | null {
  if (v.t === K.Integer || v.t === K.Decimal || v.t === K.Percent || v.t === K.Money) return v;
  if (v.t === K.Char) return integer(v.v);
  if (v.t === K.Logic) return integer(v.v ? 1 : 0);
  if (isAnyString(v.t)) return loadOne(text(v as StringCell).trim(), NUMBERS);
  return null;
}

/**
 * A time from its hours, minutes and seconds, as R3: to time! [9 30] is 9:30, [9 30 15.5] 9:30:15.5; minutes
 * and seconds over 59 carry, and the sign of the hours is the sign of the whole time: [-1 30] is -1:30.
 */
export function timeOfParts(parts: Cell[]): Cell | null {
  if (parts.length < 1 || parts.length > 3) return null;
  const last = parts.length - 1;
  if (!parts.every((c, i) => c.t === K.Integer || (i === 2 && i === last && c.t === K.Decimal))) return null;
  const [h = 0, m = 0, s = 0] = parts.map(c => (c.t === K.Integer ? num(c) : (c as { v: number }).v));
  const sign = h < 0 ? -1 : 1;
  return { t: K.Time, v: sign * Math.round(((Math.abs(h) * 60 + m) * 60 + s) * 1e9) };
}

function toKind(k: Kind, v: Cell): Cell | string {
  const bad = () => `cannot convert ${kindName(v.t)} to ${kindName(k)}`;
  switch (k) {
    case K.String: case K.File: case K.Email: case K.Url: case K.Tag: {
      if (v.t === K.Binary) return { t: k, s: { data: codePoints(new TextDecoder().decode(new Uint8Array(v.s.data.slice(v.i)))) }, i: 0 };
      if (isAnyWord(v.t)) return { t: k, s: { data: codePoints(spell((v as WordCell).sym)) }, i: 0 };
      if (v.t === K.Char) return { t: k, s: { data: [v.v] }, i: 0 };
      // the text itself, so to string! <a> is "a", as in R3; form gives "<a>"
      if (isAnyString(v.t)) return { t: k, s: { data: (v as StringCell).s.data.slice((v as StringCell).i) }, i: 0 };
      return { t: k, s: { data: codePoints(textOf(v)) }, i: 0 };
    }
    case K.Binary:
      if (v.t === K.Binary) return { t: K.Binary, s: { data: v.s.data.slice(v.i) }, i: 0 };
      if (v.t === K.Block) return { t: K.Binary, s: { data: v.s.data.slice(v.i).map(c => (c.t === K.Integer ? num(c) & 255 : 0)) }, i: 0 };
      return { t: K.Binary, s: { data: utf8(textOf(v)) }, i: 0 };
    case K.Word: case K.SetWord: case K.GetWord: case K.LitWord: case K.Refinement: case K.Issue: {
      if (isAnyWord(v.t)) return { t: k, sym: (v as WordCell).sym, bind: (v as WordCell).bind };
      if (isAnyString(v.t) || v.t === K.Char) {
        const name = v.t === K.Char ? String.fromCodePoint(v.v) : text(v as StringCell);
        const w = loadOne(name, [K.Word]);
        if (w === null && k !== K.Issue && k !== K.Refinement) return `${JSON.stringify(name)} is not a valid word`;
        return { t: k, sym: intern(name), bind: null };
      }
      if (v.t === K.Datatype) return { t: k, sym: intern(kindName(v.k)), bind: null };
      return bad();
    }
    case K.Integer: {
      // a time converts to its seconds, as in R3
      const n = v.t === K.Time ? decimal(v.v / 1e9) : toNumberCell(v);
      if (n === null) return bad();
      if (n.t === K.Integer) return n;
      const x = n.t === K.Money ? decToNumber(n.v) : (n as { v: number }).v;
      const r = I64.fromNumber(Math.trunc(x));
      return r === null ? 'number is too big for integer!' : integer(r);
    }
    case K.Decimal: case K.Percent: {
      const n = v.t === K.Time && k === K.Decimal ? decimal(v.v / 1e9) : toNumberCell(v);
      if (n === null) return bad();
      const x = n.t === K.Money ? decToNumber(n.v) : n.t === K.Integer ? I64.toNumber(n.v) : (n as { v: number }).v;
      return k === K.Decimal ? decimal(x) : percent(x);
    }
    case K.Money: {
      const n = toNumberCell(v);
      const d = n === null ? null : toDec(n);
      if (d === null) return bad();
      return money(d, n!.t === K.Money ? n!.cur : '');
    }
    case K.Char:
      if (v.t === K.Char) return v;
      if (v.t === K.Integer) return char(num(v));
      if (isAnyString(v.t) && (v as StringCell).s.data.length > (v as StringCell).i) return char((v as StringCell).s.data[(v as StringCell).i]!);
      return bad();
    case K.Logic: return logic(truthy(v));
    case K.None: return NONE;
    case K.Block: case K.Paren: case K.Path: case K.SetPath: case K.GetPath: case K.LitPath: {
      if (isAnyBlock(v.t)) return { t: k, s: { data: (v as BlockCell).s.data.slice((v as BlockCell).i) }, i: 0 };
      if (isAnyString(v.t)) {
        try {
          const b = load(text(v as StringCell));
          return { t: k, s: b.s, i: 0 };
        } catch (e) {
          if (e instanceof LoadError) return e.message;
          throw e;
        }
      }
      if (v.t === K.Map) return { t: k, s: { data: v.s.data.slice() }, i: 0 };
      if (v.t === K.Object || v.t === K.Error) {
        const data: Cell[] = [];
        v.ctx.keys.forEach((key, i) => data.push({ t: K.SetWord, sym: key, bind: null }, v.ctx.vals[i]!));
        return { t: k, s: { data }, i: 0 };
      }
      return { t: k, s: { data: [v] }, i: 0 };
    }
    case K.Map: {
      if (v.t === K.Map) return { t: K.Map, s: { data: v.s.data.slice() } };
      if (v.t === K.Block) {
        const items = v.s.data.slice(v.i);
        if (items.length % 2 !== 0) return 'a map needs key value pairs';
        return { t: K.Map, s: { data: items.map((c, i) => (i % 2 === 0 && isAnyWord(c.t) ? { t: K.Word, sym: (c as WordCell).sym, bind: null } as Cell : c)) } };
      }
      if (v.t === K.Object) {
        const data: Cell[] = [];
        v.ctx.keys.forEach((key, i) => data.push({ t: K.Word, sym: key, bind: null }, v.ctx.vals[i]!));
        return { t: K.Map, s: { data } };
      }
      return bad();
    }
    case K.Pair: {
      if (v.t === K.Pair) return v;
      if (v.t === K.Integer || v.t === K.Decimal) {
        const x = v.t === K.Integer ? num(v) : v.v;
        return pair(x, x);
      }
      if (v.t === K.Block) {
        const [a, b] = v.s.data.slice(v.i);
        const n = (c: Cell | undefined) => (c?.t === K.Integer ? num(c) : c?.t === K.Decimal ? c.v : null);
        const x = n(a);
        const y = n(b);
        return x === null || y === null ? bad() : pair(x, y);
      }
      return isAnyString(v.t) ? loadOne(text(v as StringCell), [K.Pair]) ?? bad() : bad();
    }
    case K.Tuple:
      if (v.t === K.Tuple) return v;
      if (v.t === K.Block && v.s.data.slice(v.i).every(c => c.t === K.Integer)) return tuple(v.s.data.slice(v.i).map(num));
      return isAnyString(v.t) ? loadOne(text(v as StringCell), [K.Tuple]) ?? bad() : bad();
    case K.Date: case K.Time:
      if (v.t === k) return v;
      if (k === K.Time && (v.t === K.Integer || v.t === K.Decimal)) return { t: K.Time, v: Math.round((v.t === K.Integer ? num(v) : v.v) * 1e9) };
      if (k === K.Time && v.t === K.Block) return timeOfParts(v.s.data.slice(v.i)) ?? bad();
      return isAnyString(v.t) ? loadOne(text(v as StringCell), [k]) ?? bad() : bad();
    case K.Datatype:
      if (v.t === K.Datatype) return v;
      if (isAnyWord(v.t)) {
        const name = spell(canon((v as WordCell).sym));
        const found = kindByName(name);
        return found === undefined ? bad() : datatype(found);
      }
      return bad();
    case K.Typeset: {
      if (v.t === K.Typeset) return v;
      if (v.t === K.Datatype) return typeset(kindBit(v.k));
      if (v.t !== K.Block) return bad();
      const bits = typesOf(v);
      return typeof bits === 'string' ? bits : typeset(bits);
    }
  }
  return bad();
}

native('to', '["Converts a value to another type." type [datatype! any-value!] value [any-type!]]', (_t, f) => {
  const type = f.args[0]!;
  const k = type.t === K.Datatype ? type.k : type.t;
  const r = toKind(k, f.args[1]!);
  return typeof r === 'string' ? fail('script', 'bad-to', r) : value(r);
});

/** Object from a block without evaluating it; logic and none words become values. */
native('construct', '["Makes an object from a block without evaluating its values." block [block!]]', (_t, f) => {
  const b = f.args[0] as BlockCell;
  const keys: number[] = [];
  const vals: Cell[] = [];
  const words: Record<string, Cell> = { none: NONE, true: TRUE, false: FALSE, on: TRUE, off: FALSE, yes: TRUE, no: FALSE };
  const d = b.s.data;
  for (let i = b.i; i < d.length; i++) {
    const c = d[i]!;
    if (c.t !== K.SetWord) continue;
    let j = i + 1;
    while (j < d.length && d[j]!.t === K.SetWord) j++;
    let v: Cell = d[j] ?? NONE;
    if (v.t === K.Word) v = words[spell(canon(v.sym))] ?? v;
    else if (v.t === K.LitWord) v = { t: K.Word, sym: v.sym, bind: null };
    for (let k = i; k < j; k++) {
      keys.push((d[k] as WordCell).sym);
      vals.push(v);
    }
    i = j;
  }
  return value({ t: K.Object, ctx: { keys, vals, parent: null } });
});

// --- compose -----------------------------------------------------------------------

interface ComposeLevel { src: BlockCell; i: number; out: Cell[]; nl: boolean[] }

native('compose', '["Evaluates the parens in a block and puts their values in a copy of it." value [any-value!] /deep /only]', (_t, f, v) => {
  const x = f.args[0]!;
  if (x.t !== K.Block) return value(x);
  const deep = used(f.args[1]!);
  const only = used(f.args[2]!);
  if (f.phase === 0) {
    f.phase = 1;
    f.data = [{ src: x, i: x.i, out: [], nl: [] }] satisfies ComposeLevel[];
  }
  const levels = f.data as ComposeLevel[];
  if (v !== null) {
    const lvl = levels[levels.length - 1]!;
    const wasNl = lvl.src.s.nl?.[lvl.i - 1] ?? false;
    if (v.t === K.Block && !only) {
      v.s.data.slice(v.i).forEach((c, k) => {
        lvl.out.push(c);
        lvl.nl.push(k === 0 ? wasNl : v.s.nl?.[v.i + k] ?? false);
      });
    } else if (v.t !== K.Unset) {
      lvl.out.push(v);
      lvl.nl.push(wasNl);
    }
  }
  for (;;) {
    const lvl = levels[levels.length - 1]!;
    const d = lvl.src.s.data;
    if (lvl.i >= d.length) {
      levels.pop();
      const built: Cell = { t: lvl.src.t, s: { data: lvl.out, nl: lvl.nl } as Series<Cell>, i: 0 } as Cell;
      if (levels.length === 0) return value(built);
      const parent = levels[levels.length - 1]!;
      parent.out.push(built);
      parent.nl.push(parent.src.s.nl?.[parent.i - 1] ?? false);
      continue;
    }
    const c = d[lvl.i++]!;
    if (c.t === K.Paren) return { k: 'do', s: c.s, i: c.i };
    if (deep && isAnyBlock(c.t)) {
      levels.push({ src: c as BlockCell, i: (c as BlockCell).i, out: [], nl: [] });
      continue;
    }
    lvl.out.push(c);
    lvl.nl.push(lvl.src.s.nl?.[lvl.i - 1] ?? false);
  }
});

// --- collect-words ---------------------------------------------------------------

native('collect-words', '["The words used in a block, each once." block [block!] /deep /set /ignore words [block!]]', (_t, f) => {
  const deep = used(f.args[1]!);
  const setOnly = used(f.args[2]!);
  const ignore = used(f.args[3]!) ? (f.args[4] as BlockCell).s.data.filter(c => isAnyWord(c.t)).map(c => canon((c as WordCell).sym)) : [];
  const seen = new Set<number>(ignore);
  const out: Cell[] = [];
  const stack: Series<Cell>[] = [];
  const walk = (s: Series<Cell>, from: number) => {
    if (stack.includes(s)) return;
    stack.push(s);
    for (let i = from; i < s.data.length; i++) {
      const c = s.data[i]!;
      if ((setOnly ? c.t === K.SetWord : c.t >= K.Word && c.t <= K.LitWord) && !seen.has(canon((c as WordCell).sym))) {
        seen.add(canon((c as WordCell).sym));
        out.push({ t: K.Word, sym: (c as WordCell).sym, bind: null });
      } else if (deep && isAnyBlock(c.t)) {
        walk((c as BlockCell).s, (c as BlockCell).i);
      }
    }
    stack.pop();
  };
  const b = f.args[0] as BlockCell;
  walk(b.s, b.i);
  return value({ t: K.Block, s: { data: out }, i: 0 });
});

// --- iteration over a series word ----------------------------------------------------

/** forall and forskip: the word walks its series; it is restored at the end. */
function walkWord(stepSize: (args: Cell[]) => number, bodyAt: number) {
  return (_t: unknown, f: { args: Cell[]; phase: number; data: unknown; trap: number; thrown: { kind: number; v: Cell } | null }, v: Cell | null): Step => {
    const w = f.args[0] as WordCell;
    const n = stepSize(f.args);
    if (f.phase === 0) {
      const s = getWord(w);
      if (s === null || !(isAnyBlock(s.t) || isAnyString(s.t))) return fail('script', 'bad-walk', `${spell(w.sym)} must refer to a series`);
      f.phase = 1;
      f.trap = (1 << T.Break) | (1 << T.Continue);
      f.data = { start: s, cur: s as SeriesCell, out: NONE as Cell, first: true };
    }
    const st = f.data as { start: Cell; cur: SeriesCell; out: Cell; first: boolean };
    const th = f.thrown;
    f.thrown = null;
    const finish = (r: Cell) => {
      setWord(w, st.start);
      return value(r);
    };
    if (th !== null && th.kind === T.Break) return finish(th.v);
    if (v !== null) st.out = v;
    if (!st.first) st.cur = at(st.cur, st.cur.i + n);
    st.first = false;
    if (st.cur.i >= st.cur.s.data.length) return finish(st.out);
    setWord(w, st.cur);
    return doBlock(f.args[bodyAt] as BlockCell);
  };
}

native('forall', "[\"Evaluates a block for each position of the series a word refers to.\" 'word [word!] body [block!]]", walkWord(() => 1, 1));
native('forskip', "[\"Evaluates a block at every so many positions of the series a word refers to.\" 'word [word!] size [integer!] body [block!]]", walkWord(a => Math.max(1, num(a[1]!)), 2));

// --- apply -------------------------------------------------------------------------

native('apply', '["Calls a function with the arguments in a block." func [any-function!] block [block!] /only]', (_t, f, v) => {
  const fn = f.args[0]!;
  const b = f.args[1] as BlockCell;
  if (f.phase === 2) return value(v!);
  if (f.phase === 0) {
    if (used(f.args[2]!)) {
      f.phase = 2;
      return { k: 'call', fn, args: b.s.data.slice(b.i), full: true };
    }
    f.phase = 1;
    f.data = { feed: { s: b.s, i: b.i }, out: [] };
  }
  const st = f.data as { feed: Feed; out: Cell[] };
  if (v !== null) st.out.push(v);
  if (st.feed.i < st.feed.s.data.length) return { k: 'expr', feed: st.feed };
  f.phase = 2;
  return { k: 'call', fn, args: st.out, full: true };
});
