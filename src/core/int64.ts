// Hybrid 64-bit integers.
//
// Trebol's integer! is a signed 64-bit integer that raises an error on
// overflow, as in Rebol 3 and as an i64 would in Zig. Internally a value is
// a JS `number` while it fits in the safe range (|n| <= 2^53 - 1) and a
// `bigint` only beyond it. Every function here returns the normalized form,
// so `number` is always used when possible and equality stays simple.
//
// Arithmetic returns `null` on 64-bit overflow; the caller turns that into a
// Trebol error. No JS exceptions on the normal path.

export type I64 = number | bigint;

const MIN64 = -(2n ** 63n);
const MAX64 = 2n ** 63n - 1n;
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** Normalizes a bigint: number if it fits, null if it overflows 64 bits. */
export function fromBig(b: bigint): I64 | null {
  if (b >= MIN_SAFE && b <= MAX_SAFE) return Number(b);
  if (b < MIN64 || b > MAX64) return null;
  return b;
}

function big(a: I64): bigint {
  return typeof a === 'bigint' ? a : BigInt(a);
}

export function add(a: I64, b: I64): I64 | null {
  if (typeof a === 'number' && typeof b === 'number') {
    const r = a + b;
    if (Number.isSafeInteger(r)) return r;
  }
  return fromBig(big(a) + big(b));
}

export function sub(a: I64, b: I64): I64 | null {
  if (typeof a === 'number' && typeof b === 'number') {
    const r = a - b;
    if (Number.isSafeInteger(r)) return r;
  }
  return fromBig(big(a) - big(b));
}

export function mul(a: I64, b: I64): I64 | null {
  if (typeof a === 'number' && typeof b === 'number') {
    const r = a * b;
    if (Number.isSafeInteger(r)) return r === 0 ? 0 : r; // no -0
  }
  return fromBig(big(a) * big(b));
}

export function neg(a: I64): I64 | null {
  if (typeof a === 'number') return a === 0 ? 0 : -a;
  return fromBig(-a);
}

/** Truncating integer division. Returns null on overflow or division by zero. */
export function quot(a: I64, b: I64): I64 | null {
  if (b === 0) return null;
  if (typeof a === 'number' && typeof b === 'number') {
    const r = Math.trunc(a / b);
    return r === 0 ? 0 : r;
  }
  return fromBig(big(a) / big(b));
}

/** Remainder with the sign of the dividend. Null on division by zero. */
export function rem(a: I64, b: I64): I64 | null {
  if (b === 0) return null;
  if (typeof a === 'number' && typeof b === 'number') {
    const r = a % b;
    return r === 0 ? 0 : r;
  }
  return fromBig(big(a) % big(b));
}

export function cmp(a: I64, b: I64): -1 | 0 | 1 {
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
  const x = big(a);
  const y = big(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function isZero(a: I64): boolean {
  return a === 0 || a === 0n;
}

export function toNumber(a: I64): number {
  return typeof a === 'number' ? a : Number(a);
}

/** Converts a finite JS number to integer!, truncating. Null if out of range. */
export function fromNumber(n: number): I64 | null {
  if (!Number.isFinite(n)) return null;
  const t = Math.trunc(n);
  if (Number.isSafeInteger(t)) return t === 0 ? 0 : t;
  return fromBig(BigInt(t));
}

/**
 * Parses decimal digits with an optional sign. Accepts Rebol's ' digit
 * separators ("1'000'000"). Returns null if malformed or out of range.
 */
export function parse(text: string): I64 | null {
  const clean = text.replace(/'/g, '');
  if (!/^[+-]?\d+$/.test(clean)) return null;
  if (clean.replace(/^[+-]/, '').length <= 15) {
    const n = Number(clean); // 15 digits always fit in a safe integer
    return n === 0 ? 0 : n;
  }
  return fromBig(BigInt(clean));
}

export function toString(a: I64): string {
  return typeof a === 'bigint' ? a.toString() : String(a);
}
