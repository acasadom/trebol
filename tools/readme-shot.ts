// The picture under the first example of README.md, taken from that very example: the code is built as an
// app, opened in headless Chromium (Playwright) and photographed. Run it after changing the example:
// `npm run readme-shot`. Needs Chromium: `npx playwright install chromium`.

import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { buildApp } from './bundle.ts';

const ROOT = new URL('..', import.meta.url).pathname;
export const SHOT = 'docs/screenshots/readme-example.png';

const readme = await readFile(join(ROOT, 'README.md'), 'utf8');
const code = /```rebol\n([\s\S]*?)```/.exec(readme)?.[1];
if (code === undefined) throw new Error('README.md has no ```rebol example');

const dir = await mkdtemp(join(tmpdir(), 'trebol-shot-'));
try {
  const src = join(dir, 'src');
  await mkdir(src, { recursive: true });
  await writeFile(join(src, 'app.trb'), `Trebol [title: "Example"]\n\n${code}`);
  await buildApp(src, join(dir, 'site'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 340 }, deviceScaleFactor: 2, colorScheme: 'light' });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    // the page as built, not through the development server, which adds its tools to it
    await page.goto(`file://${join(dir, 'site', 'index.html')}`);
    await page.getByLabel('Customer').fill('Ada Lovelace');
    await page.getByLabel('Price').fill('45.50');
    await page.getByRole('heading').click();
    await page.waitForLoadState('networkidle');
    if (errors.length > 0) throw new Error(errors.join('\n'));
    await page.screenshot({ path: join(ROOT, SHOT) });
    console.log(`wrote ${SHOT}`);
  } finally {
    await browser.close();
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
