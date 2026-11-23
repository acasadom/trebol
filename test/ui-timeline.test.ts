// timeline: what happened, and when, under the day it happened
// (src/ui/dialect/timelines.trb, drawn by src/host/browser/timelines.ts from src/host/dates.ts).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, intern, type Cell, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { setHost } from '../src/host/browser/mount.ts';
import { momentOf, dayOf, timelineDays, dayLabel, relativeText, clockText, timeText } from '../src/host/dates.ts';
import { rowField } from '../src/host/rows.ts';

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

/** Milliseconds of a moment on the clock where the tests run. */
const at = (y: number, m: number, d: number, h = 0, min = 0): number => new Date(y, m - 1, d, h, min).getTime();

describe('timeline', () => {
  test('takes its columns, an order, relative and role-by', async () => {
    const got = await run(`
      root: view [timeline log [at text "What" who] oldest relative role-by tone]
      f: first root/pane
      reduce [f/style f/columns f/order f/relative f/role-by]`);
    assert.equal(mold(got), '[timeline [at "at" text "What" who "who"] oldest true tone]');
  });

  test('starts newest first, and is gives it its rows', async () => {
    const got = await run(`
      events: [#(at: 23-Nov-2026/9:30 text: "Bike in")]
      root: view [timeline log [at text] is [events]]
      f: first root/pane
      ui-react root
      reduce [f/order f/relative length? f/data]`);
    assert.equal(mold(got), '[newest false 1]');
  });

  test('a timeline without the field of its time and of its text is a problem of the layout', async () => {
    const got = await run(`collect [foreach [p m] ui-check [view [timeline a [at]  timeline b  timeline c [at text]]] [keep m]]`);
    assert.equal(mold(got), '["a timeline takes the field of its time and of its text: timeline log [at text]" "a timeline takes the field of its time and of its text: timeline log [at text]"]');
  });

  test('a moment from a date, with a zone or without, from an ISO text, and nothing from the rest', async () => {
    const [zoned, local, day, iso, isoDay, other, word] = (await run(`reduce [
      23-Nov-2026/9:30+1:00  23-Nov-2026/9:30  23-Nov-2026  "2026-11-23T08:30:00Z"  "2026-11-23"  "yesterday"  'x
    ]`) as unknown as { s: { data: Cell[] } }).s.data;
    assert.deepEqual(momentOf(zoned!), { ms: Date.UTC(2026, 10, 23, 8, 30), allDay: false });
    assert.deepEqual(momentOf(local!), { ms: at(2026, 11, 23, 9, 30), allDay: false });
    assert.deepEqual(momentOf(day!), { ms: at(2026, 11, 23), allDay: true });
    assert.deepEqual(momentOf(iso!), { ms: Date.UTC(2026, 10, 23, 8, 30), allDay: false });
    assert.deepEqual(momentOf(isoDay!), { ms: at(2026, 11, 23), allDay: true });
    assert.equal(momentOf(other!), null);
    assert.equal(momentOf(word!), null);
  });

  test('rows go under their days, newest first or oldest first; rows with no moment go last', async () => {
    const rows = (await run(`[
      #(at: 22-Nov-2026/18:00 text: "b")
      #(at: 23-Nov-2026/9:30 text: "d")
      #(at: none text: "none")
      #(at: 22-Nov-2026/8:00 text: "a")
      #(at: 23-Nov-2026 text: "c day")
      #(at: 23-Nov-2026/9:30 text: "e same moment")
    ]`) as unknown as { s: { data: Cell[] } }).s.data;
    const texts = (days: ReturnType<typeof timelineDays>): string[][] =>
      days.map(d => d.rows.map(r => form(rowField(r.row, intern('text')))));
    const newest = timelineDays(rows, intern('at'), true);
    assert.deepEqual(newest.map(d => d.day), [20261123, 20261122, 0]);
    assert.deepEqual(texts(newest), [['d', 'e same moment', 'c day'], ['b', 'a'], ['none']]);
    const oldest = timelineDays(rows, intern('at'), false);
    assert.deepEqual(texts(oldest), [['a', 'b'], ['c day', 'd', 'e same moment'], ['none']]);
    assert.equal(dayOf(at(2026, 1, 5, 23, 59)), 20260105);
  });

  test('a day is said from now: Today, Yesterday, a weekday and date, and the year of another year', () => {
    const now = at(2026, 11, 23, 10);
    assert.equal(dayLabel(at(2026, 11, 23, 0, 5), now, 'en'), 'Today');
    assert.equal(dayLabel(at(2026, 11, 22, 23), now, 'en'), 'Yesterday');
    assert.equal(dayLabel(at(2026, 11, 24), now, 'en'), 'Tomorrow');
    assert.equal(dayLabel(at(2026, 11, 22), now, 'es'), 'Ayer');
    assert.equal(dayLabel(at(2026, 11, 20), now, 'en-GB'), 'Friday 20 November');
    // ICU versions put a comma there or not
    assert.match(dayLabel(at(2025, 11, 20), now, 'en-GB'), /^Thursday,? 20 November 2025$/);
    assert.equal(dayLabel(at(2026, 11, 20), now, 'es'), 'Viernes, 20 de noviembre');
  });

  test('how long ago, in the language of the page', () => {
    const now = at(2026, 11, 23, 10);
    const ago = (ms: number, lang = 'en', allDay = false): string => relativeText({ ms, allDay }, now, lang);
    assert.equal(ago(now - 20e3), 'now');
    assert.equal(ago(now - 5 * 60e3), '5 minutes ago');
    assert.equal(ago(now - 59.8 * 60e3), '1 hour ago');
    assert.equal(ago(now - 3 * 3600e3 - 60e3), '3 hours ago');
    assert.equal(ago(at(2026, 11, 22, 9)), 'yesterday');
    assert.equal(ago(at(2026, 11, 20, 12)), '3 days ago');
    assert.equal(ago(at(2026, 11, 2)), '3 weeks ago');
    assert.equal(ago(now + 10 * 60e3), 'in 10 minutes');
    assert.equal(ago(now - 5 * 60e3, 'es'), 'hace 5 minutos');
    assert.equal(ago(at(2026, 11, 23), 'en', true), 'today');
    assert.match(clockText(at(2026, 11, 23, 9, 5), 'en-GB'), /^0?9:05$/);
    // a row shows how long ago under a day, the clock after it, and nothing for a whole day
    assert.equal(timeText({ ms: now - 5 * 60e3, allDay: false }, now, 'en', true), '5 minutes ago');
    assert.match(timeText({ ms: at(2026, 11, 22, 9, 5), allDay: false }, now, 'en-GB', true)!, /^0?9:05$/);
    assert.match(timeText({ ms: now - 5 * 60e3, allDay: false }, now, 'en-GB', false)!, /^0?9:55$/);
    assert.equal(timeText({ ms: at(2026, 11, 23), allDay: true }, now, 'en', true), null);
    assert.match(clockText(at(2026, 11, 23, 21, 5), 'en-US'), /^9:05\sPM$/);
  });
});
