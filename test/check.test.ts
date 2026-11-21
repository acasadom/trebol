// `trebol check`: the problems in the layouts of a file, found without running it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readdirSync, statSync } from 'node:fs';
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
view compose/deep [text (name) button "a" menu (items) hiden  panel [(face) inert]  screens [home "Home" (home-faces)]]
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

test('a face compose puts in ends at the next style, and what follows it is read as any face could take it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trebol-check-'));
  const file = join(dir, 'app.trb');
  writeFileSync(file, `Trebol []
x: [text "a"]
show-it: does [b/pane: layout/only compose/deep [form [(x) submit "Ok" [print 1]]]]
view [global b: column [] button "x" [show-it]]
view compose [column [(x) [print 1] button "Ok" [print 1]]]
view compose [column [(x) red submitt "Ok"]]
`);
  const { clean, lines } = await checked([file]);
  assert.equal(clean, false);
  assert.deepEqual(lines.map(l => l.slice(dir.length + 1)), [
    'app.trb:6:31  submitt is not a style; did you mean submit?',
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

test('check makes the fragments a machine uses, from the fragments written before it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trebol-check-'));
  const file = join(dir, 'app.trb');
  writeFileSync(file, `Trebol [title: "Check"]
approval: fragment [signal [word!]] [
    initial waiting
    state waiting []
    state accepted []
    from waiting to accepted on signal
]
twice: fragment [] [initial one  state one [use approval with [signal: go]]]
process: machine [initial quote  state quote [use approval with [signal: yes]]  state other [use twice]  from quote to other on next]
print state-of process
`);
  const good = await checked([file]);
  assert.deepEqual(good.lines, ['No problems.']);
  assert.equal(good.clean, true);
  writeFileSync(file, `Trebol [title: "Check"]
early: machine [initial a  state a [use approval]]
approval: fragment [signal [word!]] [initial waiting  state waiting []]
bad: fragment [blank [no-such-type]] [initial a  state a []]
late: machine [initial a  state a [use aproval]  state b [use approval with [sign: go]]  from a to b on go]
`);
  const { clean, lines } = await checked([file]);
  assert.equal(clean, false);
  assert.deepEqual(lines.map(l => l.slice(dir.length + 1)), [
    // a machine sees only the fragments written before it, as when the file runs
    'app.trb:2:37  machine: approval has no value: use takes the name of a fragment',
    'app.trb:4:1   fragment: no-such-type is not a type, in the types of blank',
    'app.trb:5:36  machine: aproval has no value: use takes the name of a fragment',
  ]);
});

test('a state no way leads to is a warning: check says it, and the file is still fine', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trebol-check-'));
  const file = join(dir, 'app.trb');
  writeFileSync(file, `Trebol [title: "Check"]
m: machine [initial a  state a []  state b []  state c []  from a to b on go]
`);
  const { clean, lines } = await checked([file]);
  assert.equal(clean, true);
  assert.deepEqual(lines.map(l => l.slice(dir.length + 1)), ['app.trb:2:48  warning: machine: no way leads to state c']);
  // with a mistake beside it, the file is not fine
  writeFileSync(file, `Trebol [title: "Check"]
m: machine [initial a  state a []  state b []  state c []  from a to b on go]
view [buton "Go"]
`);
  const after = await checked([file]);
  assert.equal(after.clean, false);
  assert.equal(after.lines.length, 2);
});

test('check knows the rules of the program, and finds a rule that cannot be one', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trebol-check-'));
  const file = join(dir, 'app.trb');
  writeFileSync(file, `Trebol [title: "Rules"]
rule 'even "Enter an even number" [even? to integer! value]
rule 'email "Mine" [true]
view [field n "N" even iban  field m "M" evn]
`);
  const { clean, lines } = await checked([file]);
  assert.equal(clean, false);
  assert.deepEqual(lines.map(l => l.slice(dir.length + 1)), [
    'app.trb:3:1   rule: email is already a word of the dialect',
    'app.trb:4:42  evn is not a word of field; did you mean even?',
  ]);
});

test('check runs the imports at the top of a file, so it knows the rules of a package', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trebol-check-'));
  mkdirSync(join(dir, 'node_modules', 'trebol-x'), { recursive: true });
  writeFileSync(join(dir, 'node_modules', 'trebol-x', 'package.json'), '{"trebol": "x.trb"}');
  writeFileSync(join(dir, 'node_modules', 'trebol-x', 'x.trb'), `Trebol []\nrule 'postcode "Enter a postcode" [true]\n`);
  writeFileSync(join(dir, 'mine.trb'), `Trebol []\nrule 'even "Enter an even number" [true]\n`);
  const file = join(dir, 'app.trb');
  writeFileSync(file, `Trebol [title: "Rules"]
import 'trebol-x
import %mine.trb
import 'trebol-nope
view [field p "P" postcode even  field q "Q" postcod]
`);
  const { clean, lines } = await checked([file]);
  assert.equal(clean, false);
  assert.deepEqual(lines.map(l => l.slice(dir.length + 1)), [
    'app.trb:4:1   cannot find the package trebol-nope: no node_modules/trebol-nope/package.json',
    'app.trb:5:46  postcod is not a word of field; did you mean postcode?',
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
