// Contrast of what is really drawn: every look in both modes, in headless Chromium.
//
// The palette test (test/ui.test.ts) checks pairs of roles. A skin paints more than roles: gradients, mixes of
// two roles, faces of its own. Here the gallery (examples/gallery, every component) is built once per look and
// shown light and dark; every piece of text that can be read is measured against the pixels drawn under it,
// with the text itself made transparent. Each must reach WCAG AA 1.4.3: 4.5:1, or 3:1 for large text.
// Disabled controls are exempt, as WCAG says.

import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import { buildApp } from '../../tools/bundle.ts';
import { startDev, type Dev } from '../../tools/dev.ts';
import { LOOKS } from '../../src/host/theme.ts';

const GALLERY = new URL('../../examples/gallery/', import.meta.url);

let dir = '';
let dev: Dev;
let browser: Browser;
let base = '';

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'trebol-contrast-'));
  const app = await readFile(new URL('app.trb', GALLERY), 'utf8');
  for (const look of Object.keys(LOOKS)) {
    const src = join(dir, 'src', look);
    await cp(GALLERY.pathname, src, { recursive: true });
    await writeFile(join(src, 'app.trb'), app.replace("look: 'minimal", `look: '${look}`) + '\nretheme\n');
    await buildApp(src, join(dir, 'site', look));
  }
  dev = await startDev({ root: join(dir, 'site'), port: 0 });
  base = `http://localhost:${dev.port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await dev?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

interface Piece { text: string; where: string; x: number; y: number; w: number; h: number; rgba: number[]; large: boolean }

/** Every piece of readable text under `scope`, with its box and its color as sRGB. Then hides all text. */
const collect = (scope: string): Piece[] => {
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const rgba = (css: string): number[] => {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = css;
    probe.fillRect(0, 0, 1, 1);
    return Array.from(probe.getImageData(0, 0, 1, 1).data);
  };
  const where = (e: Element): string => {
    const parts: string[] = [];
    for (let n: Element | null = e; n !== null && parts.length < 3; n = n.parentElement) {
      const cls = Array.from(n.classList).filter(c => c.startsWith('tb-')).slice(0, 2).join('.');
      parts.unshift(n.tagName.toLowerCase() + (cls ? '.' + cls : ''));
    }
    return parts.join(' > ');
  };
  const readable = (e: Element): boolean => {
    if (e.closest('svg, canvas, [inert], [aria-hidden="true"], :disabled, [aria-disabled="true"]') !== null) return false;
    for (let n: Element | null = e; n !== null; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
    }
    return true;
  };
  const pieces: Piece[] = [];
  // what an ancestor clips away is not seen: keep the part of the box inside every clipping ancestor
  const visible = (e: Element, r: DOMRect): DOMRect | null => {
    let [x0, y0, x1, y1] = [r.left, r.top, r.right, r.bottom];
    for (let n: Element | null = e; n !== null; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.clipPath !== 'none') return null;
      if (n !== e && (s.overflowX !== 'visible' || s.overflowY !== 'visible')) {
        const c = n.getBoundingClientRect();
        [x0, y0, x1, y1] = [Math.max(x0, c.left), Math.max(y0, c.top), Math.min(x1, c.right), Math.min(y1, c.bottom)];
      }
    }
    return x1 - x0 >= 2 && y1 - y0 >= 2 ? new DOMRect(x0, y0, x1 - x0, y1 - y0) : null;
  };
  const add = (e: Element, text: string, box: DOMRect): void => {
    const r = visible(e, box);
    if (r === null || r.width < 2 || r.height < 2 || text.trim() === '') return;
    const s = getComputedStyle(e);
    const color = rgba(s.color);
    // text drawn transparent is not shown (cupertino's close dot shows its × only on hover)
    if (color[3] === 0) return;
    const size = parseFloat(s.fontSize);
    const bold = Number(s.fontWeight) >= 700;
    pieces.push({
      text: text.trim().slice(0, 30), where: where(e),
      x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height,
      rgba: color, large: size >= 24 || (bold && size >= 18.66),
    });
  };
  const roots = Array.from(document.querySelectorAll(scope));
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t !== null; t = walker.nextNode()) {
      const e = t.parentElement;
      if (e === null || ['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION'].includes(e.tagName) || !readable(e)) continue;
      const range = document.createRange();
      range.selectNodeContents(t);
      for (const r of Array.from(range.getClientRects())) add(e, t.textContent ?? '', r);
    }
  }
  for (const e of roots.flatMap(root => Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')))) {
    if (!readable(e) || ['checkbox', 'radio', 'range', 'color', 'file', 'hidden'].includes(e.type)) continue;
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    const pl = parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth);
    const pt = parseFloat(s.paddingTop) + parseFloat(s.borderTopWidth);
    const inner = new DOMRect(r.left + pl, r.top + pt, r.width - pl - parseFloat(s.paddingRight) - parseFloat(s.borderRightWidth),
      r.height - pt - parseFloat(s.paddingBottom) - parseFloat(s.borderBottomWidth));
    add(e, e.value, inner);
  }
  const hide = document.createElement('style');
  hide.id = 'tb-contrast-hide';
  hide.textContent = '*, *::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; text-decoration-color: transparent !important; }';
  document.head.append(hide);
  return pieces;
};

/** For each piece, the worst contrast of its color over the pixels under it (the screenshot with no text). */
const measure = async ([png, pieces]: [string, Piece[]]): Promise<number[]> => {
  const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
  const ctx = new OffscreenCanvas(img.width, img.height).getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const lin = (v: number): number => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (r: number, g: number, b: number): number => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return pieces.map(p => {
    const x = Math.max(0, Math.round(p.x)), y = Math.max(0, Math.round(p.y));
    const w = Math.min(img.width - x, Math.round(p.w)), h = Math.min(img.height - y, Math.round(p.h));
    if (w <= 0 || h <= 0) return 21;
    const d = ctx.getImageData(x, y, w, h).data;
    const [fr, fg, fb, fa] = p.rgba;
    const a = fa / 255;
    let worst = 21;
    for (let i = 0; i < d.length; i += 4) {
      // the text over this pixel, as it is drawn with its alpha
      const t = lum(fr * a + d[i] * (1 - a), fg * a + d[i + 1] * (1 - a), fb * a + d[i + 2] * (1 - a));
      const u = lum(d[i], d[i + 1], d[i + 2]);
      const c = (Math.max(t, u) + 0.05) / (Math.min(t, u) + 0.05);
      if (c < worst) worst = c;
    }
    return worst;
  });
};

/** What fails under `scope`: the whole page, or one popup (measured in the viewport, where it is drawn). */
async function failures(page: Page, scope = 'body'): Promise<string[]> {
  await page.evaluate(() => document.fonts.ready);
  const pieces = await page.evaluate(collect, scope);
  const png = (await page.screenshot({ fullPage: scope === 'body', animations: 'disabled' })).toString('base64');
  const worst = await page.evaluate(measure, [png, pieces] as [string, Piece[]]);
  await page.evaluate(() => document.getElementById('tb-contrast-hide')?.remove());
  const out: string[] = [];
  pieces.forEach((p, i) => {
    const need = p.large ? 3 : 4.5;
    if (worst[i] < need) out.push(`${worst[i].toFixed(2)} < ${need} "${p.text}" ${scope === 'body' ? '' : `(${scope}) `}${p.where}`);
  });
  return [...new Set(out)];
}

for (const look of Object.keys(LOOKS)) {
  for (const scheme of ['light', 'dark']) {
    test(`every text of the gallery reads in the ${look} look, ${scheme}`, async () => {
      const page = await browser.newPage({ colorScheme: scheme as 'light' | 'dark', reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(`${base}/${look}/`);
      await page.getByText('Every component of the UI dialect, with no HTML or CSS.').waitFor({ timeout: 10000 });
      await page.waitForTimeout(300);
      const bad = await failures(page);
      // what only shows when asked for: a menu, a dialog, a confirmation, a toast
      const shown = async (button: string, scope: string): Promise<void> => {
        await page.getByRole('button', { name: button, exact: true }).first().click();
        await page.locator(scope).first().waitFor({ state: 'visible', timeout: 5000 });
        await page.waitForTimeout(300);
        bad.push(...await failures(page, scope));
        await page.keyboard.press('Escape');
        await page.locator(scope).first().waitFor({ state: 'hidden', timeout: 5000 });
      };
      await shown('Look', '.tb-menu');
      await shown('Dialog', 'dialog.tb-dialog[open]');
      await shown('Confirm', 'dialog.tb-dialog[open]');
      await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
      await page.locator('.tb-toast').first().waitFor({ state: 'visible', timeout: 5000 });
      await page.waitForTimeout(300);
      bad.push(...await failures(page, '.tb-toast'));
      await page.close();
      assert.deepEqual(errors, []);
      assert.deepEqual(bad, []);
    });
  }
}
