import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRuntime, doSource, mold, load, bindSeries, newTask, run, resume, resumeError,
  native, value, errorField, makeError, form, integer,
  type RunResult, type Cell, type ObjectCell, type Ctx,
} from '../src/core/index.ts';

let pending: { resolve: (v: Cell) => void } | null = null;

// A native that parks the task until the test resumes it.
native('test-pause', '[]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  return { k: 'await', p: new Promise<Cell>(resolve => { pending = { resolve }; }) };
});

// A native that recurses on the JS stack until it overflows, as a native written wrongly would.
const deepDown = (n: number): number => (n === 0 ? 0 : 1 + deepDown(n - 1));
native('test-recurse', '[]', () => value(integer(deepDown(1e7))));

const rt = makeRuntime();

function result(src: string): RunResult {
  return doSource(rt, src);
}

/** mold of the result of evaluating `src`. */
function ev(src: string): string {
  const r = result(src);
  if (r.k !== 'done') assert.fail(`${src}: ${r.k === 'error' ? form(errorField(r.e, 'message')) : r.k}`);
  return mold(r.v);
}

/** The id of the error raised by `src`. */
function evErr(src: string): string {
  const r = result(src);
  if (r.k !== 'error') assert.fail(`${src}: expected an error, got ${r.k === 'done' ? mold(r.v) : r.k}`);
  return form(errorField(r.e, 'id'));
}

describe('evaluation order', () => {
  test('infix operators go left to right without precedence', () => {
    assert.equal(ev('1 + 2 * 3'), '9');
    assert.equal(ev('2 * (1 + 2)'), '6');
    assert.equal(ev('10 - 2 - 3'), '5');
  });

  test('function arguments take infix expressions', () => {
    assert.equal(ev('negate 1 + 2'), '-3');
    assert.equal(ev('add 1 2 * 10'), '21');
  });

  test('the right operand of an op takes no infix of its own', () => {
    assert.equal(ev('1 + negate 2 * 3'), '-5');
  });

  test('set-words take a whole expression', () => {
    assert.equal(ev('x: 1 + 2 + 3 x'), '6');
    assert.equal(ev('a: b: 5 a + b'), '10');
  });

  test('a block evaluates to its last value; empty is unset', () => {
    assert.equal(ev('1 2 3'), '3');
    assert.equal(ev('do []'), '');
  });

  test('words: get-word, lit-word, paths', () => {
    assert.equal(ev("f: :negate f 3"), '-3');
    assert.equal(ev("'foo"), 'foo');
    assert.equal(ev("b: [x 10 y 20] b/y"), '20');
    assert.equal(ev("b: [7 8 9] b/2"), '8');
    assert.equal(ev("b: [7 8 9] i: 3 b/:i"), '9');
    assert.equal(ev("b: [7 8 9] b/(1 + 1)"), '8');
    assert.equal(ev("b: [1 2 3] b/2: 20 b"), '[1 20 3]');
    assert.equal(ev("p: 3x4 p/y"), '4');
  });
});

describe('binding', () => {
  test('function arguments are bound to the call frame', () => {
    assert.equal(ev('x: 1 f: func [x] [x * 10] reduce [f 5 x]'), '[50 1]');
  });

  test('each call gets its own frame (recursion)', () => {
    assert.equal(ev('fact: func [n] [either n < 2 [1] [n * fact n - 1]] fact 20'), '2432902008176640000');
  });

  test('functions made inside functions close over the frame', () => {
    assert.equal(ev('adder: func [n] [func [x] [x + n]] a: adder 1 b: adder 10 reduce [a 5 b 5]'), '[6 15]');
  });

  test('objects bind their set-words, methods see their own fields', () => {
    assert.equal(ev('o: make object! [a: 1 f: does [a + 1]] o/a: 41 o/f'), '42');
  });

  test('objects made from a prototype get their own copies of methods', () => {
    assert.equal(ev('p: make object! [a: 1 f: does [a]] q: make p [a: 2] reduce [p/f q/f]'), '[1 2]');
  });

  test('user words shadow lib without changing it', () => {
    const own = makeRuntime();
    assert.equal(mold((doSource(own, 'negate: func [x] [x] negate 5') as { v: Cell }).v), '5');
    // lib, and so any other runtime, still has the native
    assert.equal(mold((doSource(makeRuntime(), 'negate 5') as { v: Cell }).v), '-5');
  });

  test('bind, in and use', () => {
    assert.equal(ev('o: make object! [v: 7] b: [v * 2] do bind b o'), '14');
    assert.equal(ev('o: make object! [v: 7] get in o \'v'), '7');
    assert.equal(ev('v: 1 use [v] [v: 99] v'), '1');
  });

  test('writes to a watched object mark it dirty once', () => {
    const r = result('w: make object! [a: 1 b: 2 f: does [b: 3]]');
    assert.equal(r.k, 'done');
    const ctx = ((r as { v: Cell }).v as ObjectCell).ctx;
    const list: Ctx[] = [];
    ctx.watch = list;
    ev('w/a');
    assert.equal(list.length, 0);
    ev('w/a: 5 w/f set in w \'a 6');
    assert.deepEqual([list.length, list[0] === ctx, ctx.dirty], [1, true, true]);
    ctx.dirty = false;
    list.length = 0;
    ev('w/f');
    assert.equal(list.length, 1);
  });

  test('loop words are local to the loop', () => {
    assert.equal(ev('i: 0 repeat i 3 [] i'), '0');
    assert.equal(ev('out: copy [] foreach [k v] [a 1 b 2] [append out v] out'), '[1 2]');
  });
});

describe('control flow', () => {
  test('conditionals', () => {
    assert.equal(ev('if 1 < 2 ["yes"]'), '"yes"');
    assert.equal(ev('if 1 > 2 ["yes"]'), 'none');
    assert.equal(ev('either none [1] [2]'), '2');
    assert.equal(ev('case [false [1] true [2] true [3]]'), '2');
    assert.equal(ev('switch/default "b" ["a" [1] "B" [2]] [3]'), '2');
    assert.equal(ev('all [1 none 3]'), 'none');
    assert.equal(ev('any [none 2 3]'), '2');
  });

  test('loops, break and continue', () => {
    assert.equal(ev('n: 0 loop 5 [n: n + 1] n'), '5');
    assert.equal(ev('n: 0 while [n < 10] [n: n + 1 if n = 4 [break]] n'), '4');
    assert.equal(ev('loop 3 [break/return 7]'), '7');
    assert.equal(ev('s: 0 repeat i 5 [if i = 3 [continue] s: s + i] s'), '12');
    assert.equal(ev('n: 0 until [n: n + 1 n = 3]'), 'true');
  });

  test('return and exit leave the function', () => {
    assert.equal(ev('f: func [] [loop 5 [return 1] 2] f'), '1');
    assert.equal(ev('f: func [] [exit 2] f'), '');
  });

  test('break does not cross function boundaries', () => {
    assert.equal(evErr('f: does [break] loop 2 [f]'), 'no-loop');
  });

  test('try, attempt, catch and throw', () => {
    assert.equal(ev('e: try [1 / 0] e/id'), 'zero-divide');
    assert.equal(ev('try [1 + 1]'), '2');
    assert.equal(ev('attempt [1 / 0]'), 'none');
    assert.equal(ev('catch [loop 3 [throw "out"] 1]'), '"out"');
    assert.equal(ev("catch/name [catch [throw/name 5 'x] 6] 'x"), '5');
    assert.equal(evErr('throw 1'), 'no-catch');
    assert.equal(ev('e: try [do make error! "boom"] e/message'), '"boom"');
  });
});

describe('functions', () => {
  test('refinements and their arguments', () => {
    assert.equal(ev('f: func [a /scale k] [either scale [a * k] [a]] reduce [f 2 f/scale 2 10]'), '[2 20]');
    assert.equal(evErr('f: func [a] [a] f/nope 1'), 'bad-refine');
  });

  test('argument and return types are checked', () => {
    assert.equal(evErr('f: func [a [integer!]] [a] f "x"'), 'expect-arg');
    assert.equal(evErr('f: func [return: [integer!]] ["x"] f'), 'bad-return');
    assert.equal(ev('f: func [a [integer! string!]] [a] f "x"'), '"x"');
  });

  test('quoted and literal arguments', () => {
    assert.equal(ev("f: func ['w] [w] f hello"), 'hello');
    assert.equal(ev("f: func ['w] [w] f (1 + 1)"), '2');
    assert.equal(ev('f: func [:w] [w] f (1 + 1)'), '(1 + 1)');
  });

  test('missing arguments are an error', () => {
    assert.equal(evErr('negate'), 'no-arg');
    assert.equal(evErr('1 +'), 'no-arg');
  });

  test('has and does', () => {
    assert.equal(ev('x: 5 f: has [x] [x: 1 x] reduce [f x]'), '[1 5]');
  });
});

describe('numbers', () => {
  test('integer division is exact when it can be', () => {
    assert.equal(ev('6 / 3'), '2');
    assert.equal(ev('7 / 2'), '3.5');
    assert.equal(ev('7 // 2'), '1');
  });

  test('integer overflow is an error, not a wrap', () => {
    assert.equal(ev('9223372036854775807 - 1'), '9223372036854775806');
    assert.equal(evErr('9223372036854775807 + 1'), 'overflow');
    assert.equal(evErr('1 / 0'), 'zero-divide');
  });

  test('money is exact', () => {
    assert.equal(ev('$0.10 + $0.20'), '$0.30');
    assert.equal(ev('$10 * 3'), '$30.00');
    assert.equal(ev('$1 / 4'), '$0.25');
    assert.equal(ev('$1 = 1'), 'true');
    assert.equal(evErr('EUR$1 + USD$1'), 'currency');
  });

  test('mixed kinds', () => {
    assert.equal(ev('1 + 0.5'), '1.5');
    assert.equal(ev('10% * 2'), '20%');
    assert.equal(ev('200 * 10%'), '20.0');
    assert.equal(ev('1:30 + 0:45'), '2:15');
    assert.equal(ev('2x3 * 2'), '4x6');
  });

  test('comparison', () => {
    assert.equal(ev('1 = 1.0'), 'true');
    assert.equal(ev('1 == 1.0'), 'false');
    assert.equal(ev('"abc" = "ABC"'), 'true');
    assert.equal(ev('"abc" < "abd"'), 'true');
    assert.equal(ev('30-Oct-2026 < 31-Oct-2026'), 'true');
    assert.equal(evErr('1 < "a"'), 'bad-compare');
  });
});

describe('errors', () => {
  test('errors carry near, where and the source position', () => {
    const src = 'f: func [x] [\n    x / 0\n]\nf 1';
    const code = load(src, { file: 'demo.trb' });
    bindSeries(code.s, rt.user, true);
    const r = run(newTask(rt, code.s, 0));
    assert.equal(r.k, 'error');
    if (r.k !== 'error') return;
    assert.equal(form(errorField(r.e, 'type')), 'math');
    assert.equal(mold(errorField(r.e, 'near')), '[x / 0]');
    assert.equal(form(errorField(r.e, 'where')), '/');
    assert.equal(form(errorField(r.e, 'at')), 'demo.trb:2:5');
  });

  test('an unknown word', () => {
    assert.equal(evErr('no-such-word'), 'no-value');
  });

  test('errors are values', () => {
    assert.equal(ev('error? try [1 / 0]'), 'true');
    assert.equal(ev('e: make error! "x" error? e'), 'true');
  });
});

describe('tasks', () => {
  test('a task pauses on await and resumes with the value', () => {
    const code = load('x: 1 + test-pause x * 2');
    bindSeries(code.s, rt.user, true);
    const t = newTask(rt, code.s, 0);
    const r1 = run(t);
    assert.equal(r1.k, 'await');
    assert.ok(pending !== null);
    resume(t, integer(20));
    const r2 = run(t);
    assert.equal(r2.k, 'done');
    if (r2.k === 'done') assert.equal(mold(r2.v), '42');
  });

  test('a parse action can await in the middle of a parse', () => {
    const code = load('got: none ok: parse "ab" ["a" (got: test-pause) "b"] reduce [ok got]');
    bindSeries(code.s, rt.user, true);
    const t = newTask(rt, code.s, 0);
    assert.equal(run(t).k, 'await');
    resume(t, integer(7));
    const r = run(t);
    assert.equal(r.k, 'done');
    if (r.k === 'done') assert.equal(mold(r.v), '[true 7]');
  });

  test('a rejected await raises a catchable error', () => {
    const code = load('e: try [test-pause] e/message');
    bindSeries(code.s, rt.user, true);
    const t = newTask(rt, code.s, 0);
    assert.equal(run(t).k, 'await');
    resumeError(t, makeError('access', 'timeout', 'took too long'));
    const r = run(t);
    assert.equal(r.k, 'done');
    if (r.k === 'done') assert.equal(mold(r.v), '"took too long"');
  });

  test('the step budget yields and the task continues', () => {
    const code = load('n: 0 loop 1000 [n: n + 1] n');
    bindSeries(code.s, rt.user, true);
    const t = newTask(rt, code.s, 0);
    let yields = 0;
    let r = run(t, 100);
    while (r.k === 'yield') {
      yields++;
      r = run(t, 100);
    }
    assert.ok(yields > 10);
    assert.equal(r.k, 'done');
    if (r.k === 'done') assert.equal(mold(r.v), '1000');
  });

  test('deep recursion does not use the JS stack', () => {
    assert.equal(ev('down: func [n] [either n = 0 [0] [down n - 1]] down 50000'), '0');
  });

  test('type? gives the datatype', () => {
    assert.equal(ev('type? 1'), 'integer!');
    assert.equal(ev('type? :negate'), 'native!');
  });
});

describe('nesting deeper than the JS stack', () => {
  const deep = (n: number) => '['.repeat(n) + ']'.repeat(n);

  test('load of blocks nested too deep is a load error, not a crash', () => {
    assert.throws(() => load(deep(100000)), /nested too deep/);
    assert.equal(evErr(`load ${JSON.stringify(deep(100000))}`), 'load');
    assert.equal(ev(`attempt [load ${JSON.stringify(deep(100000))}]`), 'none');
  });

  test('writers and walkers take values nested deeper than the JS stack', () => {
    const src = 'b: copy [] loop 100000 [b: reduce [b]]';
    const deep = `${'['.repeat(100001)}${']'.repeat(100001)}`; // b holds the first []
    assert.equal(ev(`${src} (length? mold b) = length? mold/all b`), 'true');
    assert.equal(ev(`${src} length? mold b`), String(deep.length));
    assert.equal(ev(`${src} form b`), '""');
    assert.equal(ev(`${src} length? to-json b`), String(deep.length));
    assert.equal(ev(`${src} c: copy/deep b block? first c`), 'true');
    assert.equal(ev(`${src} o: make object! [x: 1] block? bind b o`), 'true');
    assert.equal(ev(`${src} f: func [x] compose/only [(b) x] f 7`), '7');
  });

  test('form shows a block or object met again inside itself as ...', () => {
    assert.equal(ev('b: copy [1 2] append/only b b form b'), '"1 2 ..."');
    assert.equal(ev('o: make object! [a: 1 b: none] o/b: o form o'), '{a: 1\nb: ...}');
    assert.equal(ev('b: [x] form reduce [b b]'), '"x x"');
  });

  test('a stack overflow in a native is a Trebol error that attempt catches', () => {
    assert.equal(evErr('test-recurse'), 'stack-overflow');
    assert.equal(ev('attempt [test-recurse]'), 'none');
  });

  test('another task keeps running after one overflows', () => {
    const bad = load('test-recurse');
    const good = load('1 + 2');
    bindSeries(bad.s, rt.user, true);
    bindSeries(good.s, rt.user, true);
    assert.equal(run(newTask(rt, bad.s, 0)).k, 'error');
    const r = run(newTask(rt, good.s, 0));
    assert.equal(r.k === 'done' ? mold(r.v) : r.k, '3');
  });
});

describe('at-end', () => {
  test('outside a function it waits for the end of the code, which still gives its own value', () => {
    assert.equal(ev("t: copy []  at-end [append t 'end]  append t 'body  7"), '7');
    assert.equal(ev('t'), '[body end]');
  });

  test('a function that fails leaves its kept blocks to the code around it', () => {
    assert.equal(ev(`t: copy []
      f: function [] [at-end [append t 'later]  do make error! "no"]
      e: try [f]
      append t 'next
      t`), '[later next]');
  });
});
