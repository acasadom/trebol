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

test('going back goes one step, as the browser does', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/steps.test.trb']);
  assert.ok(passed, lines.join('\n'));
});

test('on-leave keeps the screen when the user goes back or follows a link', async () => {
  const { passed, lines } = await ran(['test/fixtures/screens/leave.test.trb']);
  assert.ok(passed, lines.join('\n'));
});

test('the tests of the examples pass', async () => {
  const files = (await findTests(join(ROOT, 'examples'))).map(f => relative(ROOT, f));
  assert.ok(files.includes('examples/clients/app.test.trb'));
  const { passed, lines } = await ran(files);
  assert.ok(passed, lines.join('\n'));
});
