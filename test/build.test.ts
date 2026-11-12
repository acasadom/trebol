// The built package (tools/build.ts): installed under node_modules, where Node
// runs no TypeScript, the `trebol` command still runs scripts and serves apps,
// and the browser runtime is one file with the UI dialect inside.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

  mkdirSync(join(project, 'app'));
  writeFileSync(join(project, 'app', 'app.trb'), 'view [text "hi"]');
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
  } finally {
    dev.kill();
  }
});

test('the browser runtime is one module with the UI dialect inside', async () => {
  const { pkg } = await installed();
  const js = readFileSync(join(pkg, 'dist', 'trebol.js'), 'utf8');
  assert.doesNotMatch(js, /^import\b|\bimport\s*\(|\bfrom\s*["']/m);
  for (const name of ['ui.trb', 'i18n.trb']) {
    const first = readFileSync(join(ROOT, 'src', 'ui', name), 'utf8').split('\n')[0]!;
    assert.ok(js.includes(JSON.stringify(first).slice(1, -1)), `${name} is inside`);
  }
});
