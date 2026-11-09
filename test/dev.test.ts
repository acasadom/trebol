// The dev server: an app folder as the root, Trebol by name, the app's API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../tools/dev.ts';

test('an app folder loads Trebol by name and brings its own API', async () => {
  const app = mkdtempSync(join(tmpdir(), 'trebol-app-'));
  writeFileSync(join(app, 'index.html'), `<html><head><title>x</title>
<script type="module">import 'trebol/browser';</script></head><body></body></html>`);
  writeFileSync(join(app, 'api.ts'), `export async function handleApi(req: unknown, res: { end(s: string): void }, url: URL): Promise<boolean> {
  if (url.pathname !== '/api/ping') return false;
  res.end('pong');
  return true;
}`);
  const dev = await startDev({ root: app, port: 0, api: join(app, 'api.ts') });
  const base = `http://localhost:${dev.port}`;
  try {
    const page = await (await fetch(`${base}/`)).text();
    const map = /<script type="importmap">(.*?)<\/script>/.exec(page);
    assert.ok(map !== null && page.indexOf(map[0]) < page.indexOf('trebol/browser'));
    const imports = (JSON.parse(map[1]) as { imports: Record<string, string> }).imports;
    assert.equal(imports['trebol/browser'], '/@trebol/src/host/browser.ts');
    const js = await fetch(base + imports['trebol/core']);
    assert.equal(js.status, 200);
    assert.match(js.headers.get('content-type') ?? '', /javascript/);
    assert.doesNotMatch(await js.text(), /import type/);
    assert.equal(await (await fetch(`${base}/api/ping`)).text(), 'pong');
    assert.equal((await fetch(`${base}/@trebol/..%2f..%2fetc/passwd`)).status, 403);
    assert.equal((await fetch(`${base}/..%2fsecret`)).status, 403);
    assert.equal((await fetch(`${base}/nope.trb`)).status, 404);
  } finally {
    await dev.close();
  }
});

test('a folder with only an app.trb is served as that app', async () => {
  const app = mkdtempSync(join(tmpdir(), 'trebol-app-'));
  writeFileSync(join(app, 'app.trb'), 'view [title "Hi"]');
  mkdirSync(join(app, 'empty'));
  const dev = await startDev({ root: app, port: 0 });
  const base = `http://localhost:${dev.port}`;
  try {
    const page = await (await fetch(`${base}/`)).text();
    assert.match(page, /<script type="importmap">/);
    assert.match(page, /import 'trebol\/browser'/);
    assert.match(page, /<script type="text\/trebol" src="app.trb"><\/script>/);
    assert.equal(await (await fetch(`${base}/app.trb`)).text(), 'view [title "Hi"]');
    assert.equal((await fetch(`${base}/empty/`)).status, 404);
  } finally {
    await dev.close();
  }
});

test('a page reloads when a file it asked for changes, not for another one in the folder', async () => {
  const app = realpathSync(mkdtempSync(join(tmpdir(), 'trebol-app-')));
  writeFileSync(join(app, 'index.html'), '<html><head></head><body></body></html>');
  writeFileSync(join(app, 'app.trb'), 'one');
  mkdirSync(join(app, 'data'));
  const dev = await startDev({ root: app, port: 0 });
  const base = `http://localhost:${dev.port}`;
  const stream = await fetch(`${base}/__reload`);
  const reader = stream.body!.getReader();
  let reloads = 0;
  void (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      if (new TextDecoder().decode(value).includes('reload')) reloads++;
    }
  })().catch(() => {});
  const wait = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
  try {
    await (await fetch(`${base}/`)).text();
    await (await fetch(`${base}/app.trb`)).text();
    // the system may still report the files this test has just created
    await wait(1500);
    const before = reloads;
    writeFileSync(join(app, 'data', 'store.mdb'), 'written by the app');
    await wait(1000);
    assert.equal(reloads, before);
    writeFileSync(join(app, 'app.trb'), 'two');
    await wait(1000);
    assert.ok(reloads > before);
  } finally {
    await reader.cancel();
    await dev.close();
  }
});
