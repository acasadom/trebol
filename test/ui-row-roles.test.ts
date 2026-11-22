// role-by: a table, list, board or tree paints each row, and a column each cell, in the role
// the row's data names (src/host/browser/row-roles.ts, read by tables.ts and trees.ts).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, spell, form, mold, errorField, type ObjectCell, type BlockCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { setHost } from '../src/host/browser/mount.ts';
import { columns } from '../src/host/browser/tables.ts';
import { roleField, roleOf } from '../src/host/browser/row-roles.ts';

native('show', '[root [object!]]', (_t, f) => value(f.args[0]!));

let host: Host;
beforeEach(async () => {
  host = startHost({ onError: () => {}, loader: { base: 'file:///', read: href => readFile(fileURLToPath(href), 'utf8') } });
  await startUi(host);
  setHost(host);
});

/** The face the source gives, and the rows of its data. */
async function rowsOf(src: string): Promise<{ f: ObjectCell; rows: ObjectCell[] }> {
  const f = await runSource(host, src).catch((e: ObjectCell) => assert.fail(form(errorField(e, "message")))) as ObjectCell;
  const data = f.ctx.vals[f.ctx.keys.findIndex(k => spell(k) === 'data')] as BlockCell;
  return { f, rows: data.s.data.slice(data.i) as ObjectCell[] };
}

describe('role-by', () => {
  test('a table paints a row and a cell in the role the row names', async () => {
    const { f, rows } = await rowsOf(`
      root: view [table t role-by state [name "Job" state "State" role-by state]]
      t: first root/pane
      t/data: [#(id: 1 name: "Boiler" state: success) #(id: 2 name: "Roof" state: 'danger) #(id: 3 name: "Door" state: "Warning")]
      t`);
    const [name, state] = columns(f);
    assert.equal(name!.roleBy, null);
    assert.equal(spell(state!.roleBy!), 'state');
    assert.equal(state!.label, 'State');
    const field = roleField(f);
    assert.equal(spell(field!), 'state');
    // a word, a lit-word and a string in any case all name a role
    assert.deepEqual(rows.map(r => roleOf(r, field)), ['success', 'danger', 'warning']);
  });

  test('a value that is no role, none, a number or no field paints nothing', async () => {
    const { f, rows } = await rowsOf(`
      root: view [list l role-by tone [tone]]
      l: first root/pane
      l/data: [#(tone: done) #(tone: none) #(tone: 3) #(other: success)]
      l`);
    assert.deepEqual(rows.map(r => roleOf(r, roleField(f))), [null, null, null, null]);
    assert.equal(roleOf(rows[0]!, null), null);
  });

  test('a face without role-by reads no field', async () => {
    const { f } = await rowsOf(`root: view [table t [name]] t: first root/pane t/data: [] t`);
    assert.equal(roleField(f), null);
    assert.equal(columns(f)[0]!.roleBy, null);
  });

  test('a column of images can be painted too, and a board passes role-by to its cards', async () => {
    const { f } = await rowsOf(`root: view [table t [photo "" image round role-by tone  name]] t: first root/pane t/data: [] t`);
    const [photo, name] = columns(f);
    assert.equal(photo!.image && photo!.round, true);
    assert.equal(spell(photo!.roleBy!), 'tone');
    assert.equal(name!.roleBy, null);
    const r = await runSource(host, `
      root: view [board b by lane role-by tone card [title role-by tone] [todo "To do"]]
      b: first root/pane  b/data: [#(id: 1 title: "Tap" lane: todo tone: danger)]
      cards: b/pane/1/pane/1
      reduce [cards/role-by  select cards 'columns]`);
    assert.equal(mold(r), "[tone [title [\"title\" role-by tone]]]");
  });
});
