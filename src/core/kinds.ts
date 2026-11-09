// Datatype identifiers.
//
// A plain const object instead of a TS `enum`: enums are not erasable syntax,
// so Node cannot run them with type stripping. The numeric values are stable
// and meant to be mirrored 1:1 by a `enum(u8)` in a future Zig core.

export const K = {
  Unset: 0,
  None: 1,
  Logic: 2,
  Integer: 3,
  Decimal: 4,
  Percent: 5,
  Money: 6,
  Char: 7,
  Pair: 8,
  Tuple: 9,
  Date: 10,
  Time: 11,

  // string-like series (code points or bytes)
  String: 12,
  File: 13,
  Email: 14,
  Url: 15,
  Tag: 16,
  Binary: 17,
  Bitset: 18,

  // word-like (carry a symbol and a binding)
  Word: 19,
  SetWord: 20,
  GetWord: 21,
  LitWord: 22,
  Refinement: 23,
  Issue: 24,

  // block-like (series of cells)
  Block: 25,
  Paren: 26,
  Path: 27,
  SetPath: 28,
  GetPath: 29,
  LitPath: 30,

  // contexts and the rest
  Map: 31,
  Object: 32,
  Error: 33,
  Function: 34,
  Native: 35,
  Op: 36,
  Datatype: 37,
  Typeset: 38,
  Handle: 39,
} as const;

export type Kind = (typeof K)[keyof typeof K];

/** Datatype names, indexed by Kind. */
export const KIND_NAMES: readonly string[] = [
  'unset!', 'none!', 'logic!', 'integer!', 'decimal!', 'percent!', 'money!',
  'char!', 'pair!', 'tuple!', 'date!', 'time!',
  'string!', 'file!', 'email!', 'url!', 'tag!', 'binary!', 'bitset!',
  'word!', 'set-word!', 'get-word!', 'lit-word!', 'refinement!', 'issue!',
  'block!', 'paren!', 'path!', 'set-path!', 'get-path!', 'lit-path!',
  'map!', 'object!', 'error!', 'function!', 'native!', 'op!',
  'datatype!', 'typeset!', 'handle!',
];

export const KIND_COUNT = KIND_NAMES.length;

const byName = new Map<string, Kind>();
KIND_NAMES.forEach((n, i) => byName.set(n, i as Kind));

/** Looks up a datatype by its name, e.g. "integer!". Case-insensitive. */
export function kindByName(name: string): Kind | undefined {
  return byName.get(name.toLowerCase());
}

export function kindName(k: Kind): string {
  return KIND_NAMES[k] ?? '?!';
}

/** The kind's name with its article: "a block!", "an email!". */
export function aKindName(k: Kind): string {
  const n = kindName(k);
  return ('aeiou'.includes(n[0]!) ? 'an ' : 'a ') + n;
}

// --- classification helpers ------------------------------------------------

export function isAnyString(k: Kind): boolean {
  return k >= K.String && k <= K.Tag;
}

export function isAnyWord(k: Kind): boolean {
  return k >= K.Word && k <= K.Issue;
}

export function isAnyBlock(k: Kind): boolean {
  return k >= K.Block && k <= K.LitPath;
}

export function isAnyPath(k: Kind): boolean {
  return k >= K.Path && k <= K.LitPath;
}

export function isSeries(k: Kind): boolean {
  return (k >= K.String && k <= K.Binary) || isAnyBlock(k);
}

// --- typesets ------------------------------------------------------------------

/**
 * A typeset as a table indexed by kind, for checks on the hot path: testing
 * a bigint mask allocates, reading an array does not.
 */
export function kindTable(bits: bigint): readonly boolean[] {
  const out: boolean[] = [];
  for (let k = 0; k < KIND_COUNT; k++) out.push((bits & (1n << BigInt(k))) !== 0n);
  return out;
}

/** A set of kinds as a bitmask: bit `k` is set when kind `k` belongs to it. */
export function kindBit(k: Kind): bigint {
  return 1n << BigInt(k);
}

function range(from: Kind, to: Kind): bigint {
  let bits = 0n;
  for (let k = from; k <= to; k++) bits |= 1n << BigInt(k);
  return bits;
}

const ALL_KINDS = range(K.Unset, (KIND_COUNT - 1) as Kind);

/** Built-in typesets, usable wherever a datatype is expected (function specs, `make typeset!`). */
export const TYPESETS: Readonly<Record<string, bigint>> = {
  'any-type!': ALL_KINDS,
  'any-value!': ALL_KINDS & ~kindBit(K.Unset),
  'number!': kindBit(K.Integer) | kindBit(K.Decimal) | kindBit(K.Percent),
  'scalar!': range(K.Logic, K.Time) & ~kindBit(K.Logic),
  'any-string!': range(K.String, K.Tag),
  'series!': range(K.String, K.Binary) | range(K.Block, K.LitPath),
  'any-word!': range(K.Word, K.Issue),
  'any-block!': range(K.Block, K.LitPath),
  'any-path!': range(K.Path, K.LitPath),
  'any-object!': kindBit(K.Object) | kindBit(K.Error),
  'any-function!': kindBit(K.Function) | kindBit(K.Native) | kindBit(K.Op),
};

/** Bits for a datatype or typeset name ("integer!", "series!"), or undefined. */
export function typeBitsByName(name: string): bigint | undefined {
  const lower = name.toLowerCase();
  const k = byName.get(lower);
  return k !== undefined ? kindBit(k) : TYPESETS[lower];
}
