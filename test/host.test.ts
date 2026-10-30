// Host tests: tasks, timers and the network against a local server.
// Includes the phase 2 gate: a fetch inside parse does not block the host.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import type { Duplex } from 'node:stream';
import { mold, form, errorField, type ObjectCell } from '../src/core/index.ts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { startHost, runSource, output } from '../src/host/index.ts';

let server: Server;
let base = '';
const lines: string[] = [];
output.line = text => lines.push(text);

/** Minimal WebSocket server side: handshake, then echo text frames back upper-cased. */
function upgrade(req: { headers: Record<string, string | string[] | undefined> }, socket: Duplex): void {
  const key = String(req.headers['sec-websocket-key']);
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const send = (text: string) => {
    const payload = Buffer.from(text);
    socket.write(Buffer.concat([Buffer.from([0x81, payload.length]), payload]));
  };
  send('{"hello": "world"}');
  socket.on('data', (buf: Buffer) => {
    const op = buf[0]! & 0x0f;
    if (op === 8) {
      socket.end(Buffer.from([0x88, 0]));
      return;
    }
    const len = buf[1]! & 0x7f;
    const mask = buf.subarray(2, 6);
    const data = Buffer.from(buf.subarray(6, 6 + len).map((b, i) => b ^ mask[i % 4]!));
    send(data.toString().toUpperCase());
  });
}

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url!, 'http://x');
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    switch (url.pathname) {
      case '/clients':
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('[{"id": 1853920394857203841, "name": "Ana"}, {"id": 2, "name": "Luis"}]');
        return;
      case '/slow':
        setTimeout(() => json(200, { word: url.searchParams.get('w') }), 60);
        return;
      case '/never':
        return; // never answers
      case '/missing':
        json(404, { error: 'not here' });
        return;
      case '/echo': {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => json(200, { method: req.method, type: req.headers['content-type'] ?? '', body, auth: req.headers['authorization'] ?? '' }));
        return;
      }
      case '/text':
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('plain text');
        return;
      case '/events':
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('data: {"n": 1}\n\n');
        res.write('event: note\ndata: two\n\n');
        setTimeout(() => res.end('data: 3\n\n'), 20);
        return;
    }
    res.writeHead(500);
    res.end();
  });
  server.on('upgrade', (req, socket) => upgrade(req, socket));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  base = `http://127.0.0.1:${addr.port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

async function ev(src: string): Promise<string> {
  const host = startHost({ onError: () => {} });
  const v = await runSource(host, `base: ${base}\n${src}`);
  return mold(v);
}

async function evErr(src: string): Promise<string> {
  const host = startHost({ onError: () => {} });
  try {
    const v = await runSource(host, `base: ${base}\n${src}`);
    return assert.fail(`expected an error, got ${mold(v)}`);
  } catch (e) {
    return form(errorField(e as ObjectCell, 'id'));
  }
}

describe('tasks and timers', () => {
  test('wait pauses only the task', async () => {
    assert.equal(await ev('t: spawn [wait 0.02 "late"] r: copy [] append r "early" append r wait t r'), '["early" "late"]');
  });

  test('cancel stops a waiting task', async () => {
    assert.equal(await ev('t: spawn [wait 10] cancel t e: try [wait t] e/id'), 'cancelled');
  });

  test('delay and every run blocks later', async () => {
    assert.equal(await ev('n: 0 tm: every 0.005 [n: n + 1] wait 0.06 cancel tm n > 2'), 'true');
    assert.equal(await ev('x: 1 delay 0.01 [x: 2] wait 0.03 x'), '2');
  });

  test('print goes to the host output', async () => {
    lines.length = 0;
    await ev('print ["a" 1 + 1]');
    assert.deepEqual(lines, ['a 2']);
  });
});

describe('http', () => {
  test('fetch returns JSON as maps and blocks, with exact 64-bit ids', async () => {
    assert.equal(await ev('c: fetch base/clients c/1/id'), '1853920394857203841');
    assert.equal(await ev('c: fetch base/clients c/2/name'), '"Luis"');
  });

  test('text answers come back as strings', async () => {
    assert.equal(await ev('fetch base/text'), '"plain text"');
  });

  test('fetch/with: method, JSON body and headers', async () => {
    const r = await ev(`r: fetch/with base/echo [
      method: 'post body: make map! [name "Ana"]
      headers: reduce ["Authorization" rejoin ["Bearer " "t0k"]]
    ] reduce [r/method r/type r/body r/auth]`);
    assert.equal(r, '["POST" "application/json" {{"name":"Ana"}} "Bearer t0k"]');
  });

  test('form posts', async () => {
    assert.equal(await ev('r: fetch/with base/echo [form: [a 1 b "x y"]] r/body'), '"a=1&b=x+y"');
  });

  test('HTTP errors, timeouts and cancellation are catchable errors', async () => {
    assert.equal(await evErr('fetch base/missing'), 'http');
    assert.equal(await evErr('fetch/with base/never [timeout: 0.05]'), 'timeout');
    assert.equal(await ev('t: spawn [fetch base/never] wait 0.02 cancel t e: try [wait t] e/id'), 'cancelled');
    assert.equal(await ev('r: fetch/with base/missing [full: true] r/status'), '404');
  });

  test('requests run concurrently', async () => {
    const start = Date.now();
    await ev('a: spawn [fetch base/slow] b: spawn [fetch base/slow] wait [a b]');
    assert.ok(Date.now() - start < 110, 'two 60 ms requests should overlap');
  });
});

describe('streams', () => {
  test('server-sent events', async () => {
    const r = await ev(`got: copy []
      feed: open-events base/events
      on-message feed [append/only got reduce [event value]]
      wait 0.08 close feed got`);
    assert.equal(r, '[[message #(n: 1)] [note "two"] [message "3"]]');
  });

  test('websocket: messages, send and JSON', async () => {
    const ws = base.replace('http', 'ws');
    const r = await ev(`got: copy []
      live: open-socket ${ws}/live
      on-message live [append/only got value]
      wait 0.02
      send live "ping"
      wait 0.03 close live got`);
    assert.equal(r, '[#(hello: "world") "PING"]');
  });
});

describe('modules and storage', () => {
  const fixtures = join(import.meta.dirname, 'fixtures');
  const fsHost = () => startHost({
    onError: () => {},
    loader: { base: pathToFileURL(fixtures + '/').href, read: href => readFile(fileURLToPath(href), 'utf8') },
  });

  test('import loads each file once, resolves relative paths and sets exports', async () => {
    const host = fsHost();
    const src = await readFile(join(fixtures, 'main.trb'), 'utf8');
    const v = await runSource(host, src, 'main.trb');
    assert.equal(mold(v), '[$121.00 21% 1 1]');
  });

  test('an export that is not defined is an error', async () => {
    const host = fsHost();
    await assert.rejects(runSource(host, 'import %broken.trb', 'x.trb'), (e: ObjectCell) => form(errorField(e, 'id')) === 'bad-export');
    await assert.rejects(runSource(host, 'import %missing.trb', 'x.trb'), (e: ObjectCell) => form(errorField(e, 'id')) === 'import');
  });

  test('local storage keeps values exact', async () => {
    assert.equal(await ev('save-local "k" reduce [$1.10 30-Oct-2026 #(a: 1)] load-local "k"'), '[$1.10 30-Oct-2026 #(a: 1)]');
    assert.equal(await ev('remove-local "k" load-local "k"'), 'none');
  });
});

describe('phase 2 gate', () => {
  test('a fetch inside parse does not block the host or other tasks', async () => {
    let hostTicks = 0;
    const timer = setInterval(() => hostTicks++, 5);
    const r = await ev(`
      ticks: 0
      ticker: spawn [loop 1000 [ticks: ticks + 1 wait 0.005]]
      words: copy []
      ok: parse ["uno" "dos" "tres"] [
          some [set w string! (append words select fetch rejoin [base "/slow?w=" w] 'word)]
      ]
      cancel ticker
      reduce [ok words ticks > 10]
    `);
    clearInterval(timer);
    assert.equal(r, '[true ["uno" "dos" "tres"] true]');
    assert.ok(hostTicks > 10, `host timer ticked ${hostTicks} times during the parse`);
  });
});
