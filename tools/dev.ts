// `trebol dev`: serves the repository for the browser and reloads pages
// when a file changes. TypeScript is served as JavaScript by stripping its
// types on the fly (the code is erasable-only), so there is no build step.
//
//   npm run dev                      then open http://localhost:5173/examples/signup/
//   npm run dev -- --port 8080
//
// It also serves a small in-memory REST API under /api (see api.ts).

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { handleApi } from './api.ts';

const root = normalize(join(import.meta.dirname, '..'));
const portArg = process.argv.indexOf('--port');
const port = portArg > 0 ? Number(process.argv[portArg + 1]) : 5173;

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
const clients = new Set<import('node:http').ServerResponse>();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/__reload') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (await handleApi(req, res, url.pathname)) return;
  let path = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!path.startsWith(root)) {
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
    // ?static leaves out live reload (headless screenshots wait for the page to go idle)
    if (ext === '.html' && !url.searchParams.has('static')) body = body.toString().replace('</body>', `${RELOAD}</body>`);
    res.writeHead(200, { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end(`not found: ${url.pathname}`);
  }
});

let pending: NodeJS.Timeout | null = null;
for (const dir of ['src', 'examples']) {
  watch(join(root, dir), { recursive: true }, () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      for (const c of clients) c.write('data: reload\n\n');
    }, 50);
  });
}

server.listen(port, () => console.log(`trebol dev: http://localhost:${port}/examples/`));
