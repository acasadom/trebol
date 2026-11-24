// Work that walks a series or a source once per item takes time in proportion to the square of its
// size. Each case here runs with n items and with 4 times as many: time in proportion to n grows about
// 4 times, the square 16 times. Times are not compared with a fixed limit, which a slow machine misses.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeRuntime, doSource, form, errorField, mold, loadSpans } from '../src/core/index.ts';

const rt = makeRuntime();
const MOST = 9;
const FLOOR = 20;

function run(src: string): string {
  const r = doSource(rt, src);
  if (r.k !== 'done') assert.fail(`${src}: ${r.k === 'error' ? form(errorField(r.e, 'message')) : r.k}`);
  return mold(r.v);
}

function timed<T>(f: () => T): { out: T; ms: number } {
  const t0 = performance.now();
  const out = f();
  return { out, ms: performance.now() - t0 };
}

/** Run `f` with n and 4n, check what it gives and that its time grows in proportion to n. */
function grows<T>(name: string, n: number, f: (n: number) => T, want: (n: number) => T): void {
  const small = timed(() => f(n));
  const big = timed(() => f(4 * n));
  assert.deepEqual(small.out, want(n));
  assert.deepEqual(big.out, want(4 * n));
  console.log(`${name}: ${small.ms.toFixed(0)} ms with ${n}, ${big.ms.toFixed(0)} ms with ${4 * n}`);
  assert.ok(big.ms < MOST * Math.max(small.ms, FLOOR), `${name}: ${small.ms} ms with ${n}, ${big.ms} ms with ${4 * n}`);
}

describe('time in proportion to size', () => {
  test('load-spans of text with characters outside ASCII but no surrogate pair', () => {
    grows('load-spans', 10_000, n => loadSpans('漢 '.repeat(n)).s.data.length, n => n);
  });

  test('load-spans of text with a surrogate pair', () => {
    grows('load-spans pair', 10_000, n => loadSpans('漢 '.repeat(n) + '😀').s.data.length, n => n + 1);
  });
});
