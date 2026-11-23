// Styles made of other styles: layout: in stylize, `it` the face, slot for the faces given to it
// (src/ui/dialect/composites.trb).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, type Cell, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { setHost } from '../src/host/browser/mount.ts';

native('show', '[root [object!]]', (_t, f) => value(f.args[0]!));
native('ui-watch', '[value [object! series! map!]]', (_t, f) => value(f.args[0]!));

let host: Host;
beforeEach(async () => {
  host = startHost({ onError: () => {}, loader: { base: 'file:///', read: href => readFile(fileURLToPath(href), 'utf8') } });
  await startUi(host);
  setHost(host);
});

async function run(src: string): Promise<Cell> {
  return runSource(host, src).catch((e: ObjectCell) => assert.fail(form(errorField(e, 'message'))));
}

async function fails(src: string): Promise<string> {
  try {
    await runSource(host, src);
  } catch (e) {
    return form(errorField(e as ObjectCell, 'message'));
  }
  return assert.fail('it did not fail');
}

const KPI = `
  stylize [
    kpi: column [
      takes: [value: [number! money!] "the number it shows"]
      layout: [
        label: text muted is [it/text]
        heading is [it/value]
        text muted is [it/hint]
      ]
    ]
    section: panel [layout: [heading is [it/text]  slot]]
  ]`;

describe('styles made of other styles', () => {
  test('a face of it holds its own faces, which follow its fields through it', async () => {
    const got = await run(`${KPI}
      root: view [kpi "Takings" $1240.00 "12 repairs today"]
      k: first root/pane
      ui-react root
      reduce [k/style collect [foreach g k/pane [keep g/style  keep g/text]]]`);
    assert.equal(mold(got), '[column [text "Takings" heading $1240.00 text "12 repairs today"]]');
  });

  test('a change to a field of it reaches its faces', async () => {
    const got = await run(`${KPI}
      root: view [kpi "Jobs" 3]
      k: first root/pane
      ui-react root
      k/value: 7  k/text: "Jobs done"
      ui-react root
      reduce [k/pane/1/text k/pane/2/text]`);
    assert.equal(mold(got), '["Jobs done" 7]');
  });

  test('each face of it has its own faces and labels', async () => {
    const got = await run(`${KPI}
      root: view [kpi "A" 1  kpi "B" 2]
      a: root/pane/1  b: root/pane/2
      ui-react root
      reduce [
        same? a/pane/1 b/pane/1
        a/pane/1/text b/pane/1/text
        same? first a/pane/1/reactions first b/pane/1/reactions
      ]`);
    assert.equal(mold(got), '[false "A" "B" false]');
  });

  test('its labels stay inside it: the layout around it does not see them', async () => {
    const got = await run(`${KPI}
      root: view [label: text "outer"  kpi "A" 1  text is [label/text]]
      ui-react root
      reduce [root/pane/2/pane/1/text  root/pane/3/text]`);
    assert.equal(mold(got), '["A" "outer"]');
  });

  test('the faces given go where slot is, and see the labels of the layout they are written in', async () => {
    const got = await run(`${KPI}
      root: view [name: field "Name"  section "Clients" [text is [name/value]  button "Go"]]
      s: second root/pane
      root/pane/1/value: "Ada"
      ui-react root
      reduce [collect [foreach g s/pane [keep g/style]]  s/pane/2/text]`);
    assert.equal(mold(got), '[[heading text button] "Ada"]');
  });

  test('slot right after a field is where the faces go, not the name of the field', async () => {
    const got = await run(`
      stylize [boxed: column [layout: [field  slot]]]
      root: view [boxed [text "x"]]
      b: first root/pane
      reduce [b/pane/1/name  collect [foreach g b/pane [keep g/style]]]`);
    assert.equal(mold(got), '[none [field text]]');
  });

  test('a style made from it holds the same faces, and may say its own', async () => {
    const got = await run(`${KPI}
      stylize [big-kpi: kpi [size: 'large]  note: kpi [layout: [text is [it/text]]]]
      root: view [big-kpi "A" 1  note "B"]
      ui-react root
      reduce [length? root/pane/1/pane  root/pane/1/size  length? root/pane/2/pane  root/pane/2/pane/1/text]`);
    assert.equal(mold(got), '[3 large 1 "B"]');
  });

  test('it nests: one inside the layout of another, its slot given by the outer one', async () => {
    const got = await run(`${KPI}
      stylize [card: column [layout: [section "Inside" [slot]  kpi "N" 5]]]
      root: view [card [text "given"]]
      ui-react root
      c: first root/pane
      s: first c/pane
      reduce [collect [foreach g c/pane [keep g/style]]  collect [foreach g s/pane [keep g/text]]]`);
    assert.equal(mold(got), '[[panel column] ["Inside" "given"]]');
  });

  test('a block given to one with no slot, or slot out of a layout:, is a problem of the layout', async () => {
    const got = await run(`${KPI}
      collect [foreach [p m] ui-check [view [kpi "A" 1 [text "x"]  slot]] [keep m]]`);
    assert.equal(mold(got), '["kpi holds its own faces and takes no block: its layout has no slot" "slot goes only in the layout: of a style, where the faces written after it go"]');
  });

  test('a problem inside the layout is found when a face of it is checked', async () => {
    const got = await run(`
      stylize [bad: column [layout: [text "a" tone]]]
      collect [foreach [p m] ui-check [view [bad]] [keep m]]`);
    assert.equal((got as unknown as { t: number }).t !== undefined, true);
    assert.match(mold(got), /tone/);
  });

  test('stylize says what it cannot take', async () => {
    assert.match(await fails(`stylize [x: text [layout: [text "a"]]]`), /made from a container/);
    assert.match(await fails(`stylize [x: column [layout: "a"]]`), /layout: a block of faces/);
    assert.match(await fails(`stylize [x: column [layout: [slot panel [slot]]]]`), /slot 2 times/);
  });

  test('the definition keeps its layout and whether it has a slot', async () => {
    const got = await run(`${KPI}
      reduce [select ui-style-defs/kpi 'slot  select ui-style-defs/section 'slot  block? ui-style-defs/kpi/layout]`);
    assert.equal(mold(got), '[false true true]');
  });
});
