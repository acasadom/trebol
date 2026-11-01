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

  test('toggle, radio, progress, image and icon', async () => {
    const r = await ev(`
      root: view [form [
        toggle dark "Dark mode" required
        radio size "Size" ["S" "M" "L"] required
        progress "Upload" 40%
        image %logo.png "Logo" small
        icon #search primary
        button #plus "New"
      ]]
      f: first root/children
      t: first f/children r: second f/children
      a: reduce [validate-face t validate-face r]
      ui-input t true ui-input r "M"
      reduce [a t/value r/value r/options form-values f
        collect [foreach g skip f/children 2 [keep g/style keep g/value keep g/icon]]]`);
    assert.equal(r, '[["This field is required" "This field is required"] true "M" ["S" "M" "L"] '
      + '#(dark: true size: "M") [progress 40% none image %logo.png none icon none #search button none #plus]]');
  });

  test('set-values sets a toggle to true or false', async () => {
    const r = await ev(`
      root: view [f: form [toggle on "On"]]
      set-values f make map! [on: 1]
      a: select first f/children 'value
      set-values f none
      reduce [a select first f/children 'value]`);
    assert.equal(r, '[false false]');
  });

  test('pad and gap take a spacing step; scroll is a container; screen flags', async () => {
    const r = await ev(`
      root: view [
        s: scroll small pad 2 gap none [text "a" text "b"]
        row gap wide narrow-only [text "x"]
        text "wide" wide-only
      ]
      r: second root/children
      reduce [s/style s/size s/pad s/gap length? s/children r/gap r/narrow-only
        select third root/children 'wide-only]`);
    assert.equal(r, '[scroll small 2 0 2 6 true true]');
    await assert.rejects(runSource(host, 'view [column pad 8 []]'));
  });

  test('split holds two panes and starts on the first', async () => {
    const r = await ev(`
      root: view [s: split [list people [name] column [text "Detail"]]]
      reduce [s/value collect [foreach c s/children [keep c/style]]]`);
    assert.equal(r, '[1 [list column]]');
    await assert.rejects(runSource(host, 'view [split [text "only one"]]'));
  });

  test('set-content replaces the faces of a container and links them to its form', async () => {
    const r = await ev(`
      sent: none
      root: view [frm: form [field a "A"] box: column [text "old"]]
      set-content frm [field b "B" required  submit "Go" [sent: values]]
      set-content box [text "new" text "more"]
      b-face: first frm/children
      go: last frm/children
      x: reduce [b-face/form = frm  b-face/root = root  go/disabled]
      ui-input b-face "hi"
      ui-click go
      first-text: first box/children
      reduce [x sent/b  length? box/children  first-text/text]`);
    assert.equal(r, '[[true true true] "hi" 2 "new"]');
    await assert.rejects(runSource(host, 'r: view [s: split [text "a" text "b"]] set-content s [text "c"]'));
  });

  test('general events run their handler with the event words bound', async () => {
    const r = await ev(`
      log: copy []
      root: view [
        field name "Name" on-focus [append log 'focus] on-blur [append log value]
        card: panel [] on-hover [append log over]
        list people [name] on-double-click [append log row/name]
        button "Save" key "Ctrl+S" on-key [append log reduce [key ctrl]]
      ]
      nm: first root/children
      btn: last root/children
      ui-event nm 'on-focus []
      ui-input nm "Ada"
      ui-event nm 'on-blur []
      ui-event card 'on-hover [over: true]
      people/data: reduce [make map! [id 1 name "Ada"]]
      ui-select people first people/data
      ui-event people 'on-double-click []
      ui-event btn 'on-key [key: 'enter ctrl: false]
      ui-event btn 'on-focus []
      v: view [on-key [append log key] text "x"]
      ui-event v 'on-key [key: "z"]
      reduce [log btn/shortcut people/key length? v/children]`);
    assert.equal(r, '[[focus "Ada" true "Ada" enter false "z"] "Ctrl+S" id 1]');
  });

  test('menus hold items, dividers and submenus; choosing one runs it with the row bound', async () => {
    const r = await ev(`
      got: none
      root: view [
        list people [name] menu [#edit "Edit" [got: row/name] divider "Move to" menu ["Top" [got: 'top]]]
        button "File" menu ["New" [got: 'new]]
      ]
      m: people/menu
      people/data: reduce [make map! [id 1 name "Ada"] make map! [id 2 name "Alan"]]
      ui-menu people first m second people/data
      a: got
      sub: third m
      ui-menu people first sub/items none
      reduce [a got length? m m/2/divider m/1/icon sub/text people/selected/id]`);
    assert.equal(r, '["Alan" top 3 true #edit "Move to" 2]');
    await assert.rejects(runSource(host, 'view [text "x" menu ["A"]]'));
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

test('texts show in the active language and fall back to the main one', async () => {
  assert.equal(await ev('label: translated [es "Solicitud" en "Application"]  i18n/language: \'en  tr label'), '"Application"');
  assert.equal(await ev('tr translated "Plazo"'), '"Plazo"');
  assert.equal(await ev('i18n/texts/save: translated [es "Guardar" en "Save"]  tr \'save'), '"Save"');
  assert.equal(await ev('i18n/language: \'es  tr \'save'), '"Guardar"');
  assert.equal(await ev('tr \'unknown-word'), '"unknown-word"');
  assert.equal(await ev('tr none'), '""');
});
