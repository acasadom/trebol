// A small in-memory REST API for the examples, served under /api by
// `npm run dev` (`trebol dev --api examples/api.ts`), so the
// examples can create, read, update and delete records end to end:
//
//   GET    /api/clients          the list
//   POST   /api/clients          adds one; answers it with its new id
//   PUT    /api/clients/:id      replaces one
//   DELETE /api/clients/:id      removes one
//
// Records need a name and an email; anything else answers 422 with a
// message. The data lives only as long as the server.
//
// The live example's chat and its events are in live/server.ts.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleLive } from './live/server.ts';

export { handleUpgrade } from './live/server.ts';

interface Client { id: number; name: string; email: string; phone: string; kind: string }

const clients: Client[] = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@analytical.co', phone: '+44 20 7946 0001', kind: 'Person' },
  { id: 2, name: 'Babbage & Sons', email: 'office@babbage.co', phone: '+44 20 7946 0002', kind: 'Company' },
  { id: 3, name: 'Grace Hopper', email: 'grace@cobol.dev', phone: '+1 202 555 0103', kind: 'Person' },
  { id: 4, name: 'Northwind Traders', email: 'hello@northwind.example', phone: '', kind: 'Company' },
];
let nextId = clients.length + 1;

function send(res: ServerResponse, status: number, body?: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  try {
    const v: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Checks a body and returns the client it describes, or a message. */
function clientFrom(body: Record<string, unknown> | null, id: number): Client | string {
  if (body === null) return 'The body must be a JSON object';
  const s = (k: string): string => (typeof body[k] === 'string' ? (body[k] as string).trim() : '');
  if (s('name') === '') return 'A client needs a name';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s('email'))) return 'A client needs a valid email';
  return { id, name: s('name'), email: s('email'), phone: s('phone'), kind: s('kind') || 'Person' };
}

/** Answers a request under /api; returns false when the path is not an API path. */
export async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  if (handleLive(req, res, url)) return true;
  const path = url.pathname;
  const m = /^\/api\/clients(?:\/(\d+))?\/?$/.exec(path);
  if (m === null) {
    if (!path.startsWith('/api/')) return false;
    send(res, 404, { error: 'No such resource' });
    return true;
  }
  const id = m[1] !== undefined ? Number(m[1]) : null;
  const at = id === null ? -1 : clients.findIndex(c => c.id === id);
  const method = req.method ?? 'GET';
  if (id === null) {
    if (method === 'GET') return send(res, 200, clients), true;
    if (method === 'POST') {
      const c = clientFrom(await readJson(req), nextId);
      if (typeof c === 'string') return send(res, 422, { error: c }), true;
      nextId++;
      clients.push(c);
      return send(res, 201, c), true;
    }
  } else {
    if (at < 0) return send(res, 404, { error: 'No such client' }), true;
    if (method === 'GET') return send(res, 200, clients[at]), true;
    if (method === 'PUT') {
      const c = clientFrom(await readJson(req), id);
      if (typeof c === 'string') return send(res, 422, { error: c }), true;
      clients[at] = c;
      return send(res, 200, c), true;
    }
    if (method === 'DELETE') {
      clients.splice(at, 1);
      return send(res, 204), true;
    }
  }
  send(res, 405, { error: `${method} is not allowed here` });
  return true;
}
