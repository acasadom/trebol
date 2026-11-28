// A `trebol build --csp` app under a strict Content-Security-Policy, in headless Chromium.
//
// test/csp.test.ts reads the host's source for what a policy blocks, and test/bundle.test.ts checks the built
// page has nothing inline. Here the gallery (examples/gallery, every component) is built with --csp and served
// with the policy docs/strict-csp.md gives. The browser reports every blocked script, style, font or image as a
// securitypolicyviolation event; any of them fails, as does any error. The same page built without --csp must
// be blocked, or the policy would not be checked at all.

import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import { buildApp } from '../../tools/bundle.ts';

const GALLERY = new URL('../../examples/gallery/', import.meta.url);
const POLICY = "default-src 'self'; img-src 'self' data: blob:";
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.txt': 'text/plain',
};

let dir = '';
let server: Server;
let browser: Browser;
let base = '';

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'trebol-csp-'));
  const src = join(dir, 'src');
  await cp(GALLERY.pathname, src, { recursive: true });
  await buildApp(src, join(dir, 'site', 'strict'), { csp: true });
  await buildApp(src, join(dir, 'site', 'single'));
  const site = join(dir, 'site');
  server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    const file = normalize(join(site, path.endsWith('/') ? path + 'index.html' : path));
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'content-security-policy': POLICY });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>(ok => server.listen(0, ok));
  base = `http://localhost:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await new Promise(ok => server ? server.close(ok) : ok(undefined));
  if (dir) await rm(dir, { recursive: true, force: true });
});

/** Opens a build with every policy violation and page error collected from the first byte on. */
async function open(build: string): Promise<{ page: Page; blocked: () => Promise<string[]>; errors: string[] }> {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { tbBlocked: string[] }).tbBlocked = seen;
    document.addEventListener('securitypolicyviolation', e =>
      seen.push(`${e.effectiveDirective} ${e.blockedURI || '(inline)'} ${e.sourceFile}:${e.lineNumber}`));
  });
  await page.goto(`${base}/${build}/`);
  const blocked = (): Promise<string[]> => page.evaluate(() => [...(window as unknown as { tbBlocked: string[] }).tbBlocked]);
  return { page, blocked, errors };
}

test('a --csp build runs under a strict policy: nothing blocked, fonts loaded, menus and dialogs open', async () => {
  const { page, blocked, errors } = await open('strict');
  await page.getByText('Every component of the UI dialect, with no HTML or CSS.').waitFor({ timeout: 10000 });
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family);
  });
  assert.ok(fonts.some(f => /inter/i.test(f)), `the Inter font loads from fonts/: ${fonts.join(', ')}`);
  // what the host draws while the app runs: a menu, a dialog, a confirmation, a toast
  for (const [button, scope] of [['Look', '.tb-menu'], ['Dialog', 'dialog.tb-dialog[open]'], ['Confirm', 'dialog.tb-dialog[open]']]) {
    await page.getByRole('button', { name: button, exact: true }).first().click();
    await page.locator(scope!).first().waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.locator(scope!).first().waitFor({ state: 'hidden', timeout: 5000 });
  }
  await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
  await page.locator('.tb-toast').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(500);
  assert.deepEqual(await blocked(), []);
  assert.deepEqual(errors, []);
  await page.close();
});

test('the same app built as one page is blocked by that policy, so the check above means something', async () => {
  const { page, blocked } = await open('single');
  await page.waitForTimeout(1000);
  const what = await blocked();
  assert.ok(what.some(w => w.startsWith('script-src')), `the inline runtime is blocked: ${what.join('; ')}`);
  await page.close();
});
