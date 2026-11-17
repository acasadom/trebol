// `trebol dev`: serves an app folder for the browser and reloads pages when
// a file changes. TypeScript is served as JavaScript by stripping its types
// on the fly (the code is erasable-only), so there is no build step.
//
// Trebol's own files are served under /@trebol/, and every HTML page gets an
// import map from the package exports, so a page loads Trebol by name:
//
//   <script type="module">import 'trebol/browser';</script>
//
// A folder with an app.trb and no index.html is served as that app, so an app
// needs no HTML at all. A file under /node_modules/ that the folder does not have is
// looked for in the node_modules of the folders above it, as Node would find a package.
//
// An app can bring its own backend: `api` names a module whose `handleApi`
// answers requests, and whose `handleUpgrade`, if it has one, takes the
// requests to open a WebSocket (see examples/api.ts).

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import type { Duplex } from 'node:stream';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync, watch, type FSWatcher } from 'node:fs';
import { dirname, join, extname, normalize, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

/** Answers a request; returns false to let the dev server serve files. */
export type ApiHandler = (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<boolean>;

/** Takes a request to open a WebSocket; returns false to refuse it. */
export type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer, url: URL) => boolean;

export interface DevOptions {
  /** Folder served as the site root (default: the current directory). */
  root?: string;
  /** Port to listen on; 0 picks a free one (default 5173). */
  port?: number;
  /** Path of a module exporting `handleApi` and maybe `handleUpgrade` (see ApiHandler, UpgradeHandler). */
  api?: string;
}

export interface Dev {
  readonly server: Server;
  readonly port: number;
  close(): Promise<void>;
}

/** The Trebol package folder: the one holding this file's tools/. */
const TREBOL = normalize(join(import.meta.dirname, '..'));
const PREFIX = '/@trebol/';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.trb': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/** The page of a folder that has an app.trb and no index.html. */
const APP_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trebol</title>
<script type="module">import 'trebol/browser';</script>
<script type="text/trebol" src="app.trb"></script>
</head>
<body></body>
</html>
`;

// Only the top page listens: a browser keeps at most six connections open to a server, so a page with
// frames (the documentation's live examples) would leave the last ones waiting. Reloading the top page
// reloads its frames too.
const RELOAD = `<script>if (window === top) new EventSource('/__reload').onmessage = () => location.reload();</script>`;

/** Tells the browser host it runs under trebol dev, and the folder it serves (for links to the source). */
const devMark = (root: string): string => `<meta name="trebol-dev" content="${root.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`;

/** `trebol/x` for every export of the package, pointing under /@trebol/ to its source, which is served stripped. */
function importMap(): string {
  const pkg = JSON.parse(readFileSync(join(TREBOL, 'package.json'), 'utf8')) as { exports: Record<string, { source: string }> };
  const imports: Record<string, string> = {};
  for (const [name, paths] of Object.entries(pkg.exports)) {
    imports[`trebol${name.slice(1)}`] = PREFIX + paths.source.slice(2);
  }
  return `<script type="importmap">${JSON.stringify({ imports })}</script>`;
}

/** Joins a URL path to a folder; null when it would leave the folder. */
function inside(dir: string, urlPath: string): string | null {
  const path = normalize(join(dir, urlPath));
  return path === dir || path.startsWith(dir.endsWith(sep) ? dir : dir + sep) ? path : null;
}

/** A path of node_modules/ in a folder above `root` (the nearest that has it), or null. */
async function above(root: string, urlPath: string): Promise<string | null> {
  for (let dir = dirname(root); ; dir = dirname(dir)) {
    const path = inside(join(dir, 'node_modules'), urlPath.slice('/node_modules'.length));
    if (path !== null && await stat(path).catch(() => null)) return path;
    if (dirname(dir) === dir) return null;
  }
}

/** Starts the dev server; resolves once it listens. */
export async function startDev(options: DevOptions = {}): Promise<Dev> {
  const root = normalize(resolve(options.root ?? '.'));
  const mod = options.api !== undefined
    ? (await import(pathToFileURL(resolve(options.api)).href)) as { handleApi: ApiHandler; handleUpgrade?: UpgradeHandler }
    : null;
  const api = mod?.handleApi ?? null;
  const upgrade = mod?.handleUpgrade ?? null;
  const map = importMap();
  const mark = devMark(root);
  const clients = new Set<ServerResponse>();
  // only what a page asked for can change that page: a database in the folder cannot
  const asked = new Set<string>();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/__reload') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (api !== null && await api(req, res, url)) return;
    const name = decodeURIComponent(url.pathname);
    let path = name.startsWith(PREFIX) ? inside(TREBOL, name.slice(PREFIX.length)) : inside(root, name);
    // import 'name looks for node_modules/name/ going up: the folder's own, or one of a folder above it
    if (path !== null && name.startsWith('/node_modules/') && !(await stat(path).catch(() => null))) path = await above(root, name) ?? path;
    if (path === null) {
      res.writeHead(403).end();
      return;
    }
    asked.add(path);
    let page: string | null = null;
    try {
      if ((await stat(path)).isDirectory()) {
        // relative URLs in the page (src="app.trb") need the trailing slash
        if (!url.pathname.endsWith('/')) {
          res.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
          return;
        }
        const app = join(path, 'app.trb');
        path = join(path, 'index.html');
        asked.add(path);
        if (!(await stat(path).catch(() => null)) && await stat(app).catch(() => null)) page = APP_PAGE;
      }
      let body: string | Buffer = page ?? await readFile(path);
      const ext = extname(path);
      if (ext === '.ts') body = stripTypeScriptTypes(body.toString(), { mode: 'strip' });
      if (ext === '.html') {
        // the import map must come before any module script; the mark has the page show its errors
        body = body.toString().replace(/<head[^>]*>/i, h => h + map + mark);
        // ?static leaves out live reload (headless screenshots wait for the page to go idle)
        if (!url.searchParams.has('static')) body = body.replace('</body>', `${RELOAD}</body>`);
      }
      res.writeHead(200, { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end(`not found: ${url.pathname}`);
    }
  });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (upgrade === null || !upgrade(req, socket, head, new URL(req.url ?? '/', 'http://x'))) socket.destroy();
  });
  // open WebSockets and event streams of the API would keep close() waiting
  const sockets = new Set<Socket>();
  server.on('connection', s => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });

  let pending: NodeJS.Timeout | null = null;
  const reload = (file: string | null): void => {
    if (file !== null && !asked.has(join(root, file))) return;
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      for (const c of clients) c.write('data: reload\n\n');
    }, 50);
  };
  const watchers: FSWatcher[] = [watch(root, { recursive: true }, (_, f) => reload(f))];
  if (!root.startsWith(TREBOL + sep) && root !== TREBOL) {
    watchers.push(watch(join(TREBOL, 'src'), { recursive: true }, () => reload(null)));
  }

  await new Promise<void>(r => server.listen(options.port ?? 5173, r));
  return {
    server,
    port: (server.address() as import('node:net').AddressInfo).port,
    close: () => {
      for (const w of watchers) w.close();
      for (const c of clients) c.end();
      for (const s of sockets) s.destroy();
      return new Promise<void>(r => server.close(() => r()));
    },
  };
}
