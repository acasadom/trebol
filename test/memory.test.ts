// What values cost in memory, so a change that makes them dearer shows up here, and big series that
// once overflowed the JS stack (an edit passing every item as an argument) keep working.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { makeRuntime, doSource, form, errorField, mold } from '../src/core/index.ts';

setFlagsFromString('--expose-gc');
const gc = runInNewContext('gc') as () => void;
const rt = makeRuntime();

function run(src: string): string {
  const r = doSource(rt, src);
  if (r.k !== 'done') assert.fail(`${src}: ${r.k === 'error' ? form(errorField(r.e, 'message')) : r.k}`);
  return mold(r.v);
}

/** Bytes the heap keeps per unit after running `src`, which keeps what it builds in a word. */
function kept(src: string, units: number): number {
  gc(); gc();
  const before = process.memoryUsage().heapUsed;
  run(src);
  gc(); gc();
  return (process.memoryUsage().heapUsed - before) / units;
}

const N = 1_000_000;

describe('memory', () => {
  test('a string keeps about one array slot per character', () => {
    const b = kept(`m-s: append/dup make string! 0 #"a" ${N} 0`, N);
    assert.ok(b < 16, `${b.toFixed(1)} bytes per character`);
    run('m-s: none');
  });

  test('an integer in a block keeps its cell and a slot', () => {
    const b = kept(`m-b: make block! 0 repeat i ${N} [append m-b i] 0`, N);
    assert.ok(b < 80, `${b.toFixed(1)} bytes per integer`);
    run('m-b: none');
  });

  test('series of a million items go in and out whole', () => {
    run(`m-s: append/dup make string! 0 #"a" ${N}`);
    assert.equal(run(`length? head insert at copy "xy" 2 m-s`), String(N + 2));
    assert.equal(run(`length? trim/tail append copy m-s "   "`), String(N));
    assert.equal(run(`length? map-each x copy/part m-s 300000 [[x x]]`), '600000');
    assert.equal(run(`m-b: append/dup copy [] 1 ${N} length? remove-each x m-b [x > 1]`), String(N));
    assert.equal(run(`length? load-json to-json m-b`), String(N));
    run('m-s: m-b: none');
  });
});
