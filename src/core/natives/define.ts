// Helpers to declare natives.
//
//   native('append', '[series [series!] value /only]', (t, f) => ...)
//
// The spec is Trebol source, parsed by the same code as `func` specs, so
// natives and functions take arguments, refinements and types identically.
// `f.args` follows the spec order: refinements and their arguments included.

import { K } from '../kinds.ts';
import { load } from '../lexer.ts';
import { parseSpec } from '../func.ts';
import { registerNative, throwError, type NativeFn, type Step } from '../eval.ts';
import type { Cell, BlockCell } from '../values.ts';

export function native(name: string, spec: string, fn: NativeFn): void {
  const specBlock = load(spec).s.data[0] as BlockCell;
  const parsed = parseSpec(specBlock);
  // A malformed spec here is a bug in Trebol itself, found at startup.
  if (typeof parsed === 'string') throw new Error(`bad spec for native ${name}: ${parsed}`);
  registerNative({ name, spec: parsed, specBlock }, fn);
}

/** Infix operators: the op's name and the two-argument native it calls. */
export const OPS: Array<[op: string, fn: string]> = [];

export function op(name: string, fn: string): void {
  OPS.push([name, fn]);
}

export const value = (v: Cell): Step => ({ k: 'value', v });

export const fail = throwError;

/** none and false are false; everything else is true. */
export function truthy(c: Cell): boolean {
  return !(c.t === K.None || (c.t === K.Logic && !c.v));
}

/** `do` this block and come back. */
export function doBlock(b: BlockCell): Step {
  return { k: 'do', s: b.s, i: b.i };
}
