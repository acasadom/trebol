// A small heading: the size of the text around it, one level under the headings around it (theme/layout.ts, sync.ts).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LAYOUT } from '../src/host/theme/layout.ts';

describe('a small heading', () => {
  test('is the size of the text around it, still strong, over any skin', () => {
    assert.match(LAYOUT, /\.tb-heading\.tb-small \{ font-family: inherit; font-size: 13px; line-height: 1\.4; letter-spacing: 0; \}/);
  });

  test('is one level under the headings around it for a screen reader', async () => {
    const sync = await readFile(new URL('../src/host/browser/sync.ts', import.meta.url), 'utf8');
    assert.match(sync, /style === 'heading'[\s\S]{0,80}word\(f, 'size'\) === 'small'\) m\.el\.setAttribute\('aria-level', '3'\)/);
  });
});
