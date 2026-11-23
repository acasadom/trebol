// rate: a face that ticks while shown, firing on-time (src/host/browser/rates.ts), as in R2 and Red.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, integer, time, NONE, type Cell, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { setHost, type Mounted } from '../src/host/browser/mount.ts';
import { rateMs, syncRate, sweepRates, tickingFaces } from '../src/host/browser/rates.ts';

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

const pause = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

describe('rate', () => {
  test('is times a second or the time between ticks, on any face', async () => {
    const got = await run(`root: view [text "a" rate 2  panel rate 0:00:30 []  text "c"]  collect [foreach f root/pane [keep f/rate]]`);
    assert.equal(mold(got), '[2 0:00:30 none]');
  });

  test('of none or less is a problem of the layout, and on-time is an event', async () => {
    const got = await run(`collect [foreach [p m] ui-check [view [text rate 0  text rate -0:00:01  text rate 3 on-time [] on-tmie []]] [keep m]]`);
    assert.equal(mold(got), '["a rate is more than none: rate 2 or rate 0:00:30" "a rate is more than none: rate 2 or rate 0:00:30" "on-tmie is not an event; did you mean on-time?"]');
  });

  test('gives the time between ticks in milliseconds', () => {
    assert.equal(rateMs(integer(4)), 250);
    assert.equal(rateMs(time(30e9)), 30000);
    assert.equal(rateMs(integer(0)), null);
    assert.equal(rateMs(NONE), null);
  });

  test('fires on-time while on the page, again when changed, and stops when none or taken off', async () => {
    const face = await run(`n: 0  root: view [text "t" rate 0:00:00.02 on-time [n: n + 1]]  first root/pane`) as ObjectCell;
    const el = { isConnected: true } as unknown as HTMLElement;
    const m = { face, el } as unknown as Mounted;
    syncRate(m);
    assert.equal(tickingFaces(), 1);
    await pause(150);
    const ticks = Number(mold(await run('n')));
    assert.ok(ticks >= 2, `ticked ${ticks} times`);
    await run('root/pane/1/rate: none');
    syncRate(m);
    assert.equal(tickingFaces(), 0);
    await run('root/pane/1/rate: 50  n: 0');
    syncRate(m);
    (el as unknown as { isConnected: boolean }).isConnected = false;
    sweepRates();
    assert.equal(tickingFaces(), 0);
    await pause(60);
    assert.equal(mold(await run('n')), '0');
  });
});
