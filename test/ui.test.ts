// The UI dialect (src/ui/ui.trb) without a browser: layout, faces,
// validation and events, with `show` and `apply-theme` captured here.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { K, NONE, native, value, mold, form, string, text, money, blockOf, errorField, type Cell, type ObjectCell, type StringCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, readLocal, editLocal, readDate, weekStart, translate, uiText, type Host } from '../src/host/index.ts';
import { fileHandle } from '../src/host/net.ts';
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

let repaints = 0;
native('repaint', '[]', () => { repaints++; return value(blockOf(K.Block, [])); });

// the page's link, as the browser host keeps it in location.hash
let link: string[] = [];
let links: string[] = [];
native('route', '[]', () => value(blockOf(K.Block, link.map(p => string(p)))));
native('set-route', '[route [block!] replace [logic!]]', (_t, f) => {
  link = (f.args[0] as { s: { data: Cell[] } }).s.data.map(c => (c.t === K.String ? text(c as StringCell) : form(c)));
  links.push((f.args[1]!.t === K.Logic && f.args[1]!.v ? 'replace ' : 'push ') + link.join('/'));
  return value(f.args[0]!);
});

// two files as an upload's host gives them: name size type file
native('test-files', '[]', () => value(blockOf(K.Block, ['a.pdf', 'b.png'].flatMap((n, i) =>
  [string(n), { t: K.Integer, v: 1000 * (i + 1) } as Cell, string('application/pdf'), fileHandle(new File(['x'], n))]))));

let host: Host;
// every test gets a fresh user context, so words one test sets never leak into the next
beforeEach(async () => {
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
  frm: second root/pane
  get-face: func [n] [foreach f frm/pane [if f/name = n [return f]] none]
  btn: last frm/pane
`;

describe('layout', () => {
  test('styles, names, labels, rules and roles', async () => {
    await ev(`root: view [title "Hi" row [field search "Search" "Type here" fill button primary "Go" [x: 1]]]`);
    const r = await ev(`
      r: second root/pane
      f: first r/pane b: second r/pane
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
      collect [foreach f select first root/pane 'pane [keep f/name keep length? any [f/rules []]]]`);
    assert.equal(r, '[none 1 none 0 none 0 none 1 email 1]');
  });

  test('global set-words name faces outside the view; stylize derives styles', async () => {
    const r = await ev(`
      stylize [risky: button [role: 'danger]]
      root: view [global total: text "0" risky "Delete"]
      reduce [total/text select last root/pane 'role]`);
    assert.equal(r, '["0" danger]');
  });

  test('grids take a column count; choices take options', async () => {
    const r = await ev(`root: view [grid 3 [text "a"] choice kind "Kind" ["Person" "Company"]]
      reduce [select first root/pane 'cols select second root/pane 'options]`);
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
        global f: form [field name "Name" required submit "Save" [x: 1]]
        field note "Note"
        global go-btn: submit "Go" [y: 1]
      ]
      reduce [select last f/pane 'disabled go-btn/disabled]`);
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
      fm: first root/pane
      u: first fm/pane c: second fm/pane
      ui-input u "admin" ui-blur u
      ui-input c "41" ui-blur c
      reduce [u/error c/error]`);
    assert.equal(r, '["That name is taken" "Wrong code"]');
  });
});

describe('handlers', () => {
  test('handlers see face, value, values and the labels of their layout, not field names', async () => {
    const r = await ev(`
      got: none
      root: view [form [
        fn: field first-name "First" on-change [got: reduce [face/name value]]
        button "Go" [got: reduce [values/first-name fn/value value? 'first-name]]
      ]]
      fm: first root/pane
      ui-input first fm/pane "Eva"
      a: got
      ui-click second fm/pane
      reduce [a got]`);
    assert.equal(r, '[[first-name "Eva"] ["Eva" "Eva" false]]');
  });

  test('theme passes its parameters to the host', async () => {
    await ev('theme [base: 160 neutral: warm mode: dark]');
    assert.equal(mold(themed!).replace(/\s+/g, ' '), 'make object! [ base: 160 neutral: warm mode: dark ]');
  });
});

describe('components', () => {
  test('a word after table labels it; columns take optional labels', async () => {
    const r = await ev(`
      root: view [global table clients [name "Name" email] key code on-select [x: 1]]
      clients/text: "seen"
      reduce [select first root/pane 'text clients/style clients/columns clients/key clients/data]`);
    assert.equal(r, '["seen" table [name "Name" email "email"] code none]');
  });

  test('choosing a row binds row in on-select', async () => {
    const r = await ev(`
      picked: none
      root: view [global table people [name] on-select [picked: reduce [row/name face/style]]]
      people/data: reduce [make map! [id 1 name "Ada"] make map! [id 2 name "Alan"]]
      ui-select people second people/data
      reduce [picked people/selected/id]`);
    assert.equal(r, '[["Alan" table] 2]');
  });

  test('dialogs start hidden; open, close and dismissing toggle them', async () => {
    const r = await ev(`
      closed: 0
      root: view [global edit: dialog "Edit" [form [field name "Name"]] on-close [closed: closed + 1]]
      a: edit/hidden open edit b: edit/hidden close edit c: edit/hidden
      open edit ui-close edit
      reduce [a b c edit/hidden closed edit/text length? edit/pane]`);
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
      t: first root/pane
      reduce [t/value collect [foreach c t/pane [keep c/style keep c/text keep length? c/pane]]
        form-values root]`);
    assert.equal(r, '[1 [tab "General" 1 tab "Advanced" 1] #(name: none debug: none)]');
  });

  test('set-values fills a form and forgets that it was touched', async () => {
    const r = await ev(`
      root: view [global f: form [field name "Name" required check ok "OK" submit "Save" [x: 1]]]
      n: first f/pane
      ui-blur n
      a: n/error
      set-values f make map! reduce ['name "Ada" 'ok true 'extra 1]
      b: reduce [n/value n/touched n/error select second f/pane 'value select third f/pane 'disabled]
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
      f: first root/pane
      t: first f/pane r: second f/pane
      a: reduce [validate-face t validate-face r]
      ui-input t true ui-input r "M"
      reduce [a t/value r/value r/options form-values f
        collect [foreach g skip f/pane 2 [keep g/style keep g/value keep g/icon]]]`);
    assert.equal(r, '[["This field is required" "This field is required"] true "M" ["S" "M" "L"] '
      + '#(dark: true size: "M") [progress 40% none image %logo.png none icon none #search button none #plus]]');
  });

  test('set-values sets a toggle to true or false', async () => {
    const r = await ev(`
      root: view [global f: form [toggle on "On"]]
      set-values f make map! [on: 1]
      a: select first f/pane 'value
      set-values f none
      reduce [a select first f/pane 'value]`);
    assert.equal(r, '[false false]');
  });

  test('pad and gap take a spacing step; scroll is a container; screen flags', async () => {
    const r = await ev(`
      root: view [
        global s: scroll small pad 2 gap none [text "a" text "b"]
        row gap wide narrow-only [text "x"]
        text "wide" wide-only
      ]
      r: second root/pane
      reduce [s/style s/size s/pad s/gap length? s/pane r/gap r/narrow-only
        select third root/pane 'wide-only]`);
    assert.equal(r, '[scroll small 2 0 2 6 true true]');
    await assert.rejects(runSource(host, 'view [column pad 8 []]'));
  });

  test('split holds two panes and starts on the first', async () => {
    const r = await ev(`
      root: view [global s: split [list people [name] column [text "Detail"]]]
      reduce [s/value collect [foreach c s/pane [keep c/style]]]`);
    assert.equal(r, '[1 [list column]]');
    await assert.rejects(runSource(host, 'view [split [text "only one"]]'));
  });

  test('assigning a pane and calling ui-pane links the new faces to their form', async () => {
    const r = await ev(`
      sent: none
      root: view [global frm: form [field a "A"] global box: column [text "old"]]
      frm/pane: layout/only [field b "B" required  submit "Go" [sent: values]]
      ui-pane frm
      box/pane: layout/only [text "new" text "more"]
      ui-pane box
      b-face: first frm/pane
      go-btn: last frm/pane
      x: reduce [b-face/form = frm  b-face/root = root  go-btn/disabled]
      ui-input b-face "hi"
      ui-click go-btn
      first-text: first box/pane
      lay: layout [on-key [x] text "t"]
      reduce [x sent/b  length? box/pane  first-text/text  lay/style  length? lay/pane  lay/events/1]`);
    assert.equal(r, '[[true true true] "hi" 2 "new" view 1 on-key]');
  });

  test('general events run their handler with event bound, as in Red', async () => {
    const r = await ev(`
      log: copy []
      root: view [
        field name "Name" on-focus [append log event/type] on-unfocus [append log value]
        global card: panel [] on-over [append log event/away?]
        global list people [name] on-dbl-click [append log row/name]
        button "Save" key "Ctrl+S" on-key [append/only log reduce [event/key event/ctrl? event/alt?]]
      ]
      nm: first root/pane
      btn: last root/pane
      ui-event nm 'on-focus []
      ui-input nm "Ada"
      ui-event nm 'on-unfocus []
      ui-event card 'on-over [away?: true]
      people/data: reduce [make map! [id 1 name "Ada"]]
      ui-select people first people/data
      ui-event people 'on-dbl-click []
      ui-event btn 'on-key [key: #"^M" ctrl?: false shift?: false alt?: true meta?: false]
      ui-event btn 'on-key [key: 'left ctrl?: true shift?: false alt?: false meta?: false]
      v: view [on-key [append log event/key] text "x"]
      ui-event v 'on-key [key: #"z"]
      plain: none
      w: view [button "b" [plain: event]]
      ui-click first w/pane
      reduce [log btn/shortcut length? v/pane plain]`);
    assert.equal(r, '[[focus "Ada" true "Ada" [#"^(0D)" false true] [left true false] #"z"] "Ctrl+S" 1 none]');
  });

  test('menus follow Red: label and word, --- and submenus; on-menu gets event/picked and the row', async () => {
    const r = await ev(`
      got: none
      root: view [
        global list people [name] menu [#edit "Edit" edit --- "Move to" ["Top" top]] on-menu [got: reduce [event/picked row/name]]
        button "File" menu ["New" new]
      ]
      m: people/menu
      people/data: reduce [make map! [id 1 name "Ada"] make map! [id 2 name "Alan"]]
      ui-menu people first m second people/data
      a: got
      sub: third m
      ui-menu people first sub/items none
      reduce [a got length? m m/2/divider m/1/icon sub/text people/selected/id]`);
    assert.equal(r, '[[edit "Alan"] [top "Alan"] 3 true #edit "Move to" 2]');
    await assert.rejects(runSource(host, 'view [text "x" menu ["A"]]'));
  });

  test('dropping runs on-drop; reordering moves rows or children and runs on-reorder', async () => {
    const r = await ev(`
      log: copy []
      root: view [
        global list palette [label] drag
        global canvas: column [text "a" text "b" text "c"] drop reorder
          on-drop [append/only log reduce [event/type event/dropped/label event/source/style event/index]]
          on-reorder [append/only log reduce [event/from event/to]]
        global list items [name] reorder
      ]
      palette/data: reduce [make map! [id 1 label "Field"]]
      ui-drop canvas first palette/data palette 2 none
      ui-reorder canvas 1 3 none
      items/data: reduce [make map! [id 1 name "x"] make map! [id 2 name "y"]]
      ui-reorder items 2 1 none
      t: collect [foreach c canvas/pane [keep c/text]]
      reduce [log t collect [foreach row items/data [keep row/name]] palette/drag canvas/drop]`);
    assert.equal(r, '[[[drop "Field" list 2] [1 3]] ["b" "c" "a"] ["y" "x"] true true]');
  });

  test('a toolbar is a container whose --- are separators', async () => {
    const r = await ev(`
      root: view [global bar: toolbar "Actions" [button #plus "New" --- button #trash "Delete"]]
      reduce [bar/text collect [foreach c bar/pane [keep c/style]]]`);
    assert.equal(r, '["Actions" [button divider button]]');
  });

  test('a breadcrumb takes label and word items; choosing one runs its action with the word in value', async () => {
    const r = await ev(`
      went: none
      root: view [global crumbs: breadcrumb ["Home" home "Clients" clients "Ada"] [went: value]]
      ui-crumb crumbs 'clients
      reduce [went crumbs/value length? crumbs/data]`);
    assert.equal(r, '[clients clients 5]');
    await assert.rejects(runSource(host, 'view [breadcrumb ["Home" "Clients" clients]]'));
  });

  test('a tree selects nodes, expands them lazily, and reorders among siblings', async () => {
    const r = await ev(`
      log: copy []
      root: view [
        global tree folders [name] drop reorder
          on-select [append log row/name]
          on-expand [append log join "open " row/name  row/children: reduce [make map! [id 9 name "Late"]]]
          on-reorder [append/only log reduce [event/from event/to either event/parent [event/parent/name] [none]]]
          on-drop [append/only log reduce [event/dropped event/index event/parent/name]]
      ]
      docs: make map! [id 1 name "Docs"]
      docs/children: reduce [make map! [id 2 name "A"] make map! [id 3 name "B"]]
      lazy: make map! [id 4 name "Lazy"]
      lazy/children: copy []
      folders/data: reduce [docs lazy]
      ui-select folders second folders/data
      ui-expand folders second folders/data
      ui-reorder folders 2 1 docs
      ui-reorder folders 2 1 none
      ui-drop folders "x" none 1 docs
      reduce [log collect [foreach n docs/children [keep n/name]] folders/data/1/name lazy/children/1/name folders/selected/id]`);
    assert.equal(r, '[["Lazy" "open Lazy" [2 1 "Docs"] [2 1 none] ["x" 1 "Docs"]] ["B" "A"] "Lazy" "Late" 4]');
  });

  test('screens show one screen per link; go and the link change it, and on-enter runs', async () => {
    link = ['nowhere'];
    links = [];
    const r = await ev(`
      log: copy []
      root: view [
        global main: screens [
          home "Home" [on-enter [append log 'home] title "Welcome" link "Clients" 'clients]
          clients "Clients" [global list people [name] on-select [go [client row/id]]]
          client "Client" [id] [on-enter [append log join "client " id  shown/text: id] global shown: text]
        ]
      ]
      first-screen: main/pane/1
      ui-route main ["clients"]
      people/data: reduce [make map! [id 42 name "Ada"]]
      ui-select people first people/data
      at-client: reduce [main/value main/pane/1/text shown/text shown/root = root]
      ui-route main ["client" "x" "extra"]
      go 'clients
      reduce [log first-screen/text first-screen/pane/2/value at-client main/value]`);
    assert.equal(r, `[[home "client 42" home] "Home" clients [[client "42"] "Client" "42" true] [clients]]`);
    assert.deepEqual(links, ['replace home', 'push client/42', 'replace home', 'push clients']);
    await assert.rejects(runSource(host, 'go [nowhere 1]'));
    await assert.rejects(runSource(host, 'view [screens [home "Home" [1] []]]'));
  });

  test('labels are local to their layout and seen by all its handlers; global makes them global', async () => {
    const r = await ev(`
      got: none
      one: view [
        a: text "one"
        tabs ["T" [b: text "tab"]]
        column [button "x" [got: reduce [a/text b/text]]]
        screens [home "Home" [w: text "w" button "y" [got: reduce [w/text a/text]]]]
        global g: text "g"
      ]
      two: view [a: text "two"]
      ui-click first select third one/pane 'pane
      x: got
      home: first select fourth one/pane 'pane
      ui-click second home/pane
      reduce [x got value? 'a value? 'w g/text]`);
    assert.equal(r, '[["one" "tab"] ["w" "one"] false false "g"]');
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

test('localize formats dates, times, numbers, percents and money in the active language', async () => {
  repaints = 0;
  const r = await ev(`
    vals: [2-Nov-2026 2-Nov-2026/16:05 16:05 1234567 1234.5 15.5% EUR$1234.5 USD$-3 "x" none]
    set-language 'es
    es: collect [foreach v vals [keep localize v]]
    set-language "en"
    en: collect [foreach v vals [keep localize v]]
    reduce [es en i18n/language]`);
  // Intl puts no-break spaces before units and day periods
  assert.equal(r.replace(/[\u00a0\u202f]/g, ' '), '[["2/11/2026" "2/11/2026, 16:05" "16:05" "1.234.567" "1234,5" "15,5 %" "1234,50 €" "-3,00 US$" "x" "none"] '
    + '["11/2/2026" "11/2/2026, 4:05 PM" "4:05 PM" "1,234,567" "1,234.5" "15.5%" "€1,234.50" "-$3.00" "x" "none"] en]');
  assert.equal(repaints, 2);
});

test('money fields keep an exact amount in their currency, with min and max', async () => {
  const r = await ev(`
    set-language 'es
    root: view [form [money price "Price" eur min EUR$1 max 1000  money tip "Tip"]]
    p: first select first root/pane 'pane
    t: second select first root/pane 'pane
    ui-input p "1234.5"  big: reduce [p/value p/error]
    ui-blur p
    ui-input p "0.10"  small: reduce [p/value p/error]
    ui-input p "12.5"  ok: reduce [p/value p/error]
    ui-input p "abc"  bad: p/value
    ui-input t "-3"
    reduce [p/style p/name p/currency big small ok bad t/value t/currency]`);
  assert.equal(r.replace(/[\u00a0\u202f]/g, ' '), '[money price EUR [EUR$1234.50 none] [EUR$0.10 "Debe ser como mínimo 1,00 €"] [EUR$12.50 none] none -$3.00 none]');
});

test('date fields keep a date!, with min, max and required', async () => {
  const r = await ev(`
    set-language 'es
    root: view [form [date due "Due date" required min 1-Jan-2026 max 31-Dec-2026]]
    d: first select first root/pane 'pane
    ui-input d "2026-11-03"  ok: reduce [d/value validate-face d]
    ui-input d "2025-12-31"  early: validate-face d
    ui-input d "2027-01-01"  late: validate-face d
    ui-input d none  empty: validate-face d
    reduce [d/style d/name ok early late empty]`);
  assert.equal(r, '[date due [3-Nov-2026 none] "Debe ser como mínimo 1/1/2026" "Debe ser como máximo 31/12/2026" "Este campo es obligatorio"]');
});

test('text that is not a number, amount or date stays, with its message', async () => {
  const r = await ev(`
    root: view [form [number n "N"  money m "M"  date d "D"  field email "E" date]]
    fs: select first root/pane 'pane
    foreach f copy/part fs 3 [ui-input f "abc"]
    out: collect [foreach f copy/part fs 3 [keep/only reduce [f/value f/typed validate-face f]]]
    ui-input first fs "12"
    append out reduce [fs/1/value fs/1/typed  fs/4/name  fs/4/rules]
    ui-blur fs/2
    append out fs/2/error
    set-values first root/pane none
    append out reduce [fs/2/typed fs/2/error]
    out`);
  assert.equal(r, '[[none "abc" "Enter a number"] [none "abc" "Enter an amount"] [none "abc" "Enter a valid date"] 12 none email none "Enter an amount" none none]');
});

test('upload fields keep a block of chosen files; refused ones give a message', async () => {
  const r = await ev(`
    root: view [form [upload docs "Attachments" multiple required accept ["pdf" "png"]  upload one "One"]]
    fs: select first root/pane 'pane
    d: fs/1  o: fs/2
    out: reduce [d/name d/multiple d/accept validate-face d]
    ui-files d test-files []
    ui-files d copy/part test-files 4 ["c.exe"]
    append out reduce [length? d/value d/value/1/name d/value/2/size handle? d/value/3/file validate-face d]
    ui-remove-file d 1
    append out reduce [length? d/value d/value/1/name validate-face d]
    ui-remove-file d 1  ui-remove-file d 1
    append out reduce [d/value validate-face d]
    ui-files o test-files []
    append out reduce [length? o/value o/value/1/name  (select form-values first root/pane 'one) = o/value]
    out`);
  assert.equal(r, '[docs true ["pdf" "png"] "This field is required" 3 "a.pdf" 2000 true "Only pdf, png files" 2 "b.png" none none "This field is required" 1 "a.pdf" true]');
});

test('dates are read in the order of the language', () => {
  const cases: [string, string, string | null][] = [
    ['3/11/2026', 'es', '2026-11-03'], ['11/3/2026', 'en', '2026-11-03'], ['3-11-26', 'es', '2026-11-03'],
    ['2026-11-03', 'en', '2026-11-03'], ['23.11.2026', 'de', '2026-11-23'], ['31/2/2026', 'es', null],
    ['3/11', 'es', null], ['x', 'es', null],
  ];
  for (const [typed, lang, want] of cases) assert.equal(readDate(typed, lang), want, `${lang} ${typed}`);
  assert.deepEqual(['es', 'en', 'en-GB'].map(weekStart), [1, 7, 1]);
});

test('amounts are read and edited in the format of the language', () => {
  const cases: [string, string, string | null][] = [
    ['1234,56', 'es', '1234.56'], ['1.234,56 €', 'es', '1234.56'], ['12.5', 'es', '12.5'],
    ['1.234', 'es', '1234'], ['1.234.567', 'es', '1234567'], ['1,234.5', 'en', '1234.5'],
    ['€1,234', 'en', '1234'], ['1,5', 'en', '1.5'], ['-3', 'es', '-3'],
    ['abc', 'es', null], ['1,2,3', 'es', null], ['', 'en', null],
  ];
  for (const [typed, lang, want] of cases) assert.equal(readLocal(typed, lang), want, `${lang} ${typed}`);
  const eur = money({ d: 123450n, e: 2 }, 'EUR');
  assert.deepEqual([editLocal(eur, 'es'), editLocal(eur, 'en'), editLocal(NONE, 'es')], ['1234,50', '1234.50', '']);
});

test('texts show in the active language and fall back to the main one', async () => {
  assert.equal(await ev('label: translated [es "Solicitud" en "Application"]  i18n/language: \'en  tr label'), '"Application"');
  assert.equal(await ev('tr translated "Plazo"'), '"Plazo"');
  assert.equal(await ev('i18n/texts/save: translated [es "Guardar" en "Save"]  tr \'save'), '"Save"');
  assert.equal(await ev('i18n/language: \'es  tr \'save'), '"Guardar"');
  assert.equal(await ev('tr \'unknown-word'), '"unknown-word"');
  assert.equal(await ev('tr none'), '""');
});

test('interface texts per language or from the dictionary follow the active language', async () => {
  await ev(`
    i18n/texts/save: #(en: "Save" es: "Guardar")
    i18n/texts/name: #(en: "Name" es: "Nombre")
    root: view [
      t: title #(en: "Designer" es: "Diseñador")
      b: button 'save
      l: link #(en: "Home" es: "Inicio") 'home
      tabs ['name [text "x"] "Plain" [text "y"]]
      list people [name 'name]
      form [field who 'name required]
    ]
  `);
  const shown = async (src: string): Promise<string> => translate(await runSource(host, src), host.rt);
  await ev("i18n/language: 'en");
  assert.deepEqual(
    [await shown('root/pane/1/text'), await shown('root/pane/2/text'), await shown('root/pane/3/text'), await shown('root/pane/4/pane/1/text')],
    ['Designer', 'Save', 'Home', 'Name'],
  );
  assert.equal(await ev('root/pane/3/value'), 'home');
  assert.equal(await ev('root/pane/5/columns'), "[name name]");
  await ev("i18n/language: 'es");
  assert.deepEqual([await shown('root/pane/1/text'), await shown('root/pane/2/text'), await shown('root/pane/4/pane/2/text')], ['Diseñador', 'Guardar', 'Plain']);
  assert.equal(await ev('f: root/pane/6/pane/1  ui-blur f  f/error'), '"Este campo es obligatorio"');
  // Trebol's own texts: in the active language, and an app may change them or add a language
  assert.equal(uiText(host.rt, 'back'), 'Atrás');
  assert.equal(uiText(host.rt, 'remove-file', 'a.pdf'), 'Quitar a.pdf');
  await ev(`i18n/language: 'fr  i18n/ui/back/fr: "Retour"  i18n/ui/close: #(en: "Done")`);
  assert.deepEqual([uiText(host.rt, 'back'), uiText(host.rt, 'close'), uiText(host.rt, 'nothing-here')], ['Retour', 'Done', 'nothing-here']);
});

test('a view takes its width at the head; inert faces; screen titles per language', async () => {
  assert.equal(await ev('v: layout [on-key [x: 1] width large text "a"]  reduce [v/size length? v/pane v/events/1]'), '[large 1 on-key]');
  assert.equal(await ev('v: layout [text "a"]  v/size'), 'none');
  assert.equal(await ev('f: first layout/only [panel drag inert [field "Name"]]  reduce [f/inert f/drag]'), '[true true]');
  assert.equal(await ev('f: first layout/only [grid [1 4 1] [text "a" text "b" text "c"]]  reduce [f/cols length? f/pane]'), '[[1 4 1] 3]');
  assert.equal(await ev('f: first layout/only [grid 3 []]  reduce [f/cols f/pane]'), '[3 []]');
  link = [];
  const r = await ev(`v: view [screens [home #(en: "Home" es: "Inicio") [text "x"] about 'about [text "y"]]]
    sc: v/pane/1  reduce [tr sc/pane/1/text  pick sc/data 6]`);
  assert.equal(r, '["Home" about]');
});

