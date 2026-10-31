// The in-memory REST API that `npm run dev` serves for the examples.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { handleApi } from '../tools/api.ts';

test('clients can be listed, added, updated and deleted', async () => {
  const server = createServer((req, res) => {
    void handleApi(req, res, new URL(req.url ?? '/', 'http://x').pathname).then(ok => {
      if (!ok) res.writeHead(404).end();
    });
  });
  await new Promise<void>(r => server.listen(0, r));
  const base = `http://localhost:${(server.address() as AddressInfo).port}/api/clients`;
  const json = { 'content-type': 'application/json' };
  try {
    const before = await (await fetch(base)).json() as Array<{ id: number }>;
    const added = await fetch(base, { method: 'POST', headers: json, body: JSON.stringify({ name: 'Alan', email: 'alan@x.io' }) });
    assert.equal(added.status, 201);
    const { id } = await added.json() as { id: number };
    const bad = await fetch(base, { method: 'POST', headers: json, body: JSON.stringify({ name: 'No email' }) });
    assert.equal(bad.status, 422);
    assert.match(((await bad.json()) as { error: string }).error, /email/);
    const put = await fetch(`${base}/${id}`, { method: 'PUT', headers: json, body: JSON.stringify({ name: 'Alan T', email: 'alan@x.io' }) });
    assert.equal(((await put.json()) as { name: string }).name, 'Alan T');
    assert.equal((await fetch(`${base}/${id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(`${base}/${id}`)).status, 404);
    const after = await (await fetch(base)).json() as unknown[];
    assert.equal(after.length, before.length);
    assert.equal((await fetch(base.replace('clients', 'nope'))).status, 404);
  } finally {
    server.close();
  }
});
