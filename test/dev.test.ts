// The dev server: an app folder as the root, Trebol by name, the app's API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
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
