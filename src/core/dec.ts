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
