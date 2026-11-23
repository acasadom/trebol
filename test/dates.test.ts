// day-label and time-ago: a date said for people in the active language; the moment a value names (src/host/dates.ts).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, blockOf, K, type Cell, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { setHost } from '../src/host/browser/mount.ts';
import { momentOf, dayLabel, relativeText } from '../src/host/dates.ts';

native('show', '[root [object!]]', (_t, f) => value(f.args[0]!));
native('ui-watch', '[value [object! series! map!]]', (_t, f) => value(f.args[0]!));
native('repaint', '[]', () => value(blockOf(K.Block, [])));

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

describe('day-label', () => {
  test('says today, yesterday and tomorrow, else the weekday and date, with the year when another', async () => {
    const got = await run(`reduce [day-label now  day-label now/date - 1  day-label now/date + 1  day-label 1-Jan-2020  day-label 1-Jan-2020/23:30]`);
    assert.equal(mold(got), '["Today" "Yesterday" "Tomorrow" "Wednesday, January 1, 2020" "Wednesday, January 1, 2020"]');
  });

  test('is said in the active language', async () => {
    const got = await run(`set-language 'es  reduce [day-label now  day-label now/date - 1  day-label 1-Jan-2020]`);
    assert.equal(mold(got), '["Hoy" "Ayer" "Miércoles, 1 de enero de 2020"]');
  });
});

describe('time-ago', () => {
  test('says how long ago, or until, in the unit that fits; a date with no time in days', async () => {
    const got = await run(`reduce [time-ago now  time-ago now - 0:05  time-ago now - 3:00  time-ago now + 0:10  time-ago now/date - 3  time-ago now - 400  time-ago now/date - 400]`);
    assert.equal(mold(got), '["now" "5 minutes ago" "3 hours ago" "in 10 minutes" "3 days ago" "last year" "400 days ago"]');
  });

  test('is said in the active language', async () => {
    const got = await run(`set-language 'es  reduce [time-ago now - 0:05  time-ago now/date - 1]`);
    assert.equal(mold(got), '["hace 5 minutos" "ayer"]');
  });
});

describe('moments and how they are said, from the host', () => {
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
  });

  test('days are counted right across the year 100, which Date.UTC reads as 1900', () => {
    const early = (y: number, m: number, d: number, h = 0): number => {
      const t = new Date(2000, 0, 1, h);
      t.setFullYear(y, m - 1, d);
      return t.getTime();
    };
    const now = early(99, 12, 31, 10);
    assert.equal(relativeText({ ms: early(100, 1, 1), allDay: true }, now, 'en'), 'tomorrow');
    assert.equal(relativeText({ ms: early(99, 12, 30), allDay: true }, now, 'en'), 'yesterday');
  });
});
