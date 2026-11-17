// `trebol test`: screen tests written in Trebol, run on the app without a browser.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, relative } from 'node:path';
import { test as runTests, findTests } from '../tools/test.ts';

const ROOT = join(import.meta.dirname, '..');

async function ran(files: string[]): Promise<{ passed: boolean; lines: string[] }> {
  const lines: string[] = [];
  const passed = await runTests(files.map(f => relative(process.cwd(), join(ROOT, f))), l => lines.push(l));
  return { passed, lines };
}

test('click, type, choose and see act on the faces on show, and serve answers the requests', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/app.test.trb']);
  assert.equal(passed, false);
  const at = (l: string): string => l.replace(/\S*test\/fixtures\/screens\//g, '');
  assert.deepEqual(lines.slice(0, 5).map(at), [
    'ok    app.test.trb:8:1  screens and tabs',
    'ok    app.test.trb:22:1  choices',
    'ok    app.test.trb:33:1  forms',
    "ok    app.test.trb:44:1  the server and the user's answers",
    "ok    app.test.trb:45:1  the server and the user's answers",
  ]);
  // each failure says what and where, at the step of the test or the line of the app
  const failures = lines.slice(5).map(at).filter(l => !/\*\* (Where|Near):/.test(l));
  assert.deepEqual(failures, [
    'FAIL  app.test.trb:48:1  what fails',
    '        ** User error: click: nothing on the screen is "Nothing"',
    '        ** At: app.test.trb:48:2',
    'FAIL  app.test.trb:49:1  what fails',
    '        ** User error: click: "Save" cannot be used now',
    '        ** At: app.test.trb:49:20',
    'FAIL  app.test.trb:50:1  what fails',
    '        ** User error: type: nothing on the screen is "Welcome"',
    '        ** At: app.test.trb:50:2',
    'FAIL  app.test.trb:51:1  what fails',
    '        ** User error: choose: "Size" has no option "Huge"',
    '        ** At: app.test.trb:51:20',
    'FAIL  app.test.trb:52:1  what fails',
    '        ** User error: see: "Goodbye" is not on the screen',
    '        ** At: app.test.trb:52:2',
    'FAIL  app.test.trb:53:1  what fails',
    '        ** User error: see: "Welcome" is on the screen',
    '        ** At: app.test.trb:53:2',
    'FAIL  app.test.trb:54:1  what fails',
    '        ** Script error: no-such-word has no value',
    '        ** At: app.trb:10:28',
    'FAIL  app.test.trb:55:1  what fails',
    '        ** Access error: HTTP 500 Internal Server Error for /api/note?q=a%20b',
    '        ** At: app.trb:8:34',
    'FAIL  app.test.trb:56:1  what fails',
    '        the test gave 2, not true',
    '14 tests, 9 failed.',
  ]);
});

test('a request serve has no answer for fails the test, before what it caused', async () => {
  const { lines } = await ran(['test/fixtures/screens/unserved.test.trb']);
  assert.match(lines[1]!, /serve has no answer for GET \/api\/note\?q=a%20b$/);
  assert.match(lines[2]!, /HTTP 404 Not Found/);
});

test('insert-text puts text in a field, area or rich text as the user would type it', async () => {
  const { lines } = await ran(['test/fixtures/screens/insert.test.trb']);
  const at = (l: string): string => l.replace(/\S*test\/fixtures\/screens\//g, '');
  assert.deepEqual(lines.map(at).filter(l => !/\*\* (Where|Near):/.test(l)), [
    'ok    insert.test.trb:4:1  insert-text',
    'ok    insert.test.trb:13:1  insert-text',
    'FAIL  insert.test.trb:14:1  insert-text',
    '        ** User error: insert-text: a choice has no cursor',
    '        ** At: insert.trb:11:21',
    '3 tests, 1 failed.',
  ]);
});

test('a form in steps led by a machine: it chooses the next step, Back puts it back', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/flow.test.trb']);
  assert.ok(passed, lines.join('\n'));
});

test('see-mark sees the mark of a tile, and see its label', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/tiles.test.trb']);
  assert.ok(passed, lines.join('\n'));
});

test('going back goes one step, as the browser does', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/steps.test.trb']);
  assert.ok(passed, lines.join('\n'));
});

test('on-leave keeps the screen when the user goes back or follows a link', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/leave.test.trb']);
  assert.ok(passed, lines.join('\n'));
});

test('react, is and calc follow what they read, between the steps of a test', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/react.test.trb']);
  assert.ok(passed, lines.join('\n'));
});

test('cached gives the last answer and asks again after a post or a refresh', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/cached.test.trb']);
  assert.ok(passed, lines.join('\n'));
});

test('toast/undo: click "Undo" runs its back block, dismiss and a new screen run its then block', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/undo.test.trb']);
  assert.equal(passed, false);
  const at = (l: string): string => l.replace(/\S*test\/fixtures\/screens\//g, '');
  const out = lines.map(at).filter(l => !/\*\* (Where|Near|At):/.test(l));
  assert.deepEqual(out.slice(0, 4), [
    'ok    undo.test.trb:7:1  undo',
    'ok    undo.test.trb:15:1  undo',
    'ok    undo.test.trb:24:1  undo',
    'ok    undo.test.trb:32:1  what waits is done when the screen changes',
  ], lines.join('\n'));
  assert.deepEqual(out.slice(4, 8), [
    'FAIL  undo.test.trb:38:1  errors',
    '        ** User error: dismiss: no notice waiting to go shows "Nobody removed"',
    'FAIL  undo.test.trb:39:1  errors',
    '        ** User error: click: nothing on the screen is "Undo"',
  ], lines.join('\n'));
});

test('steps: one step on show, Next and Enter check it, a step with when is skipped, only a step done is chosen', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/wizard.test.trb']);
  assert.equal(passed, false);
  const out = lines.map(l => l.replace(/\S*test\/fixtures\/screens\//g, '')).filter(l => !/\*\* (Where|Near|At):/.test(l));
  assert.equal(out.filter(l => l.startsWith('ok ')).length, 8, lines.join('\n'));
  assert.deepEqual(out.slice(7, 9), [
    'FAIL  wizard.test.trb:71:1  errors',
    '        ** User error: click: "What" cannot be used now',
  ], lines.join('\n'));
});

test('the tests of the examples pass', async () => {
  const files = (await findTests(join(ROOT, 'examples'))).map(f => relative(ROOT, f));
  assert.ok(files.includes('examples/clients/app.test.trb'));
  const { passed, lines } = await ran(files);
  assert.ok(passed, lines.join('\n'));
});

test('click and pick-menu choose the open rows of a tree, and see sees them', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/tree.test.trb']);
  assert.ok(passed, lines.join('\n'));
});

test('a test in a folder imports the files next to it', async () => {
  const { passed, lines } = await ran(['test/fixtures/imports/lib/twice.test.trb']);
  assert.ok(passed, lines.join('\n'));
});

test('say answers the next confirm, and an answer no question took fails the test', async () => {
  const { lines } = await ran(['test/fixtures/screens/confirm.test.trb']);
  const at = (l: string): string => l.replace(/\S*test\/fixtures\/screens\//g, '');
  assert.deepEqual(lines.map(at), [
    'ok    confirm.test.trb:4:1  say',
    'ok    confirm.test.trb:8:1  say',
    'ok    confirm.test.trb:15:1  say',
    'FAIL  confirm.test.trb:22:1  say',
    '        say no: no question was asked',
    '4 tests, 1 failed.',
  ]);
});

test('press runs the shortcut of a button, else on-key; Enter sends a form and Escape closes a dialog', async () => {
  const { lines } = await ran(['test/fixtures/screens/keys.test.trb']);
  const at = (l: string): string => l.replace(/\S*test\/fixtures\/screens\//g, '');
  assert.deepEqual(lines.map(at).filter(l => !/\*\* (Where|Near):/.test(l)), [
    'ok    keys.test.trb:4:1  press',
    'ok    keys.test.trb:8:1  press',
    'ok    keys.test.trb:12:1  press',
    'ok    keys.test.trb:17:1  press',
    'ok    keys.test.trb:21:1  press',
    'ok    keys.test.trb:28:1  press',
    'FAIL  keys.test.trb:35:1  press',
    '        ** User error: press: "Ctrl+O" cannot be used now',
    '        ** At: keys.test.trb:35:2',
    'FAIL  keys.test.trb:36:1  press',
    '        ** User error: press: "Ctrl+Nothing" is not a key',
    '        ** At: keys.test.trb:36:2',
    '8 tests, 2 failed.',
  ]);
});

test('pick-menu chooses an item of a button, a face or a row of a table, and of a submenu', async () => {
  const { lines } = await ran(['test/fixtures/screens/menus.test.trb']);
  const at = (l: string): string => l.replace(/\S*test\/fixtures\/screens\//g, '');
  assert.deepEqual(lines.map(at).filter(l => !/\*\* (Where|Near):/.test(l)), [
    'ok    menus.test.trb:4:1  pick-menu',
    'ok    menus.test.trb:8:1  pick-menu',
    'ok    menus.test.trb:12:1  pick-menu',
    'ok    menus.test.trb:16:1  pick-menu',
    'FAIL  menus.test.trb:20:1  pick-menu',
    '        ** User error: pick-menu: the menu of "Actions" has no "Print"',
    '        ** At: menus.test.trb:20:2',
    'FAIL  menus.test.trb:21:1  pick-menu',
    '        ** User error: pick-menu: "Send to" opens a submenu',
    '        ** At: menus.test.trb:21:2',
    'FAIL  menus.test.trb:22:1  pick-menu',
    '        ** User error: pick-menu: "Nothing yet" has no menu',
    '        ** At: menus.test.trb:22:2',
    'FAIL  menus.test.trb:23:1  pick-menu',
    '        ** User error: pick-menu: "Off" cannot be used now',
    '        ** At: menus.test.trb:23:2',
    '8 tests, 4 failed.',
  ]);
});

test('drag moves a row or a face to the place of another, or drops it on a face or before a row', async () => {
  const { lines } = await ran(['test/fixtures/screens/drag.test.trb']);
  const at = (l: string): string => l.replace(/\S*test\/fixtures\/screens\//g, '');
  assert.deepEqual(lines.map(at).filter(l => !/\*\* (Where|Near):/.test(l)), [
    'ok    drag.test.trb:4:1  drag',
    'ok    drag.test.trb:9:1  drag',
    'ok    drag.test.trb:13:1  drag',
    'ok    drag.test.trb:17:1  drag',
    'ok    drag.test.trb:21:1  drag',
    'ok    drag.test.trb:25:1  drag',
    'FAIL  drag.test.trb:29:1  drag',
    '        ** User error: drag: "Still" cannot be dragged',
    '        ** At: drag.test.trb:29:2',
    'FAIL  drag.test.trb:30:1  drag',
    '        ** User error: drag: "Still" takes nothing dropped',
    '        ** At: drag.test.trb:30:2',
    'ok    drag.test.trb:31:1  drag',
    '9 tests, 2 failed.',
  ]);
});

test('attach chooses files next to the test for an upload or photo, refuses what accept does not take, and serve sees them sent', async () => {
  const { lines } = await ran(['test/fixtures/screens/files.test.trb']);
  const at = (l: string): string => l.replace(/\S*test\/fixtures\/screens\//g, '');
  assert.deepEqual(lines.map(at).filter(l => !/\*\* (Where|Near):/.test(l)), [
    'ok    files.test.trb:8:1  attach',
    'ok    files.test.trb:16:1  attach',
    'ok    files.test.trb:21:1  attach',
    'ok    files.test.trb:28:1  attach',
    'FAIL  files.test.trb:34:1  attach',
    '        ** Access error: attach: there is no file missing.pdf',
    '        ** At: files.test.trb:34:2',
    'FAIL  files.test.trb:35:1  attach',
    '        ** User error: attach: nothing on the screen is "Said"',
    '        ** At: files.test.trb:35:2',
    '6 tests, 2 failed.',
  ]);
});

test('a slider starts at its least, takes numbers within its ends, and keeps its place for what is no number', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/slider.test.trb']);
  assert.ok(passed, lines.join('\n'));
});

test('a range of dates takes two dates, the start first, each within min and max', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/stay.test.trb']);
  assert.ok(passed, lines.join('\n'));
});

test('a time takes what is one, in the active language, within min and max', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/times.test.trb']);
  assert.ok(passed, lines.join('\n'));
});

test('a board deals its cards to lanes; a drop sets the field, or takes the way of a machine to that state', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/board.test.trb']);
  assert.ok(passed, lines.join('\n'));
});
