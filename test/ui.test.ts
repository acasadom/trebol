// The UI dialect (src/ui/ui.trb) without a browser: layout, faces,
// validation and events, with `show` and `apply-theme` captured here.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, type Cell, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { themeCss, DEFAULT_THEME, palette, contrast, CONTRAST_PAIRS } from '../src/host/theme.ts';

let shown: Cell | null = null;
let themed: Cell | null = null;
native('show', '[root [object!]]', (_t, f) => {
  shown = f.args[0]!;
  return value(shown);
});
let toasts: string[] = [];
native('show-toast', '[message [string!] kind [word! none!]]', (_t, f) => {
  toasts.push(mold(f.args[0]!) + ' ' + mold(f.args[1]!));
  return value(f.args[0]!);
});
native('apply-theme', '[spec [object!]]', (_t, f) => {
  themed = f.args[0]!;
  return value(themed);
});

let host: Host;
before(async () => {
  host = startHost({ onError: () => {}, loader: { base: 'file:///', read: href => readFile(fileURLToPath(href), 'utf8') } });
  await startUi(host);
});

async function ev(src: string): Promise<string> {
  try {
    return mold(await runSource(host, src));
  } catch (e) {
    return assert.fail(`${src}\n  raised: ${form(errorField(e as ObjectCell, 'message'))}`);
  }
}

const SIGNUP = `
  saved: none
  root: view [
    title "Create account"
    form [
      field name "Name" required
      field email "Email" required email
      number age "Age" min 18
      password pass "Password" required length 8 64
      password pass2 "Repeat password" match pass
      check terms "I accept the terms" required
      submit "Create account" [saved: values]
    ]
  ]
  frm: second root/children
  get-face: func [n] [foreach f frm/children [if f/name = n [return f]] none]
  btn: last frm/children
`;

describe('layout', () => {
  test('styles, names, labels, rules and roles', async () => {
    await ev(`root: view [title "Hi" row [field search "Search" "Type here" fill button primary "Go" [x: 1]]]`);
    const r = await ev(`
      r: second root/children
      f: first r/children b: second r/children
      reduce [r/style f/style f/name f/text f/hint f/fill b/role b/text block? b/action]`);
    assert.equal(r, '[row field search "Search" "Type here" true primary "Go" true]');
  });

  test('reserved words never name a field; email and friends can', async () => {
    const r = await ev(`
      root: view [form [
        field required "A"
        field primary "B"
        field on-change [x: 1] "C"
        number min 1 "D"
        field email "E" email
      ]]
      collect [foreach f select first root/children 'children [keep f/name keep length? any [f/rules []]]]`);
    assert.equal(r, '[none 1 none 0 none 0 none 1 email 1]');
  });

  test('set-words name faces; stylize derives styles', async () => {
    const r = await ev(`
      stylize [risky: button [role: 'danger]]
      root: view [total: text "0" risky "Delete"]
      reduce [total/text select last root/children 'role]`);
    assert.equal(r, '["0" danger]');
  });

  test('grids take a column count; choices take options', async () => {
    const r = await ev(`root: view [grid 3 [text "a"] choice kind "Kind" ["Person" "Company"]]
      reduce [select first root/children 'cols select second root/children 'options]`);
    assert.equal(r, '[3 ["Person" "Company"]]');
  });

  test('unknown styles are an error', async () => {
    await assert.rejects(runSource(host, 'view [nonsense "x"]'));
  });
});

describe('validation', () => {
  test('submit stays disabled until every field is valid', async () => {
    await ev(SIGNUP);
    assert.equal(await ev('btn/disabled'), 'true');
    assert.equal(await ev(`
      ui-input get-face 'name "Ana"
      ui-input get-face 'email "ana@example.com"
      ui-input get-face 'age "21"
      ui-input get-face 'pass "secret123"
      ui-input get-face 'pass2 "secret123"
      ui-input get-face 'terms true
      btn/disabled`), 'false');
    await ev('ui-click btn');
    assert.equal(await ev('reduce [saved/name saved/age saved/terms]'), '["Ana" 21 true]');
  });

  test('a view leaves the submits of its forms alone', async () => {
    const r = await ev(`
      root: view [
        f: form [field name "Name" required submit "Save" [x: 1]]
        field note "Note"
        go: submit "Go" [y: 1]
      ]
      reduce [select last f/children 'disabled go/disabled]`);
    assert.equal(r, '[true false]');
  });

  test('errors show only after a field is touched, with readable messages', async () => {
    await ev(SIGNUP);
    assert.equal(await ev(`e: get-face 'email ui-input e "nope" e/error`), 'none');
    assert.equal(await ev(`ui-blur e e/error`), '"Enter a valid email address"');
    assert.equal(await ev(`a: get-face 'age ui-input a "12" ui-blur a a/error`), '"Must be at least 18"');
    assert.equal(await ev(`p: get-face 'pass ui-input p "short" ui-blur p p/error`), '"Must be between 8 and 64 characters"');
    assert.equal(await ev(`ui-input p "longenough" q: get-face 'pass2 ui-input q "other" ui-blur q q/error`), '"Must match Password"');
  });

  test('clicking submit touches every field and does not run the action', async () => {
    await ev(SIGNUP);
    assert.equal(await ev(`ui-click btn n: get-face 'name reduce [saved n/error]`), '[none "This field is required"]');
  });

  test('check and check-async rules', async () => {
    const r = await ev(`
      taken: ["admin"]
      root: view [form [
        field user "User" required check-async [wait 0.01 either find taken value ["That name is taken"] [true]]
        field code "Code" check [either value = "42" [true] ["Wrong code"]]
      ]]
      fm: first root/children
      u: first fm/children c: second fm/children
      ui-input u "admin" ui-blur u
      ui-input c "41" ui-blur c
      reduce [u/error c/error]`);
    assert.equal(r, '["That name is taken" "Wrong code"]');
  });
});

describe('handlers', () => {
  test('handlers see face, value, values and named fields', async () => {
    const r = await ev(`
      got: none
      root: view [form [
        field first-name "First" on-change [got: reduce [face/name value]]
        button "Go" [got: reduce [values/first-name first-name/value]]
      ]]
      fm: first root/children
      ui-input first fm/children "Eva"
      a: got
      ui-click second fm/children
      reduce [a got]`);
    assert.equal(r, '[[first-name "Eva"] ["Eva" "Eva"]]');
  });

  test('theme passes its parameters to the host', async () => {
    await ev('theme [base: 160 neutral: warm mode: dark]');
    assert.equal(mold(themed!).replace(/\s+/g, ' '), 'make object! [ base: 160 neutral: warm mode: dark ]');
  });
});

describe('components', () => {
  test('a word after table labels it globally; columns take optional labels', async () => {
    const r = await ev(`
      root: view [table clients [name "Name" email] key code on-select [x: 1]]
      clients/text: "seen"
      reduce [select first root/children 'text clients/style clients/columns clients/key clients/data]`);
    assert.equal(r, '["seen" table [name "Name" email "email"] code none]');
  });

  test('choosing a row binds row in on-select', async () => {
    const r = await ev(`
      picked: none
      root: view [table people [name] on-select [picked: reduce [row/name face/style]]]
      people/data: reduce [make map! [id 1 name "Ada"] make map! [id 2 name "Alan"]]
      ui-select people second people/data
      reduce [picked people/selected/id]`);
    assert.equal(r, '[["Alan" table] 2]');
  });

  test('dialogs start hidden; open, close and dismissing toggle them', async () => {
    const r = await ev(`
      closed: 0
      root: view [edit: dialog "Edit" [form [field name "Name"]] on-close [closed: closed + 1]]
      a: edit/hidden open edit b: edit/hidden close edit c: edit/hidden
      open edit ui-close edit
      reduce [a b c edit/hidden closed edit/text length? edit/children]`);
    assert.equal(r, '[true false true true 1 "Edit" 1]');
  });

  test('close still closes streams', async () => {
    const r = await ev(`reduce [attempt [close 1] type? :close-stream]`);
    assert.equal(r, '[none native!]');
  });

  test('toast passes its message and role to the host', async () => {
    toasts = [];
    await ev(`toast "Saved" toast/role "Failed" 'danger`);
    assert.deepEqual(toasts, ['"Saved" none', '"Failed" danger']);
  });

  test('tabs hold a face per tab and select the first one', async () => {
    const r = await ev(`
      root: view [tabs ["General" [field name "Name"] "Advanced" [check debug "Debug"]]]
      t: first root/children
      reduce [t/value collect [foreach c t/children [keep c/style keep c/text keep length? c/children]]
        form-values root]`);
    assert.equal(r, '[1 [tab "General" 1 tab "Advanced" 1] #(name: none debug: none)]');
  });

  test('set-values fills a form and forgets that it was touched', async () => {
    const r = await ev(`
      root: view [f: form [field name "Name" required check ok "OK" submit "Save" [x: 1]]]
      n: first f/children
      ui-blur n
      a: n/error
      set-values f make map! reduce ['name "Ada" 'ok true 'extra 1]
      b: reduce [n/value n/touched n/error select second f/children 'value select third f/children 'disabled]
      set-values f none
      reduce [a b n/value]`);
    assert.equal(r, '["This field is required" ["Ada" false none true false] none]');
  });

  test('tables need words for columns; tabs need label and block pairs', async () => {
    await assert.rejects(runSource(host, 'view [table t ["Name"]]'));
    await assert.rejects(runSource(host, 'view [tabs ["A"]]'));
  });
});

describe('theme', () => {
  test('every text color meets WCAG AA on its background, for every hue and mode', () => {
    for (const neutral of ['cool', 'neutral', 'warm'] as const) {
      for (let h = 0; h < 360; h += 5) {
        for (const dark of [false, true]) {
          const p = palette({ ...DEFAULT_THEME, base: h, accent: (h + 150) % 360, neutral }, dark);
          for (const [fg, bg] of CONTRAST_PAIRS) {
            const c = contrast(p[fg], p[bg]);
            assert.ok(c >= 4.5, `${fg} on ${bg}: ${c.toFixed(2)} (hue ${h}, ${neutral}, ${dark ? 'dark' : 'light'})`);
          }
        }
      }
    }
  });

  test('the stylesheet uses only theme tokens for color in component rules', () => {
    const css = themeCss(DEFAULT_THEME);
    const components = css.slice(css.indexOf('*, *::before'));
    assert.ok(!/#[0-9a-f]{3,6}\b|rgb\(/i.test(components), 'no raw colors in component rules');
    assert.ok(css.includes('@media (prefers-color-scheme: dark)'));
    assert.ok(!themeCss({ ...DEFAULT_THEME, mode: 'light' }).includes('prefers-color-scheme'));
  });
});
