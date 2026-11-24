// The order and keys of a table's rows are kept while nothing they come from changes, and made again
// on any change that could move a row or change its key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRuntime, doSource, intern, form, type Cell } from '../src/core/index.ts';
import { rowOrder, ID, type RowOrder } from '../src/host/row-order.ts';

const rt = makeRuntime();
const run = (src: string): Cell => {
  const r = doSource(rt, src);
  if (r.k !== 'done') assert.fail(`${src}: ${r.k}`);
  return r.v;
};
const NAME = { sym: intern('name'), desc: false };
const order = (prev: RowOrder | null, data: Cell, by: { sym: ReturnType<typeof intern>; desc: boolean } | null = NAME, language = 'en'): RowOrder =>
  rowOrder(prev, data, by, language, ID, form);
/** The ids of the rows in their order; a head or foot of a group by its place. */
const ids = (o: RowOrder): string => o.items.map(it => it.k.slice(it.k.indexOf(':') + 1)).join(' ');

/** Rows made fresh, then sorted by name: the order and the order again after `change`. */
function after(rows: string, change: string): { first: RowOrder; next: RowOrder } {
  run(`rows: ${rows}`);
  const first = order(null, run('rows'));
  run(change);
  return { first, next: order(first, run('rows')) };
}

test('rows that have not changed keep their order and keys', () => {
  const data = run('rows: reduce [#(id: 1 name: "b") #(id: 2 name: "a") make object! [id: 3 name: "c"]]');
  const first = order(null, data);
  assert.equal(ids(first), '2 1 3');
  assert.equal(order(first, run('rows')), first);
  // unsorted, the keys too
  const plain = order(null, data, null);
  assert.equal(order(plain, run('rows'), null), plain);
});

test('any change that could move a row or change its key makes the order again', () => {
  const maps = 'reduce [#(id: 1 name: "b") #(id: 2 name: "a")]';
  const cases: [string, string, string][] = [
    [maps, 'append rows #(id: 3 name: "0")', '3 2 1'],
    [maps, 'rows/1/name: "0"', '1 2'],
    [maps, 'rows/2/id: 7', '7 1'],
    [maps, 'remove rows', '2'],
    [maps, 'reverse rows', '2 1'],
    ['reduce [make object! [id: 1 name: "b"] make object! [id: 2 name: "a"]]', 'rows/2/name: "c"', '1 2'],
    ['reduce [make object! [id: 1 name: "b"] make object! [id: 2 name: "a"]]', 'rows/1/id: 5', '2 5'],
    // a text changed in place: the same cell, a new version of its series
    [maps, 'insert rows/2/name "c"', '1 2'],
  ];
  for (const [rows, change, want] of cases) {
    const { first, next } = after(rows, change);
    assert.notEqual(next, first, change);
    assert.equal(ids(next), want, change);
  }
});

test('another order, language or key makes the order again', () => {
  const data = run('rows: reduce [#(id: 1 name: "b" code: 2) #(id: 2 name: "a" code: 1)]');
  const first = order(null, data);
  assert.notEqual(order(first, data, { sym: intern('name'), desc: true }), first);
  assert.notEqual(order(first, data, { sym: intern('id'), desc: false }), first);
  assert.notEqual(order(first, data, NAME, 'es'), first);
  const byCode = rowOrder(first, data, NAME, 'en', intern('code'), form);
  assert.notEqual(byCode, first);
  assert.equal(ids(byCode), '1 2');
});

test('rows sorted by a value with values inside are sorted again each time', () => {
  // a change inside the block of a cell changes neither the cell nor the version of the row
  run('rows: reduce [#(id: 1 name: ["b"]) #(id: 2 name: ["a"])]');
  const first = order(null, run('rows'));
  assert.equal(first.marks, null);
  run('rows/1/name/1: "0"');
  const next = order(first, run('rows'));
  assert.notEqual(next, first);
  assert.equal(ids(next), '1 2');
});

test('heads and feet of groups keep their places when nothing changed', () => {
  const data = run('rows: reduce [[head 1 "G"] #(id: 1 name: "b") #(id: 2 name: "a") [foot 1 #(amount: 1)]]');
  const first = order(null, data);
  assert.equal(ids(first), 'head#0 2 1 foot#3');
  assert.equal(order(first, run('rows')), first);
  run('rows/1/3: "H"');
  assert.notEqual(order(first, run('rows')), first);
});
