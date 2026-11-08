// Exact decimals, used by money!.
//
// A value is `d × 10^-e` with `d` a bigint and `e >= 0`, always normalized
// (no trailing zeros in `d` when e > 0), so two equal amounts have the same
// representation and can be compared field by field.

export interface Dec {
  readonly d: bigint;
  readonly e: number;
}

export function dec(d: bigint, e: number): Dec {
  while (e > 0 && d % 10n === 0n) {
    d /= 10n;
    e--;
  }
  if (d === 0n) e = 0;
  return { d, e };
}

/** Parses "12", "-12.50", "1'000,25" (comma or dot as decimal mark). */
export function parseDec(text: string): Dec | null {
  const clean = text.replace(/'/g, '').replace(',', '.');
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(clean);
  if (!m) return null;
  const int = m[2] ?? '';
  const frac = m[3] ?? '';
  if (int === '' && frac === '') return null;
  const digits = BigInt((int || '0') + frac);
  return dec(m[1] === '-' ? -digits : digits, frac.length);
}

/** Formats with at least `minFrac` fractional digits. */
export function formatDec(v: Dec, minFrac = 0): string {
  const neg = v.d < 0n;
  let digits = (neg ? -v.d : v.d).toString();
  const e = Math.max(v.e, minFrac);
  digits = digits + '0'.repeat(e - v.e);
  if (e > 0) {
    digits = digits.padStart(e + 1, '0');
    digits = digits.slice(0, digits.length - e) + '.' + digits.slice(digits.length - e);
  }
  return (neg ? '-' : '') + digits;
}

export function decEqual(a: Dec, b: Dec): boolean {
  return a.d === b.d && a.e === b.e;
}

export function decToNumber(v: Dec): number {
  return Number(v.d) / 10 ** v.e;
}

// --- arithmetic ------------------------------------------------------------------

function align(a: Dec, b: Dec): [bigint, bigint, number] {
  const e = Math.max(a.e, b.e);
  return [a.d * 10n ** BigInt(e - a.e), b.d * 10n ** BigInt(e - b.e), e];
}

export function decAdd(a: Dec, b: Dec): Dec {
  const [x, y, e] = align(a, b);
  return dec(x + y, e);
}

export function decSub(a: Dec, b: Dec): Dec {
  const [x, y, e] = align(a, b);
  return dec(x - y, e);
}

export function decMul(a: Dec, b: Dec): Dec {
  return dec(a.d * b.d, a.e + b.e);
}

/** Digits kept after the point by division, rounded half to even. */
export const DIV_SCALE = 18;

/** a / b with DIV_SCALE fractional digits; null when b is zero. */
export function decDiv(a: Dec, b: Dec): Dec | null {
  if (b.d === 0n) return null;
  // a.d·10^-a.e / b.d·10^-b.e = (a.d·10^(S+b.e) / (b.d·10^a.e)) · 10^-S
  let num = a.d * 10n ** BigInt(DIV_SCALE + b.e);
  let den = b.d * 10n ** BigInt(a.e);
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  let q = num / den;
  const r = num % den;
  const twice = (r < 0n ? -r : r) * 2n;
  if (twice > den || (twice === den && q % 2n !== 0n)) q += num < 0n ? -1n : 1n;
  return dec(q, DIV_SCALE);
}

export function decCmp(a: Dec, b: Dec): -1 | 0 | 1 {
  const [x, y] = align(a, b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** The exact decimal of a finite JS number's shortest representation. */
export function decFromNumber(n: number): Dec | null {
  if (!Number.isFinite(n)) return null;
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(n));
  if (!m) return null;
  const frac = m[3] ?? '';
  let d = BigInt(m[2]! + frac);
  let e = frac.length - Number(m[4] ?? 0);
  if (e < 0) {
    d *= 10n ** BigInt(-e);
    e = 0;
  }
  return dec(m[1] === '-' ? -d : d, e);
}

export function decFromBig(n: bigint): Dec {
  return dec(n, 0);
}

/** Remainder with the sign of `a`, as `a - b × trunc(a / b)`; null when b is zero. */
export function decRem(a: Dec, b: Dec): Dec | null {
  if (b.d === 0n) return null;
  const [x, y, e] = align(a, b);
  return dec(x % y, e);
}

/** How `round` breaks a value between two multiples of the scale. */
export type Rounding = 'half-away' | 'half-down' | 'half-ceiling' | 'even' | 'down' | 'floor' | 'ceiling';

/** The multiple of `scale` nearest to `a` by `mode`, computed exactly; null when scale is zero. */
export function decRound(a: Dec, scale: Dec, mode: Rounding): Dec | null {
  if (scale.d === 0n) return null;
  // a / scale = num / den exactly
  let num = a.d * 10n ** BigInt(scale.e);
  let den = scale.d * 10n ** BigInt(a.e);
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  let k = num / den;
  const r = num % den;
  if (r !== 0n) {
    const away = num < 0n ? -1n : 1n;
    const twice = (r < 0n ? -r : r) * 2n;
    const half = twice > den ? 1 : twice === den ? 0 : -1;
    switch (mode) {
      case 'half-away': if (half >= 0) k += away; break;
      case 'half-down': if (half > 0) k += away; break;
      case 'half-ceiling': if (half > 0 || (half === 0 && num > 0n)) k += away; break;
      case 'even': if (half > 0 || (half === 0 && k % 2n !== 0n)) k += away; break;
      case 'down': break;
      case 'floor': if (num < 0n) k -= 1n; break;
      case 'ceiling': if (num > 0n) k += 1n; break;
    }
  }
  return dec(k * scale.d, scale.e);
}
