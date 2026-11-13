// The parts supplier of the language tutorial (docs/language/12-tasks-and-network.md):
// a small JSON API on http://localhost:8089, started with `trebol supplier`.
//
//   GET  /parts           every part: name, price, stock
//   GET  /parts/:name     one part; 404 for a part the supplier does not sell
//   POST /orders          takes {"parts": [...]} and answers when it will arrive
//   GET  /deliveries      server-sent events: the day's delivery, step by step
//   /desk                 a WebSocket: {"ask": "bell"} answers {"part": "bell", "stock": 12}
//
// Every answer takes a moment, as a real supplier's would, so the tutorial
// can show tasks waiting at the same time. Nothing is kept between requests:
// the answers are always the same, which the documentation tests rely on.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { WebSocketServer } from 'ws';

export const SUPPLIER_PORT = 8089;
const DELAY_MS = 300;

const parts = [
  { part: 'chain', price: 11.5, stock: 40 },
  { part: 'tyre', price: 16, stock: 0 },
  { part: 'bell', price: 3.25, stock: 12 },
  { part: 'brake-pad', price: 6.8, stock: 25 },
];

function send(res: ServerResponse, status: number, body: unknown): void {
  setTimeout(() => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  }, DELAY_MS);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

async function answer(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname.replace(/\/$/, '');
  if (req.method === 'GET' && path === '/parts') return send(res, 200, parts);
  const m = /^\/parts\/([^/]+)$/.exec(path);
  if (req.method === 'GET' && m !== null) {
    const p = parts.find(x => x.part === decodeURIComponent(m[1]!));
    return p === undefined ? send(res, 404, { error: 'No such part' }) : send(res, 200, p);
  }
  if (req.method === 'POST' && path === '/orders') {
    const body = await readJson(req);
    const wanted = (body as { parts?: unknown } | null)?.parts;
    if (!Array.isArray(wanted) || wanted.length === 0) return send(res, 422, { error: 'An order needs parts' });
    return send(res, 200, { accepted: true, lines: wanted.length, days: 2 });
  }
  if (req.method === 'GET' && path === '/deliveries') return deliveries(res);
  send(res, 404, { error: 'No such resource' });
}

/** The day's delivery, step by step, as server-sent events; then the stream ends. */
function deliveries(res: ServerResponse): void {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const steps = ['packed', 'on the road', 'delivered'];
  steps.forEach((step, i) => setTimeout(() => {
    res.write(`data: ${JSON.stringify({ step })}\n\n`);
    if (i === steps.length - 1) res.end();
  }, (i + 1) * 100));
}

/** The order desk, over a WebSocket: {"ask": "bell"} is answered with that part's stock. */
const desk = new WebSocketServer({ noServer: true });
desk.on('connection', ws => {
  ws.on('message', raw => {
    let ask: unknown = null;
    try {
      ask = (JSON.parse(raw.toString()) as { ask?: unknown }).ask;
    } catch { /* not JSON: answered as an unknown part */ }
    const p = parts.find(x => x.part === ask);
    setTimeout(() => ws.send(JSON.stringify(p === undefined
      ? { error: 'No such part' }
      : { part: p.part, stock: p.stock })), DELAY_MS);
  });
});

/** Starts the supplier; resolves once it listens. */
export function startSupplier(port = SUPPLIER_PORT): Promise<Server> {
  const server = createServer((req, res) => void answer(req, res));
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/desk') return void socket.destroy();
    desk.handleUpgrade(req, socket, head, ws => desk.emit('connection', ws, req));
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
}
