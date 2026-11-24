// Built apps in a real browser (headless Chromium, through Playwright): `npm run test:browser`.
//
// Each case is a screen fixture of test/fixtures/screens, built with `trebol build` as one page and
// served by `trebol dev` with a slow backend (api.ts), so answers come while reactions run or wait, as
// in production. The screen runner checks the same apps with instant answers; this checks the browser
// host: its scheduler, its fetches and its drawing. Any console error or uncaught exception fails.
//
// Needs Chromium: `npx playwright install chromium`.

import assert from 'node:assert/strict';
import { copyFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import { buildApp } from '../../tools/bundle.ts';
import { startDev, type Dev } from '../../tools/dev.ts';

const FIXTURES = new URL('../fixtures/screens/', import.meta.url);
const APPS = ['cached-timeline', 'cached-own', 'cached-other'];

let dir = '';
let dev: Dev;
let browser: Browser;
let base = '';

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'trebol-browser-'));
  for (const app of APPS) {
    const src = join(dir, 'src', app);
    await mkdir(src, { recursive: true });
    await copyFile(new URL(`${app}.trb`, FIXTURES), join(src, 'app.trb'));
    await buildApp(src, join(dir, 'site', app));
  }
  dev = await startDev({ root: join(dir, 'site'), port: 0, api: new URL('api.ts', import.meta.url).pathname });
  base = `http://localhost:${dev.port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await dev?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

/** Opens a built app with the request counts cleared; `errors` collects what the page reports. */
async function open(app: string): Promise<{ page: Page; errors: string[] }> {
  await fetch(`${base}/api/reset`);
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${base}/${app}/`);
  return { page, errors };
}

/** Waits until some text of the page (shadow roots too) is exactly `text`. */
const see = (page: Page, text: string): Promise<void> =>
  page.getByText(text, { exact: true }).first().waitFor({ timeout: 5000 });

/** How many times the app asked for `path` once it is quiet: the same count 2 s apart, or a loop. */
async function settled(path: string): Promise<number> {
  const count = async (): Promise<number> =>
    ((await (await fetch(`${base}/api/stats`)).json()) as Record<string, number>)[path] ?? 0;
  await new Promise(r => setTimeout(r, 1500));
  const a = await count();
  await new Promise(r => setTimeout(r, 2000));
  const b = await count();
  assert.equal(b, a, `${path} still asked: ${a} then ${b}`);
  return b;
}

test('an answer of cached that comes while a timeline is built is shown', async () => {
  const { page, errors } = await open('cached-timeline');
  await see(page, 'hello');
  await see(page, 'other 7');
  assert.deepEqual(errors, []);
  await page.close();
});

test('a reaction that asks again for what it reads ends', async () => {
  const { page, errors } = await open('cached-own');
  await see(page, 'count 1');
  assert.equal(await settled('/api/count'), 2);
  await page.getByRole('button', { name: 'Again' }).click();
  await see(page, 'count 3');
  assert.equal(await settled('/api/count'), 4);
  assert.deepEqual(errors, []);
  await page.close();
});

test('an answer another task asks for while a reaction waits is not lost', async () => {
  const { page, errors } = await open('cached-other');
  await see(page, 'b 1 0');
  await page.getByRole('button', { name: 'Go' }).click();
  await see(page, 'b 2 1');
  assert.equal(await settled('/api/b'), 2);
  assert.deepEqual(errors, []);
  await page.close();
});
