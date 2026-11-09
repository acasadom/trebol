// Function specs and function values.
//
// A spec block such as
//
//   [series [series!] value "the value" /only /part length [integer!] return: [series!] /local x]
//
// is parsed once into a flat parameter list. That list is also the layout of
// the frame context of every call: arguments, refinements, refinement
// arguments and locals, in spec order. Natives and functions share it.
//
// A function keeps its body bound to a template context with the frame's
// keys. Each call makes a fresh context and a deep copy of the body rebound
// to it (see `copyDeep`), so frames are never shared between calls or tasks.

import { K, kindBit, kindTable, typeBitsByName, TYPESETS } from './kinds.ts';
import { canon, intern, spell, type Sym } from './symbols.ts';
import { NONE, context, type BlockCell, type Cell, type Ctx, type Series } from './values.ts';
import { bindSeries, copyDeep } from './ctx.ts';

/** Parameter kinds. */
export const P = {
  /** evaluated argument: `value` */
  Arg: 0,
  /** quoted argument: `'value` (parens and get-words are still evaluated) */
  Lit: 1,
  /** literal argument: `:value`, taken as is */
  Get: 2,
  /** refinement: `/only`; true when used, none otherwise */
  Ref: 3,
  /** local: after `/local`, starts as none */
  Local: 4,
} as const;

export type PKind = (typeof P)[keyof typeof P];

export interface Param {
  readonly sym: Sym;
  readonly kind: PKind;
  /** Allowed kinds as a typeset bitmask. */
  readonly types: bigint;
  /** The same, indexed by kind: `allows[k]`. */
  readonly allows: readonly boolean[];
  /** Index of the refinement this argument belongs to, or -1. */
  readonly ref: number;
}

export interface Spec {
  readonly params: readonly Param[];
  /** Indexes of the arguments every call takes, in order. */
  readonly base: readonly number[];
  /** Allowed return kinds, or null when unchecked. */
  readonly ret: bigint | null;
  /** The same, indexed by kind. */
  readonly retAllows: readonly boolean[] | null;
  /** A frame's values before a call fills them: none for every parameter. */
  readonly blank: readonly Cell[];
}

/** The payload of a function! cell. */
export interface FuncDef {
  readonly spec: Spec;
  /** The spec as written, for mold and help. */
  readonly specBlock: BlockCell;
  /** Body bound to `tmpl`; copied and rebound for every call. */
  readonly body: Series<Cell>;
  readonly tmpl: Ctx;
}

/** The payload of a native! cell: an index into the native table. */
export interface NativeDef {
  readonly spec: Spec;
  /** The spec as written, for help. */
  readonly specBlock: BlockCell;
  readonly id: number;
  readonly name: string;
}

/** The payload of an op! cell: the two-argument function it calls. */
export interface OpDef {
  readonly fn: Cell;
}

const DEFAULT_TYPES = TYPESETS['any-value!']!;
const LOGIC_TYPES = kindBit(K.Logic) | kindBit(K.None);
const LOCAL = intern('local');
const RETURN = intern('return');

/** Parses a spec block. Returns an error message on a malformed spec. */
export function parseSpec(b: BlockCell): Spec | string {
  const params: Param[] = [];
  const base: number[] = [];
  let ret: bigint | null = null;
  let ref = -1;
  let local = false;
  const data = b.s.data;
  for (let i = b.i; i < data.length; i++) {
    const c = data[i]!;
    switch (c.t) {
      case K.String:
        continue; // documentation
      case K.Word: case K.LitWord: case K.GetWord: {
        if (params.some(p => canon(p.sym) === canon(c.sym))) return `duplicate parameter ${spell(c.sym)}`;
        const kind = local ? P.Local : c.t === K.Word ? P.Arg : c.t === K.LitWord ? P.Lit : P.Get;
        if (local && c.t !== K.Word) return `bad local ${spell(c.sym)}`;
        let types = DEFAULT_TYPES;
        const next = data[i + 1];
        if (!local && next !== undefined && next.t === K.Block) {
          const bits = typesOf(next);
          if (typeof bits === 'string') return bits;
          types = bits;
          i++;
        }
        if (kind !== P.Local && ref < 0) base.push(params.length);
        params.push({ sym: c.sym, kind, types, allows: kindTable(types), ref: local ? -1 : ref });
        continue;
      }
      case K.Refinement: {
        if (canon(c.sym) === canon(LOCAL)) {
          local = true;
          continue;
        }
        if (local) return `refinement /${spell(c.sym)} after /local`;
        if (params.some(p => canon(p.sym) === canon(c.sym))) return `duplicate parameter ${spell(c.sym)}`;
        ref = params.length;
        params.push({ sym: c.sym, kind: P.Ref, types: LOGIC_TYPES, allows: kindTable(LOGIC_TYPES), ref: -1 });
        continue;
      }
      case K.SetWord: {
        const next = data[i + 1];
        if (canon(c.sym) !== canon(RETURN) || next === undefined || next.t !== K.Block) {
          return `bad spec item ${spell(c.sym)}:`;
        }
        const bits = typesOf(next);
        if (typeof bits === 'string') return bits;
        ret = bits;
        i++;
        continue;
      }
      default:
        return 'bad spec item';
    }
  }
  return { params, base, ret, retAllows: ret === null ? null : kindTable(ret), blank: params.map(() => NONE) };
}

/** The typeset of a block of datatype names, e.g. [integer! none!]. */
export function typesOf(b: BlockCell): bigint | string {
  let bits = 0n;
  for (const w of b.s.data.slice(b.i)) {
    const found = w.t === K.Word ? typeBitsByName(spell(w.sym))
      : w.t === K.Datatype ? kindBit(w.k)
      : w.t === K.Typeset ? w.bits
      : undefined;
    if (found === undefined) return 'bad type in spec';
    bits |= found;
  }
  return bits;
}

/** Makes a function from a spec and a body. Both are copied. */
export function makeFunc(specBlock: BlockCell, bodyBlock: BlockCell): FuncDef | string {
  const spec = parseSpec(specBlock);
  if (typeof spec === 'string') return spec;
  const tmpl = context(spec.params.map(p => p.sym));
  const body = copyDeep(bodyBlock.s, bodyBlock.i);
  bindSeries(body, tmpl);
  return {
    spec,
    specBlock: { t: K.Block, s: copyDeep(specBlock.s, specBlock.i), i: 0 },
    body,
    tmpl,
  };
}
