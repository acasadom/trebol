// Bitsets, as in Rebol: bit n is bit (0x80 >> (n & 7)) of byte (n >> 3),
// so `#{80}` holds code point 0. A negated bitset holds everything its bytes
// do not, which keeps `complement charset "abc"` small.

import { K } from './kinds.ts';
import * as I64 from './int64.ts';
import { spell } from './symbols.ts';
import type { Cell, BitsetCell, StringCell } from './values.ts';

export function bitHas(b: BitsetCell, n: number): boolean {
  const byte = b.s.data[n >> 3];
  const on = byte !== undefined && (byte & (0x80 >> (n & 7))) !== 0;
  return on !== b.neg;
}

export function bitSet(bytes: number[], n: number): void {
  const i = n >> 3;
  while (bytes.length <= i) bytes.push(0);
  bytes[i]! |= 0x80 >> (n & 7);
}

/**
 * Adds the members described by a spec: a char, an integer, a string (its
 * chars), a binary (raw bytes, as the bitset data itself), or a block of
 * those where `a - b` is a range. Returns an error message on a bad spec.
 */
export function bitsFrom(spec: Cell, bytes: number[]): string | null {
  switch (spec.t) {
    case K.Char: bitSet(bytes, spec.v); return null;
    case K.Integer: bitSet(bytes, I64.toNumber(spec.v)); return null;
    case K.String: case K.File: case K.Email: case K.Url: case K.Tag:
      for (const cp of (spec as StringCell).s.data.slice((spec as StringCell).i)) bitSet(bytes, cp);
      return null;
    case K.Binary:
      spec.s.data.slice(spec.i).forEach((x, i) => { bytes[i] = (bytes[i] ?? 0) | x; });
      return null;
    case K.Block: {
      const d = spec.s.data.slice(spec.i);
      for (let i = 0; i < d.length; i++) {
        const c = d[i]!;
        const dash = d[i + 1];
        if (dash !== undefined && dash.t === K.Word && d[i + 2] !== undefined && isDash(dash)) {
          const lo = codeOf(c);
          const hi = codeOf(d[i + 2]!);
          if (lo === null || hi === null || hi < lo) return 'bad range in bitset spec';
          for (let n = lo; n <= hi; n++) bitSet(bytes, n);
          i += 2;
          continue;
        }
        const err = bitsFrom(c, bytes);
        if (err !== null) return err;
      }
      return null;
    }
  }
  return 'bad bitset spec';
}

function isDash(w: Cell): boolean {
  return w.t === K.Word && spell(w.sym) === '-';
}

function codeOf(c: Cell): number | null {
  if (c.t === K.Char) return c.v;
  if (c.t === K.Integer) return I64.toNumber(c.v);
  return null;
}
