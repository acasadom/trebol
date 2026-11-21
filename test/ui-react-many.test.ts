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

const N = Number(process.env.REACT_N ?? 320);
const LIMIT = Number(process.env.REACT_LIMIT ?? 400);

describe('many reactions', () => {
  test(`a chain of ${N}, each reading the one before`, async () => {
    // a1: text "0"  a2: text is [form 1 + to integer! a1/text]  ...
    let spec = 'a1: text "0"';
    for (let i = 2; i <= N; i++) spec += `  a${i}: text is [form 1 + to integer! a${i - 1}/text]`;
    await ev(`v: view [${spec}]  ui-react v`);
    const r = await timed(`v/pane/1/text: "1"  ui-react v  select last v/pane 'text`);
    console.log(`chain change: ${r.ms.toFixed(0)} ms`);
    assert.equal(r.out, `"${N}"`);
    assert.ok(r.ms < LIMIT, `${r.ms} ms`);
  });

  test(`${N} that read their own source, one changed`, async () => {
    let spec = '';
    for (let i = 1; i <= N; i++) spec += `  s${i}: text "x"  text is [join s${i}/text "!"]`;
    await ev(`v: view [${spec}]`);
    const shown = await timed(`ui-react v  v/pane/2/text`);
    console.log(`first show of many: ${shown.ms.toFixed(0)} ms`);
    assert.equal(shown.out, '"x!"');
    const r = await timed(`v/pane/1/text: "y"  ui-react v  v/pane/2/text`);
    console.log(`one of many: ${r.ms.toFixed(0)} ms`);
    assert.equal(r.out, '"y!"');
    const idle = await timed(`ui-react v  v/pane/2/text`);
    console.log(`idle round: ${idle.ms.toFixed(0)} ms`);
    assert.ok(shown.ms < LIMIT * 2 && r.ms < LIMIT && idle.ms < LIMIT, `${shown.ms} ${r.ms} ${idle.ms} ms`);
  });

  test(`the first show of a chain of ${N}`, async () => {
    let spec = 'a1: text "0"';
    for (let i = 2; i <= N; i++) spec += `  a${i}: text is [form 1 + to integer! a${i - 1}/text]`;
    await ev(`v: view [${spec}]`);
    const r = await timed(`ui-react v  select last v/pane 'text`);
    console.log(`first show: ${r.ms.toFixed(0)} ms`);
    assert.equal(r.out, `"${N - 1}"`);
    assert.ok(r.ms < LIMIT * 2, `${r.ms} ms`);
  });

  test('values is gathered when the block names it, at any depth', async () => {
    assert.equal(await ev(`
      v: view [field qty  t: text is [either true [form (values/qty)] ["no"]]  u: text is [form none? :values]]
      ui-input v/pane/1 "2"  ui-react v  reduce [v/pane/2/text v/pane/3/text]`), '["2" "false"]');
  });
});
