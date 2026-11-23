// A text that shows a date or a time says it in a <time> a machine reads (src/host/browser/moments.ts, dates.ts).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, date, time, integer, type Cell, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { setHost } from '../src/host/browser/mount.ts';
import { isoOf, fullDateText } from '../src/host/dates.ts';
import { momentShown } from '../src/host/browser/moments.ts';

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

const H = 3600e9, M = 60e9;

describe('moments a text shows', () => {
  test('a date or a time of day as HTML datetime writes it', () => {
    assert.equal(isoOf(date({ y: 2026, m: 11, d: 23, time: null, zone: null })), '2026-11-23');
    assert.equal(isoOf(date({ y: 2026, m: 11, d: 23, time: 9 * H + 30 * M, zone: null })), '2026-11-23T09:30');
    assert.equal(isoOf(date({ y: 2026, m: 11, d: 23, time: 9 * H + 30 * M + 15e9, zone: 120 })), '2026-11-23T09:30:15+02:00');
    assert.equal(isoOf(date({ y: 2026, m: 1, d: 5, time: 0, zone: -330 })), '2026-01-05T00:00-05:30');
    // the last instant of a day is cut to the millisecond, never rounded up to 24:00
    assert.equal(isoOf(date({ y: 2026, m: 11, d: 23, time: 24 * H - 1, zone: null })), '2026-11-23T23:59:59.999');
    assert.equal(isoOf(time(24 * H - 1)), '23:59:59.999');
    assert.equal(isoOf(time(9 * H + 5 * M + 250e6)), '09:05:00.250');
    assert.equal(isoOf(time(30 * H)), null);
    assert.equal(isoOf(integer(3)), null);
  });

  test('a date in full in a language, as its clock reads it', () => {
    assert.equal(fullDateText(date({ y: 2026, m: 11, d: 23, time: null, zone: null }), 'en'), 'Monday, November 23, 2026');
    assert.match(fullDateText(date({ y: 2026, m: 11, d: 23, time: 9 * H + 30 * M, zone: 120 }), 'en')!, /^Monday, November 23, 2026 at 9:30\sAM$/);
    assert.match(fullDateText(date({ y: 2026, m: 11, d: 23, time: 9 * H, zone: null }), 'es')!, /^lunes, 23 de noviembre de 2026, 9:00$/);
    assert.equal(fullDateText(time(9 * H), 'en'), null);
  });

  test('clock is a flag of a text: a date with a time shows only its time', async () => {
    await run(`root: view [text clock with [text: 23-Nov-2026/9:30]  text with [text: 23-Nov-2026/9:30]  text clock with [text: 23-Nov-2026]]`);
    assert.equal(mold(await run(`reduce [root/pane/1/clock root/pane/2/clock]`)), '[true false]');
    const f = async (i: number): Promise<string> => mold(momentShown(await run(`root/pane/${i}`) as ObjectCell, await run(`root/pane/${i}/text`)));
    assert.deepEqual([await f(1), await f(2), await f(3)], ['9:30', '23-Nov-2026/9:30', '23-Nov-2026']);
  });

  test('ago is a flag of a text: a date says how long ago it was', async () => {
    await run(`root: view [text ago with [text: 23-Nov-2026/9:30+0:00]  text ago with [text: "soon"]]`);
    const at = Date.UTC(2026, 10, 23, 9, 35);
    const f = async (i: number): Promise<string> => form(momentShown(await run(`root/pane/${i}`) as ObjectCell, await run(`root/pane/${i}/text`), at));
    assert.deepEqual([await f(1), await f(2)], ['5 minutes ago', 'soon']);
  });
});
