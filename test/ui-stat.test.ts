// stat: a number that stands for something, its label, a line under it and its trend
// (src/ui/dialect/stats.trb: a style made of other styles).
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

describe('stat', () => {
  test('takes a label, a number, a line under it, a trend, a role and count', async () => {
    const got = await run(`
      root: view [stat "Takings" $1240.00 "12 repairs today" trend [980 1100 $1240.00] success count]
      f: first root/pane
      reduce [f/style f/text f/value f/hint f/trend f/role f/count]`);
    assert.equal(mold(got), '[stat "Takings" $1240.00 "12 repairs today" [980 1100 $1240.00] success true]');
  });

  test('is gives it its number', async () => {
    const got = await run(`
      today: make object! [jobs: 7]
      root: view [stat "Jobs" is [today/jobs]]
      f: first root/pane
      ui-react root
      f/value`);
    assert.equal(mold(got), '7');
  });

  test('a trend of fewer than two numbers, or of other values, is a problem of the layout', async () => {
    const got = await run(`collect [foreach [p m] ui-check [view [stat "A" trend [1]  stat "B" trend [1 "x"]  stat "C" 5 trend [1 2.5 50%]]] [keep m]]`);
    assert.equal(mold(got), '["a trend takes two numbers or more: trend [3 5 4 8]" "a trend takes two numbers or more: trend [3 5 4 8]"]');
  });

  test('is made of a label, its number, the line under it and a canvas, which follow it', async () => {
    const got = await run(`
      root: view [stat "Takings" $1240.00 "12 repairs today" trend [980 1100] success count  stat "Jobs" 7]
      ui-react root
      a: first root/pane  b: second root/pane
      reduce [
          a/composed collect [foreach g a/pane [keep g/style]]
          a/pane/1/text a/pane/1/bold a/pane/2/text a/pane/2/role a/pane/2/count a/pane/2/shrink a/pane/3/text
          a/pane/4/stretch a/pane/4/hidden b/pane/3/hidden b/pane/4/hidden b/pane/2/count b/pane/2/role
      ]`);
    assert.equal(mold(got), '[panel [text title text canvas] "Takings" true $1240.00 success true true "12 repairs today" true false true true false none]');
  });

  test('its trend is drawn in the colour of its role, from the foot of a canvas 100x40', async () => {
    const got = await run(`
      root: view [stat "a" trend [2 6 4]  stat "b" trend [3 $3.00] muted  stat "c" trend [1 50%] danger  stat "d" success  stat "e"]
      ui-react root
      collect [foreach f root/pane [keep/only f/pane/4/draw]]`);
    assert.equal(mold(got).replace(/\s+/g, ' ').replace(/\[ /g, '[').replace(/ \]/g, ']'), '[' + [
      '[pen off fill-pen primary 14% polygon 0x37 50x11 100x24 100x40 0x40 pen primary line-width 2 line-join round line-cap round fill-pen off line 0x37 50x11 100x24 pen raised fill-pen primary circle 100x24 4.5]',
      '[pen off fill-pen border-strong 14% polygon 0x24 100x24 100x40 0x40 pen border-strong line-width 2 line-join round line-cap round fill-pen off line 0x24 100x24 pen raised fill-pen border-strong circle 100x24 4.5]',
      '[pen off fill-pen danger 14% polygon 0x11 100x37 100x40 0x40 pen danger line-width 2 line-join round line-cap round fill-pen off line 0x11 100x37 pen raised fill-pen danger circle 100x37 4.5]',
      'none', 'none',
    ].join(' ') + ']');
  });
});
