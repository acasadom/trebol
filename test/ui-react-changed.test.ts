// At the end of a round only the reactions that read something that changed are checked
// (ui-changed), and those not given the round before: never one whose change is missed.
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

// a view of n pairs: a text, and one that reads it
const pairs = (n: number): string => {
  let spec = '';
  for (let i = 1; i <= n; i++) spec += `  s${i}: text "x"  text is [join s${i}/text "!"]`;
  return spec;
};

describe('only what changed is checked', () => {
  test('a change gives only the reactions that read it', async () => {
    assert.equal(await ev(`
      v: view [${pairs(50)}]  ui-react v
      rs: second ui-reactions v/pane
      v/pane/7/text: "y"
      reduce [ui-changed rs  ui-changed rs]`), '[[4] []]');
  });

  test('a reaction met for the first time, or back after a round without it, is given', async () => {
    assert.equal(await ev(`
      v: view [${pairs(3)}]  ui-react v
      rs: second ui-reactions v/pane
      ui-changed rs
      a: ui-changed copy/part rs 2
      b: ui-changed rs
      reduce [a b]`), '[[] [3]]');
  });

  test('a change made while its face was not given runs it when it is again', async () => {
    assert.equal(await ev(`
      o: make object! [x: 1]
      v: view [text "a"  text is [form o/x]]  ui-react v
      ui-react reduce [v/pane/1]
      o/x: 2
      ui-react reduce [v/pane/1]
      ui-react v
      v/pane/2/text`), '"2"');
  });

  test('a change in place in a series inside what it reads runs it', async () => {
    assert.equal(await ev(`
      o: make object! [items: [[1] [2]]]
      v: view [text is [form length? second o/items]]  ui-react v
      append second o/items 9
      ui-react v
      v/pane/1/text`), '"2"');
  });

  test('a series put inside what it reads, then changed in place, runs it', async () => {
    assert.equal(await ev(`
      o: make object! [items: [[1]]]
      v: view [text is [form length? last o/items]]  ui-react v
      append/only o/items b: copy [1 2]  ui-react v
      append b 3  ui-react v
      v/pane/1/text`), '"3"');
  });

  test('an object put down a path, then changed, runs it', async () => {
    assert.equal(await ev(`
      o: make object! [inner: make object! [x: 1]]
      v: view [text is [form o/inner/x]]  ui-react v
      old: o/inner
      o/inner: make object! [x: 2]  ui-react v
      a: v/pane/1/text
      o/inner/x: 3  ui-react v
      old/x: 9  ui-react v
      reduce [a v/pane/1/text]`), '["2" "3"]');
  });
});
