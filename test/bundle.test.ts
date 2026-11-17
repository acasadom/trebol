// `trebol build` (tools/bundle.ts): one index.html with the runtime, Inter and the app's .trb inside,
// and the app's media copied next to it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildApp, scriptSafe } from '../tools/bundle.ts';

/** A folder with these files in it. */
function folder(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'trebol-app-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

/** The text of the first <script> with this opening tag. */
function script(page: string, open: string): string {
  const at = page.indexOf(open) + open.length;
  return page.slice(at, page.indexOf('</script>', at));
}

test('the page has the app inside and its media next to it', async () => {
  const root = folder({
    'app.trb': 'Trebol [title: "Cog & <Chain>"]\nimport %lib/parts.trb\nview [text greeting]\n',
    'lib/parts.trb': 'Trebol []\nexport greeting: "Привет </script> <!-- hi"\n',
    'app.test.trb': 'Trebol []\n"a" [see "x"]\n',
    'node_modules/x/y.trb': '1',
    '.secret/z.trb': '1',
    'photo.PNG': 'png',
    'data/rows.csv': 'a,b',
    'api.ts': 'export {}',
    'package.json': '{}',
    'index.html': '<p>old</p>',
  });
  const b = await buildApp(root);
  assert.deepEqual(b.sources, ['app.trb', 'lib/parts.trb']);
  assert.deepEqual(b.copied, ['data/rows.csv', 'photo.PNG']);
  const out = join(root, 'build');
  assert.equal(b.page, join(out, 'index.html'));
  assert.equal(readFileSync(join(out, 'data', 'rows.csv'), 'utf8'), 'a,b');
  for (const left of ['api.ts', 'package.json', 'app.test.trb', 'lib']) assert.ok(!existsSync(join(out, left)), left);

  const page = readFileSync(b.page, 'utf8');
  assert.equal(b.size, Buffer.byteLength(page));
  assert.match(page, /<title>Cog &amp; &lt;Chain&gt;<\/title>/);
  assert.deepEqual(JSON.parse(script(page, '<script type="application/json" id="trebol-files">')), {
    'app.trb': readFileSync(join(root, 'app.trb'), 'utf8'),
    'lib/parts.trb': readFileSync(join(root, 'lib', 'parts.trb'), 'utf8'),
  });
  // the app's text, the runtime and the license close no element early
  assert.equal(page.match(/<\/script/gi)?.length, 3);
  assert.equal(page.match(/<!--/g)?.length, 1);
  assert.equal(page.slice(0, page.indexOf('<style')).match(/-->/g)?.length, 1);
  assert.match(page, /SIL Open Font License, Version 1\.1/);
  // Latin always, Cyrillic for the greeting; not Cyrillic Extended or Greek
  const fonts = page.slice(page.indexOf('<style data-tb-fonts>'), page.indexOf('</style>'));
  assert.equal(fonts.match(/@font-face/g)?.length, 3);
  assert.match(fonts, /U\+0000-00FF/);
  assert.match(fonts, /U\+0100-02BA/);
  assert.match(fonts, /U\+0301,U\+0400-045F/);
  assert.doesNotMatch(fonts, /U\+0460-052F/);
  assert.doesNotMatch(fonts, /U\+1F00-1FFF/);
  assert.match(fonts, /src: url\(data:font\/woff2;base64,d09GMg/);
  assert.match(page, /<script type="text\/trebol" src="app.trb"><\/script>/);
});

test('the packages the app imports by name go inside the page, under node_modules/', async () => {
  const top = folder({
    'node_modules/trebol-x/package.json': '{"trebol": "x.trb"}',
    'node_modules/trebol-x/x.trb': "Trebol []\nimport %more/y.trb\nimport 'trebol-y",
    'node_modules/trebol-x/more/y.trb': 'Trebol []',
    'node_modules/trebol-x/x.test.trb': 'Trebol []',
    'node_modules/trebol-x/README.md': 'x',
    'node_modules/trebol-y/package.json': '{"trebol": "y.trb"}',
    'node_modules/trebol-y/y.trb': 'Trebol []',
    'node_modules/unused/package.json': '{"trebol": "u.trb"}',
    'shop/app.trb': "Trebol []\nif true [import 'trebol-x]\nview [text \"hi\"]",
  });
  const b = await buildApp(join(top, 'shop'));
  assert.deepEqual(b.sources, ['app.trb', 'node_modules/trebol-x/more/y.trb', 'node_modules/trebol-x/x.trb', 'node_modules/trebol-y/y.trb']);
  const files = JSON.parse(script(readFileSync(b.page, 'utf8'), '<script type="application/json" id="trebol-files">')) as Record<string, string>;
  assert.deepEqual(Object.keys(files).sort(), [
    'app.trb', 'node_modules/trebol-x/more/y.trb', 'node_modules/trebol-x/package.json', 'node_modules/trebol-x/x.trb',
    'node_modules/trebol-y/package.json', 'node_modules/trebol-y/y.trb',
  ]);
  await assert.rejects(buildApp(folder({ 'app.trb': "import 'nope" })), /imports the package nope, which is not in node_modules/);
});

test('a page in Latin has only the Latin fonts', async () => {
  const root = folder({ 'app.trb': 'view [text "Año ¿qué? Łódź"]' });
  const out = join(mkdtempSync(join(tmpdir(), 'trebol-out-')), 'site');
  const page = readFileSync((await buildApp(root, out)).page, 'utf8');
  assert.equal(page.slice(0, page.indexOf('</style>')).match(/@font-face/g)?.length, 2);
  assert.match(page, /<title>Trebol<\/title>/);
});

test('with csp the page has no inline script or style, and the runtime and fonts sit next to it', async () => {
  const root = folder({ 'app.trb': 'Trebol []\nview [text "Hi"]\n', 'photo.png': 'png' });
  const b = await buildApp(root, undefined, { csp: true });
  const out = join(root, 'build');
  assert.deepEqual(b.split, ['trebol.js', 'fonts/']);
  const page = readFileSync(b.page, 'utf8');
  assert.doesNotMatch(page, /<style|style=/);
  // every script has a src or is data
  for (const open of page.match(/<script[^>]*>/g)!) assert.match(open, /src="|type="application\/json"/, open);
  assert.match(page, /<script type="module" src="trebol.js"><\/script>/);
  assert.deepEqual(Object.keys(JSON.parse(script(page, '<script type="application/json" id="trebol-files">'))), ['app.trb']);
  assert.ok(readFileSync(join(out, 'trebol.js'), 'utf8').length > 100_000);
  for (const f of ['inter-latin.woff2', 'inter-cyrillic.woff2', 'OFL.txt']) assert.ok(existsSync(join(out, 'fonts', f)), f);
  assert.equal(readFileSync(join(out, 'photo.png'), 'utf8'), 'png');
  // the app's own trebol.js would be lost
  await assert.rejects(buildApp(folder({ 'app.trb': 'view []', 'fonts/a.woff2': 'x' }), undefined, { csp: true }), /fonts\/a\.woff2 would take the place/);
});

test('a build replaces only a folder it made', async () => {
  const root = folder({ 'app.trb': 'view [text "hi"]', 'a.svg': '<svg/>' });
  await buildApp(root);
  writeFileSync(join(root, 'build', 'stale.txt'), 'x');
  await buildApp(root);
  assert.ok(!existsSync(join(root, 'build', 'stale.txt')));
  const other = folder({ 'notes.txt': 'mine' });
  await assert.rejects(buildApp(root, other), /has files not made by trebol build/);
  assert.equal(readFileSync(join(other, 'notes.txt'), 'utf8'), 'mine');
  await assert.rejects(buildApp(root, root), /cannot hold the app/);
  await assert.rejects(buildApp(other), /no app\.trb/);
});

test('JavaScript inside a page cannot end its script', () => {
  assert.equal(scriptSafe(String.raw`a = "</script>" + "<!--" + /<\/x/ + /<\/SCRIPT/i`), String.raw`a = "\x3C/script>" + "\x3C!--" + /<\/x/ + /<\/SCRIPT/i`);
  assert.equal(scriptSafe('/</SCRIPT/i'), String.raw`/\x3C/SCRIPT/i`);
});
