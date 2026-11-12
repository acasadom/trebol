// Host tests: tasks, timers and the network against a local server.
// Includes the phase 2 gate: a fetch inside parse does not block the host.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import type { Duplex } from 'node:stream';
import { K, spell, mold, form, errorField, native, value, type ObjectCell } from '../src/core/index.ts';
import { fileHandle, saver, dispositionName } from '../src/host/net.ts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { startHost, startUi, runSource, output } from '../src/host/index.ts';
import { consoleHost } from '../tools/console.ts';

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
        req.on('end', () => json(200, { method: req.method, type: req.headers['content-type'] ?? '', body, auth: req.headers['authorization'] ?? '', query: url.search }));
        return;
      }
      case '/report': {
        // a POST answered with a file, as a report is
        const name = url.searchParams.get('name');
        const head: Record<string, string> = { 'content-type': 'application/pdf' };
        if (name === 'accents') head['content-disposition'] = `attachment; filename="informe.pdf"; filename*=UTF-8''${encodeURIComponent('Año fiscal.pdf')}`;
        if (name === 'plain') head['content-disposition'] = 'attachment; filename="march \\"A\\".pdf"';
        if (name === 'refused') {
          json(403, { error: 'not allowed' });
          return;
        }
        res.writeHead(200, head);
        res.end(Buffer.from('%PDF-1.7'));
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

  test('now: whole seconds unless /precise, and one part with a refinement', async () => {
    assert.equal(await ev('t: now/time t = round t'), 'true');
    assert.equal(await ev('d: now all [d/date = now/date d/year = now/year 1 <= now/weekday 7 >= now/weekday]'), 'true');
    assert.equal(await ev('d: now/utc d/zone'), '0:00');
    assert.equal(await ev('d: now/date none? d/time'), 'true');
  });

  test('help explains a function from its spec; ?? and source print a word', async () => {
    lines.length = 0;
    await ev('tax: func ["Adds the tax." amount [money!] "Before tax" /rate pct [percent!] return: [money!]] [amount] help tax');
    assert.deepEqual(lines, [
      'USAGE:', '    TAX amount', '',
      'DESCRIPTION:', '    Adds the tax.', '    TAX is a function! value.', '',
      'ARGUMENTS:', '    amount -- Before tax (money!)', '',
      'REFINEMENTS:', '    /rate', '        pct (percent!)', '',
      'RETURNS:', '    money!',
    ]);
    lines.length = 0;
    await ev('help +  b: [1 2] help b  help nothing-here  ?? b  f: func [x] [x * 2] source f  source add');
    assert.deepEqual(lines.slice(0, 2), ['USAGE:', '    a + b']);
    assert.deepEqual(lines.slice(-5), [
      'B is a block! of value: [1 2]', 'NOTHING-HERE has no value.', 'b: [1 2]',
      'f: func [x] [x * 2]', 'add: native ["The sum of two values." a [number! money! time! pair! date!] b [number! money! time! pair! date!]]',
    ]);
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

  test('files the user chose: read-file and multipart', async () => {
    native('test-file', '["A file handle for the tests." ]', () => value(fileHandle(new File(['hello'], 'note.txt', { type: 'text/plain' }))));
    assert.equal(await ev('to string! read-file test-file'), '"hello"');
    const r = await ev(`f: test-file  r: fetch/with base/echo [multipart: reduce ['doc f 'title "Notes"]] reduce [r/type r/body]`);
    assert.match(r, /multipart\/form-data/);
    assert.match(r, /name="doc"; filename="note.txt"[^]*hello[^]*name="title"[^]*Notes/);
    assert.equal(await evErr('read-file none'), 'expect-arg');
  });

  test('to-csv/language writes dates and amounts as the language does', async () => {
    const rows = '[#(id: 12345 due: 11-Nov-2026 at: 11-Nov-2026/9:30 total: EUR$1250.5 rate: 1.5)]';
    assert.equal(await ev(`to-csv/language ${rows} 'es`), '{id;due;at;total;rate\n12345;11/11/2026;11/11/2026 9:30;1250,50\u00a0€;1,5\n}');
    assert.equal(await ev(`to-csv/language ${rows} "en-GB"`), '{id,due,at,total,rate\n12345,11/11/2026,11/11/2026 9:30,"€1,250.50",1.5\n}');
    assert.equal(await ev(`to-csv/language/with ${rows} 'es #"|"`), '{id|due|at|total|rate\n12345|11/11/2026|11/11/2026 9:30|1250,50\u00a0€|1,5\n}');
    assert.equal(await ev(`to-csv/language [["a" 1]] 'es`), '{a;1\n}');
  });

  test('download hands the browser a file', async () => {
    const saved: Array<[string, Blob]> = [];
    const save = saver.save;
    saver.save = (name, blob) => saved.push([name, blob]) > 0;
    try {
      assert.equal(await ev('download %out/clients.csv to-csv [["Name"] ["Ávila"]]'), '%out/clients.csv');
      assert.equal(await ev('download "logo.png" #{89504E47}'), '"logo.png"');
      assert.equal(saved[0]![0], 'clients.csv');
      assert.equal(saved[0]![1].type, 'text/csv;charset=utf-8');
      // a byte order mark first, so spreadsheets read the accent
      assert.deepEqual([...new Uint8Array(await saved[0]![1].arrayBuffer())].slice(0, 3), [0xef, 0xbb, 0xbf]);
      // text() drops the mark
      assert.equal(await saved[0]![1].text(), 'Name\nÁvila\n');
      assert.equal(saved[1]![1].type, 'image/png');
      assert.equal(saved[1]![1].size, 4);
      assert.equal(await evErr('download "" "x"'), 'bad-file');
    } finally {
      saver.save = save;
    }
    assert.equal(await evErr('download %a.txt "x"'), 'no-download');
  });

  test('download saves an answer of the server under the name it gives', async () => {
    const saved: Array<[string, Blob]> = [];
    const save = saver.save;
    saver.save = (name, blob) => saved.push([name, blob]) > 0;
    const post = (q: string) => `fetch/with join base/report "?name=${q}" [method: 'post body: #(year: 2026) full: true]`;
    try {
      assert.equal(await ev(`download %informe.pdf ${post('accents')}`), '%Año%20fiscal.pdf');
      assert.equal(saved[0]![0], 'Año fiscal.pdf');
      assert.equal(saved[0]![1].type, 'application/pdf');
      assert.equal(await saved[0]![1].text(), '%PDF-1.7');
      assert.equal(await ev(`download "x.pdf" ${post('plain')}`), '{march "A".pdf}');
      // no name from the server: the one given
      assert.equal(await ev(`download %out/informe.pdf ${post('none')}`), '%out/informe.pdf');
      assert.equal(saved[2]![0], 'informe.pdf');
      assert.equal(await evErr(`download %x.pdf ${post('refused')}`), 'http');
      assert.equal(saved.length, 3);
      assert.equal(await evErr('download %x.pdf make object! [a: 1]'), 'bad-answer');
    } finally {
      saver.save = save;
    }
  });

  test('content-disposition names', () => {
    assert.equal(dispositionName(`attachment; filename*=UTF-8''%C3%B1u.pdf; filename="nu.pdf"`), 'ñu.pdf');
    assert.equal(dispositionName(`attachment; filename*=iso-8859-1'es'%F1u.pdf`), 'ñu.pdf');
    assert.equal(dispositionName('attachment; filename=plain.csv'), 'plain.csv');
    assert.equal(dispositionName('inline'), '');
  });

  test('query adds names and values to the URL', async () => {
    assert.equal(await ev('r: fetch/with base/echo [query: #(q: "café ñ" page: 2)] r/query'), '"?q=caf%C3%A9%20%C3%B1&page=2"');
    assert.equal(await ev('r: fetch/with join base/echo "?a=1#top" [query: [b 2]] r/query'), '"?a=1&b=2"');
    assert.equal(await ev('r: fetch/with base/echo [query: #()] r/query'), '""');
    assert.equal(await evErr('fetch/with base/echo [query: [1 2]]'), 'bad-query');
  });

  test('form posts', async () => {
    assert.equal(await ev('r: fetch/with base/echo [form: [a 1 b "x y"]] r/body'), '"a=1&b=x+y"');
  });

  test('HTTP errors, timeouts and cancellation are catchable errors', async () => {
    assert.equal(await evErr('fetch base/missing'), 'http');
    assert.equal(await evErr('fetch/with base/never [timeout: 0.05]'), 'timeout');
    assert.equal(await ev('t: spawn [fetch base/never] wait 0.02 cancel t e: try [wait t] e/id'), 'cancelled');
    assert.equal(await ev('r: fetch/with base/missing [full: true] r/status'), '404');
    assert.equal(await evErr('fetch/with base/missing [full: false]'), 'http');
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
    await assert.rejects(runSource(host, 'import %missing.trb', 'x.trb'), (e: ObjectCell) => form(errorField(e, 'id')) === 'cannot-open');
  });

  test('export marks words in the module body, as R3', async () => {
    const host = fsHost();
    const v = await runSource(host, 'm: import %marked.trb reduce [double 2 triple 2 m/hidden value? \'hidden words-of m]', 'x.trb');
    assert.equal(mold(v), '[4 6 7 false [double triple hidden]]');
  });

  test('do runs a script file each time; a module is imported', async () => {
    const host = fsHost();
    const v = await runSource(host, 'a: do %script.trb b: do %script.trb m: do %marked.trb reduce [a b greeting same? m import %marked.trb]', 'x.trb');
    assert.equal(mold(v), '[10 20 "hello" true]');
    await assert.rejects(runSource(host, 'do %nothere.trb', 'x.trb'), (e: ObjectCell) => form(errorField(e, 'id')) === 'cannot-open');
  });

  test('read gives the text of a file, load its values without the header', async () => {
    const host = fsHost();
    assert.equal(mold(await runSource(host, 'copy/part read %script.trb 6', 'x.trb')), '"Trebol"');
    assert.equal(mold(await runSource(host, 'first load %script.trb', 'x.trb')), 'runs:');
    assert.equal(mold(await runSource(host, 'reduce [load {Trebol [title: "x"] 1 2} do "Trebol [] 5"]', 'x.trb')), '[[1 2] 5]');
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

test('every function of the library says what it does, for help and the reference', async () => {
  const host = consoleHost();
  await startUi(host);
  const names: string[] = [];
  for (const ctx of [host.rt.lib, host.rt.user]) {
    ctx.keys.forEach((k, i) => {
      const t = ctx.vals[i]!.t;
      if ((t === K.Function || t === K.Native) && /^[a-z]/.test(spell(k))) names.push(spell(k));
    });
  }
  const missing = await runSource(host, `collect [foreach w [${[...new Set(names)].map(n => `'${n}`).join(' ')}] [
    unless string? first spec-of get w [keep w]
  ]]`);
  assert.equal(mold(missing), '[]');
});
