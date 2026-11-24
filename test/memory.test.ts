// What values cost in memory, so a change that makes them dearer shows up here, and big series that
// once overflowed the JS stack (an edit passing every item as an argument) keep working.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { makeRuntime, doSource, form, errorField, mold } from '../src/core/index.ts';
import { startHost, runSource } from '../src/host/index.ts';

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

  test('finished tasks and fired timers nobody keeps are let go', async () => {
    const host = startHost({ onError: () => {} });
    const round = 'loop 5000 [spawn [append make block! 100 1]] loop 500 [delay 0 [1]] wait 0.05';
    await runSource(host, round);
    gc(); gc();
    const before = process.memoryUsage().heapUsed;
    for (let r = 0; r < 3; r++) await runSource(host, round);
    gc(); gc();
    const grew = (process.memoryUsage().heapUsed - before) / 1048576;
    assert.ok(grew < 1, `${grew.toFixed(1)} MiB kept by 16500 finished tasks and timers`);
    assert.equal(host.sch.live, 0);
  });

  test('a task the app keeps can be waited for after it finished and memory was swept', async () => {
    const host = startHost({ onError: () => {} });
    await runSource(host, 'm-t: spawn [6 * 7] m-u: reduce [spawn [1] spawn [2]] wait 0.05');
    gc(); gc();
    assert.equal(mold(await runSource(host, 'wait m-t')), '42');
    assert.equal(mold(await runSource(host, 'wait m-u')), '[1 2]');
  });
});
