// A device shows a screen of another size at that size, made smaller to fit: its screen is the
// width the narrow rules go by. The dialect gives it its size; the browser lays it out.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { form, mold, errorField, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { themeCss, DEFAULT_THEME, type Skin } from '../src/host/theme.ts';

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

test('a device takes the size of its screen, or phone, tablet or desktop, and holds faces', async () => {
  assert.equal(await ev(`f: first get in layout [device [text "a"]] 'pane  reduce [f/screen length? f/pane]`), '[390x844 1]');
  assert.equal(await ev(`f: first get in layout [device tablet [text "a"]] 'pane  f/screen`), '834x1112');
  assert.equal(await ev(`f: first get in layout [device desktop []] 'pane  f/screen`), '1280x800');
  assert.equal(await ev(`f: first get in layout [device 360x740 []] 'pane  f/screen`), '360x740');
});

test('a screen too small or too large for a device is a problem of the layout', async () => {
  assert.equal(await ev(`e: try [layout [device 10x10 []]]  find/tail e/message "layout: "`), '"device does not take 10x10"');
  assert.equal(await ev(`e: try [layout [device watch []]]  find/tail e/message "layout: "`), '"watch is not a word of device; did you mean with?"');
});

test('the narrow rules of every skin go by the width of the screen a face is on, not the window', () => {
  for (const skin of ['modern', 'classic', 'cupertino', 'fusion', 'fluent'] as Skin[]) {
    const css = themeCss({ ...DEFAULT_THEME, skin });
    assert.doesNotMatch(css, /@media \((max|min)-width/, skin);
    assert.match(css, /body \{ container: tb-screen \/ inline-size; \}/, skin);
    assert.match(css, /\.tb-device-screen \{\s*container: tb-screen \/ inline-size;/, skin);
  }
});

test('the hidden label of joined buttons stays inside them, so a panel that scrolls holds it', () => {
  const css = themeCss(DEFAULT_THEME);
  assert.match(css, /\.tb-segmented \{ position: relative; \}/);
  assert.match(css, /\.tb-segmented > \.tb-label \{ position: absolute; top: 0; left: 0;/);
});
