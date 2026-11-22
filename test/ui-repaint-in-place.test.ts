// A face is drawn again when a series or row it shows changes in place: the host marks
// what a face's fields hold each time it draws it (src/host/browser/inplace.ts), and the
// core's touch, or ctxSet for a row object, puts the change where the host looks.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, touch, type Ctx, type ObjectCell, type Series, type Cell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { dirtySeries, watchShown, watchChanged, ownersOf, isFace } from '../src/host/browser/inplace.ts';

native('show', '[root [object!]]', (_t, f) => value(f.args[0]!));
native('ui-watch', '[value [object! series! map!]]', (_t, f) => value(f.args[0]!));

let host: Host;
const dirty: Ctx[] = [];
beforeEach(async () => {
  host = startHost({ onError: () => {}, loader: { base: 'file:///', read: href => readFile(fileURLToPath(href), 'utf8') } });
  await startUi(host);
  dirty.length = 0;
  dirtySeries.length = 0;
});

const faces = new Map<object, ObjectCell>();

/** Runs the source, whose last value is a face, and marks what it shows with an owner, as drawing it does. */
async function face(src: string): Promise<{ f: ObjectCell; owner: object }> {
  const f = await runSource(host, src) as ObjectCell;
  const owner = { name: 'face' };
  faces.set(owner, f);
  watchShown(f.ctx, dirty, owner);
  return { f, owner };
}

/** The owners of what changed since the last call, marked again as syncDirty does. */
function changed(): object[] {
  const into = new Set<object>();
  const series = dirtySeries.splice(0);
  const ctxs = dirty.splice(0);
  for (const x of [...series, ...ctxs]) x.dirty = false;
  ownersOf(series, ctxs, into);
  watchChanged(series, ctxs, dirty, () => true);
  for (const o of into) if (faces.has(o)) watchShown(faces.get(o)!.ctx, dirty, o);
  return [...into];
}

describe('the core marks a watched series', () => {
  test('touch puts a watched series once in its array', () => {
    const watch: Series<unknown>[] = [];
    const s: Series<unknown> = { data: [], watch };
    touch(s);
    touch(s);
    assert.equal(watch.length, 1);
    assert.equal(s.dirty, true);
    const free: Series<unknown> = { data: [] };
    touch(free);
    assert.equal(free.dirty, undefined);
  });
});

describe('a face shown changes in place', () => {
  test('a row appended to the data of a table', async () => {
    const { owner } = await face(`
      rows: reduce [make object! [id: 1 name: "a"]]
      v: view [table [id "Id"]]  v/pane/1/data: rows  v/pane/1`);
    assert.deepEqual(changed(), []);
    await runSource(host, `append rows make object! [id: 2 name: "b"]`);
    assert.deepEqual(changed(), [owner]);
    // the row that came is marked too, as is a block put inside a row already marked
    await runSource(host, `rows/2/name: "c"`);
    assert.deepEqual(changed(), [owner]);
    await runSource(host, `rows/1/name: copy [1]`);
    assert.deepEqual(changed(), [owner]);
    await runSource(host, `append rows/1/name 2`);
    assert.deepEqual(changed(), [owner]);
  });

  test('what did not change is not walked again', async () => {
    const { owner } = await face(`
      rows: reduce [make object! [id: 1 name: "a"]]
      v: view [table [id "Id"]]  v/pane/1/data: rows  v/pane/1`);
    // a mark taken off by hand stays off: the row, unchanged, is not visited
    const row = (await runSource(host, `rows/1`) as ObjectCell).ctx;
    row.watch = undefined;
    watchShown(faces.get(owner)!.ctx, dirty, owner);
    assert.equal(row.watch, undefined);
  });

  test('a field of a row object set, and a string in a row changed', async () => {
    const { owner } = await face(`
      rows: reduce [make object! [id: 1 name: "a"]]
      v: view [table [id "Id"]]  v/pane/1/data: rows  v/pane/1`);
    await runSource(host, `rows/1/name: "z"`);
    assert.deepEqual(changed(), [owner]);
    // the new string was marked when the face was drawn again
    await runSource(host, `append rows/1/name "!"`);
    assert.deepEqual(changed(), [owner]);
  });

  test('a map row and a block inside a block row', async () => {
    const { owner } = await face(`
      rows: reduce [make map! [id 1] [1 [2 3]]]
      v: view [list [id "Id"]]  v/pane/1/data: rows  v/pane/1`);
    await runSource(host, `put rows/1 'id 5`);
    assert.deepEqual(changed(), [owner]);
    await runSource(host, `append rows/2/2 4`);
    assert.deepEqual(changed(), [owner]);
  });

  test('the text of a face appended to', async () => {
    const { owner } = await face(`v: view [text "x"]  v/pane/1`);
    await runSource(host, `append v/pane/1/text "y"`);
    assert.deepEqual(changed(), [owner]);
  });

  test('children, handlers and other faces are not its content', async () => {
    const { f } = await face(`
      v: view [panel [text "in" button "b" [print 1]]]  v/pane/1`);
    await runSource(host, `append v/pane/1/pane/1/text "!"  append v/pane/1/pane/2/action [print 2]`);
    assert.deepEqual(changed(), []);
    assert.ok(isFace(f.ctx));
    assert.ok(!isFace((await runSource(host, `make object! [style: 1 pane: 2]`) as ObjectCell).ctx));
  });

  test('a face that left the page is dropped as an owner when another one marks', async () => {
    const rows = await runSource(host, `rows: copy [1 2]`) as Cell;
    const gone = { name: 'gone' };
    const here = { name: 'here' };
    watchShown(rows, dirty, gone);
    watchShown(rows, dirty, here, o => o !== gone);
    await runSource(host, `append rows 3`);
    assert.deepEqual(changed(), [here]);
  });

  test('a cycle in what it shows is walked once', async () => {
    const { owner } = await face(`
      b: copy [1]  append/only b b
      v: view [list [id "Id"]]  v/pane/1/data: b  v/pane/1`);
    await runSource(host, `append b 2`);
    assert.deepEqual(changed(), [owner]);
  });

  test('without an owner, a reaction source is only marked', async () => {
    const src = await runSource(host, `xs: copy [[1]]`) as Cell;
    watchShown(src, dirty);
    await runSource(host, `append first xs 2`);
    assert.equal(dirtySeries.length, 1);
    assert.deepEqual(changed(), []);    // a block that came inside it is read too
    await runSource(host, `append/only xs copy [3]`);
    assert.deepEqual(changed(), []);
    await runSource(host, `append last xs 4`);
    assert.equal(dirtySeries.length, 1);
  });
});
