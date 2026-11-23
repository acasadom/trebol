// bold: a text with heavier letters (src/ui/dialect/styles.trb, the theme's .tb-bold).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, type Cell, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { setHost } from '../src/host/browser/mount.ts';
native('show', '[root [object!]]', (_t, f) => value(f.args[0]!));
native('ui-watch', '[value [object! series! map!]]', (_t, f) => value(f.args[0]!));

let host: Host;
beforeEach(async () => {
  host = startHost({ onError: () => {}, loader: { base: 'file:///', read: href => readFile(fileURLToPath(href), 'utf8') } });
  await startUi(host);
  setHost(host);
});

async function run(src: string): Promise<Cell> {
  return runSource(host, src).catch((e: ObjectCell) => assert.fail(form(errorField(e, 'message'))));
}


describe('bold', () => {
  test('a text takes it, also in the layout of a style', async () => {
    const got = await run(`
      stylize [kpi: column [layout: [text bold is [it/text]]]]
      root: view [text bold "a"  text "b"  kpi "c"]
      reduce [root/pane/1/bold root/pane/2/bold root/pane/3/pane/1/bold]`);
    assert.equal(mold(got), '[true false true]');
  });
});
