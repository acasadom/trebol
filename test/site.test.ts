// The website (site/): it builds, and the rules of its two games hold, played in the console with plain
// objects in place of the faces they draw on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../tools/bundle.ts';

const ROOT = join(import.meta.dirname, '..');

/** Runs a script with the CLI and gives what it printed. */
function run(src: string): string {
  const file = join(mkdtempSync(join(tmpdir(), 'trebol-site-')), 'play.trb');
  writeFileSync(file, src);
  return execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', join(ROOT, 'tools', 'cli.ts'), file], { encoding: 'utf8' });
}

const FACES = `face: does [make object! [draw: none text: "" role: none]]\n`;

test('the site builds into one page, with its title, description and icon', async () => {
  const b = await buildApp(join(ROOT, 'site'), join(mkdtempSync(join(tmpdir(), 'trebol-web-')), 'out'));
  assert.ok(b.sources.includes('games/leaf-fall.trb'));
  assert.ok(b.copied.includes('favicon.svg') && b.copied.includes('trebol.svg'));
  const page = readFileSync(b.page, 'utf8');
  assert.match(page, /<title>Trebol<\/title>/);
  assert.match(page, /<meta name="description" content="Trebol is a language/);
});

test('Leaf Fall: pieces move, turn, drop and settle, and a full row is raked away', () => {
  const out = run(`${FACES}
foreach w [fall-bed fall-next fall-score fall-lines fall-level fall-state fall-play] [set w face]
do %${join(ROOT, 'site', 'games', 'leaf-fall.trb')}
f: leaf-fall
f/key #" "  f/stop
print [f/state f/at]
f/piece: first f/shapes  f/turn: 1  f/at: 3x0
f/key 'left  print f/at
f/key 'up  print f/turn
f/key 'right  f/key 'up  print [f/turn f/at]
; a row with only the middle three cells empty, and a straight piece dropped into them
f/stop
poke f/bed 14 reduce ['red 'red 'red none none none 'red 'red]
f/piece: first f/shapes  f/turn: 1  f/at: 4x0
f/key #" "  f/stop
print [f/lines f/score fall-lines/text]
print mold last f/bed
`);
  assert.equal(out, 'playing 3x0\n2x0\n2\n1 3x0\n1 126 1\n[none none none none none none none none]\n');
});

test('Clover Hunt: a patch counts the hidden clovers in its row and column, and the hunt ends', () => {
  const out = run(`${FACES}
foreach w [hunt-left hunt-found hunt-state] [set w face]
hunt-field: make object! [pane: collect [repeat i 49 [keep face]]]
do %${join(ROOT, 'site', 'games', 'clover-hunt.trb')}
h: clover-hunt
h/start
h/clovers: [1 9 17 49]   ; row 1 col 1, row 2 col 2, row 3 col 3, row 7 col 7
print h/hint 2           ; row 1 has 1, column 2 has 9
h/search 2 pick hunt-field/pane 2
h/search 2 pick hunt-field/pane 2
print [h/left hunt-field/pane/2/text]
foreach c [1 9 17] [h/search c pick hunt-field/pane c]
print [h/state hunt-found/text h/hint 7]
h/search 49 pick hunt-field/pane 49
print [h/state hunt-state/role]
h/start
h/clovers: [1 2 3 4]
loop 16 [h/search 49 - h/left pick hunt-field/pane 49 - h/left]
print [h/state h/left hunt-field/pane/1/role]
`);
  assert.equal(out, '2\n15 2\nplaying 3 of 4 1\nwon success\nlost 0 danger\n');
});
