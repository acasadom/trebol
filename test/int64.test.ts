import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as I64 from '../src/core/int64.ts';

const MAX = 2n ** 63n - 1n;
const MIN = -(2n ** 63n);

test('small values stay JS numbers', () => {
  assert.equal(I64.add(2, 3), 5);
  assert.equal(I64.mul(-4, 5), -20);
  assert.equal(I64.parse('1\'000\'000'), 1000000);
  assert.equal(typeof I64.parse('9007199254740991'), 'number');
});

test('values beyond 2^53 become bigint and stay exact', () => {
  const big = I64.add(Number.MAX_SAFE_INTEGER, 2);
  assert.equal(big, 9007199254740993n);
  assert.equal(I64.parse('9007199254740993'), 9007199254740993n);
});

test('results that fit again are normalized back to numbers', () => {
  const big = I64.add(Number.MAX_SAFE_INTEGER, 10)!;
  assert.equal(I64.sub(big, 10), Number.MAX_SAFE_INTEGER);
  assert.equal(typeof I64.sub(big, 10), 'number');
});

test('64-bit overflow returns null instead of a wrong value', () => {
  assert.equal(I64.add(MAX, 1), null);
  assert.equal(I64.sub(MIN, 1), null);
  assert.equal(I64.mul(MAX, 2), null);
  assert.equal(I64.neg(MIN), null);
  assert.equal(I64.parse('9223372036854775808'), null);
  assert.equal(I64.parse('9223372036854775807'), MAX);
  assert.equal(I64.parse('-9223372036854775808'), MIN);
});

test('division and remainder', () => {
  assert.equal(I64.quot(7, 2), 3);
  assert.equal(I64.quot(-7, 2), -3);
  assert.equal(I64.rem(-7, 2), -1);
  assert.equal(I64.quot(1, 0), null);
  assert.equal(I64.quot(MIN, -1), null);
});

test('comparison mixes numbers and bigints', () => {
  assert.equal(I64.cmp(1, MAX), -1);
  assert.equal(I64.cmp(MAX, MAX), 0);
  assert.equal(I64.cmp(MIN, -1), -1);
});

test('no negative zero', () => {
  assert.ok(Object.is(I64.mul(-1, 0), 0));
  assert.ok(Object.is(I64.neg(0), 0));
  assert.ok(Object.is(I64.parse('-0'), 0));
});
