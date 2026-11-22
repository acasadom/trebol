// A box that scrolls with nothing focusable inside takes tabindex 0, so the keyboard can scroll it,
// and gives it back once it fits or holds something focusable. Plain objects stand in for the page.

import { test } from 'node:test';
import assert from 'node:assert/strict';

(globalThis as Record<string, unknown>).getComputedStyle = (n: Box) => ({ overflowX: n.overflow, overflowY: 'visible' });

const { markScrollers } = await import('../src/host/browser/scrollers.ts');

class Box {
  attrs = new Map<string, string>();
  overflow = 'auto';
  scrollWidth = 100;
  clientWidth = 100;
  focusable = false;
  hasAttribute(k: string) { return this.attrs.has(k); }
  setAttribute(k: string, v: string) { this.attrs.set(k, v); }
  removeAttribute(k: string) { this.attrs.delete(k); }
  set tabIndex(v: number) { this.attrs.set('tabindex', String(v)); }
  querySelector() { return this.focusable ? {} : null; }
}

const page = (...boxes: Box[]) => ({ querySelectorAll: () => boxes }) as unknown as ParentNode;

test('a box that scrolls takes focus while it scrolls', () => {
  const code = new Box();
  markScrollers(page(code));
  assert.equal(code.hasAttribute('tabindex'), false, 'it fits: no tab stop');
  code.scrollWidth = 300;
  markScrollers(page(code));
  assert.equal(code.attrs.get('tabindex'), '0');
  code.scrollWidth = 100;
  markScrollers(page(code));
  assert.equal(code.hasAttribute('tabindex'), false, 'it fits again');
});

test('a box with something focusable inside, one that does not scroll, or one with its own tabindex is left alone', () => {
  const table = new Box();
  table.scrollWidth = 300;
  table.focusable = true;
  const hidden = new Box();
  hidden.scrollWidth = 300;
  hidden.overflow = 'hidden';
  const own = new Box();
  own.scrollWidth = 300;
  own.attrs.set('tabindex', '-1');
  markScrollers(page(table, hidden, own));
  assert.equal(table.hasAttribute('tabindex'), false);
  assert.equal(hidden.hasAttribute('tabindex'), false);
  assert.equal(own.attrs.get('tabindex'), '-1');
  own.scrollWidth = 100;
  markScrollers(page(own));
  assert.equal(own.attrs.get('tabindex'), '-1', 'a tabindex not set here is never taken away');
  table.focusable = false;
  markScrollers(page(table));
  assert.equal(table.attrs.get('tabindex'), '0', 'its focusable content went away');
});
