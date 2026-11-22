// Arithmetic, comparison and logic natives, and their infix operators.
//
// integer! stays exact and raises an error on 64-bit overflow; integer
// division gives an integer when exact and a decimal otherwise, as in R3.
// money! is exact (see dec.ts). A percent scaled by a number stays a percent.

import { K, kindName } from '../kinds.ts';
import * as I64 from '../int64.ts';
import { decAdd, decSub, decMul, decDiv, decRem, decRound, decFromNumber, decToNumber, decEqual, type Dec, type Rounding } from '../dec.ts';
import {
  ownMeta,
  NONE, UNSET, TRUE, integer, decimal, percent, money, time, pair, logic, date, strictEqual, sameValue,
  type Cell, type BlockCell, type DateCell, type DateVal,
} from '../values.ts';
import { isSeries } from '../kinds.ts';
import { mold } from '../mold.ts';
import { pick } from '../access.ts';
import { isEqual, compare, toDec } from '../compare.ts';
import type { Step } from '../eval.ts';
import { native, op, value, fail, truthy } from './define.ts';
import { touch } from '../values.ts';

const A = { Add: 0, Sub: 1, Mul: 2, Div: 3, Rem: 4 } as const;
type Arith = (typeof A)[keyof typeof A];
const VERBS = ['add', 'subtract', 'multiply', 'divide', 'take the remainder of'];

const zeroDivide = (): Step => fail('math', 'zero-divide', 'attempt to divide by zero');
const overflow = (): Step => fail('math', 'overflow', 'math or number overflow');

function num(c: Cell): number | null {
  switch (c.t) {
    case K.Integer: return I64.toNumber(c.v);
    case K.Decimal: case K.Percent: return c.v;
  }
  return null;
}

function floatOp(op: Arith, x: number, y: number): number | null {
  switch (op) {
    case A.Add: return x + y;
    case A.Sub: return x - y;
    case A.Mul: return x * y;
    case A.Div: return y === 0 ? null : x / y;
    case A.Rem: return y === 0 ? null : x % y;
  }
}

function intArith(op: Arith, a: I64.I64, b: I64.I64): Step {
  let r: I64.I64 | null;
  switch (op) {
    case A.Add: r = I64.add(a, b); break;
    case A.Sub: r = I64.sub(a, b); break;
    case A.Mul: r = I64.mul(a, b); break;
    case A.Rem:
      if (I64.isZero(b)) return zeroDivide();
      r = I64.rem(a, b);
      break;
    case A.Div: {
      if (I64.isZero(b)) return zeroDivide();
      const m = I64.rem(a, b);
      if (m !== null && I64.isZero(m)) {
        r = I64.quot(a, b);
        break;
      }
      return value(decimal(I64.toNumber(a) / I64.toNumber(b)));
    }
  }
  return r === null ? overflow() : value(integer(r));
}

function moneyArith(op: Arith, a: Cell, b: Cell): Step | null {
  const x = toDec(a);
  const y = toDec(b);
  if (x === null || y === null) return null;
  const ca = a.t === K.Money ? a.cur : '';
  const cb = b.t === K.Money ? b.cur : '';
  if (ca !== '' && cb !== '' && ca.toUpperCase() !== cb.toUpperCase()) {
    return fail('math', 'currency', `cannot mix ${ca} and ${cb}`);
  }
  const cur = ca || cb;
  const both = a.t === K.Money && b.t === K.Money;
  let r: Dec | null;
  switch (op) {
    case A.Add: r = decAdd(x, y); break;
    case A.Sub: r = decSub(x, y); break;
    case A.Mul:
      if (both) return null;
      r = decMul(x, y);
      break;
    case A.Div:
      r = decDiv(x, y);
      if (r === null) return zeroDivide();
      return value(both ? decimal(decToNumber(r)) : money(r, cur));
    case A.Rem: r = decRem(x, y); break;
  }
  return r === null ? zeroDivide() : value(money(r, cur));
}

function arith(op: Arith, a: Cell, b: Cell): Step {
  if (a.t === K.Integer && b.t === K.Integer) return intArith(op, a.v, b.v);
  const x = num(a);
  const y = num(b);
  if (a.t === K.Money || b.t === K.Money) {
    const r = moneyArith(op, a, b);
    if (r !== null) return r;
  } else if (a.t === K.Pair || b.t === K.Pair) {
    const ax = a.t === K.Pair ? a.x : x;
    const ay = a.t === K.Pair ? a.y : x;
    const bx = b.t === K.Pair ? b.x : y;
    const by = b.t === K.Pair ? b.y : y;
    if (ax !== null && ay !== null && bx !== null && by !== null) {
      const rx = floatOp(op, ax, bx);
      const ry = floatOp(op, ay, by);
      return rx === null || ry === null ? zeroDivide() : value(pair(rx, ry));
    }
  } else if (a.t === K.Date) {
    const r = dateArith(op, a, b);
    if (r !== null) return r;
  } else if (a.t === K.Time || b.t === K.Time) {
    const r = timeArith(op, a, b, x, y);
    if (r !== null) return r;
  } else if (x !== null && y !== null) {
    const r = floatOp(op, x, y);
    if (r === null) return zeroDivide();
    if (!Number.isFinite(r)) return overflow();
    const keepsPercent = a.t === K.Percent &&
      (b.t === K.Percent ? op !== A.Div : op === A.Mul || op === A.Div);
    return value(keepsPercent ? percent(r) : decimal(r));
  }
  return fail('script', 'bad-math', `cannot ${VERBS[op]} ${kindName(a.t)} and ${kindName(b.t)}`);
}

function timeArith(op: Arith, a: Cell, b: Cell, x: number | null, y: number | null): Step | null {
  if (a.t === K.Time && b.t === K.Time) {
    switch (op) {
      case A.Add: return value(time(a.v + b.v));
      case A.Sub: return value(time(a.v - b.v));
      case A.Div: return b.v === 0 ? zeroDivide() : value(decimal(a.v / b.v));
      case A.Rem: return b.v === 0 ? zeroDivide() : value(time(a.v % b.v));
    }
    return null;
  }
  if (a.t === K.Time && y !== null) {
    if (op === A.Mul) return value(time(Math.round(a.v * y)));
    if (op === A.Div) return y === 0 ? zeroDivide() : value(time(Math.round(a.v / y)));
  }
  if (b.t === K.Time && x !== null && op === A.Mul) return value(time(Math.round(b.v * x)));
  return null;
}

const DAY_NS = 86400e9;

/** Days since 1970-01-01 for a calendar date. */
function dayNumber(d: DateVal): number {
  return Date.UTC(d.y, d.m - 1, d.d) / 86400000;
}

function fromDayNumber(n: number, time: number | null, zone: number | null): Cell {
  const js = new Date(n * 86400000);
  return date({ y: js.getUTCFullYear(), m: js.getUTCMonth() + 1, d: js.getUTCDate(), time, zone });
}

/** date ± integer days, date ± time, date - date in days. */
function dateArith(op: Arith, a: DateCell, b: Cell): Step | null {
  const d = a.v;
  if (b.t === K.Integer && (op === A.Add || op === A.Sub)) {
    const n = I64.toNumber(b.v);
    return value(fromDayNumber(dayNumber(d) + (op === A.Add ? n : -n), d.time, d.zone));
  }
  if (b.t === K.Time && (op === A.Add || op === A.Sub)) {
    const total = (d.time ?? 0) + (op === A.Add ? b.v : -b.v);
    const days = Math.floor(total / DAY_NS);
    return value(fromDayNumber(dayNumber(d) + days, total - days * DAY_NS, d.zone));
  }
  if (b.t === K.Date && op === A.Sub) {
    const ns = dateDiff(d, b.v);
    return value(d.time === null && b.v.time === null ? integer(Math.round(ns / DAY_NS)) : time(ns));
  }
  return null;
}

/** Nanoseconds from date `e` to date `d`, zones taken into account. */
export function dateDiff(d: DateVal, e: DateVal): number {
  return (dayNumber(d) - dayNumber(e)) * DAY_NS + ((d.time ?? 0) - (d.zone ?? 0) * 60e9) - ((e.time ?? 0) - (e.zone ?? 0) * 60e9);
}

const NUMERIC = '[number! money! time! pair! date!]';

native('add', `["The sum of two values." a ${NUMERIC} b ${NUMERIC}]`, (_t, f) => arith(A.Add, f.args[0]!, f.args[1]!));
native('subtract', `["The difference of two values." a ${NUMERIC} b ${NUMERIC}]`, (_t, f) => arith(A.Sub, f.args[0]!, f.args[1]!));
native('multiply', `["The product of two values." a ${NUMERIC} b ${NUMERIC}]`, (_t, f) => arith(A.Mul, f.args[0]!, f.args[1]!));
native('divide', `["The first value divided by the second." a ${NUMERIC} b ${NUMERIC}]`, (_t, f) => arith(A.Div, f.args[0]!, f.args[1]!));
native('remainder', `["What is left after dividing the first value by the second." a ${NUMERIC} b ${NUMERIC}]`, (_t, f) => arith(A.Rem, f.args[0]!, f.args[1]!));

native('negate', `["The value with its sign changed." value ${NUMERIC}]`, (_t, f) => {
  const a = f.args[0]!;
  switch (a.t) {
    case K.Integer: {
      const r = I64.neg(a.v);
      return r === null ? overflow() : value(integer(r));
    }
    case K.Decimal: return value(decimal(-a.v));
    case K.Percent: return value(percent(-a.v));
    case K.Money: return value(money({ d: -a.v.d, e: a.v.e }, a.cur));
    case K.Time: return value(time(-a.v));
    case K.Pair: return value(pair(-a.x, -a.y));
  }
  return fail('script', 'bad-math', `cannot negate ${kindName(a.t)}`);
});

// round: the nearest multiple of a scale (1 by default; 1 second for time!),
// exact for every kind since it works on decimals. As in R3, half goes away
// from zero; an integer scale gives an integer, a money! on either side money.
const ROUNDINGS = ['even', 'down', 'half-down', 'floor', 'ceiling', 'half-ceiling'] as const;

native('round', '["The value rounded to the nearest whole number, or to a multiple of a scale." value [number! money! time!] /to scale [number! money! time!] /even /down /half-down /floor /ceiling /half-ceiling]', (_t, f) => {
  const a = f.args[0]!;
  const to = f.args[1] === TRUE;
  const mode: Rounding = ROUNDINGS.find((_m, i) => f.args[3 + i] === TRUE) ?? 'half-away';
  if (a.t === K.Time) {
    const s = to ? f.args[2]! : integer(1);
    const step = s.t === K.Time ? s.v : (num(s) ?? decToNumber(toDec(s)!)) * 1e9;
    const r = decRound(decFromNumber(a.v)!, decFromNumber(step)!, mode);
    return r === null ? zeroDivide() : value(time(decToNumber(r)));
  }
  const s = to ? f.args[2]! : a.t === K.Percent ? percent(0.01) : integer(1);
  if (s.t === K.Time) return fail('script', 'bad-math', 'cannot round a number to a time!');
  const r = decRound(toDec(a)!, toDec(s)!, mode);
  if (r === null) return zeroDivide();
  if (a.t === K.Money || s.t === K.Money) return value(money(r, a.t === K.Money ? a.cur : (s as { cur: string }).cur));
  if (s.t === K.Integer && (to || a.t === K.Integer)) {
    const n = r.e === 0 ? I64.fromBig(r.d) : null;
    return n === null ? overflow() : value(integer(n));
  }
  return value(a.t === K.Percent ? percent(decToNumber(r)) : decimal(decToNumber(r)));
});

native('abs', `["The value without its sign." value ${NUMERIC}]`, (_t, f) => {
  const a = f.args[0]!;
  switch (a.t) {
    case K.Integer: {
      if (I64.cmp(a.v, 0) >= 0) return value(a);
      const r = I64.neg(a.v);
      return r === null ? overflow() : value(integer(r));
    }
    case K.Decimal: return value(decimal(Math.abs(a.v)));
    case K.Percent: return value(percent(Math.abs(a.v)));
    case K.Money: return value(money({ d: a.v.d < 0n ? -a.v.d : a.v.d, e: a.v.e }, a.cur));
    case K.Time: return value(time(Math.abs(a.v)));
    case K.Pair: return value(pair(Math.abs(a.x), Math.abs(a.y)));
  }
  return fail('script', 'bad-math', `cannot take abs of ${kindName(a.t)}`);
});

native('zero?', `["True if the value is zero." value ${NUMERIC}]`, (_t, f) => {
  const a = f.args[0]!;
  switch (a.t) {
    case K.Integer: return value(logic(I64.isZero(a.v)));
    case K.Money: return value(logic(decEqual(a.v, { d: 0n, e: 0 })));
    case K.Pair: return value(logic(a.x === 0 && a.y === 0));
    case K.Decimal: case K.Percent: case K.Time: return value(logic(a.v === 0));
  }
  return value(logic(false));
});

native('even?', '["True if the integer is even." value [integer!]]', (_t, f) => value(logic(I64.isZero(I64.rem((f.args[0] as { v: I64.I64 }).v, 2)!))));
native('odd?', '["True if the integer is odd." value [integer!]]', (_t, f) => value(logic(!I64.isZero(I64.rem((f.args[0] as { v: I64.I64 }).v, 2)!))));

native('sign?', '["Gives -1, 0 or 1 by the sign of the value." value [number! money! time!]]', (_t, f) => {
  return value(integer(signOf(f.args[0]!)));
});
native('negative?', '["True if the value is less than zero." value [number! money! time!]]', (_t, f) => value(logic(signOf(f.args[0]!) < 0)));
native('positive?', '["True if the value is more than zero." value [number! money! time!]]', (_t, f) => value(logic(signOf(f.args[0]!) > 0)));

function signOf(a: Cell): number {
  return a.t === K.Integer ? I64.cmp(a.v, 0) : a.t === K.Money ? Math.sign(Number(a.v.d)) : Math.sign((a as { v: number }).v);
}

// --- powers, roots, logarithms and trigonometry -------------------------------------
//
// As in Red, an integer to a whole power stays an exact integer (an error on
// 64-bit overflow); anything else is a decimal. Angles are in degrees unless
// /radians, as in R3 and Red.

const NUMBER = '[number!]';

function real(c: Cell): number {
  return c.t === K.Integer ? I64.toNumber(c.v) : (c as { v: number }).v;
}

/** As in R3 and Red, a result with no number is 1.#NaN, and one too big 1.#INF: not an error. */
function finite(x: number): Step {
  return value(decimal(x));
}

native('power', `["The number raised to the exponent." number ${NUMBER} exponent ${NUMBER}]`, (_t, f) => {
  const [a, b] = f.args as [Cell, Cell];
  if (a.t === K.Integer && b.t === K.Integer && I64.cmp(b.v, 0) >= 0) {
    const base = BigInt(a.v);
    const e = BigInt(b.v);
    // past 63 doublings even a base of 2 overflows; 0, 1 and -1 never do
    if (e > 64n && base !== 0n && base !== 1n && base !== -1n) return overflow();
    const n = I64.fromBig(base ** (e > 64n ? e % 2n + 2n : e));
    return n === null ? overflow() : value(integer(n));
  }
  return finite(Math.pow(real(a), real(b)));
});

native('square-root', `["The square root of the number." value ${NUMBER}]`, (_t, f) => {
  return finite(Math.sqrt(real(f.args[0]!)));
});
native('exp', `["e raised to the power of the number." power ${NUMBER}]`, (_t, f) => finite(Math.exp(real(f.args[0]!))));

function logOf(f: { args: Cell[] }, log: (x: number) => number): Step {
  return finite(log(real(f.args[0]!)));
}
native('log-e', `["The natural logarithm of the number." value ${NUMBER}]`, (_t, f) => logOf(f, Math.log));
native('log-10', `["The base-10 logarithm of the number." value ${NUMBER}]`, (_t, f) => logOf(f, Math.log10));
native('log-2', `["The base-2 logarithm of the number." value ${NUMBER}]`, (_t, f) => logOf(f, Math.log2));

const DEG = Math.PI / 180;

/** In degrees, what is left of an exact zero is zero: sine 180 is 0.0, as in R3. */
function clean(x: number): number {
  return Math.abs(x) < 1e-15 ? 0 : x;
}

function trig(name: string, doc: string, fn: (x: number) => number): void {
  native(name, `["${doc}" angle ${NUMBER} /radians "The angle is in radians"]`, (_t, f) => {
    const x = real(f.args[0]!) * (f.args[1] === TRUE ? 1 : DEG);
    if (name === 'tangent' && Math.abs(Math.cos(x)) < 1e-15) return finite(Math.sin(x) > 0 ? Infinity : -Infinity);
    const r = fn(x);
    return finite(f.args[1] === TRUE ? r : clean(r));
  });
}
trig('sine', 'The sine of an angle, in degrees.', Math.sin);
trig('cosine', 'The cosine of an angle, in degrees.', Math.cos);
trig('tangent', 'The tangent of an angle, in degrees.', Math.tan);

function arc(name: string, doc: string, fn: (x: number) => number, bounded: boolean): void {
  native(name, `["${doc}" value ${NUMBER} /radians "Give the angle in radians"]`, (_t, f) => {
    const x = real(f.args[0]!);
    return finite(f.args[1] === TRUE ? fn(x) : clean(fn(x) / DEG));
  });
}
arc('arcsine', 'The angle whose sine is the value, in degrees.', Math.asin, true);
arc('arccosine', 'The angle whose cosine is the value, in degrees.', Math.acos, true);
arc('arctangent', 'The angle whose tangent is the value, in degrees.', Math.atan, false);

native('arctangent2', `["The angle of the point x, y, in degrees." y ${NUMBER} x ${NUMBER} /radians "Give the angle in radians"]`, (_t, f) => {
  const r = Math.atan2(real(f.args[0]!), real(f.args[1]!));
  return finite(f.args[2] === TRUE ? r : clean(r / DEG));
});

// --- random ------------------------------------------------------------------------
//
// A small seeded generator (xorshift128+), so /seed gives the same sequence
// again. Seeded from the clock until a program seeds it.

const rng = { a: BigInt(Date.now()) | 1n, b: 0x9e3779b97f4a7c15n };

function nextRandom(): number {
  let x = rng.a;
  const y = rng.b;
  rng.a = y;
  x ^= (x << 23n) & 0xffffffffffffffffn;
  rng.b = x ^ y ^ (x >> 17n) ^ (y >> 26n);
  return Number((rng.b + y) & 0x1fffffffffffffn) / 2 ** 53;
}

/** A whole number from 1 to n. */
function randomInt(n: number): number {
  return Math.floor(nextRandom() * n) + 1;
}

native('random', '["A random value: an integer from 1 to it, a decimal up to it, a shuffled series." value [any-value!] /seed "Start the sequence from this value; gives nothing" /only "Pick one element of a series"]', (_t, f) => {
  const v = f.args[0]!;
  if (f.args[1] === TRUE) {
    let h = 0x811c9dc5n;
    for (const ch of mold(v)) h = ((h ^ BigInt(ch.codePointAt(0)!)) * 0x100000001b3n) & 0xffffffffffffffffn;
    rng.a = h | 1n;
    rng.b = (h * 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn | 1n;
    for (let i = 0; i < 8; i++) nextRandom();
    return value(UNSET);
  }
  switch (v.t) {
    case K.Integer: {
      const n = I64.toNumber(v.v);
      if (n === 0) return value(integer(0));
      return value(integer(Math.sign(n) * randomInt(Math.abs(n))));
    }
    case K.Decimal: return value(decimal(nextRandom() * v.v));
    case K.Percent: return value(percent(nextRandom() * v.v));
    case K.Money: return value(money(decFromNumber(Math.floor(nextRandom() * decToNumber(v.v) * 100) / 100)!, v.cur));
    case K.Logic: return value(logic(nextRandom() < 0.5));
    case K.Time: return value(time(Math.floor(nextRandom() * v.v)));
    case K.Char: return value({ t: K.Char, v: randomInt(v.v) });
  }
  if (isSeries(v.t)) {
    const s = v as BlockCell;
    const n = s.s.data.length - s.i;
    if (f.args[2] === TRUE) {
      if (n <= 0) return value(NONE);
      return value(pick(v, integer(randomInt(n))) as Cell);
    }
    ownMeta(s.s);
    touch(s.s);
    const arrays = [s.s.data, (s.s as { nl?: unknown[] }).nl, (s.s as { pos?: unknown[] }).pos].filter(x => x !== undefined) as unknown[][];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(nextRandom() * (i + 1));
      for (const arr of arrays) [arr[s.i + i], arr[s.i + j]] = [arr[s.i + j], arr[s.i + i]];
    }
    return value(v);
  }
  return fail('script', 'bad-random', `cannot make a random ${kindName(v.t)}`);
});

// --- bit shifts --------------------------------------------------------------------
//
// As in Red: shift goes right (keeping the sign) unless /left; /logical
// shifts zeros in from the left. Bits shifted out of the 64 are lost.

function shiftBits(x: I64.I64, n: number, left: boolean, logical: boolean): Cell {
  const v = BigInt(x);
  const by = BigInt(Math.max(0, Math.min(64, n)));
  let r: bigint;
  if (left) r = BigInt.asIntN(64, v << by);
  else if (logical) r = BigInt.asIntN(64, BigInt.asUintN(64, v) >> by);
  else r = v >> by;
  return integer(I64.fromBig(r)!);
}

const SHIFT_ARGS = 'data [integer!] bits [integer!] "How many bits"';
native('shift', `["Shifts the bits of an integer right, or left with /left." ${SHIFT_ARGS} /left "Shift to the left" /logical "Shift zeros in, not the sign"]`, (_t, f) =>
  value(shiftBits((f.args[0] as { v: I64.I64 }).v, I64.toNumber((f.args[1] as { v: I64.I64 }).v), f.args[2] === TRUE, f.args[3] === TRUE)));
native('shift-left', `["Shifts the bits of an integer left." ${SHIFT_ARGS}]`, (_t, f) =>
  value(shiftBits((f.args[0] as { v: I64.I64 }).v, I64.toNumber((f.args[1] as { v: I64.I64 }).v), true, false)));
native('shift-right', `["Shifts the bits of an integer right, keeping its sign." ${SHIFT_ARGS}]`, (_t, f) =>
  value(shiftBits((f.args[0] as { v: I64.I64 }).v, I64.toNumber((f.args[1] as { v: I64.I64 }).v), false, false)));
native('shift-logical', `["Shifts the bits of an integer right, shifting zeros in." ${SHIFT_ARGS}]`, (_t, f) =>
  value(shiftBits((f.args[0] as { v: I64.I64 }).v, I64.toNumber((f.args[1] as { v: I64.I64 }).v), false, true)));

// --- comparison ------------------------------------------------------------------

native('equal?', '["True if the values are equal." a [any-type!] b [any-type!]]', (_t, f) => value(logic(isEqual(f.args[0]!, f.args[1]!))));
native('not-equal?', '["True if the values are not equal." a [any-type!] b [any-type!]]', (_t, f) => value(logic(!isEqual(f.args[0]!, f.args[1]!))));
native('strict-equal?', '["True if the values are equal and of the same type and case." a [any-type!] b [any-type!]]', (_t, f) => value(logic(strictEqual(f.args[0]!, f.args[1]!))));
native('same?', '["True if the values are the very same: the same series at the same position, the same object." a [any-type!] b [any-type!]]', (_t, f) =>
  value(logic(sameValue(f.args[0]!, f.args[1]!))));
native('strict-not-equal?', '["True if the values are not strictly equal." a [any-type!] b [any-type!]]', (_t, f) => value(logic(!strictEqual(f.args[0]!, f.args[1]!))));

function ordered(a: Cell, b: Cell, test: (c: number) => boolean): Step {
  const c = compare(a, b);
  if (c === null) return fail('script', 'bad-compare', `cannot compare ${kindName(a.t)} with ${kindName(b.t)}`);
  return value(logic(test(c)));
}

native('lesser?', '["True if the first value is less than the second." a [any-value!] b [any-value!]]', (_t, f) => ordered(f.args[0]!, f.args[1]!, c => c < 0));
native('greater?', '["True if the first value is more than the second." a [any-value!] b [any-value!]]', (_t, f) => ordered(f.args[0]!, f.args[1]!, c => c > 0));
native('lesser-or-equal?', '["True if the first value is less than or equal to the second." a [any-value!] b [any-value!]]', (_t, f) => ordered(f.args[0]!, f.args[1]!, c => c <= 0));
native('greater-or-equal?', '["True if the first value is more than or equal to the second." a [any-value!] b [any-value!]]', (_t, f) => ordered(f.args[0]!, f.args[1]!, c => c >= 0));

function pickBy(a: Cell, b: Cell, wantMax: boolean): Step {
  const c = compare(a, b);
  if (c === null) return fail('script', 'bad-compare', `cannot compare ${kindName(a.t)} with ${kindName(b.t)}`);
  return value((c >= 0) === wantMax ? a : b);
}

native('max', '["The greater of two values." a [any-value!] b [any-value!]]', (_t, f) => pickBy(f.args[0]!, f.args[1]!, true));
native('min', '["The lesser of two values." a [any-value!] b [any-value!]]', (_t, f) => pickBy(f.args[0]!, f.args[1]!, false));

// --- logic -----------------------------------------------------------------------

/** Integers combine bitwise; anything else as logic by truthiness. */
function logicOp(a: Cell, b: Cell, int: (x: bigint, y: bigint) => bigint, bool: (x: boolean, y: boolean) => boolean): Step {
  if (a.t === K.Integer && b.t === K.Integer) {
    const r = I64.fromBig(BigInt.asIntN(64, int(BigInt(a.v), BigInt(b.v))));
    return r === null ? overflow() : value(integer(r));
  }
  if (a.t === K.Binary && b.t === K.Binary) {
    // byte by byte; as in R3, the shorter one repeats to the length of the longer
    const x = a.s.data.slice(a.i);
    const y = b.s.data.slice(b.i);
    const out: number[] = [];
    const n = Math.max(x.length, y.length);
    for (let i = 0; i < n && x.length > 0 && y.length > 0; i++) {
      out.push(Number(int(BigInt(x[i % x.length]!), BigInt(y[i % y.length]!)) & 255n));
    }
    return value({ t: K.Binary, s: { data: out }, i: 0 });
  }
  return value(logic(bool(truthy(a), truthy(b))));
}

native('and~', '["Both values: bitwise for integers and binaries, logical for anything else." a [any-value!] b [any-value!]]', (_t, f) => logicOp(f.args[0]!, f.args[1]!, (x, y) => x & y, (x, y) => x && y));
native('or~', '["Either value: bitwise for integers and binaries, logical for anything else." a [any-value!] b [any-value!]]', (_t, f) => logicOp(f.args[0]!, f.args[1]!, (x, y) => x | y, (x, y) => x || y));
native('xor~', '["One value or the other but not both: bitwise for integers and binaries, logical for anything else." a [any-value!] b [any-value!]]', (_t, f) => logicOp(f.args[0]!, f.args[1]!, (x, y) => x ^ y, (x, y) => x !== y));

// --- operators -------------------------------------------------------------------

op('+', 'add');
op('-', 'subtract');
op('*', 'multiply');
op('/', 'divide');
op('//', 'remainder');
op('**', 'power');
op('<<', 'shift-left');
op('>>', 'shift-right');
op('>>>', 'shift-logical');
op('=', 'equal?');
op('<>', 'not-equal?');
op('==', 'strict-equal?');
op('!==', 'strict-not-equal?');
op('<', 'lesser?');
op('>', 'greater?');
op('<=', 'lesser-or-equal?');
op('>=', 'greater-or-equal?');
op('and', 'and~');
op('or', 'or~');
op('xor', 'xor~');
