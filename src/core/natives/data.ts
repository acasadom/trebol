// Data natives: making values, words and contexts, load/mold, and the few
// series natives the core needs before the full series set arrives.

import { K, isAnyBlock, isAnyString, isAnyWord, kindName, type Kind } from '../kinds.ts';
import { spell } from '../symbols.ts';
import * as I64 from '../int64.ts';
import {
  NONE, TRUE, FALSE, string, codePoints, text, datatype, typeset, context,
  type Cell, type BlockCell, type StringCell, type WordCell, type Ctx, type ObjectCell, type Series,
} from '../values.ts';
import { bindSeries, collectSetWords, copyDeep, ctxFind, getWord, setWord } from '../ctx.ts';
import { makeError } from '../errors.ts';
import { makeFunc, typesOf, type FuncDef } from '../func.ts';
import { load, LoadError } from '../lexer.ts';
import { mold, form } from '../mold.ts';
import { pick, poke } from '../access.ts';
import type { Runtime, Step } from '../eval.ts';
import { native, value, fail, doBlock } from './define.ts';

/** Loads a string into a block bound to the user context. */
export function loadUser(rt: Runtime, src: StringCell): Step {
  let b: BlockCell;
  try {
    b = load(text(src));
  } catch (e) {
    // LoadError is the one exception on the normal path; it becomes a value here.
    if (e instanceof LoadError) return fail('syntax', 'load', e.message);
    throw e;
  }
  bindSeries(b.s, rt.user, true);
  return value(b);
}

native('load', '[source [string!]]', (t, f) => loadUser(t.rt, f.args[0] as StringCell));

native('mold', '[value [any-type!] /only /all]', (_t, f) =>
  value(string(mold(f.args[0]!, { only: f.args[1] === TRUE, all: f.args[2] === TRUE }))));

native('form', '[value [any-type!]]', (_t, f) => value(string(form(f.args[0]!))));

// --- make ------------------------------------------------------------------------

/**
 * A new object from an optional prototype and a body. The prototype's
 * blocks and function bodies are copied and rebound to the new context, so
 * methods see the new object's fields.
 */
function makeObject(proto: Ctx | null, spec: BlockCell, kind: typeof K.Object | typeof K.Error): { obj: ObjectCell; body: Series<Cell> } {
  const ctx = context();
  if (proto !== null) {
    ctx.keys.push(...proto.keys);
    for (const v of proto.vals) ctx.vals.push(rebindValue(v, proto, ctx));
  }
  collectSetWords(spec.s, spec.i, ctx);
  const body = copyDeep(spec.s, spec.i);
  bindSeries(body, ctx);
  return { obj: { t: kind, ctx }, body };
}

function rebindValue(v: Cell, from: Ctx, to: Ctx): Cell {
  if (isAnyBlock(v.t)) {
    const b = v as BlockCell;
    return { t: b.t, s: copyDeep(b.s, 0, from, to), i: b.i };
  }
  if (v.t === K.Function) {
    const def = v.p as FuncDef;
    return { t: K.Function, p: { ...def, body: copyDeep(def.body, 0, from, to) } satisfies FuncDef };
  }
  return v;
}

function makeOf(k: Kind, spec: Cell): Cell | string {
  switch (k) {
    case K.Function: {
      if (spec.t !== K.Block) break;
      const [s, b] = spec.s.data.slice(spec.i);
      if (s?.t !== K.Block || b?.t !== K.Block) return 'make function! needs [spec body]';
      const def = makeFunc(s, b);
      return typeof def === 'string' ? `bad function spec: ${def}` : { t: K.Function, p: def };
    }
    case K.Op: {
      if (spec.t !== K.Function && spec.t !== K.Native) break;
      return { t: K.Op, p: { fn: spec } };
    }
    case K.Map: {
      if (spec.t !== K.Block) break;
      const items = spec.s.data.slice(spec.i);
      if (items.length % 2 !== 0) return 'make map! needs key value pairs';
      return {
        t: K.Map,
        s: { data: items.map((c, i) => i % 2 === 0 && isAnyWord(c.t) ? { t: K.Word, sym: (c as WordCell).sym, bind: null } as Cell : c) },
      };
    }
    case K.Block: case K.Paren:
      if (spec.t === K.Integer) return { t: k, s: { data: [] }, i: 0 };
      if (isAnyBlock(spec.t)) return { t: k, s: { data: (spec as BlockCell).s.data.slice((spec as BlockCell).i) }, i: 0 };
      break;
    case K.String: case K.File: case K.Email: case K.Url: case K.Tag:
      if (spec.t === K.Integer) return { t: k, s: { data: [] }, i: 0 };
      return { t: k, s: { data: codePoints(form(spec)) }, i: 0 };
    case K.Typeset: {
      if (spec.t !== K.Block) break;
      const bits = typesOf(spec);
      return typeof bits === 'string' ? bits : typeset(bits);
    }
    case K.Error:
      if (spec.t === K.String) return makeError('user', 'message', text(spec));
      break;
  }
  return `cannot make ${kindName(k)} from ${kindName(spec.t)}`;
}

native('make', '[type [any-value!] spec [any-value!]]', (_t, f) => {
  if (f.phase === 1) return value(f.data as ObjectCell);
  const type = f.args[0]!;
  const spec = f.args[1]!;
  let proto: Ctx | null = null;
  let kind: typeof K.Object | typeof K.Error = K.Object;
  if (type.t === K.Datatype && (type.k === K.Object || (type.k === K.Error && spec.t === K.Block))) {
    if (type.k === K.Error) {
      proto = makeError('user', 'message', '').ctx;
      kind = K.Error;
    }
  } else if (type.t === K.Object || type.t === K.Error) {
    proto = type.ctx;
    kind = type.t;
  } else if (type.t === K.Datatype) {
    const made = makeOf(type.k, spec);
    return typeof made === 'string' ? fail('script', 'bad-make', made) : value(made);
  } else {
    return fail('script', 'bad-make', `cannot make from ${kindName(type.t)}`);
  }
  if (spec.t !== K.Block) return fail('script', 'bad-make', `make ${kindName(kind)} needs a block`);
  const { obj, body } = makeObject(proto, spec, kind);
  f.phase = 1;
  f.data = obj;
  return { k: 'do', s: body, i: 0 };
});

// --- words and contexts ----------------------------------------------------------

native('get', '[word [any-word!] /any]', (_t, f) => {
  const w = f.args[0] as WordCell;
  const v = getWord(w);
  if (v === null) return fail('script', 'not-bound', `${spell(w.sym)} is not bound to a context`);
  if (v.t === K.Unset && f.args[1] !== TRUE) return fail('script', 'no-value', `${spell(w.sym)} has no value`);
  return value(v);
});

native('set', '[word [any-word! block!] value [any-type!]]', (_t, f) => {
  const target = f.args[0]!;
  const v = f.args[1]!;
  const words = target.t === K.Block ? target.s.data.slice(target.i) : [target];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (!isAnyWord(w.t)) return fail('script', 'bad-set', `cannot set ${mold(w)}`);
    const x = target.t === K.Block && v.t === K.Block ? v.s.data[v.i + i] ?? NONE : v;
    if (!setWord(w as WordCell, x)) return fail('script', 'not-bound', `${spell((w as WordCell).sym)} is not bound to a context`);
  }
  return value(v);
});

native('value?', '[word [any-word!]]', (_t, f) => {
  const v = getWord(f.args[0] as WordCell);
  return value(v !== null && v.t !== K.Unset ? TRUE : FALSE);
});

native('type?', '[value [any-type!]]', (_t, f) => value(datatype(f.args[0]!.t)));

native('bind', '[block [block!] context [any-word! any-object!]]', (_t, f) => {
  const b = f.args[0] as BlockCell;
  const c = f.args[1]!;
  const ctx = c.t === K.Object || c.t === K.Error ? c.ctx : (c as WordCell).bind;
  if (ctx === null) return fail('script', 'not-bound', `${mold(c)} is not bound to a context`);
  bindSeries(b.s, ctx);
  return value(b);
});

native('in', '[object [any-object!] word [any-word!]]', (_t, f) => {
  const obj = f.args[0] as ObjectCell;
  const w = f.args[1] as WordCell;
  return value(ctxFind(obj.ctx, w.sym) >= 0 ? { t: K.Word, sym: w.sym, bind: obj.ctx } : NONE);
});

native('use', '[words [block! word!] body [block!]]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);
  const words = f.args[0]!;
  const list = words.t === K.Block ? words.s.data.slice(words.i) : [words];
  if (list.some(w => !isAnyWord(w.t))) return fail('script', 'bad-words', 'use needs a block of words');
  const ctx = context(list.map(w => (w as WordCell).sym), list.map(() => NONE));
  const body = f.args[1] as BlockCell;
  const s = copyDeep(body.s, body.i);
  bindSeries(s, ctx);
  f.phase = 1;
  return doBlock({ t: K.Block, s, i: 0 });
});

// --- minimal series ----------------------------------------------------------------

native('length?', '[series [series! map! object!]]', (_t, f) => {
  const x = f.args[0]!;
  if (x.t === K.Map) return value({ t: K.Integer, v: x.s.data.length / 2 });
  if (x.t === K.Object || x.t === K.Error) return value({ t: K.Integer, v: x.ctx.keys.length });
  const s = x as BlockCell | StringCell;
  return value({ t: K.Integer, v: Math.max(0, s.s.data.length - s.i) });
});

native('pick', '[series [any-value!] index [any-value!]]', (_t, f) => {
  const r = pick(f.args[0]!, f.args[1]!);
  return typeof r === 'string' ? fail('script', 'bad-pick', r) : value(r);
});

native('select', '[series [any-block! map! object!] key [any-value!]]', (_t, f) => {
  const x = f.args[0]!;
  const key = f.args[1]!;
  if ((x.t === K.Object || x.t === K.Error) && isAnyWord(key.t)) {
    const i = ctxFind(x.ctx, (key as WordCell).sym);
    return value(i < 0 ? NONE : x.ctx.vals[i]!);
  }
  if (key.t === K.Integer && isAnyBlock(x.t)) {
    // select looks for the key; it never indexes
    const b = x as BlockCell;
    for (let j = b.i; j < b.s.data.length - 1; j++) {
      const c = b.s.data[j]!;
      if (c.t === K.Integer && I64.cmp(c.v, key.v) === 0) return value(b.s.data[j + 1]!);
    }
    return value(NONE);
  }
  const r = pick(x, key);
  return typeof r === 'string' ? fail('script', 'bad-select', r) : value(r);
});

native('poke', '[series [any-value!] index [any-value!] value [any-value!]]', (_t, f) => {
  const msg = poke(f.args[0]!, f.args[1]!, f.args[2]!);
  return msg !== null ? fail('script', 'bad-poke', msg) : value(f.args[2]!);
});

native('append', '[series [series!] value [any-value!] /only]', (_t, f) => {
  const x = f.args[0]!;
  const v = f.args[1]!;
  if (isAnyBlock(x.t)) {
    const s = (x as BlockCell).s;
    if (isAnyBlock(v.t) && f.args[2] !== TRUE) s.data.push(...(v as BlockCell).s.data.slice((v as BlockCell).i));
    else s.data.push(v);
    return value(x);
  }
  const s = (x as StringCell).s;
  if (x.t === K.Binary) {
    if (v.t === K.Binary) s.data.push(...v.s.data.slice(v.i));
    else if (v.t === K.Integer) s.data.push(I64.toNumber(v.v) & 255);
    else s.data.push(...new TextEncoder().encode(form(v)));
    return value(x);
  }
  if (v.t === K.Char) s.data.push(v.v);
  else if (isAnyString(v.t)) s.data.push(...(v as StringCell).s.data.slice((v as StringCell).i));
  else s.data.push(...codePoints(form(v)));
  return value(x);
});

native('copy', '[value [series! map! object!] /deep]', (_t, f) => {
  const x = f.args[0]!;
  const deep = f.args[1] === TRUE;
  if (isAnyBlock(x.t)) {
    const b = x as BlockCell;
    const s = deep ? copyDeep(b.s, b.i) : { data: b.s.data.slice(b.i) };
    return value({ t: b.t, s, i: 0 });
  }
  if (x.t === K.Map) return value({ t: K.Map, s: deep ? copyDeep(x.s) : { data: x.s.data.slice() } });
  if (x.t === K.Object || x.t === K.Error) {
    const ctx = context(x.ctx.keys.slice(), []);
    for (const v of x.ctx.vals) ctx.vals.push(deep ? rebindValue(v, x.ctx, ctx) : v);
    return value({ t: x.t, ctx });
  }
  if (x.t === K.Bitset) return value({ t: K.Bitset, s: { data: x.s.data.slice() }, neg: x.neg });
  const s = x as StringCell;
  return value({ t: s.t, s: { data: s.s.data.slice(s.i) }, i: 0 });
});
