// `trebol dev`: serves an app folder for the browser and reloads pages when
// a file changes. TypeScript is served as JavaScript by stripping its types
// on the fly (the code is erasable-only), so there is no build step.
//
// Trebol's own files are served under /@trebol/, and every HTML page gets an
// import map from the package exports, so a page loads Trebol by name:
//
//   <script type="module">import 'trebol/browser';</script>
//
// An app can bring its own backend: `api` names a module whose `handleApi`
// answers requests (see examples/api.ts).

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync, watch, type FSWatcher } from 'node:fs';
import { join, extname, normalize, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

/** Answers a request; returns false to let the dev server serve files. */
export type ApiHandler = (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<boolean>;

export interface DevOptions {
  /** Folder served as the site root (default: the current directory). */
  root?: string;
  /** Port to listen on; 0 picks a free one (default 5173). */
  port?: number;
  /** Path of a module exporting `handleApi` (see ApiHandler). */
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

const RELOAD = `<script>new EventSource('/__reload').onmessage = () => location.reload();</script>`;

/** `trebol/x` for every export of the package, pointing under /@trebol/. */
function importMap(): string {
  const pkg = JSON.parse(readFileSync(join(TREBOL, 'package.json'), 'utf8')) as { exports: Record<string, string> };
  const imports: Record<string, string> = {};
  for (const [name, path] of Object.entries(pkg.exports)) {
    imports[`trebol${name.slice(1)}`] = PREFIX + path.slice(2);
  }
  return `<script type="importmap">${JSON.stringify({ imports })}</script>`;
}

/** Joins a URL path to a folder; null when it would leave the folder. */
function inside(dir: string, urlPath: string): string | null {
  const path = normalize(join(dir, urlPath));
  return path === dir || path.startsWith(dir.endsWith(sep) ? dir : dir + sep) ? path : null;
}

/** Starts the dev server; resolves once it listens. */
export async function startDev(options: DevOptions = {}): Promise<Dev> {
  const root = normalize(resolve(options.root ?? '.'));
  const api: ApiHandler | null = options.api !== undefined
    ? ((await import(pathToFileURL(resolve(options.api)).href)) as { handleApi: ApiHandler }).handleApi
    : null;
  const map = importMap();
  const clients = new Set<ServerResponse>();

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
    if (path === null) {
      res.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(path)).isDirectory()) {
        // relative URLs in the page (src="app.trb") need the trailing slash
        if (!url.pathname.endsWith('/')) {
          res.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
          return;
        }
        path = join(path, 'index.html');
      }
      let body: string | Buffer = await readFile(path);
      const ext = extname(path);
      if (ext === '.ts') body = stripTypeScriptTypes(body.toString(), { mode: 'strip' });
      if (ext === '.html') {
        // the import map must come before any module script
        body = body.toString().replace(/<head[^>]*>/i, h => h + map);
        // ?static leaves out live reload (headless screenshots wait for the page to go idle)
        if (!url.searchParams.has('static')) body = body.replace('</body>', `${RELOAD}</body>`);
      }
      res.writeHead(200, { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end(`not found: ${url.pathname}`);
    }
  });

  let pending: NodeJS.Timeout | null = null;
  const reload = (file: string | null): void => {
    if (file !== null && /(^|[\\/])(node_modules|\.git)([\\/]|$)/.test(file)) return;
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
      return new Promise<void>(r => server.close(() => r()));
    },
  };
}
