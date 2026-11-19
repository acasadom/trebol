// A grid with resize: the dialect takes the flag; the browser draws a handle between columns
// (checked in Chrome: it needs a laid-out page), and the theme hides none of it on wide screens.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { form, mold, errorField, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { themeCss, DEFAULT_THEME } from '../src/host/theme.ts';

let host: Host;
beforeEach(async () => {
  host = startHost({ onError: () => {}, loader: { base: 'file:///', read: href => readFile(fileURLToPath(href), 'utf8') } });
  await startUi(host);
});

async function ev(src: string): Promise<string> {
  try {
    return mold(await runSource(host, src));
  } catch (e) {
    return `error: ${form(errorField(e as ObjectCell, 'message'))}`;
  }
}

test('a grid takes resize, with its columns by count or by weight; other faces do not', async () => {
  assert.equal(await ev(`f: first get in layout [grid [small 1] resize []] 'pane  reduce [f/resize f/cols]`), '[true [small 1]]');
  assert.equal(await ev(`f: first get in layout [grid 3 resize []] 'pane  reduce [f/resize f/cols]`), '[true 3]');
  assert.equal(await ev(`f: first get in layout [grid 2 []] 'pane  f/resize`), 'none');
  assert.equal(await ev(`e: try [layout [row resize []]]  find/tail e/message "layout: "`), '"resize is not a word of row"');
});

test('the handles of a grid sit in its gaps, above its columns, and show when used', () => {
  const css = themeCss(DEFAULT_THEME);
  assert.match(css, /\.tb-grid\.tb-resize \{ position: relative; \}/);
  assert.match(css, /\.tb-grid-handle \{\s*position: absolute;/);
  assert.match(css, /\.tb-grid-handle:focus-visible::before \{ width: 3px; background: var\(--tb-focus\); \}/);
});
