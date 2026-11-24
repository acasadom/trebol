// Construction syntax: the values #[...] and #(...) stand for, from the values read inside.
// Pure functions of the inner values; the lexer turns a returned message into a LoadError.

import { K, kindByName, isAnyBlock, isAnyString } from './kinds.ts';
import { spell as symName } from './symbols.ts';
import * as I64 from './int64.ts';
import {
  NONE, UNSET, TRUE, FALSE, datatype, typeset, bitset, object, context,
  type Cell, type BlockCell, type StringCell,
} from './values.ts';

/** #( key value ... ) — keys and values are not evaluated. A string is the load error. */
export function mapOf(d: readonly Cell[]): Cell | string {
if (d.length % 2 !== 0) return 'a map! needs key value pairs';
const data = d.map((c, j) =>
    j % 2 === 0 && c.t === K.SetWord ? { t: K.Word, sym: c.sym, bind: null } as Cell : c,
  );
  return { t: K.Map, s: { data } };
}

/**
 * Construction syntax #[...], for values that have no literal form:
 *   #[none] #[true] #[false] #[unset]
 *   #[datatype! integer!]   #[typeset! [integer! decimal!]]
 *   #[bitset! #{...}]       #[bitset! not #{...}]
 *   #[object! [a: 1]]       #[map! [a 1]]
 *   #[string! "abc" 2]      #[block! [a b] 2]   (series with an index)
 * A string is the load error.
 */
export function construct(d: readonly Cell[]): Cell | string {
const head = d[0];
const bad = (): string => 'invalid construction syntax';
  if (!head || head.t !== K.Word) return bad();
  const name = spellOf(head).toLowerCase();
  if (d.length === 1) {
    switch (name) {
      case 'none': case 'none!': return NONE;
      case 'unset': case 'unset!': return UNSET;
      case 'true': return TRUE;
      case 'false': return FALSE;
    }
    return bad();
  }
  const kind = kindByName(name);
  if (kind === undefined) return bad();
  const arg = d[1]!;
  switch (kind) {
    case K.Logic:
      if (d.length === 2 && arg.t === K.Word) {
        const v = spellOf(arg).toLowerCase();
        if (v === 'true') return TRUE;
        if (v === 'false') return FALSE;
      }
      return bad();
    case K.Datatype: {
      if (d.length !== 2 || arg.t !== K.Word) return bad();
      const k = kindByName(spellOf(arg));
      return k === undefined ? bad() : datatype(k);
    }
    case K.Typeset: {
      if (d.length !== 2 || arg.t !== K.Block) return bad();
      let bits = 0n;
      for (const w of arg.s.data) {
        const k = w.t === K.Word ? kindByName(spellOf(w)) : undefined;
        if (k === undefined) return bad();
        bits |= 1n << BigInt(k);
      }
      return typeset(bits);
    }
    case K.Bitset: {
      const neg = d.length === 3 && arg.t === K.Word && spellOf(arg).toLowerCase() === 'not';
      const bin = neg ? d[2]! : arg;
      if (bin.t !== K.Binary || d.length !== (neg ? 3 : 2)) return bad();
      return bitset([...bin.s.data], neg);
    }
    case K.Object: {
      if (d.length !== 2 || arg.t !== K.Block) return bad();
      const ctx = context();
      const body = arg.s.data;
      for (let j = 0; j < body.length; j += 2) {
        const key = body[j]!;
        if (key.t !== K.SetWord || j + 1 >= body.length) return bad();
        ctx.keys.push(key.sym);
        ctx.vals.push(literalValue(body[j + 1]!));
      }
      return object(ctx);
    }
    case K.Map:
      if (d.length !== 2 || arg.t !== K.Block) return bad();
      return mapOf(arg.s.data);
  }
  // A series at an index: #[kind! value index]
  const at = d[2];
  if (d.length === 3 && at !== undefined && at.t === K.Integer) {
    const idx = I64.toNumber(at.v) - 1;
    const ok = (isAnyString(kind) && isAnyString(arg.t)) || (isAnyBlock(kind) && isAnyBlock(arg.t));
    if (!ok || idx < 0) return bad();
    const src = arg as StringCell | BlockCell;
    if (idx > src.s.data.length) return bad();
    return { ...src, t: kind, i: idx } as Cell;
  }
  return bad();
}

function spellOf(c: Cell): string {
  return 'sym' in c ? symName(c.sym) : '';
}


/** In #[object! [...]] the words none, true and false stand for their values. */
function literalValue(c: Cell): Cell {
  if (c.t === K.Word) {
    switch (symName(c.sym).toLowerCase()) {
      case 'none': return NONE;
      case 'true': return TRUE;
      case 'false': return FALSE;
    }
  }
  return c;
}
