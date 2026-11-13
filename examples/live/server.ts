// The server of the live example: a chat over a WebSocket, and who is in it
// over server-sent events. examples/api.ts hands it its paths.
//
//   GET /api/chat?name=Ana     a WebSocket: each message sent, as JSON
//                              {"text": "..."}, goes to everyone as
//                              {"name": "Ana", "text": "..."}
//   GET /api/activity          server-sent events: {"online": 2, "note": "Ana joined"}
//                              when someone joins or leaves, and the count on connecting
//
// A WebSocket is two-way, so it carries the talk; server-sent events go one
// way only, from the server, which is all a notice needs.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';

const chat = new WebSocketServer({ noServer: true });
const watchers = new Set<ServerResponse>();

function notify(note: string | null): void {
  const data = `data: ${JSON.stringify({ online: chat.clients.size, note })}\n\n`;
  for (const w of watchers) w.write(data);
}

chat.on('connection', (ws: WebSocket, name: string) => {
  notify(`${name} joined`);
  ws.on('message', raw => {
    let text = '';
    try {
      const m: unknown = JSON.parse(raw.toString());
      if (typeof m === 'object' && m !== null && typeof (m as { text?: unknown }).text === 'string') {
        text = (m as { text: string }).text.trim();
      }
    } catch {
      return;
    }
    if (text === '') return;
    const said = JSON.stringify({ name, text });
    for (const c of chat.clients) c.send(said);
  });
  ws.on('close', () => notify(`${name} left`));
});

/** Answers GET /api/activity; returns false for any other path. */
export function handleLive(req: IncomingMessage, res: ServerResponse, url: URL): boolean {
  if (url.pathname !== '/api/activity') return false;
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  res.write(`data: ${JSON.stringify({ online: chat.clients.size, note: null })}\n\n`);
  watchers.add(res);
  req.on('close', () => watchers.delete(res));
  return true;
}

/** Takes the request to open /api/chat as a WebSocket; returns false for any other path. */
export function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, url: URL): boolean {
  if (url.pathname !== '/api/chat') return false;
  const name = (url.searchParams.get('name') ?? '').trim() || 'Someone';
  chat.handleUpgrade(req, socket, head, ws => chat.emit('connection', ws, name));
  return true;
}
