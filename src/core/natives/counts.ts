// Positions and counts as R3 takes them in at, skip, /part and /dup: an integer, or a decimal
// cut toward zero (2.9 is 2); past 32 bits (R3's positions) it is out of range.

import { K } from '../kinds.ts';
import * as I64 from '../int64.ts';
import type { Cell } from '../values.ts';
import { posOf } from '../access.ts';
import { mold } from '../mold.ts';
import type { Step } from '../eval.ts';
import { fail } from './define.ts';

/** The whole number a count stands for: an integer, or a decimal cut toward zero. */
export function count(c: Cell): number {
  if (c.t === K.Decimal) return Math.trunc(c.v) + 0;
  return I64.toNumber((c as { v: I64.I64 }).v);
}

/** An out-of-range error for the first count (a number, not a series) past 32 bits, or null. */
export function countsFail(...cs: (Cell | null)[]): Step | null {
  for (const c of cs) {
    if (c !== null && posOf(c, false) === 'range') return fail('script', 'out-of-range', `${mold(c)} is out of range`);
  }
  return null;
}

/** A position for at and skip, as pick takes it (true 1, false 2), or the error. */
export function positionOf(k: Cell): number | Step {
  const n = posOf(k, true);
  if (n === 'range') return fail('script', 'out-of-range', `index ${mold(k)} is out of range`);
  // a pair is for images, which Trebol has not: an invalid argument there (R3)
  if (n === null) return fail('script', 'invalid-arg', `${mold(k)} is not a position`);
  return n;
}
