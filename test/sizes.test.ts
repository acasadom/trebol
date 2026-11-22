import { test } from 'node:test';
import assert from 'node:assert/strict';

// A ResizeObserver that only records what it watches, as the browser's does not run in Node.
const observed = new Set<object>();
let notify: ((entries: { target: object }[]) => void) | null = null;
(globalThis as Record<string, unknown>).ResizeObserver = class {
  constructor(cb: (entries: { target: object }[]) => void) { notify = cb; }
  observe(n: object) { observed.add(n); }
  unobserve(n: object) { observed.delete(n); }
};

const { watchSize, sweepSizes, watchedSizes, unwatchSize } = await import('../src/host/browser/sizes.ts');

const node = (on: boolean) => ({ isConnected: on }) as unknown as Element & { isConnected: boolean };

test('a node that leaves the page is let go at the next sweep', () => {
  const a = node(true);
  let calls = 0;
  watchSize(a, () => calls++);
  notify!([{ target: a }]);
  assert.equal(calls, 1);
  (a as { isConnected: boolean }).isConnected = false;
  sweepSizes();
  assert.equal(observed.has(a), false);
  assert.equal(watchedSizes(), 0);
});

test('a node watched before it is on the page is kept until it gets there', () => {
  const b = node(false);
  watchSize(b, () => {});
  sweepSizes();
  assert.equal(observed.has(b), true);
  (b as { isConnected: boolean }).isConnected = true;
  sweepSizes();
  (b as { isConnected: boolean }).isConnected = false;
  sweepSizes(n => n === b);
  assert.equal(observed.has(b), true, 'one set aside to be shown later stays');
  sweepSizes();
  assert.equal(observed.has(b), false);
});

test('a node off the page is not told its size', () => {
  const c = node(true);
  let calls = 0;
  watchSize(c, () => calls++);
  (c as { isConnected: boolean }).isConnected = false;
  notify!([{ target: c }]);
  assert.equal(calls, 0);
  unwatchSize(c);
  assert.equal(watchedSizes(), 0);
});
