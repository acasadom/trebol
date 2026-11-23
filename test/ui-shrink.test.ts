// shrink: a title, heading or text on one line, as large as its width lets it be
// (src/ui/dialect/styles.trb, drawn by src/host/browser/shrink.ts and the theme's container units).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, type Cell, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { setHost } from '../src/host/browser/mount.ts';
import { shrinkChars, SHRINK_FEWEST } from '../src/host/browser/shrink.ts';
import { LAYOUT } from '../src/host/theme/layout.ts';

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

describe('shrink', () => {
  test('a title, heading or text takes it; other faces and plain texts do not have it', async () => {
    const got = await run(`
      root: view [title shrink "1"  heading shrink "2"  text shrink count "3"  text "4"]
      collect [foreach f root/pane [keep f/shrink]]`);
    assert.equal(mold(got), '[true true true false]');
    const count = await run(`root: view [text shrink count "3"]  root/pane/1/count`);
    assert.equal(mold(count), 'true');
  });

  test('a face of a style made of others may say it in its layout', async () => {
    const got = await run(`
      stylize [kpi: column [takes: [value: [number! money!] "the number"] layout: [heading shrink is [it/value]]]]
      root: view [kpi $98765.43]
      root/pane/1/pane/1/shrink`);
    assert.equal(mold(got), 'true');
  });

  test('a line is sized for its characters, never fewer than a few', () => {
    assert.equal(shrinkChars(''), SHRINK_FEWEST);
    assert.equal(shrinkChars('7'), SHRINK_FEWEST);
    assert.equal(shrinkChars('$98,765,432.10'), 14);
    assert.equal(shrinkChars('€1 240'), SHRINK_FEWEST + 2);
  });

  test('the theme sizes the line by the width of the face, never above the face size', () => {
    assert.match(LAYOUT, /\.tb-shrink \{ container-type: inline-size;/);
    assert.match(LAYOUT, /clamp\(0\.6em, calc\(100cqi \/ \(0\.62 \* var\(--tb-shrink-chars, 4\)\)\), 1em\)/);
  });
});
