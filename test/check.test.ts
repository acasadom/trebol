// `trebol check`: the problems in the layouts of a file, found without running it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { check } from '../tools/check.ts';

const ROOT = join(import.meta.dirname, '..');

async function checked(files: string[]): Promise<{ clean: boolean; lines: string[] }> {
  const lines: string[] = [];
  const clean = await check(files, l => lines.push(l));
  return { clean, lines };
}

test('check lays out every view and layout block, the faces of screens and rows, without running the code', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trebol-check-'));
  const file = join(dir, 'app.trb');
  writeFileSync(file, `Trebol [title: "Check"]
stylize [big: button [size: 'large]]
greet: does [view [txt "Hi"]]
1 + "never run"
view [
    big "Go"
    buton "Save" [view/only [field a "A" requird]]
    screens [
        home "Home" [on-enter [x] text "home" lable "x"]
        client "Client" [id] [text "c"]
    ]
    rows items min 1 [field a "A" hiden]
    choice "Pick" [alpha beta]
    widget <x-y> [zoom: no-such-word]
    tabs ["A" [text "a"] 1]
]
view compose/deep [text (name) button "a" menu (items) hiden  panel [(face) inert]]
`);
  const { clean, lines } = await checked([file]);
  assert.equal(clean, false);
  assert.deepEqual(lines.map(l => l.slice(dir.length + 1)), [
    'app.trb:3:20   txt is not a style; did you mean text?',
    'app.trb:7:5    buton is not a style; did you mean button?',
    'app.trb:7:42   requird is not a word of field; did you mean required?',
    'app.trb:9:47   lable is not a style; did you mean table?',
    'app.trb:12:35  hiden is not a word of field; did you mean hidden?',
    'app.trb:15:26  tabs take a label and a block per tab',
    // in view compose [...], a paren is a value check cannot know
    'app.trb:17:56  hiden is not a word of button; did you mean hidden?',
  ]);
});

test('check makes each machine without running it: its data is not worked out', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trebol-check-'));
  const file = join(dir, 'app.trb');
  writeFileSync(file, `Trebol [title: "Check"]
good: machine [data [n: 1 / 0]  initial a  state a []  from a to a on go set [n: 2]]
bad: machine [
    data [email: none]
    initial account
    state account [on-enter [data/emial: ""]]
]
worse: machine [initial a  state a []  from a to b on go]
`);
  const { clean, lines } = await checked([file]);
  assert.equal(clean, false);
  assert.deepEqual(lines.map(l => l.slice(dir.length + 1)), [
    'app.trb:6:30  machine: data has no emial; did you mean email?',
    'app.trb:8:40  machine: no state b',
  ]);
});

test('a file that does not load is a problem; a clean one says so', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trebol-check-'));
  writeFileSync(join(dir, 'bad.trb'), 'view [text "a]');
  writeFileSync(join(dir, 'good.trb'), 'view [text "a"]');
  const bad = await checked([join(dir, 'bad.trb')]);
  assert.equal(bad.clean, false);
  assert.match(bad.lines[0]!, /bad\.trb: /);
  assert.deepEqual(await checked([join(dir, 'good.trb')]), { clean: true, lines: ['No problems.'] });
});

test('every example checks clean', async () => {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.trb')) files.push(p);
    }
  };
  walk(join(ROOT, 'examples'));
  const { clean, lines } = await checked(files);
  assert.ok(clean, lines.map(l => relative(ROOT, l)).join('\n'));
});
