// Set operations on big series take time in proportion to their length: values are kept
// in a hash index, so unique, union, intersect, difference and exclude of 100 000 values
// end in well under a second where comparing each with each took minutes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeRuntime, doSource, form, errorField, mold } from '../src/core/index.ts';

const rt = makeRuntime();

function run(src: string): string {
  const r = doSource(rt, src);
  if (r.k !== 'done') assert.fail(`${src}: ${r.k === 'error' ? form(errorField(r.e, 'message')) : r.k}`);
  return mold(r.v);
}

function timed(src: string): { out: string; ms: number } {
  const t0 = performance.now();
  const out = run(src);
  return { out, ms: performance.now() - t0 };
}

const N = 100_000;
const LIMIT = 3000;

describe('set operations on big series', () => {
  run(`s-a: make block! 0 repeat i ${N} [append s-a i append s-a i]`);
  run(`s-b: make block! 0 repeat i ${N} [append s-b i + ${N / 2}]`);
  run(`s-w: make block! 0 repeat i ${N} [append s-w to word! join "w" i]`);
  run(`s-t: make block! 0 repeat i ${N} [append s-t join "Text " i append s-t join "TEXT " i]`);
  run(`s-k: make block! 0 repeat i ${N} [append/only s-k reduce [i "x"]]`);

  const cases: [string, string][] = [
    ['unique of integers', `length? unique s-a`],
    ['union of integers', `length? union s-a s-b`],
    ['intersect of integers', `length? intersect s-a s-b`],
    ['difference of integers', `length? difference s-a s-b`],
    ['exclude of integers', `length? exclude s-a s-b`],
    ['unique of words', `length? unique s-w`],
    ['unique of text that differs only in case', `length? unique s-t`],
    ['unique/case of text that differs only in case', `length? unique/case s-t`],
    ['unique of blocks', `length? unique s-k`],
  ];
  const want = [N, N + N / 2, N / 2, N, N / 2, N, N, 2 * N, N].map(String);
  cases.forEach(([name, src], k) => {
    test(name, () => {
      const { out, ms } = timed(src);
      assert.equal(out, want[k]);
      assert.ok(ms < LIMIT, `${ms.toFixed(0)} ms`);
    });
  });

  test('unique of a long string', () => {
    const { out, ms } = timed(`length? unique append/dup make string! 0 "abcABC" ${N}`);
    assert.equal(out, '3');
    assert.ok(ms < LIMIT, `${ms.toFixed(0)} ms`);
  });
});
