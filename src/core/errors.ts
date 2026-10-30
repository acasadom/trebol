// Errors are values.
//
// An error! is an object-like context with fixed fields. Natives create them
// and hand them to the evaluator inside a `throw` Step; nothing on the normal
// path uses JS exceptions. The evaluator fills `near`, `where` and `at` while
// unwinding, from the innermost expression and function it passes through.

import { K } from './kinds.ts';
import { intern, spell } from './symbols.ts';
import { NONE, string, wordOf, text, type Cell, type Ctx, type ObjectCell } from './values.ts';
import { ctxFind } from './ctx.ts';

/** Field order of every error! context. */
export const ERROR_FIELDS = ['type', 'id', 'message', 'near', 'where', 'at'] as const;
export type ErrorField = (typeof ERROR_FIELDS)[number];

const FIELD_SYMS = ERROR_FIELDS.map(f => intern(f));

/**
 * Error types, as in Rebol: `script` for misuse of the language, `math` for
 * arithmetic, `user` for errors made by programs, `access` for the host
 * (network, storage), `syntax` for load failures, `internal` for bugs.
 */
export function makeError(type: string, id: string, message: string): ObjectCell {
  const ctx: Ctx = {
    keys: [...FIELD_SYMS],
    vals: [wordOf(K.Word, type), wordOf(K.Word, id), string(message), NONE, NONE, NONE],
    parent: null,
  };
  return { t: K.Error, ctx };
}

export function errorField(e: ObjectCell, f: ErrorField): Cell {
  const i = ctxFind(e.ctx, intern(f));
  return i >= 0 ? e.ctx.vals[i]! : NONE;
}

/** Sets a field only when it is still none, so the innermost location wins. */
export function fillErrorField(e: ObjectCell, f: ErrorField, v: Cell): void {
  const i = ctxFind(e.ctx, intern(f));
  if (i >= 0 && e.ctx.vals[i]!.t === K.None) e.ctx.vals[i] = v;
}

/** One-line message, e.g. "Script error: x has no value". */
export function errorMessage(e: ObjectCell): string {
  const type = errorField(e, 'type');
  const msg = errorField(e, 'message');
  const name = type.t === K.Word ? spell(type.sym) : 'user';
  const body = msg.t === K.String ? text(msg) : '';
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} error: ${body}`;
}
