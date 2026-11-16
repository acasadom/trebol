// The built package (tools/build.ts): installed under node_modules, where Node
// runs no TypeScript, the `trebol` command still runs scripts, serves and builds
// apps, and the browser runtime is one file with the UI dialect inside.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { buildDist } from '../tools/build.ts';

const ROOT = join(import.meta.dirname, '..');

/** A project folder with Trebol installed in its node_modules, as npm would leave it. */
async function installed(): Promise<{ project: string; pkg: string }> {
  const project = mkdtempSync(join(tmpdir(), 'trebol-project-'));
  const pkg = join(project, 'node_modules', 'trebol');
  const { files } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { files: string[] };
  mkdirSync(pkg, { recursive: true });
  for (const f of files.filter(f => f !== 'dist')) cpSync(join(ROOT, f), join(pkg, f), { recursive: true });
  cpSync(join(ROOT, 'package.json'), join(pkg, 'package.json'));
  await buildDist(join(pkg, 'dist'));
  return { project, pkg };
}

test('the installed command runs a script and serves an app', async () => {
  const { project, pkg } = await installed();
  const cli = join(pkg, 'dist', 'cli.js');
  const run = spawnSync(process.execPath, [cli], { input: 'print 1 + 2', encoding: 'utf8', cwd: project });
  assert.equal(run.stderr, '');
  assert.equal(run.stdout, '3\n');
  // the tutorial's supplier, with ws inside (port 8089 may be taken by the docs tests: only its loading is checked)
  const bad = spawnSync(process.execPath, [cli, 'supplier', 'extra'], { encoding: 'utf8', cwd: project });
  assert.match(bad.stderr, /trebol supplier/);
  assert.match(readFileSync(cli, 'utf8'), /\/deliveries/);

  mkdirSync(join(project, 'app'));
  writeFileSync(join(project, 'app', 'app.trb'), 'view [text "hi"]');
  // check finds the UI dialect inside the bundle
  const checked = spawnSync(process.execPath, [cli, 'check'], { encoding: 'utf8', cwd: join(project, 'app') });
  assert.equal(checked.stdout, 'No problems.\n');
  assert.equal(checked.status, 0);
  // and so does test, with the words of screen tests
  writeFileSync(join(project, 'app', 'app.test.trb'), 'Trebol []\n"greeting"\n[see "hi"]\n');
  const tested = spawnSync(process.execPath, [cli, 'test'], { encoding: 'utf8', cwd: join(project, 'app') });
  assert.equal(tested.stdout, 'ok    app.test.trb:3:1  greeting\n1 test, all passed.\n');
  assert.equal(tested.status, 0);
  // build puts the bundled runtime in the page
  const built = spawnSync(process.execPath, [cli, 'build'], { encoding: 'utf8', cwd: join(project, 'app') });
  assert.equal(built.stderr, '');
  assert.match(built.stdout, /^trebol build: build\/index\.html \(\d+ KB, 1 \.trb inside\)\n$/);
  const page = readFileSync(join(project, 'app', 'build', 'index.html'), 'utf8');
  assert.ok(page.includes(readFileSync(join(pkg, 'dist', 'trebol.js'), 'utf8').slice(0, 2000)));
  const dev = spawn(process.execPath, [cli, 'dev', 'app', '--port', '0'], { cwd: project });
  try {
    const line = await new Promise<string>((ok, fail) => {
      dev.stdout.on('data', (d: Buffer) => ok(d.toString()));
      dev.on('exit', code => fail(new Error(`dev exited with ${code}`)));
    });
    const base = /http:\/\/localhost:\d+/.exec(line)![0];
    assert.match(await (await fetch(`${base}/`)).text(), /src="app.trb"/);
    const js = await fetch(`${base}/@trebol/src/host/browser.ts`);
    assert.equal(js.status, 200);
    assert.doesNotMatch(await js.text(), /import type/);
    const font = await fetch(`${base}/@trebol/src/host/fonts/inter-latin.woff2`);
    assert.equal(font.headers.get('content-type'), 'font/woff2');
  } finally {
    dev.kill();
  }
});

test('the installed package is imported from Node, with its types', async () => {
  const { project } = await installed();
  writeFileSync(join(project, 'package.json'), '{"type": "module"}');
  writeFileSync(join(project, 'main.ts'), `import { mold, load } from 'trebol/core';
import { startHost, startUi, runSource } from 'trebol/host';
const host = startHost();
await startUi(host);
const face = await runSource(host, 'select layout [field name "Name"] ' + "'pane");
const n: string = mold(load('1 + 2'));
console.log(n, mold(face).length > 0);
`);
  const run = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'main.ts'], { encoding: 'utf8', cwd: project });
  assert.equal(run.stderr, '');
  assert.equal(run.stdout, '[1 + 2] true\n');
  // a project that checks its types finds Trebol's
  writeFileSync(join(project, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true,
    types: [], lib: ['ES2022', 'DOM'],
  }, files: ['main.ts'] }));
  const tsc = spawnSync(process.execPath, [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', project], { encoding: 'utf8' });
  assert.equal(tsc.stdout + tsc.stderr, '');
});

test('the browser runtime is one module with the UI dialect inside', async () => {
  const { pkg } = await installed();
  const js = readFileSync(join(pkg, 'dist', 'trebol.js'), 'utf8');
  // the one dynamic import is the app's own: import %x.js, by an address known only when it runs
  // `from "./x.js"`, not the text "from" (a word of the machines' graph)
  assert.doesNotMatch(js, /^import\b|\bimport\s*\(\s*["'`]|\bfrom\s*["'][\w./@-]/m);
  assert.equal(js.match(/\bimport\s*\(/g)?.length, 1);
  // with Inter next to it, and next to the host of trebol/browser
  for (const dir of ['fonts', join('lib', 'host', 'fonts')]) assert.ok(existsSync(join(pkg, 'dist', dir, 'inter-latin.woff2')), dir);
  for (const name of ['ui.trb', 'i18n.trb']) {
    const first = readFileSync(join(ROOT, 'src', 'ui', name), 'utf8').split('\n')[0]!;
    assert.ok(js.includes(JSON.stringify(first).slice(1, -1)), `${name} is inside`);
  }
});
