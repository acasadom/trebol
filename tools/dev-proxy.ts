// `trebol dev --proxy /api=http://localhost:8080`: requests whose path starts
// with a prefix go to another server, so an app written against a backend of
// its own (in any language) runs under trebol dev on one origin, as it will
// once published behind the same site. The path is kept as the browser wrote
// it: /api/users goes to http://localhost:8080/api/users. Answers come back
// as they arrive, so event streams flow, and WebSockets under the prefix are
// joined to the other server too.

import { request as httpRequest, type IncomingMessage, type ServerResponse, type ClientRequest, type RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { Duplex } from 'node:stream';

/** One forwarded prefix: paths equal to it or under it go to `target`. */
export interface Proxy {
  readonly prefix: string;
  readonly target: URL;
}

/** Reads `/prefix=http://host:port`; gives a message when it is not one. */
export function parseProxy(text: string): Proxy | string {
  const at = text.indexOf('=');
  const prefix = at < 0 ? '' : text.slice(0, at).replace(/\/+$/, '');
  if (at < 0 || !text.startsWith('/') || prefix === '') return `--proxy wants /prefix=http://host:port, not ${text}`;
  let target: URL;
  try {
    target = new URL(text.slice(at + 1));
  } catch {
    return `--proxy ${prefix}: not a URL: ${text.slice(at + 1)}`;
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return `--proxy ${prefix}: the server must be http:// or https://, not ${target.protocol}`;
  return { prefix, target };
}

/** The proxy whose prefix a path falls under (the longest, when prefixes nest), or null. */
export function proxyFor(proxies: readonly Proxy[], path: string): Proxy | null {
  let best: Proxy | null = null;
  for (const p of proxies) {
    const under = path === p.prefix || path.startsWith(p.prefix + '/') || path.startsWith(p.prefix + '?');
    if (under && (best === null || p.prefix.length > best.prefix.length)) best = p;
  }
  return best;
}

/** The request to the other server: same method, path and headers, its own Host, and where it came from. */
function outgoing(p: Proxy, req: IncomingMessage): RequestOptions {
  const headers = { ...req.headers };
  const host = req.headers.host;
  headers.host = p.target.host;
  if (host !== undefined) headers['x-forwarded-host'] = host;
  headers['x-forwarded-proto'] = 'http';
  const from = req.socket.remoteAddress;
  if (from !== undefined) headers['x-forwarded-for'] = headers['x-forwarded-for'] ? `${headers['x-forwarded-for']}, ${from}` : from;
  return {
    protocol: p.target.protocol,
    hostname: p.target.hostname,
    port: p.target.port,
    method: req.method,
    path: p.target.pathname.replace(/\/+$/, '') + (req.url ?? '/'),
    headers,
  };
}

const send = (p: Proxy, options: RequestOptions): ClientRequest =>
  (p.target.protocol === 'https:' ? httpsRequest : httpRequest)(options);

/** What the page reads when the other server is not there. */
const unreachable = (p: Proxy, err: Error): string =>
  `trebol dev: cannot reach ${p.target.origin} for ${p.prefix} (${(err as NodeJS.ErrnoException).code ?? err.message})\n`;

/** Forwards a request and streams the answer back as it comes. */
export function forward(p: Proxy, req: IncomingMessage, res: ServerResponse): void {
  const out = send(p, outgoing(p, req));
  out.on('response', answer => {
    res.writeHead(answer.statusCode ?? 502, answer.statusMessage, answer.rawHeaders);
    // an event stream is read as it comes: send each piece at once
    res.flushHeaders();
    answer.pipe(res);
    // the page went away (an event stream closed): stop listening to the other server
    res.on('close', () => answer.destroy());
  });
  out.on('error', err => {
    // the answer had begun: it can only be cut short
    if (res.headersSent) res.destroy();
    else res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' }).end(unreachable(p, err));
  });
  req.pipe(out);
}

/** Joins a WebSocket the page opens under the prefix to the other server; refuses it when that server does. */
export function forwardUpgrade(p: Proxy, req: IncomingMessage, socket: Duplex, head: Buffer): void {
  const out = send(p, outgoing(p, req));
  out.on('upgrade', (answer, upstream, upstreamHead) => {
    const lines = [`HTTP/1.1 ${answer.statusCode} ${answer.statusMessage}`];
    for (let i = 0; i < answer.rawHeaders.length; i += 2) lines.push(`${answer.rawHeaders[i]}: ${answer.rawHeaders[i + 1]}`);
    socket.write(lines.join('\r\n') + '\r\n\r\n');
    if (upstreamHead.length > 0) socket.write(upstreamHead);
    if (head.length > 0) upstream.write(head);
    upstream.pipe(socket).pipe(upstream);
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
    upstream.on('close', () => socket.destroy());
    socket.on('close', () => upstream.destroy());
  });
  // the other server answered without taking the WebSocket: pass its answer on
  out.on('response', answer => {
    const lines = [`HTTP/1.1 ${answer.statusCode} ${answer.statusMessage}`];
    for (let i = 0; i < answer.rawHeaders.length; i += 2) lines.push(`${answer.rawHeaders[i]}: ${answer.rawHeaders[i + 1]}`);
    socket.write(lines.join('\r\n') + '\r\nconnection: close\r\n\r\n');
    answer.pipe(socket);
  });
  out.on('error', () => socket.destroy());
  socket.on('error', () => out.destroy());
  out.end();
}
