// stat: a number that stands for something, its label, a line under it and its trend
// (src/ui/dialect/stats.trb, drawn by src/host/browser/stats.ts).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, type Cell, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { setHost } from '../src/host/browser/mount.ts';
import { trendNumbers, trendPath, TREND_H } from '../src/host/browser/stats.ts';

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

  test('the trend: its numbers, a line through them and where its last point is', () => {
    const ns = trendNumbers({ t: 0 } as unknown as Cell);
    assert.deepEqual(ns, []);
    assert.equal(trendPath([5]), null);
    const p = trendPath([2, 6, 4])!;
    // lowest at the bottom, highest at the top, inside the box
    assert.equal(p.line, 'M0 29 L50 3 L100 16');
    assert.match(p.area, /^M0 29 L50 3 L100 16 L100 32 L0 32 Z$/);
    assert.deepEqual(p.last, { x: 1, y: 16 / TREND_H });
    // a flat trend runs across the middle
    assert.equal(trendPath([3, 3])!.line, `M0 ${TREND_H / 2} L100 ${TREND_H / 2}`);
  });

  test('the trend reads numbers, percents and amounts, and leaves out what is none', async () => {
    const b = await run(`[1 2.5 50% $3.00 none "x"]`);
    assert.deepEqual(trendNumbers(b), [1, 2.5, 0.5, 3]);
  });
});
