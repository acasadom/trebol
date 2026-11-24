// The backend of the browser tests (`trebol dev --api`): answers slowly, as a real server does, so an
// answer can come while a reaction runs or waits, and counts the requests of each path.
//
// /api/stats gives the counts, /api/reset clears them. /api/h is always {n: 7}; /api/wait waits longer;
// any other path answers {n: how many times it was asked}.

import type { IncomingMessage, ServerResponse } from 'node:http';

const counts: Record<string, number> = {};

const send = (res: ServerResponse, body: unknown): void => {
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

export async function handleApi(_req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  const path = url.pathname;
  if (!path.startsWith('/api/')) return false;
  if (path === '/api/stats') { send(res, counts); return true; }
  if (path === '/api/reset') { for (const k of Object.keys(counts)) delete counts[k]; send(res, {}); return true; }
  counts[path] = (counts[path] ?? 0) + 1;
  const n = counts[path];
  await sleep(path === '/api/wait' ? 150 : 80);
  send(res, path === '/api/h' ? { n: 7 } : { n });
  return true;
}
