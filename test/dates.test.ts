// day-label and time-ago: a date said for people in the active language (src/host/dates.ts).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, blockOf, K, type Cell, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { setHost } from '../src/host/browser/mount.ts';

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
