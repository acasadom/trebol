// Reactions see a change made in place: a block or string they read, or a series inside it,
// changed by append, insert or poke, is the same series as before but has a new version.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';

// the browser host draws a view; here a view only gives its root
native('show', '[root [object!]]', (_t, f) => value(f.args[0]!));
native('ui-watch', '[object [object!]]', (_t, f) => value(f.args[0]!));

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

describe('reactions and changes in place', () => {
  test('a block appended to runs what reads it', async () => {
    assert.equal(await ev(`
      o: make object! [xs: [1]]
      v: view [text is [form length? o/xs]]
      ui-react v  a: v/pane/1/text
      append o/xs 2  ui-react v
      reduce [a v/pane/1/text]`), '["1" "2"]');
  });

  test('a series inside the block read, changed in place, runs it too', async () => {
    assert.equal(await ev(`
      o: make object! [rows: [[1] ["a"]]]
      v: view [text is [mold o/rows]]
      ui-react v
      append first o/rows 5  ui-react v  a: v/pane/1/text
      append second o/rows "b"  ui-react v
      reduce [a v/pane/1/text]`), '[{[[1 5] ["a"]]} {[[1 5] ["a" "b"]]}]');
  });

  test('a facet changed in place runs what reads it', async () => {
    assert.equal(await ev(`
      v: view [a: text "x"  b: text is [rejoin [a/text "+"]]]
      ui-react v
      append v/pane/1/text "y"  ui-react v
      poke v/pane/1/text 1 #"z"  ui-react v
      v/pane/2/text`), '"zy+"');
  });

  test('a series nothing changed does not run it again', async () => {
    assert.equal(await ev(`
      n: 0  o: make object! [xs: [1 [2]]]
      v: view [text react [n: n + 1  length? o/xs]]
      ui-react v  ui-react v  ui-react v
      a: n  insert o/xs 0  ui-react v  ui-react v
      reduce [a n]`), '[1 2]');
  });
});
