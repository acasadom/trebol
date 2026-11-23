// timeline: what happened, and when, under the day it happened
// (src/ui/dialect/timelines.trb, a composite made of columns, headings and texts).
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
});
