// Many reactions on a page: a round where one change runs a long chain, or a few among
// many, takes time in proportion to what runs, not to the square of the reactions there.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';

// the browser host draws a view; here a view only gives its root
native('show', '[root [object!]]', (_t, f) => value(f.args[0]!));
native('ui-watch', '[value [object! series! map!]]', (_t, f) => value(f.args[0]!));

let host: Host;
beforeEach(async () => {
  host = startHost({ onError: () => {}, loader: { base: 'file:///', read: href => readFile(fileURLToPath(href), 'utf8') } });
  await startUi(host);
});

async function ev(src: string): Promise<string> {
  try {
    return mold(await runSource(host, src));
  } catch (e) {
    return assert.fail(`${src}\n  raised: ${form(errorField(e as ObjectCell, 'message'))}`);
  }
}

async function timed(src: string): Promise<{ out: string; ms: number }> {
  const t0 = performance.now();
  const out = await ev(src);
  return { out, ms: performance.now() - t0 };
}

// Time is not compared with a fixed limit, which a slow machine misses: each case runs with N reactions and
// with 4 times as many, on a fresh host. Time in proportion to what runs grows about 4 times; the square of
// the reactions there, 16 times. A floor keeps rounds of a few milliseconds from being noise.
const N = Number(process.env.REACT_N ?? 640);
const MOST = 6;
const FLOOR = 20;

async function fresh(): Promise<void> {
  host = startHost({ onError: () => {}, loader: { base: 'file:///', read: href => readFile(fileURLToPath(href), 'utf8') } });
  await startUi(host);
}

/** The times a case gives with n and with 4n reactions, which must grow in proportion to n. */
async function grows(name: string, run: (n: number) => Promise<number[]>): Promise<void> {
  await fresh();
  const small = await run(N);
  await fresh();
  const big = await run(4 * N);
  small.forEach((ms, i) => {
    console.log(`${name} [${i}]: ${ms.toFixed(0)} ms with ${N}, ${big[i]!.toFixed(0)} ms with ${4 * N}`);
    assert.ok(big[i]! < MOST * Math.max(ms, FLOOR), `${name} [${i}]: ${ms} ms with ${N}, ${big[i]} ms with ${4 * N}`);
  });
}

const chain = (n: number): string => {
  // a1: text "0"  a2: text is [form 1 + to integer! a1/text]  ...
  let spec = 'a1: text "0"';
  for (let i = 2; i <= n; i++) spec += `  a${i}: text is [form 1 + to integer! a${i - 1}/text]`;
  return spec;
};

describe('many reactions', () => {
  test('a chain, each reading the one before: a change at its head', async () => {
    await grows('chain change', async n => {
      await ev(`v: view [${chain(n)}]  ui-react v`);
      const r = await timed(`v/pane/1/text: "1"  ui-react v  select last v/pane 'text`);
      assert.equal(r.out, `"${n}"`);
      return [r.ms];
    });
  });

  test('many that read their own source, one changed', async () => {
    await grows('own source', async n => {
      let spec = '';
      for (let i = 1; i <= n; i++) spec += `  s${i}: text "x"  text is [join s${i}/text "!"]`;
      await ev(`v: view [${spec}]`);
      const shown = await timed(`ui-react v  v/pane/2/text`);
      assert.equal(shown.out, '"x!"');
      const r = await timed(`v/pane/1/text: "y"  ui-react v  v/pane/2/text`);
      assert.equal(r.out, '"y!"');
      const idle = await timed(`ui-react v  v/pane/2/text`);
      return [shown.ms, r.ms, idle.ms];
    });
  });

  test('the first show of a chain', async () => {
    await grows('first show', async n => {
      await ev(`v: view [${chain(n)}]`);
      const r = await timed(`ui-react v  select last v/pane 'text`);
      assert.equal(r.out, `"${n - 1}"`);
      return [r.ms];
    });
  });

  test('values is gathered when the block names it, at any depth', async () => {
    assert.equal(await ev(`
      v: view [field qty  t: text is [either true [form (values/qty)] ["no"]]  u: text is [form none? :values]]
      ui-input v/pane/1 "2"  ui-react v  reduce [v/pane/2/text v/pane/3/text]`), '["2" "false"]');
  });
});
