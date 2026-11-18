// What each style of the UI dialect takes (src/ui/dialect/options.trb): every style and every
// word of the dialect has its options, and an option a style does not take is a problem.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';

native('ui-watch', '[object [object!]]', (_t, f) => value(f.args[0]!));

let host: Host;
before(async () => {
  host = startHost({ onError: () => {}, loader: { base: 'file:///', read: href => readFile(fileURLToPath(href), 'utf8') } });
  await startUi(host);
});

async function ev(src: string): Promise<string> {
  try {
    return mold(await runSource(host, src));
  } catch (e) {
    return assert.fail(`${src}\n  raised: ${form(errorField(e as ObjectCell, 'message'))}`);
  }
}

// the options every style takes, each an option of ui-options
const NAMES = 'names: collect [foreach [o k c h] ui-options [keep o]]';

test('every style takes options, and each of them is an option of the dialect', async () => {
  assert.equal(await ev('collect [foreach s words-of styles [unless ui-options-of s [keep s]]]'), '[]');
  assert.equal(await ev(`${NAMES}
    collect [foreach [s own] ui-style-options [foreach o own [unless find names o [keep o]]]
      foreach o any-face-options [unless find names o [keep o]]]`), '[]');
});

test('every option is taken by some style', async () => {
  assert.equal(await ev(`used: copy any-face-options  foreach [s own] ui-style-options [append used own]
    collect [foreach [o k c h] ui-options [unless find used o [keep o]]]`), '[]');
});

test('each option has a kind of editor, its choices if a word, and a help', async () => {
  assert.equal(await ev(`kinds: [flag word text icon file value number numbers pair items map code field machine name]
    collect [foreach [o k c h] ui-options [
      unless all [word? o  find kinds k  block? c  string? h  ('word = k) = not empty? c] [keep o]
    ]]`), '[]');
});

test('every word of the dialect and every event is an option, a choice of one, or a style', async () => {
  assert.equal(await ev(`${NAMES}
    choices: collect [foreach [o k c h] ui-options [keep c]]
    collect [foreach w union ui-dialect-words ui-events [
      unless any [find names w  find choices w  select styles w  find ui-option-words w  find ui-options-of 'field w] [keep w]
    ]]`), '[]');
});

const problems = (spec: string) => ev(`second ui-sketch [${spec}]`);

test('an option its style does not take is a problem at the face', async () => {
  assert.match(await problems('field name "Name" poster %p.png'), /"poster does nothing on a field"/);
  assert.match(await problems('text "x" segmented'), /"segmented does nothing on a text"/);
  assert.match(await problems('button "Go" pad 3'), /"pad does nothing on a button"/);
  assert.match(await problems('choice c "C" ["a"] on-search [x]'), /"on-search does nothing on a choice"/);
  assert.match(await problems('text "x" iban'), /"iban does nothing on a text"/);
  assert.equal(await problems('field account "Account" iban'), '[]');
});

test('what a style takes, written in any way, is no problem', async () => {
  for (const spec of [
    'video %a.mp4 "Intro" poster %p.png captions %c.vtt loop muted autoplay on-end [x]',
    'slider v "V" 0 50 step 5', 'number n "Total" calc [1 + 1]', 'text "n" count is [1]',
    'panel "P" pad 2 gap wide fit [text "a"]', 'grid [small 1] [text "a" text "b"]', 'row top [text "a"]',
    'chart line sales [month "Month" n "N"] stacked', 'money price "Price" EUR min $1 max $9',
    'table t [a "A"] sortable sorted [a asc] key code on-sort [x] on-select [x]',
    'board jobs by status [todo "To do"] card [title "T"]', 'tile #folder "F" linked mark #list "List" [x]',
    'button "Save" key "Ctrl+S" [x]', 'link "Clients" \'clients', 'field n "N" width large email length 2 9',
    'image %a.png "A" 48x48 round', 'upload u "U" multiple accept ["pdf"]', 'radio r "R" ["a" "b"] segmented',
  ]) assert.equal(await problems(spec), '[]', spec);
});

test('a style of stylize takes what its base takes', async () => {
  assert.equal(await ev('stylize [clip: video [poster: %p.png]]  second ui-sketch [clip %a.mp4 loop]'), '[]');
  assert.match(await ev('stylize [big: button [size: \'large]]  second ui-sketch [big "Go" poster %p.png]'),
    /"poster does nothing on a button"/);
});

test('a face with a problem already says nothing more of its options', async () => {
  assert.equal(await ev('length? second ui-sketch [text "a" morph 3]'), '2');
});
