// The dev server: an app folder as the root, Trebol by name, the app's API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize } from 'node:path';
import { startDev, loopback } from '../tools/dev.ts';

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
    // a frame never listens for reloads: frames would use up the browser's six connections to the server
    assert.match(page, /if \(window === top\) new EventSource\('\/__reload'\)/);
    // the browser host shows errors and its dev tools only under trebol dev; the folder makes links to the source
    assert.ok(page.includes(`<meta name="trebol-dev" content="${normalize(app)}">`));
    assert.equal(await (await fetch(`${base}/app.trb`)).text(), 'view [title "Hi"]');
    assert.equal((await fetch(`${base}/empty/`)).status, 404);
  } finally {
    await dev.close();
  }
});

test('the page of an app takes its title, description and icon from the header, as a built page does', async () => {
  const app = mkdtempSync(join(tmpdir(), 'trebol-app-'));
  writeFileSync(join(app, 'app.trb'), 'Trebol [title: "Shop" description: "Bikes & parts" icon: %icon.svg]\nview [title "Hi"]');
  const dev = await startDev({ root: app, port: 0 });
  try {
    const page = await (await fetch(`http://localhost:${dev.port}/`)).text();
    assert.match(page, /<title>Shop<\/title>/);
    assert.match(page, /<meta name="description" content="Bikes &amp; parts">/);
    assert.match(page, /<link rel="icon" href="icon.svg" type="image\/svg\+xml">/);
  } finally {
    await dev.close();
  }
});

test('node_modules missing from the folder is looked for in the folders above it', async () => {
  const top = mkdtempSync(join(tmpdir(), 'trebol-work-'));
  const app = join(top, 'apps', 'shop');
  mkdirSync(app, { recursive: true });
  mkdirSync(join(top, 'node_modules', 'trebol-x'), { recursive: true });
  mkdirSync(join(app, 'node_modules', 'own'), { recursive: true });
  writeFileSync(join(top, 'node_modules', 'trebol-x', 'package.json'), '{"trebol": "x.trb"}');
  writeFileSync(join(app, 'node_modules', 'own', 'package.json'), '{"trebol": "own.trb"}');
  writeFileSync(join(app, 'app.trb'), "import 'trebol-x");
  const dev = await startDev({ root: app, port: 0 });
  const base = `http://localhost:${dev.port}`;
  try {
    assert.equal(await (await fetch(`${base}/node_modules/trebol-x/package.json`)).text(), '{"trebol": "x.trb"}');
    assert.equal(await (await fetch(`${base}/node_modules/own/package.json`)).text(), '{"trebol": "own.trb"}');
    assert.equal((await fetch(`${base}/node_modules/nope/package.json`)).status, 404);
    assert.equal((await fetch(`${base}/node_modules/../../secret`)).status, 404);
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

test('the API can take WebSockets, and its open streams do not keep the server from closing', async () => {
  const dev = await startDev({ root: mkdtempSync(join(tmpdir(), 'trebol-app-')), port: 0, api: join(import.meta.dirname, '..', 'examples', 'api.ts') });
  const base = `localhost:${dev.port}`;
  const events = await fetch(`http://${base}/api/activity`);
  const reader = events.body!.getReader();
  const next = async (): Promise<unknown> => JSON.parse(new TextDecoder().decode((await reader.read()).value).replace(/^data: /, ''));
  assert.deepEqual(await next(), { online: 0, note: null });
  const open = (name: string): Promise<WebSocket> => new Promise((ok, fail) => {
    const ws = new WebSocket(`ws://${base}/api/chat?name=${name}`);
    ws.onopen = () => ok(ws);
    ws.onerror = () => fail(new Error('cannot open'));
  });
  const ana = await open('Ana');
  assert.deepEqual(await next(), { online: 1, note: 'Ana joined' });
  const luis = await open('Luis');
  assert.deepEqual(await next(), { online: 2, note: 'Luis joined' });
  const heard = new Promise<string>(ok => { luis.onmessage = ev => ok(String(ev.data)); });
  ana.send(JSON.stringify({ text: ' hola ' }));
  assert.deepEqual(JSON.parse(await heard), { name: 'Ana', text: 'hola' });
  const refused = new WebSocket(`ws://${base}/elsewhere`);
  await new Promise(ok => { refused.onerror = ok; });
  await dev.close();
});

test('only this machine reaches the dev server unless it is opened', async () => {
  for (const a of ['::1', '127.0.0.1', '::ffff:127.0.0.1']) assert.ok(loopback(a), a);
  for (const a of ['192.168.1.20', '::ffff:10.0.0.2', 'fe80::1', undefined]) assert.ok(!loopback(a), String(a));
});
