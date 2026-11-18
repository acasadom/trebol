// What a style takes is declared in its definition (takes: [...]), so a program or a package
// extends the dialect in Trebol alone: every style here is defined by the test, as a package
// would define it, and layout, check and what a designer reads all know it.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { form, mold, errorField, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { check } from '../tools/check.ts';

let host: Host;
beforeEach(async () => {
  host = startHost({ onError: () => {}, loader: { base: 'file:///', read: href => readFile(fileURLToPath(href), 'utf8') } });
  await startUi(host);
});

async function ev(src: string): Promise<string> {
  try {
    return mold(await runSource(host, src));
  } catch (e) {
    return `error: ${form(errorField(e as ObjectCell, 'message'))}`;
  }
}

const RATING = `
  rating-done: func [f] [f/hint: "read"]
  stylize [rating: field [stars: 5  half: false  tint: none  takes: [
    stars: 'stars [integer!] "how many stars it shows"
    half: 'half "it takes half stars"
    tint: [tuple!] :tint-of
    on: [on-rate]
    done: :rating-done
  ]]]
  tint-of: func [t] [all [t <> 0.0.0  t]]
`;

test('a style of a program takes its own words, values and events, besides those of its base', async () => {
  const r = await ev(`${RATING}
    f: first layout/only [rating score "Score" stars 10 half 255.0.0 required on-rate [x] on-change [y]]
    reduce [f/style f/name f/text f/stars f/half f/tint f/rules f/hint extract f/events 2]`);
  assert.equal(r, '[field score "Score" 10 true 255.0.0 [[required]] "read" [on-rate on-change]]');
});

test('what a style does not take is a problem that names the style, with the word it may mean', async () => {
  const r = await ev(`${RATING}
    collect [foreach b [
      [rating s "S" poster %a.png]
      [rating s "S" starz 3]
      [rating s "S" stars "many"]
      [rating s "S" 0.0.0]
      [rating s "S" on-sort [x]]
      [field s "S" stars 3]
    ] [e: try [layout b]  keep find/tail e/message "layout: "]]`);
  assert.equal(r, `[${[
    'poster is not a word of rating',
    'starz is not a word of rating; did you mean stars?',
    'stars takes an integer',
    'rating does not take 0.0.0',
    'on-sort is not an event of rating',
    'stars is not a word of field',
  ].map(s => JSON.stringify(s)).join(' ')}]`);
});

test('a style made from a style of a program takes what that one takes, and more', async () => {
  const r = await ev(`${RATING}
    stylize [big-rating: rating [glow: false  takes: [glow: 'glow]]]
    f: first layout/only [big-rating s "S" stars 3 glow half]
    reduce [f/stars f/glow f/half]`);
  assert.equal(r, '[3 true true]');
});

test('a block entry takes the blocks after a face in turn, and the one left is the action', async () => {
  const r = await ev(`
    stylize [picker: face [style: 'choice  items: none  takes: [items: block :items-of]]]
    items-of: func [b] [all [parse b [some string!]  b]]
    f: first layout/only [picker ["a" "b"] [print "picked"]]
    g: first layout/only [picker [print "only an action"]]
    reduce [f/items f/action g/items g/action]`);
  assert.equal(r, '[["a" "b"] [print "picked"] none [print "only an action"]]');
});

test('an entry fills a field of an object the face holds: a widget\'s properties', async () => {
  const r = await ev(`
    stylize [geo-map: widget [tag: "geo-map"  takes: [props/zoom: 'zoom [integer!] "how near it shows"]]]
    f: first layout/only [geo-map place "Place" [lat: 40] zoom 12]
    g: first layout/only [geo-map place "Place" zoom 3]
    reduce [f/tag f/props/lat f/props/zoom g/props/zoom]`);
  assert.equal(r, '["geo-map" 40 12 3]');
});

test('right after the style, a first entry is read in its order: a tag, then a name', async () => {
  const r = await ev(`
    stylize [card: face [style: 'panel  code: none  takes: [code: first [issue!]  name: first label]]]
    v: layout [card #k7 deal "Deal" [deal/hint: "found"]  button "Go" [do deal/action]]
    f: first v/pane
    do f/action
    reduce [f/code f/text f/hint]`);
  // the label is a word of the layout's blocks: its own action reaches the face by it
  assert.equal(r, '[#k7 "Deal" "found"]');
});

test('with runs a block bound to the face once it is read, the last way out', async () => {
  const r = await ev(`
    f: first layout/only [text "Total" with [role: 'danger  hint: "after"] "Second"]
    reduce [f/role f/hint]`);
  assert.equal(r, '[danger "after"]');
});

test('stylize says what in a takes block it cannot use', async () => {
  const r = await ev(`collect [foreach s [
    [a: field [takes: [stars: 'stars [integer!]]]]
    [a: field [takes: [stars: 12]]]
    [a: field [takes: [on: [change]]]]
    [a: nope []]
    [a: input [style: 'field]]
  ] [keep either error? e: try [stylize s] [e/message] ['ok]]]`);
  assert.equal(r, `[${[
    'stylize: a takes stars, which is no field of it; give it one: stars: none',
    'stylize: a takes: cannot read [stars: 12]',
    'stylize: a takes on: events, as on-change, not change',
    'stylize: unknown style nope',
  ].map(s => JSON.stringify(s)).join(' ')} ok]`);
});

test('face, container, input and rows-face are made from, never written', async () => {
  const r = await ev(`
    stylize [pin: input [style: 'field  takes: [required: rule 'required]]]
    f: first layout/only [pin code "Code" required readonly]
    e: try [layout [input x]]
    reduce [f/style f/name f/readonly e/message]`);
  assert.equal(r, '[field code true "layout: input is not a style"]');
});

test('ui-style-defs gives a designer what each style takes: its entries, events, base', async () => {
  const r = await ev(`${RATING}
    d: select ui-style-defs 'rating
    e: first d/own
    reduce [d/parent/name  find d/events 'on-change  collect [foreach e d/own [keep e/kw]]  e/help]`);
  assert.equal(r, '[field [on-change on-rate] [stars half none] "how many stars it shows"]');
});

test('check knows the styles a package defines, as it knows its rules', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trebol-takes-'));
  mkdirSync(join(dir, 'node_modules', 'trebol-stars'), { recursive: true });
  writeFileSync(join(dir, 'node_modules', 'trebol-stars', 'package.json'), '{"trebol": "stars.trb"}');
  writeFileSync(join(dir, 'node_modules', 'trebol-stars', 'stars.trb'), `Trebol []
stylize [rating: field [stars: 5  takes: [stars: 'stars [integer!]  on: [on-rate]]]]
`);
  const file = join(dir, 'app.trb');
  writeFileSync(file, `Trebol [title: "Stars"]
import 'trebol-stars
view [rating r "R" stars 3 on-rate [x]  rating q "Q" starz 4]
`);
  const lines: string[] = [];
  const clean = await check([file], l => lines.push(l));
  assert.equal(clean, false);
  assert.deepEqual(lines.map(l => l.slice(dir.length + 1)), [
    'app.trb:3:54  starz is not a word of rating; did you mean stars?',
  ]);
});
