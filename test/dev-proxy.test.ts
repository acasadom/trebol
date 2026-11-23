// trebol dev --proxy: paths under a prefix go to another server, answers and
// event streams come back as they arrive, WebSockets are joined through.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev } from '../tools/dev.ts';
import { parseProxy, proxyFor, type Proxy } from '../tools/dev-proxy.ts';

const proxy = (text: string): Proxy => {
  const p = parseProxy(text);
  if (typeof p === 'string') throw new Error(p);
  return p;
};

/** A backend of its own: echoes requests, streams events on demand, echoes WebSocket text frames. */
async function backend(): Promise<{ server: Server; port: number; more: () => void }> {
  let more = (): void => {};
  const server = createServer((req, res) => {
    if (req.url === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      res.write('data: one\n\n');
      more = () => res.end('data: two\n\n');
      return;
    }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      res.writeHead(201, { 'content-type': 'application/json', 'set-cookie': 'session=abc; Path=/' });
      res.end(JSON.stringify({ method: req.method, url: req.url, host: req.headers.host, forwarded: req.headers['x-forwarded-host'], body }));
    });
  });
  server.on('upgrade', (req, socket) => {
    const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.on('data', (frame: Buffer) => {
      // one small masked text frame from the browser: unmask it and send it back, upper-cased
      if ((frame[0] & 0x0f) !== 1) return;
      const length = frame[1] & 0x7f;
      const mask = frame.subarray(2, 6);
      const text = Buffer.from(frame.subarray(6, 6 + length).map((b, i) => b ^ mask[i % 4])).toString().toUpperCase();
      socket.write(Buffer.concat([Buffer.from([0x81, text.length]), Buffer.from(text)]));
    });
  });
  await new Promise<void>(r => server.listen(0, r));
  return { server, port: (server.address() as import('node:net').AddressInfo).port, more: () => more() };
}

test('--proxy reads /prefix=url and says what is wrong otherwise', () => {
  const p = proxy('/api/=http://localhost:8080');
  assert.equal(p.prefix, '/api');
  assert.equal(p.target.href, 'http://localhost:8080/');
  assert.match(parseProxy('api=http://x') as string, /wants \/prefix=/);
  assert.match(parseProxy('/api') as string, /wants \/prefix=/);
  assert.match(parseProxy('/api=localhost:8080') as string, /must be http/);
  assert.match(parseProxy('/api=nothing') as string, /not a URL/);
});

test('a path goes to the longest prefix it falls under, and only on a whole segment', () => {
  const all = [proxy('/api=http://a'), proxy('/api/admin=http://b')];
  assert.equal(proxyFor(all, '/api')?.target.host, 'a');
  assert.equal(proxyFor(all, '/api/users')?.target.host, 'a');
  assert.equal(proxyFor(all, '/api/admin/x')?.target.host, 'b');
  assert.equal(proxyFor(all, '/apis'), null);
  assert.equal(proxyFor(all, '/'), null);
});

test('requests under a prefix go to the other server with their path, body and query; the rest are files', async () => {
  const back = await backend();
  const dev = await startDev({ root: mkdtempSync(join(tmpdir(), 'trebol-app-')), port: 0, proxy: [proxy(`/api=http://localhost:${back.port}`)] });
  try {
    const base = `http://localhost:${dev.port}`;
    const res = await fetch(`${base}/api/users?page=2`, { method: 'POST', body: 'name=Ana' });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('set-cookie'), 'session=abc; Path=/');
    assert.deepEqual(await res.json(), {
      method: 'POST', url: '/api/users?page=2', host: `localhost:${back.port}`, forwarded: `localhost:${dev.port}`, body: 'name=Ana',
    });
    assert.equal((await fetch(`${base}/apis`)).status, 404);
  } finally {
    await dev.close();
    back.server.close();
  }
});

test('an event stream through the proxy delivers each event as it is sent', async () => {
  const back = await backend();
  const dev = await startDev({ root: mkdtempSync(join(tmpdir(), 'trebol-app-')), port: 0, proxy: [proxy(`/api=http://localhost:${back.port}`)] });
  try {
    const res = await fetch(`http://localhost:${dev.port}/api/events`);
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    const reader = res.body!.getReader();
    // the first event arrives while the backend still holds the second
    assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: one\n\n');
    back.more();
    assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: two\n\n');
    assert.ok((await reader.read()).done);
  } finally {
    await dev.close();
    back.server.close();
  }
});

test('a WebSocket under a prefix is joined to the other server', async () => {
  const back = await backend();
  const dev = await startDev({ root: mkdtempSync(join(tmpdir(), 'trebol-app-')), port: 0, proxy: [proxy(`/api=http://localhost:${back.port}`)] });
  try {
    const ws = new WebSocket(`ws://localhost:${dev.port}/api/chat`);
    await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
    const heard = new Promise<string>(ok => { ws.onmessage = ev => ok(String(ev.data)); });
    ws.send('hola');
    assert.equal(await heard, 'HOLA');
    ws.close();
  } finally {
    await dev.close();
    back.server.close();
  }
});

test('when the other server is not there the page reads why', async () => {
  const back = await backend();
  const port = back.port;
  await new Promise(r => back.server.close(r));
  const dev = await startDev({ root: mkdtempSync(join(tmpdir(), 'trebol-app-')), port: 0, proxy: [proxy(`/api=http://localhost:${port}`)] });
  try {
    const res = await fetch(`http://localhost:${dev.port}/api/users`);
    assert.equal(res.status, 502);
    assert.match(await res.text(), new RegExp(`cannot reach http://localhost:${port} for /api \\(ECONNREFUSED\\)`));
    const ws = new WebSocket(`ws://localhost:${dev.port}/api/chat`);
    await new Promise(ok => { ws.onerror = ok; });
  } finally {
    await dev.close();
  }
});
