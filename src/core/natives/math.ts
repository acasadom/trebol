// Arithmetic, comparison and logic natives, and their infix operators.
//
// integer! stays exact and raises an error on 64-bit overflow; integer
// division gives an integer when exact and a decimal otherwise, as in R3.
// money! is exact (see dec.ts). A percent scaled by a number stays a percent.

import { K, kindName } from '../kinds.ts';
import * as I64 from '../int64.ts';
import { decAdd, decSub, decMul, decDiv, decRem, decRound, decFromNumber, decToNumber, decEqual, type Dec, type Rounding } from '../dec.ts';
import {
  TRUE, integer, decimal, percent, money, time, pair, logic, date, strictEqual,
  type Cell, type DateCell, type DateVal,
} from '../values.ts';
import { isEqual, compare, toDec } from '../compare.ts';
import type { Step } from '../eval.ts';
import { native, op, value, fail, truthy } from './define.ts';

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
    const e = b.v;
    const ns = (dayNumber(d) - dayNumber(e)) * DAY_NS + ((d.time ?? 0) - (d.zone ?? 0) * 60e9) - ((e.time ?? 0) - (e.zone ?? 0) * 60e9);
    return value(d.time === null && e.time === null ? integer(Math.round(ns / DAY_NS)) : time(ns));
  }
  return null;
}

const NUMERIC = '[number! money! time! pair! date!]';

native('add', `[a ${NUMERIC} b ${NUMERIC}]`, (_t, f) => arith(A.Add, f.args[0]!, f.args[1]!));
native('subtract', `[a ${NUMERIC} b ${NUMERIC}]`, (_t, f) => arith(A.Sub, f.args[0]!, f.args[1]!));
native('multiply', `[a ${NUMERIC} b ${NUMERIC}]`, (_t, f) => arith(A.Mul, f.args[0]!, f.args[1]!));
native('divide', `[a ${NUMERIC} b ${NUMERIC}]`, (_t, f) => arith(A.Div, f.args[0]!, f.args[1]!));
native('remainder', `[a ${NUMERIC} b ${NUMERIC}]`, (_t, f) => arith(A.Rem, f.args[0]!, f.args[1]!));

native('negate', `[value ${NUMERIC}]`, (_t, f) => {
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

native('round', '[value [number! money! time!] /to scale [number! money! time!] /even /down /half-down /floor /ceiling /half-ceiling]', (_t, f) => {
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

native('abs', `[value ${NUMERIC}]`, (_t, f) => {
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

native('zero?', `[value ${NUMERIC}]`, (_t, f) => {
  const a = f.args[0]!;
  switch (a.t) {
    case K.Integer: return value(logic(I64.isZero(a.v)));
    case K.Money: return value(logic(decEqual(a.v, { d: 0n, e: 0 })));
    case K.Pair: return value(logic(a.x === 0 && a.y === 0));
    case K.Decimal: case K.Percent: case K.Time: return value(logic(a.v === 0));
  }
  return value(logic(false));
});

native('even?', '[value [integer!]]', (_t, f) => value(logic(I64.isZero(I64.rem((f.args[0] as { v: I64.I64 }).v, 2)!))));
native('odd?', '[value [integer!]]', (_t, f) => value(logic(!I64.isZero(I64.rem((f.args[0] as { v: I64.I64 }).v, 2)!))));

// --- comparison ------------------------------------------------------------------

native('equal?', '[a [any-type!] b [any-type!]]', (_t, f) => value(logic(isEqual(f.args[0]!, f.args[1]!))));
native('not-equal?', '[a [any-type!] b [any-type!]]', (_t, f) => value(logic(!isEqual(f.args[0]!, f.args[1]!))));
native('strict-equal?', '[a [any-type!] b [any-type!]]', (_t, f) => value(logic(strictEqual(f.args[0]!, f.args[1]!))));
native('same?', '[a [any-type!] b [any-type!]]', (_t, f) => {
  const a = f.args[0]! as Cell & { ctx?: unknown; s?: unknown; i?: number };
  const b = f.args[1]! as Cell & { ctx?: unknown; s?: unknown; i?: number };
  if (a.t !== b.t) return value(logic(false));
  if (a.ctx !== undefined) return value(logic(a.ctx === b.ctx));
  if (a.s !== undefined) return value(logic(a.s === b.s && a.i === b.i));
  return value(logic(strictEqual(a, b)));
});
native('strict-not-equal?', '[a [any-type!] b [any-type!]]', (_t, f) => value(logic(!strictEqual(f.args[0]!, f.args[1]!))));

function ordered(a: Cell, b: Cell, test: (c: number) => boolean): Step {
  const c = compare(a, b);
  if (c === null) return fail('script', 'bad-compare', `cannot compare ${kindName(a.t)} with ${kindName(b.t)}`);
  return value(logic(test(c)));
}

native('lesser?', '[a [any-value!] b [any-value!]]', (_t, f) => ordered(f.args[0]!, f.args[1]!, c => c < 0));
native('greater?', '[a [any-value!] b [any-value!]]', (_t, f) => ordered(f.args[0]!, f.args[1]!, c => c > 0));
native('lesser-or-equal?', '[a [any-value!] b [any-value!]]', (_t, f) => ordered(f.args[0]!, f.args[1]!, c => c <= 0));
native('greater-or-equal?', '[a [any-value!] b [any-value!]]', (_t, f) => ordered(f.args[0]!, f.args[1]!, c => c >= 0));

function pickBy(a: Cell, b: Cell, wantMax: boolean): Step {
  const c = compare(a, b);
  if (c === null) return fail('script', 'bad-compare', `cannot compare ${kindName(a.t)} with ${kindName(b.t)}`);
  return value((c >= 0) === wantMax ? a : b);
}

native('max', '[a [any-value!] b [any-value!]]', (_t, f) => pickBy(f.args[0]!, f.args[1]!, true));
native('min', '[a [any-value!] b [any-value!]]', (_t, f) => pickBy(f.args[0]!, f.args[1]!, false));

// --- logic -----------------------------------------------------------------------

/** Integers combine bitwise; anything else as logic by truthiness. */
function logicOp(a: Cell, b: Cell, int: (x: bigint, y: bigint) => bigint, bool: (x: boolean, y: boolean) => boolean): Step {
  if (a.t === K.Integer && b.t === K.Integer) {
    const r = I64.fromBig(BigInt.asIntN(64, int(BigInt(a.v), BigInt(b.v))));
    return r === null ? overflow() : value(integer(r));
  }
  return value(logic(bool(truthy(a), truthy(b))));
}

native('and~', '[a [any-value!] b [any-value!]]', (_t, f) => logicOp(f.args[0]!, f.args[1]!, (x, y) => x & y, (x, y) => x && y));
native('or~', '[a [any-value!] b [any-value!]]', (_t, f) => logicOp(f.args[0]!, f.args[1]!, (x, y) => x | y, (x, y) => x || y));
native('xor~', '[a [any-value!] b [any-value!]]', (_t, f) => logicOp(f.args[0]!, f.args[1]!, (x, y) => x ^ y, (x, y) => x !== y));

// --- operators -------------------------------------------------------------------

op('+', 'add');
op('-', 'subtract');
op('*', 'multiply');
op('/', 'divide');
op('//', 'remainder');
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
