// Data natives: making values, words and contexts, load/mold, and the few
// series natives the core needs before the full series set arrives.

import { K, isAnyBlock, isAnyString, isAnyWord, kindName, type Kind } from '../kinds.ts';
import { spell } from '../symbols.ts';
import * as I64 from '../int64.ts';
import {
  NONE, UNSET, TRUE, FALSE, string, codePoints, text, datatype, typeset, context, object, blockOf, wordOf,
  type Cell, type BlockCell, type StringCell, type WordCell, type Ctx, type ObjectCell, type OpaqueCell, type Series,
} from '../values.ts';
import { bindSeries, bindSelf, collectSetWords, copyDeep, ctxFind, getWord, setWord } from '../ctx.ts';
import { makeError } from '../errors.ts';
import { makeFunc, typesOf, P, type FuncDef, type NativeDef, type OpDef } from '../func.ts';
import { load, LoadError } from '../lexer.ts';
import { mold, form } from '../mold.ts';
import { pick, poke, blockFind } from '../access.ts';
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

// As in R3 and Red, text holding one value loads as that value; /all always gives a block.
native('load', '[source [string!] /all "Gives a block even for one value"]', (t, f) => {
  const r = loadUser(t.rt, f.args[0] as StringCell);
  if (r.k !== 'value' || f.args[1] === TRUE) return r;
  const b = r.v as BlockCell;
  return b.s.data.length === 1 ? value(b.s.data[0]!) : r;
});

native('mold', '[value [any-type!] /only /all]', (_t, f) =>
  value(string(mold(f.args[0]!, { only: f.args[1] === TRUE, all: f.args[2] === TRUE }))));

native('form', '[value [any-type!]]', (_t, f) => value(string(form(f.args[0]!))));

// --- make ------------------------------------------------------------------------

/**
 * A new object from an optional prototype and a body. The prototype's
 * blocks and function bodies are copied and rebound to the new context, so
 * methods see the new object's fields; its strings are copied too.
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
  if (kind === K.Object) {
    ctx.self = true;
    bindSelf(body, ctx);
  }
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
  // as R3: strings and binaries are copied too, so no two objects share one
  if (isAnyString(v.t) || v.t === K.Binary) {
    const s = v as StringCell;
    return { t: s.t, s: { data: s.s.data.slice() }, i: s.i } as Cell;
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

// --- reflection: what help and source are written with ---------------------

/** The function an op! calls, or the value itself. */
const underOp = (c: Cell): Cell => (c.t === K.Op ? ((c as OpaqueCell).p as OpDef).fn : c);

native('spec-of', '[value [any-function!]]', (_t, f) => {
  const c = underOp(f.args[0]!);
  const p = (c as OpaqueCell).p;
  const spec = c.t === K.Function ? (p as FuncDef).specBlock : (p as NativeDef).specBlock;
  return value({ t: K.Block, s: copyDeep(spec.s, spec.i), i: 0 });
});

native('body-of', '[value [any-function!]]', (_t, f) => {
  const c = underOp(f.args[0]!);
  return value(c.t === K.Function ? { t: K.Block, s: copyDeep(((c as OpaqueCell).p as FuncDef).body), i: 0 } : NONE);
});

native('words-of', '[value [any-object! map! any-function!]]', (_t, f) => {
  const c = underOp(f.args[0]!);
  if (c.t === K.Object || c.t === K.Error) return value(blockOf(K.Block, c.ctx.keys.map(k => wordOf(K.Word, k))));
  if (c.t === K.Map) return value(blockOf(K.Block, c.s.data.filter((_v, i) => i % 2 === 0)));
  // a function's arguments and refinements, as its spec names them
  const p = (c as OpaqueCell).p;
  const spec = c.t === K.Function ? (p as FuncDef).spec : (p as NativeDef).spec;
  return value(blockOf(K.Block, spec.params.filter(p => p.kind !== P.Local)
    .map(p => wordOf(p.kind === P.Ref ? K.Refinement : K.Word, p.sym))));
});

native('values-of', '[value [any-object! map!]]', (_t, f) => {
  const c = f.args[0]!;
  if (c.t === K.Map) return value(blockOf(K.Block, c.s.data.filter((_v, i) => i % 2 === 1)));
  return value(blockOf(K.Block, (c as ObjectCell).ctx.vals.slice()));
});

native('bind', '[words [block! any-word!] context [any-word! any-object!] /new /copy "Binds a deep copy and leaves the block as it was"]', (_t, f) => {
  let x = f.args[0]!;
  const c = f.args[1]!;
  const ctx = c.t === K.Object || c.t === K.Error ? c.ctx : (c as WordCell).bind;
  if (ctx === null) return fail('script', 'not-bound', `${mold(c)} is not bound to a context`);
  const all = f.args[2] === TRUE;
  if (x.t !== K.Block) {
    const w = x as WordCell;
    if (!all && ctxFind(ctx, w.sym) < 0) return value(w);
    return value({ t: w.t, sym: w.sym, bind: ctx });
  }
  if (f.args[3] === TRUE) x = { t: x.t, s: copyDeep(x.s, x.i), i: 0 };
  bindSeries(x.s, ctx, all);
  return value(x);
});

native('context?', '[word [any-word!]]', (_t, f) => {
  const ctx = (f.args[0] as WordCell).bind;
  return value(ctx === null ? NONE : object(ctx));
});

native('unset', '[word [any-word! block!]]', (_t, f) => {
  const target = f.args[0]!;
  const words = target.t === K.Block ? target.s.data.slice(target.i) : [target];
  for (const w of words) {
    if (!isAnyWord(w.t)) return fail('script', 'bad-set', `cannot unset ${mold(w)}`);
    if (!setWord(w as WordCell, UNSET)) return fail('script', 'not-bound', `${spell((w as WordCell).sym)} is not bound to a context`);
  }
  return value(UNSET);
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

native('poke', '[series [any-value!] index [any-value!] value [any-value!]]', (_t, f) => {
  const msg = poke(f.args[0]!, f.args[1]!, f.args[2]!);
  return msg !== null ? fail('script', 'bad-poke', msg) : value(f.args[2]!);
});

// put, as in R3 and Red: a map or object gets the key set; a block has the value
// after the key replaced, or the key and value appended when the key is missing.
native('put', '["Sets the value of a key; gives the value." series [map! object! block!] key [any-value!] value [any-value!]]', (_t, f) => {
  const [x, key, v] = f.args as [Cell, Cell, Cell];
  if (x.t === K.Block) {
    const at = blockFind(x.s, x.i, key);
    if (at < 0 || at + 1 >= x.s.data.length) {
      const items = at < 0 ? [key, v] : [v];
      x.s.data.push(...items);
      if (x.s.nl) x.s.nl.push(...items.map(() => false));
      if (x.s.pos) x.s.pos.push(...items.map(() => -1));
    } else {
      x.s.data[at + 1] = v;
    }
    return value(v);
  }
  const msg = poke(x, key, v);
  return msg !== null ? fail('script', 'bad-poke', msg) : value(v);
});
