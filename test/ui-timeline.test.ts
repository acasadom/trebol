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

  // what the faces of a timeline say: per day its heading and, per row, [role what time note]; a time is
  // the moment its text holds as the host shows it (src/host/browser/moments.ts): ago or clock
  const said = `
    shown: func [t] [
        case [
            t/ago [time-ago t/text]
            t/clock [to time! reduce [t/text/hour t/text/minute]]
            true [t/text]
        ]
    ]
    item: func [g] [
        line: g/pane/1/pane
        reduce [g/role  line/1/text  either line/2 [shown line/2] [none]  either g/pane/2 [g/pane/2/text] [none]]
    ]
    days-of: func [f] [
        collect [foreach d f/pane/1/pane [
            either d/rail [keep/only collect [foreach g d/pane [keep/only item g]]] [
                keep d/pane/1/text
                keep/only collect [foreach g d/pane/2/pane [keep/only item g]]
            ]
        ]]
    ]`;

  test('its rows go under their days, newest first, with their time on the clock and the rest beneath', async () => {
    const got = await run(`${said}
      log: [
        #(at: 1-Mar-2025/9:30:15 text: "b" who: "Ada" tone: success)
        #(at: 1-Mar-2025/11:05 text: "c" who: "Grace" where: "Shop" tone: "Danger")
        #(at: none text: "none")
        #(at: 1-Mar-2025 text: "whole day" tone: muted)
        #(at: 28-Feb-2025/17:40 text: "a" tone: nothing)
        #(at: "not a date" text: "text")
      ]
      root: view [timeline [at text who where] role-by tone is [log]]
      ui-react root
      f: first root/pane
      reduce [f/style days-of f  f/pane/2/hidden  day-label 1-Mar-2025]`);
    assert.equal(mold(got), '[timeline ["Saturday, March 1, 2025" [[danger "c" 11:05 "Grace · Shop"] [success "b" 9:30 "Ada"] [muted "whole day" none none]] "Friday, February 28, 2025" [[none "a" 17:40 none]] [[none "none" none none] [none "text" none none]]] true "Saturday, March 1, 2025"]');
  });

  test('oldest puts a whole day before its times; rows at the same moment keep their order', async () => {
    const got = await run(`${said}
      log: [
        #(at: 1-Mar-2025/9:30 text: "b")
        #(at: 1-Mar-2025 text: "day")
        #(at: 1-Mar-2025/9:30 text: "b2")
        #(at: "2025-02-28T08:00:00Z" text: "iso")
      ]
      root: view [timeline [at text] oldest is [log]]
      ui-react root
      days-of first root/pane`);
    assert.equal(mold(got), '["Friday, February 28, 2025" [[none "iso" 8:00 none]] "Saturday, March 1, 2025" [[none "day" none none] [none "b" 9:30 none] [none "b2" 9:30 none]]]');
  });

  test('with relative, a time under a day says how long ago it was, and again as time goes by', async () => {
    const got = await run(`${said}
      log: reduce [make map! reduce ['at now - 0:05 'text "fitted"]  make map! reduce ['at now - 48:00 'text "old"]]
      root: view [timeline [at text] relative is [log]]
      ui-react root
      f: first root/pane
      first-days: days-of f
      log/1/at: now - 2:00
      ui-event f/pane/1 'on-time []
      ui-react root
      now-days: days-of f
      reduce [first-days/2/1/3  now-days/2/1/3  time? now-days/4/1/3]`);
    assert.equal(mold(got), '["5 minutes ago" "2 hours ago" true]');
  });

  test('with no rows it says so: its own text, or Trebol\'s', async () => {
    const got = await run(`
      root: view [timeline [at text] "Nothing yet" is [[]]  timeline [at text]]
      ui-react root
      a: root/pane/1  b: root/pane/2
      reduce [a/pane/1/pane  a/pane/2/hidden  a/pane/2/pane/1/text  b/pane/2/hidden  b/pane/2/pane/1/text/en]`);
    assert.equal(mold(got), '[[] false "Nothing yet" false "Nothing to show yet"]');
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
