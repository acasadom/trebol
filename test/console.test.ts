// The interactive console of the `trebol` command, fed line by line.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { output } from '../src/host/index.ts';
import { Repl, consoleHost, PROMPT, MORE } from '../tools/console.ts';

async function session(lines: string[]): Promise<string[]> {
  const repl = new Repl(consoleHost());
  const shown: string[] = [];
  const line = output.line;
  output.line = text => shown.push(text);
  try {
    for (const l of lines) shown.push(...(await repl.feed(l)));
  } finally {
    output.line = line;
  }
  return shown;
}

test('values show after ==, unset shows nothing, print writes its own line', async () => {
  assert.deepEqual(await session(['1 + 2', 'print "hi"', 'x: 10', 'x * 2', '']),
    ['== 3', 'hi', '== 10', '== 20']);
});

test('words set in one line stay for the next', async () => {
  assert.deepEqual(await session(['price: $12.50', 'price * 2']), ['== $12.50', '== $25.00']);
});

test('an open block asks for more lines', async () => {
  const repl = new Repl(consoleHost());
  assert.deepEqual(await repl.feed('b: [1 2'), []);
  assert.equal(repl.prompt, MORE);
  // the line break typed inside the block stays, as mold keeps it
  assert.deepEqual(await repl.feed('3]'), ['== [1 2\n    3\n]']);
  assert.equal(repl.prompt, PROMPT);
});

test('errors show and the session goes on', async () => {
  const shown = await session(['1 / 0', 'nope', '1 ]', '5']);
  assert.match(shown[0]!, /^\*\* Math error: attempt to divide by zero/);
  assert.match(shown[1]!, /^\*\* Script error: nope has no value/);
  assert.match(shown[2]!, /^\*\* Syntax error: .*unexpected \]/);
  assert.equal(shown.at(-1), '== 5');
});

test('reset forgets a half-typed expression', async () => {
  const repl = new Repl(consoleHost());
  await repl.feed('f: func [x] [');
  repl.reset();
  assert.equal(repl.prompt, PROMPT);
  assert.deepEqual(await repl.feed('2'), ['== 2']);
});

test('trebol runs a script from a file or from stdin', () => {
  const cli = fileURLToPath(new URL('../tools/cli.ts', import.meta.url));
  const piped = spawnSync(process.execPath, [cli], { input: 'print 1 + 2' , encoding: 'utf8' });
  assert.equal(piped.stdout, '3\n');
  assert.equal(piped.status, 0);
  const failed = spawnSync(process.execPath, [cli], { input: 'print 1 / 0', encoding: 'utf8' });
  assert.match(failed.stderr, /\*\* Math error/);
  assert.equal(failed.status, 1);
});

test('an error that is the value shows as an error, and form gives the same text', async () => {
  assert.deepEqual(await session(['e: try [1 / 0]', 'error? e', 'e/id', 'print e']), [
    '** Math error: attempt to divide by zero\n** Where: /\n** Near: [1 / 0]\n** At: 1:9',
    '== true',
    '== zero-divide',
    '** Math error: attempt to divide by zero\n** Where: /\n** Near: [1 / 0]\n** At: 1:9',
  ]);
});
