// Asynchronous checks (check-async): only the latest one gives its answer, the first problem
// of several checks is the one said, and pending ends even when a check fails.
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

describe('check-async', () => {
  test('a slow answer about an old value does not land on the new one', async () => {
    const r = await ev(`
      v: view [form [field u "U" check-async [
        wait either value = "old" [0.05] [0.01]
        either value = "old" ["old is bad"] [true]
      ]]]
      u: v/pane/1/pane/1
      ui-input u "old"  spawn [ui-blur u]
      wait 0.001
      ui-input u "new"  ui-blur u  mid: reduce [u/error u/pending]
      wait 0.1
      reduce [mid u/value u/error u/async-error u/pending]`);
    assert.equal(r, '[[none false] "new" none none false]');
  });

  test('an older check that ends first leaves the face pending while the newer runs', async () => {
    const r = await ev(`
      v: view [form [field u "U" check-async [wait either value = "a" [0.01] [0.05] true]]]
      u: v/pane/1/pane/1
      ui-input u "a"  spawn [ui-blur u]
      wait 0.001
      ui-input u "b"  spawn [ui-blur u]
      wait 0.02  mid: u/pending
      wait 0.06
      reduce [mid u/pending]`);
    assert.equal(r, '[true false]');
  });

  test('of several checks the first that finds a problem is said', async () => {
    const r = await ev(`
      v: view [form [field u "U" check-async [wait 0.01 "first"] check-async [wait 0.01 true]]]
      u: v/pane/1/pane/1
      ui-input u "x"  ui-blur u
      u/error`);
    assert.equal(r, '"first"');
  });

  test('a check that fails leaves the face no longer pending, and the error goes on', async () => {
    const r = await ev(`
      v: view [form [field u "U" check-async [wait 0.01 1 / 0]]]
      u: v/pane/1/pane/1
      ui-input u "x"
      e: try [ui-blur u]
      reduce [error? e u/pending]`);
    assert.equal(r, '[true false]');
  });

  test('an empty field has no answer of an old check', async () => {
    const r = await ev(`
      v: view [form [field u "U" check-async [wait 0.01 "bad"]]]
      u: v/pane/1/pane/1
      ui-input u "x"  ui-blur u  a: u/error
      ui-input u ""  ui-blur u
      reduce [a u/error]`);
    assert.equal(r, '["bad" none]');
  });
});
