// The UI dialect (src/ui/ui.trb) without a browser: layout, faces,
// validation and events, with `show` and `apply-theme` captured here.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { K, NONE, UNSET, load, spell, TRUE, FALSE, native, value, mold, form, string, text, money, blockOf, errorField, type Cell, type ObjectCell, type StringCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, readLocal, editLocal, readDate, readRange, readTime, weekStart, fileSize, translate, uiText, amountOf, countStep, shown as shownLocal, type Host } from '../src/host/index.ts';
import { fileHandle } from '../src/host/net.ts';
import { themeCss, DEFAULT_THEME, LOOKS, palette, contrast, contrastOverImage, scrimAlpha, CONTRAST_PAIRS } from '../src/host/theme.ts';

let shown: Cell | null = null;
let themed: Cell | null = null;
native('show', '[root [object!]]', (_t, f) => {
  shown = f.args[0]!;
  return value(shown);
});
native('ui-watch', '[object [object!]]', (_t, f) => value(f.args[0]!));
let toasts: string[] = [];
native('show-toast', '[message [string!] kind [word! none!] undo [integer! none!]]', (_t, f) => {
  toasts.push(mold(f.args[0]!) + ' ' + mold(f.args[1]!));
  return value(f.args[0]!);
});
native('hide-toast', '[id [integer!]]', () => value(UNSET));
let asked: string[] = [];
native('show-confirm', '[question [string!] yes [string! none!] no [string! none!] kind [word! none!]]', (_t, f) => {
  asked.push(f.args.slice(0, 4).map(a => mold(a)).join(' '));
  // the user says yes to every question but the second
  return value(asked.length === 2 ? FALSE : TRUE);
});
let printed: string[] = [];
native('print-faces', '[face [object! none!]]', (_t, f) => {
  const a = f.args[0]!;
  printed.push(a.t === K.Object ? mold(a.ctx.vals[a.ctx.keys.findIndex(k => spell(k) === 'style')]!) : 'page');
  return value(NONE);
});
native('apply-theme', '[spec [object!]]', (_t, f) => {
  themed = f.args[0]!;
  return value(themed);
});

let backs = 0;
let canBack = false;
native('route-back', '[]', () => { backs++; return value(canBack ? TRUE : FALSE); });
let steps = [0, 0];
let forwards = 0;
native('route-steps', '[]', () => value(blockOf(K.Block, steps.map(n => ({ t: K.Integer, v: n }) as Cell))));
native('route-forward', '[]', () => { forwards++; return value(steps[1]! > 0 ? TRUE : FALSE); });

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

let undos = 0;
native('route-undo', '[]', () => { undos++; return value(NONE); });
let marks: boolean[] = [];
native('set-unsaved', '[on [logic!]]', (_t, f) => { marks.push(f.args[0]!.t === K.Logic && f.args[0]!.v); return value(f.args[0]!); });

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

  test('a second block after the options of a choice or radio is its action, not run while laid out', async () => {
    const r = await ev(`ran: false
      root: view [radio size "Size" ["S" "L"] [ran: value] choice c "C" ["a"] [ran: true]]
      r: first root/pane
      a: reduce [ran r/options block? r/action]
      ui-input r "L"
      append a ran`);
    assert.equal(r, '[false ["S" "L"] true "L"]');
  });

  test('a title followed by a block is a group of options, reduced like the rest', async () => {
    const r = await ev(`city: "City"
      root: view [choice bike "Bike" ["Adults" ["Road" city] #(en: "Children" es: "Niños") ["Child's"] "Other"]]
      select first root/pane 'options`);
    assert.equal(r, '["Adults" ["Road" "City"] #(en: "Children" es: "Niños") ["Child\'s"] "Other"]');
  });

  test('unknown styles are an error', async () => {
    await assert.rejects(runSource(host, 'view [nonsense "x"]'));
  });

  // the error a layout makes: its message, near and at
  async function problems(src: string): Promise<string[]> {
    try {
      await runSource(host, src, 'app.trb');
    } catch (e) {
      const err = e as ObjectCell;
      return [form(errorField(err, 'message')), mold(errorField(err, 'near')), form(errorField(err, 'at'))];
    }
    return assert.fail(`${src}\n  lays out with no problem`);
  }

  test('a layout gives every problem in it at once, each with its place and a word it may mean', async () => {
    assert.deepEqual(await problems(`view [
    title "Cog & Chain"
    buton "Save"
    field name "Name" requird
    feild bike "Bike"
    number price "Price" min "x"
    text "ok" 1.5
    table [name 1]
    panel pad 9 []
]`), [
      `layout: 7 problems
   app.trb:3:5  buton is not a style; did you mean button?
   app.trb:4:23 requird is not a word of field; did you mean required?
   app.trb:5:5  feild is not a style; did you mean field?
   app.trb:6:26 min takes a number, an amount, a date or a time
   app.trb:7:15 text does not take 1.5
   app.trb:8:17 table columns are words, each with an optional label, then image or image round
   app.trb:9:11 pad takes a step from 0 to 7`,
      '[buton "Save" field]', 'app.trb:3:5']);
    // one problem is the message itself
    assert.deepEqual(await problems('view [button "Go" hiden]'),
      ['layout: hiden is not a word of button; did you mean hidden?', '[hiden]', 'app.trb:1:19']);
    assert.deepEqual(await problems('view [text "a" loop]'), ['layout: loop is not a word of text', '[loop]', 'app.trb:1:16']);
    // a board needs its lanes and the field that names them
    assert.equal((await problems('view [board jobs by status [todo]]'))[0], 'layout: a board takes a word and a label for each lane');
    assert.equal((await problems('view [board jobs [todo "To do"]]'))[0],
      'layout: a board takes by and the field that names the lane of a card: by status');
    assert.equal((await problems('view [board jobs by status]'))[0], 'layout: a board takes a block with a word and a label for each lane');
    // a slider's ends go least first, and its step fits between them
    assert.equal((await problems('view [slider v "V" 50 10]'))[0],
      'layout: a slider takes its least and its most as two numbers, the least first: 0 100');
    assert.equal((await problems('view [time t "T" step 7.5]'))[0],
      'layout: a time\'s step is a whole number of minutes from 1 to 720');
    assert.equal((await problems('view [slider v "V" 0 10 step 0]'))[0],
      'layout: a slider\'s step is a number above 0 and no more than its most less its least');
    await runSource(host, 'view [slider v "V" step 5]', 'app.trb');
    // an on- word that no event has
    assert.deepEqual(await problems('view [field name on-chnage [print 1]]'),
      ['layout: on-chnage is not an event; did you mean on-change?', '[on-chnage [print 1]]', 'app.trb:1:18']);
    assert.equal((await problems('view [button "Go" on-clik [print 1]]'))[0],
      'layout: on-clik is not an event; the block after a face runs when it is clicked');
    assert.equal((await problems('view [on-clse [true] text "a"]'))[0], 'layout: on-clse is not an event; did you mean on-close?');
    assert.equal((await problems('view [screens [home "Home" [on-entr [true] text "a"]]]'))[0],
      'layout: on-entr is not an event; did you mean on-enter?');
    assert.deepEqual(await problems('view ["Hello" text "a"]'),
      ['layout: a face starts with a style, not "Hello"', '["Hello" text "a"]', 'app.trb:1:7']);
    assert.deepEqual((await problems('view [menu ["A" a]]'))[0], 'layout: menu is not a style; it goes after one');
    assert.deepEqual((await problems('view [button "a" menu ["A"]]'))[0],
      'layout: a menu takes a label and a word per item, danger before one that removes, a block for a submenu, or ---');
    assert.deepEqual((await problems('view [tabs ["A" [text "a"] "B" 1]]')).slice(0, 2),
      ['layout: tabs take a label and a block per tab', '["B" 1]']);
    assert.deepEqual((await problems('view [split [text "a"]]'))[0], 'layout: split takes two faces, one per pane');
    assert.deepEqual((await problems('view [table [a] sorted [a up]]'))[0], 'layout: sorted takes a column and asc or desc');
    assert.deepEqual((await problems('view [text "a" morph 3]'))[0], "layout: morph takes a name, 'logo, or a block, [client id]");
    assert.deepEqual((await problems('view [breadcrumb ["A" a "B" "C"]]')).slice(0, 2),
      ['layout: a breadcrumb takes a label and a word per item; only the last may have no word', '["C"]']);
    assert.deepEqual((await problems('view [screens [home "Home" [1] [text "a"]]]')).slice(0, 2),
      ['layout: the arguments of a screen are words', '[1]']);
    // the faces of a screen are laid out when it is shown, and checked then
    assert.deepEqual((await problems('view [screens [home "Home" [txt "a"]]]'))[0], 'layout: txt is not a style; did you mean text?');
    // problems inside a block of faces, and in a layout/only
    assert.deepEqual((await problems('layout/only [panel [button "a" big]]'))[0], 'layout: big is not a word of button');
    // a block made at run time has no place to give
    assert.deepEqual(await problems('view compose [(to word! "buton") "Save"]'),
      ['layout: buton is not a style; did you mean button?', '[buton "Save"]', 'app.trb:1:1']);
    assert.deepEqual(await problems(`stylize [big: buton []]`).then(p => p[0]), 'stylize: unknown style buton; did you mean button?');
  });

  test('an error in code a layout runs is that error, and a later layout still collects its own problems', async () => {
    assert.deepEqual(await problems('view [choice "A" [1 + "x"]]'), ['+ does not allow string! for its b argument', '[1 + "x"]', 'app.trb:1:19']);
    assert.equal((await problems('view [text "a" oops]'))[0], 'layout: oops is not a word of text');
    assert.equal(await ev('length? layout/only [text "a" text "b"]'), '2');
  });

  test('loaded-at gives where a value of a block was loaded from', async () => {
    assert.equal(mold(await runSource(host, 'b: [\n  a  b]  reduce [loaded-at b  loaded-at next b  loaded-at tail b  loaded-at append copy [] 1]', 'x.trb')),
      '["x.trb:2:3" "x.trb:2:6" none none]');
    assert.equal(await ev('loaded-at next copy [a b]'), '"1:24"');
    assert.equal(await ev('loaded-at next second copy/deep [a [b c]]'), '"1:39"');
  });

  test('a face keeps where it was written, for the dev tools', async () => {
    assert.equal(mold(await runSource(host, 'v: layout [\n  text "a"\n  row [button "b"]]  reduce [v/pane/1/place  v/pane/2/pane/1/place]', 'x.trb')),
      '["x.trb:2:3" "x.trb:3:8"]');
    assert.equal(await ev('first reduce [get in first layout/only compose [(to word! "text") "a"] \'place]'), 'none');
  });

  test('a face keeps where its first and last values were written, label included', async () => {
    assert.equal(mold(await runSource(host, 'v: layout [\n  who: field name "Name" required\n  row [button "b"]]  reduce [v/pane/1/written  v/pane/2/written  v/pane/2/pane/1/written]', 'x.trb')),
      '[["x.trb:2:3" "x.trb:2:26"] ["x.trb:3:3" "x.trb:3:7"] ["x.trb:3:8" "x.trb:3:15"]]');
  });

  test('ui-sketch lays a block out running none of its code, with its problems', async () => {
    assert.equal(mold(await runSource(host, 'r: ui-sketch [text (crash) button "Go" [crash] buton "y"]  reduce [length? r/1/pane  r/1/pane/2/text  r/2/2]', 'x.trb')),
      '[2 "Go" "buton is not a style; did you mean button?"]');
  });

  test('ui-dialect-words gives an app the words of the dialect, as a designer colours them', async () => {
    assert.equal(mold(await runSource(host, 'w: ui-dialect-words  reduce [to logic! find w \'field  to logic! find w \'required  to logic! find w \'segmented  to logic! find w \'print]', 'x.trb')),
      '[true true true false]');
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

  test('rules of your own, by name', async () => {
    const r = await ev(`
      rule 'even "Enter an even number" [all [v: attempt [to integer! value]  even? v]]
      rule 'shop-code [en "Not a shop code" es "No es un código de la tienda"] [
        either find/match value "SH-" [to logic! find/match skip value 3 "9"] ["Codes start with SH-"]
      ]
      fs: layout/only [field n "N" even  field c "C" shop-code required]
      n: fs/1  c: fs/2
      out: copy []
      foreach v reduce ["3" "4" none] [ui-input n v  append out validate-face n]
      foreach v ["x" "SH-1" "SH-9"] [ui-input c v  append out validate-face c]
      i18n/language: 'es  ui-input c "SH-1"  append out validate-face c
      poke i18n/ui 'even #(en: "Even, please")  i18n/language: 'en  ui-input n "5"  append out validate-face n
      append/only out n/rules
      out`);
    assert.equal(r, '["Enter an even number" none none "Codes start with SH-" "Not a shop code" none "No es un código de la tienda" "Even, please" [[even]]]');
  });

  test('a rule takes no word of the dialect or of Trebol\'s texts, and a typo names it', async () => {
    const r = await ev(`
      rule 'even "Enter an even number" [even? to integer! value]
      reduce [
        (rule 'even "Even" [true]) = 'even
        attempt [rule 'email "x" [true]]
        attempt [rule 'button "x" [true]]
        attempt [rule 'yes "x" [true]]
        attempt [rule 'on-change "x" [true]]
        to logic! find form try [layout [field n "N" evn]] "did you mean even?"
      ]`);
    assert.equal(r, '[true none none none none true]');
  });

  test('iban', async () => {
    const r = await ev(`
      f: first layout/only [field account "Account" iban]
      collect [foreach v ["ES91 2100 0418 4502 0005 1332" "es9121000418450200051332" "ES91 2100 0418 4502 0005 1333" "XX00"] [
        ui-input f v  keep validate-face f
      ]]`);
    assert.equal(r, '[none none "Enter a valid IBAN" "Enter a valid IBAN"]');
  });
});

describe('errors from a server', () => {
  test('field-error shows on the field until the user changes it', async () => {
    await ev(`view [
      global f: form [
        field code "Code"
        submit "Save" []
      ]
    ]`);
    assert.equal(await ev('field-error f \'code "Already taken"'), 'true');
    assert.equal(await ev('c: first f/pane  c/error'), '"Already taken"');
    assert.equal(await ev('b: second f/pane  b/disabled'), 'true');
    assert.equal(await ev('ui-input c "other"  c/error'), 'none');
    assert.equal(await ev('b/disabled'), 'false');
    assert.equal(await ev('field-error f \'nope "x"'), 'false');
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
    assert.equal(mold(themed!).replace(/\s+/g, ' '), "make object! [ base: 160 neutral: 'warm mode: 'dark ]");
    await ev("theme 'civic");
    assert.equal(mold(themed!).replace(/\s+/g, ' '), "make object! [ look: 'civic ]");
  });

  test('the looks with a name are the looks the host has', async () => {
    const names = await ev('collect [foreach [label name] looks [keep name]]');
    assert.equal(names, `[${Object.keys(LOOKS).join(' ')}]`);
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

  test('choosing a header sorts by that column, and choosing it again reverses the order', async () => {
    const r = await ev(`
      root: view [global table t [name total] sortable sorted [total desc]]
      a: copy t/sorted
      ui-sort t 'name b: copy t/sorted
      ui-sort t 'name c: copy t/sorted
      ui-sort t 'total
      reduce [t/sortable a b c t/sorted t/totals]`);
    assert.equal(r, '[true [total desc] [name asc] [name desc] [total asc] none]');
  });

  test('on-sort gets the column and the new order, and sorted is already set', async () => {
    const r = await ev(`
      got: none
      root: view [global table t [name total] on-sort [got: reduce [event/type event/column event/order face/sorted]]]
      ui-sort t 'total
      reduce [got t/sortable]`);
    assert.equal(r, '[[sort total asc [total asc]] false]');
  });

  test('sorted takes a column and asc or desc', async () => {
    await assert.rejects(runSource(host, 'view [table t [name] sorted [name up]]'));
    await assert.rejects(runSource(host, 'view [table t [name] sorted ["name" asc]]'));
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

  test('confirm asks the host and gives the answer', async () => {
    asked = [];
    const r = await ev(`reduce [
      confirm "Remove it?"
      confirm/role "Remove all?" 'danger
      confirm/with #(en: "Keep it?" es: "¿Guardarlo?") [#(en: "Keep" es: "Guardar") "Drop"]
    ]`);
    assert.equal(r, '[true false true]');
    assert.deepEqual(asked, ['"Remove it?" none none none', '"Remove all?" none none danger', '"Keep it?" "Keep" "Drop" none']);
  });

  test('print-page prints the page, or one face with /only', async () => {
    printed = [];
    await ev(`root: view [global bill: panel [text "Total"]] print-page print-page/only bill`);
    assert.deepEqual(printed, ['page', 'panel']);
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

  test('an image takes a size, as in Red, and can be round', async () => {
    const r = await ev(`
      i: first select view [image %ada.jpg "Ada" 48x48 round] 'pane
      reduce [i/extent i/round i/text]`);
    assert.equal(r, '[48x48 true "Ada"]');
  });

  test('a column of a table or list can show each row\'s picture', async () => {
    const r = await ev(`
      root: view [table people [photo "" image round  logo image  name "Name"]  list l [pic image  name]]
      reduce [select first root/pane 'columns  select second root/pane 'columns]`);
    assert.equal(r, '[[photo ["" image round] logo ["logo" image] name "Name"] [pic ["pic" image] name "name"]]');
  });

  test('a video and a sound take a poster, captions, loop, muted, autoplay and on-end', async () => {
    const r = await ev(`
      root: view [
        video %intro.mp4 "Intro" poster %intro.jpg captions [en %en.vtt es %es.vtt] loop muted on-end [done: true]
        audio %bell.m4a autoplay small
        text "Quiet" muted
      ]
      v: first root/pane  a: second root/pane  t: third root/pane
      reduce [v/style v/value v/text v/poster v/captions v/looping v/silent v/role v/events/1
        a/style a/autoplay a/silent a/size t/role]`);
    assert.equal(r, '[video %intro.mp4 "Intro" %intro.jpg [en %en.vtt es %es.vtt] true true none on-end audio true false small muted]');
  });

  test('a backdrop takes its image from a file or an address', async () => {
    const r = await ev(`
      root: view [backdrop %entry.jpg  title "Hi"  panel [backdrop https://example.com/a.png  text "In"]]
      b: first root/pane
      p: third root/pane
      reduce [b/style b/value select first p/pane 'value]`);
    assert.equal(r, '[backdrop %entry.jpg https://example.com/a.png]');
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
    assert.equal(r, '[[focus "Ada" true "Ada" [#"^M" false true] [left true false] #"z"] "Ctrl+S" 1 none]');
  });

  test('menus follow Red: label and word, --- and submenus; on-menu gets event/picked and the row', async () => {
    const r = await ev(`
      got: none
      root: view [
        global list people [name] menu [#edit "Edit" edit --- "Move to" ["Top" top] danger #trash "Delete" delete] on-menu [got: reduce [event/picked row/name]]
        button "File" menu ["New" new]
      ]
      m: people/menu
      people/data: reduce [make map! [id 1 name "Ada"] make map! [id 2 name "Alan"]]
      ui-menu people first m second people/data
      a: got
      sub: third m
      ui-menu people first sub/items none
      reduce [a got length? m m/2/divider m/1/icon sub/text people/selected/id m/1/danger m/4/danger m/4/icon]`);
    assert.equal(r, '[[edit "Alan"] [top "Alan"] 4 true #edit "Move to" 2 false true #trash]');
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

  test('fit is a flag of any container', async () => {
    assert.equal(await ev(`root: view [global g: grid 2 fit []]  g/fit`), 'true');
  });

  test('a desktop is a container with an optional picture, and a tile acts and has its own menu', async () => {
    const r = await ev(`
      opened: none
      root: view [
        global mat: desktop %mat.png menu ["New" new] [
          global t: tile #folder "Reports" [opened: true] menu ["Delete" delete]
        ]
      ]
      ui-click t
      reduce [mat/style mat/value mat/menu/1/id t/style t/icon t/text t/menu/1/id opened]`);
    assert.equal(r, '[desktop %mat.png new tile #folder "Reports" delete true]');
  });

  test('a tile can say it stands for something kept elsewhere', async () => {
    const r = await ev(`
      root: view [desktop [global a: tile #folder "Here" []  global b: tile #folder "Elsewhere" linked []]]
      reduce [a/linked b/linked]`);
    assert.equal(r, '[false true]');
  });

  test('a tile takes a mark: an icon and its label, right after it', async () => {
    const r = await ev(`
      fs: layout/only [tile #folder "Records" [] mark #list "List" linked  tile #invoice "Bills" mark #stack 'many []]
      out: reduce [fs/1/mark fs/1/mark-text fs/1/linked fs/1/text fs/2/mark fs/2/mark-text]
      append out to logic! find form try [layout [tile #folder "X" mark #list]] "mark takes an icon and its label, #list"
      out`);
    assert.equal(r, '[#list "List" true "Records" #stack many true]');
  });

  test('a word the program sets never takes the place of one the dialect uses', async () => {
    const r = await ev(`
      form: "mine"  tr: func [x] ["hijacked"]  can?: func [a b c] [none]  message: 1  refresh: 2
      f: first layout/only [field a "A" email]
      ui-input f "bad"
      reduce [validate-face f  form  refresh]`);
    assert.equal(r, '["Enter a valid email address" "mine" 2]');
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
    assert.equal(await ev(`
      root: view [global crumbs2: breadcrumb ["Home" home "Client" client/42 "Now"] [went: value]]
      ui-crumb crumbs2 'client/42
      went`), 'client/42');
  });

  test('an orbit keeps its block; picking a node runs its action, stepping back runs on-back', async () => {
    const r = await ev(`
      log: copy []
      root: view [
          global around: orbit "Organization" [
              focus pleno
              nodes [pleno "Pleno" [primary count 9]  marta "Marta" [accent]  "x-1" #(en: "Other" es: "Otro")]
              edges [pleno marta "Members"  marta pleno "Holder" [dashed]]
              trail [town]
          ] [append log reduce ['in value]] on-back [append log reduce ['back value]]
          global plain: orbit [focus a nodes [a "A" b "B"] trail [z]] [append log reduce ['picked value]]
      ]
      ui-orbit around 'marta false
      ui-orbit around 'town true
      ui-orbit plain 'z true
      around/data: [focus marta]
      reduce [log  first around/data  around/value]`);
    assert.equal(r, '[[in marta back town picked z] focus town]');
    await assert.rejects(runSource(host, 'view [orbit [focus a nodes [a "A" b] edges [a b "L" [wavy]] colour red]]'), (e: ObjectCell) => {
      const m = form(errorField(e, 'message'));
      for (const p of ['nodes takes an id and a title for each', 'edges takes two ids for each', 'an orbit takes focus id']) assert.ok(m.includes(p), m);
      return true;
    });
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
    links = [];
    await ev("go to path! [client 7]");
    assert.deepEqual(links, ['push client/7']);
    await assert.rejects(runSource(host, 'go [nowhere 1]'));
    await assert.rejects(runSource(host, 'view [screens [home "Home" [1] []]]'));
  });

  test('morph names a face for the next screen: a word as written, or a block whose first word stays and the rest is evaluated', async () => {
    link = ['nowhere'];
    const r = await ev(`
      root: view [
        global main: screens [
          home "Home" [global people: table morph 'person [name] image %logo.svg morph 'logo]
          person "Person" [id] [global who: title morph [person id] global code: text morph [label 1 + 1]]
        ]
      ]
      a: reduce [people/morph main/pane/1/pane/2/morph]
      go [person 7]
      reduce [a who/morph code/morph]`);
    assert.equal(r, '[[person logo] [person "7"] [label 2]]');
  });

  test('a form on a screen entered later starts with its submit disabled until its fields are valid', async () => {
    const r = await ev(`
      view [screens [home "Home" [text "h"] edit "Edit" [global f: form [field name "Name" required submit "Save" [x: 1]]]]]
      go 'edit
      a: select last f/pane 'disabled
      ui-input first f/pane "Ana"
      reduce [a select last f/pane 'disabled]`);
    assert.equal(r, '[true false]');
  });

  test('a screen is not shown until its on-enter ends, also if it fails or goes elsewhere', async () => {
    link = ['home'];
    const r = await ev(`
      seen: copy []
      print-nothing: func [] [exit]
      view [
        global main: screens [
          home "Home" [text "x"]
          slow "Slow" [on-enter [append seen main/entering  print-nothing]]
          broken "Broken" [on-enter [do make error! "bad"]]
          away "Away" [on-enter [go 'slow  append seen main/entering]]
        ]
      ]
      go 'slow
      append seen main/entering
      attempt [go 'broken]
      append seen main/entering
      go 'away
      append seen reduce [main/entering main/value]
      seen`);
    assert.equal(r, '[true false false true false false [slow]]');
  });

  test('on-leave runs before leaving a screen by go or the link, and false or continue keep it', async () => {
    link = ['home'];
    undos = 0;
    const r = await ev(`
      seen: copy []
      answer: false
      view [global main: screens [
        home "Home" [on-leave [append seen 'leave  answer] text "x"]
        other "Other" [text "y"]
      ]]
      go 'other
      append/only seen copy main/value
      ui-route main ["other"]
      append/only seen copy main/value
      answer: 'continue
      go 'other
      append/only seen copy main/value
      answer: none
      go 'other
      append/only seen copy main/value
      seen`);
    assert.equal(r, '[leave [home] leave [home] leave [home] leave [other]]');
    assert.equal(undos, 1);
  });

  test('unsaved marks the screen: leaving asks, no stays, and a new screen starts unmarked', async () => {
    link = ['home'];
    asked = [];
    marks = [];
    undos = 0;
    const r = await ev(`
      view [global main: screens [home "Home" [text "x"] other "Other" [text "y"]]]
      unsaved yes
      a: unsaved?
      go 'other
      b: reduce [main/value unsaved?]
      unsaved yes
      ui-route main ["home"]
      reduce [a b main/value unsaved?]`);
    // the first question is answered yes (it went), the second no (it stayed)
    assert.equal(r, '[true [[other] false] [other] true]');
    assert.deepEqual(asked, ['"Leave without saving?" "Leave" "Stay" danger', '"Leave without saving?" "Leave" "Stay" danger']);
    assert.equal(undos, 1);
    assert.deepEqual(marks, [false, true, false, true]);
  });

  test('go-back asks the page to go back, or goes to the screen given when it came from outside', async () => {
    link = ['home'];
    backs = 0;
    canBack = true;
    const r = await ev(`
      view [global main: screens [home "Home" [text "x"] other "Other" [text "y"]]]
      go-back 'other
      at-first: main/value
      at-first`);
    assert.equal(r, '[home]');
    assert.equal(backs, 1);
    canBack = false;
    assert.equal(await ev(`go-back 'other  main/value`), '[other]');
    assert.equal(backs, 2);
  });

  test('go-forward asks the page to go forward; can-go-back? and can-go-forward? read where it stands', async () => {
    link = ['home'];
    forwards = 0;
    steps = [0, 0];
    assert.equal(await ev(`reduce [can-go-back? can-go-forward? go-forward]`), '[false false false]');
    steps = [2, 1];
    assert.equal(await ev(`reduce [can-go-back? can-go-forward? go-forward]`), '[true true true]');
    assert.equal(forwards, 2);
  });

  test('screens run on-change after each screen is entered, the first too', async () => {
    link = ['home'];
    const r = await ev(`
      seen: copy []
      view [global main: screens on-change [append/only seen copy value] [
          home "Home" [text "x"]
          away "Away" [on-enter [go 'other]]
          other "Other" [text "y"]
      ]]
      go 'away
      ui-route main ["home"]
      seen`);
    assert.equal(r, '[[home] [other] [home]]');
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
  test('every look meets WCAG AA in both modes, and draws its icons and lines its own way', () => {
    for (const [name, look] of Object.entries(LOOKS)) {
      for (const dark of [false, true]) {
        const p = palette({ ...DEFAULT_THEME, ...look }, dark);
        for (const [fg, bg] of CONTRAST_PAIRS) {
          const c = contrast(p[fg], p[bg]);
          assert.ok(c >= 4.5, `${fg} on ${bg}: ${c.toFixed(2)} (${name}, ${dark ? 'dark' : 'light'})`);
        }
      }
    }
    const css = themeCss({ ...DEFAULT_THEME, ...LOOKS['ink'] });
    assert.ok(css.includes('--tb-icon-stroke: 2.75;') && css.includes('--tb-icon-join: miter;') && css.includes('--tb-line: 2px;'));
    assert.ok(css.includes('--tb-shadow-1: none;'));
  });

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

  test('the veil over a backdrop keeps text AA on any image, for every look, hue and mode', () => {
    const themes = [
      ...Object.values(LOOKS).map(look => ({ ...DEFAULT_THEME, ...look })),
      ...Array.from({ length: 36 }, (_, i) => ({ ...DEFAULT_THEME, base: i * 10, accent: (i * 10 + 150) % 360 })),
    ];
    for (const t of themes) {
      for (const dark of [false, true]) {
        const p = palette(t, dark);
        const a = scrimAlpha(p);
        const c = contrastOverImage(p.text, p.bg, a);
        assert.ok(c >= 4.5 && a < 0.8, `text over the veil: ${c.toFixed(2)} at ${a} (hue ${t.base}, ${t.skin}, ${dark ? 'dark' : 'light'})`);
      }
    }
    assert.ok(themeCss(DEFAULT_THEME).includes('--tb-scrim: '));
  });

  test('the stylesheet uses only theme tokens for color in component rules', () => {
    for (const look of Object.values(LOOKS)) {
      const css = themeCss({ ...DEFAULT_THEME, ...look });
      const components = css.slice(css.indexOf('*, *::before'));
      assert.ok(!/#[0-9a-f]{3,6}\b|rgb\(|oklch\(/i.test(components), 'no raw colors in component rules');
    }
    const css = themeCss(DEFAULT_THEME);
    assert.ok(css.includes('@media (prefers-color-scheme: dark)'));
    assert.ok(!themeCss({ ...DEFAULT_THEME, mode: 'light' }).includes('prefers-color-scheme'));
  });

  test('a button that opens a menu shows a chevron, turned up while the menu is open', () => {
    const css = themeCss(DEFAULT_THEME);
    assert.match(css, /\[aria-expanded="true"\] > \.tb-menu-chevron \{ transform: rotate\(180deg\); \}/);
    assert.match(css, /\.tb-button\.tb-has-icon\[aria-haspopup\]:not\(:has\(> span:not\(:empty\)\)\) \{ width: auto;/);
  });

  test('a narrow form stacks its labels over its controls, wherever it sits', () => {
    const css = themeCss(DEFAULT_THEME);
    assert.match(css, /\.tb-form \{[^}]*container-type: inline-size;/);
    assert.match(css, /@container \(max-width: 420px\) \{[^@]*> \.tb-field > \.tb-label[^}]*grid-column: 1 \/ -1;/);
  });

  test('the classic skin builds controls in relief; the modern one adds nothing', () => {
    const classic = themeCss({ ...DEFAULT_THEME, ...LOOKS['classic'] });
    assert.match(classic, /--tb-bevel-hi: oklch/);
    assert.match(classic, /\.tb-button \{[^}]*box-shadow: var\(--tb-raise\);/);
    assert.match(classic, /\.tb-input \{[^}]*box-shadow: var\(--tb-sink\);/);
    assert.match(classic, /--tb-control: 29px;/);
    const modern = themeCss(DEFAULT_THEME);
    assert.ok(!modern.includes('--tb-raise:') && !modern.includes('--tb-bevel-hi'));
    assert.ok(modern.trimEnd().endsWith('}'));
  });

  test('the title focused on entering a screen paints no focus ring', () => {
    assert.ok(themeCss(DEFAULT_THEME).includes('.tb-screen :is(h1, h2)[tabindex="-1"]:focus { outline: none; }'));
  });

  test('in auto mode an embedding page can force light or dark', () => {
    const css = themeCss(DEFAULT_THEME);
    assert.ok(css.includes(':root:not([data-tb-scheme="light"])'));
    assert.ok(css.includes(':root[data-tb-scheme="dark"]'));
    assert.ok(!themeCss({ ...DEFAULT_THEME, mode: 'light' }).includes('data-tb-scheme'));
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

test('a message under a field changes with the language', async () => {
  const r = await ev(`
    root: view [form [field customer "Customer" required  money price "Price" min 10  field code "Code"]]
    fs: select first root/pane 'pane
    ui-blur fs/1
    ui-input fs/2 "3"  ui-blur fs/2
    ui-input fs/3 "A1"  ui-blur fs/3
    field-error first root/pane 'code "Taken"
    en: reduce [fs/1/error fs/2/error fs/3/error]
    set-language 'es
    es: reduce [fs/1/error fs/2/error fs/3/error]
    set-language 'en
    reduce [en es]`);
  // what a server said stays as it said it
  assert.equal(r, '[["This field is required" "Must be at least 10" "Taken"] ["Este campo es obligatorio" "Debe ser como mínimo 10" "Taken"]]');
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

test('file sizes read in the language: bytes as words, larger sizes as symbols', () => {
  assert.equal(fileSize(1, 'en'), '1 byte');
  assert.equal(fileSize(89, 'en'), '89 bytes');
  assert.equal(fileSize(12_400, 'en'), '12.4 kB');
  assert.equal(fileSize(3_400_000, 'es'), '3,4 MB');
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

test('a widget is an element the page defines: its tag, its properties, its value and its events', async () => {
  const r = await ev(`
    near: 12
    root: view [form [widget <geo-map> place "Place" [zoom: near center: [40.4 -3.7]] required
      on-change [append/only moves face/value] on-moved [append moves event/detail]]]
    moves: copy []
    w: first select first root/pane 'pane
    out: reduce [w/style w/tag w/name w/props/zoom w/props/center validate-face w]
    ui-input w [40.5 -3.6]
    ui-event w 'on-moved [detail: "north"]
    append out reduce [w/value validate-face w moves select form-values first root/pane 'place]
    out`);
  assert.equal(r, '[widget "geo-map" place 12 [40.4 -3.7] "This field is required" [40.5 -3.6] none [[40.5 -3.6] "north"] [40.5 -3.6]]');
});

test('a photo holds the image chosen, or the address of one kept elsewhere', async () => {
  const r = await ev(`
    root: view [form [photo face "Photo" required round  photo logo "Logo" accept ["svg"]]]
    p: first select first root/pane 'pane
    l: second select first root/pane 'pane
    out: reduce [p/style p/name p/round validate-face p]
    ui-files p test-files []
    append out reduce [object? p/value p/value/name handle? p/value/file validate-face p]
    p/touched: false
    ui-remove-file p 1
    append out reduce [p/value p/touched]
    set-values first root/pane make map! [face: "https://example.com/ada.jpg"]
    append out reduce [p/value select form-values first root/pane 'face]
    ui-files l [] ["c.png"]
    ui-files p [] ["c.pdf"]
    append out reduce [validate-face l validate-face p]
    out`);
  assert.equal(r, '[photo face true "This field is required" true "a.pdf" true none none true "https://example.com/ada.jpg" "https://example.com/ada.jpg" "Only svg files" "Only images"]');
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

test('a time is read in any language, with am or pm', () => {
  const cases: [string, string | null][] = [
    ['9:30', '09:30'], ['9.30', '09:30'], ['9h30', '09:30'], ['930', '09:30'], ['21', '21:00'], ['21 h', '21:00'],
    ['9:30 pm', '21:30'], ['9pm', '21:00'], ['12 a.m.', '00:00'], ['12:15 PM', '12:15'], ['24:00', null],
    ['9:60', null], ['13 pm', null], ['x', null],
  ];
  for (const [typed, want] of cases) assert.equal(readTime(typed), want, typed);
});

test('a range of dates is read as two dates, the start first', () => {
  const cases: [string, string, string | null][] = [
    ['3/11/2026 – 10/11/2026', 'es', '2026-11-03 2026-11-10'], ['11/10/2026 - 11/3/2026', 'en', '2026-11-03 2026-11-10'],
    ['2026-11-03 2026-11-10', 'en', '2026-11-03 2026-11-10'], ['3/11/2026', 'es', null],
    ['3/11/2026 – 31/2/2026', 'es', null], ['1/1/2026 2/1/2026 3/1/2026', 'es', null],
  ];
  for (const [typed, lang, want] of cases) assert.equal(readRange(typed, lang), want, `${lang} ${typed}`);
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
  assert.equal(await ev('f: first layout/only [field a "A" readonly required]  f/value: none  reduce [f/readonly validate-face f]'), '[true none]');
  assert.equal(await ev('f: first layout/only [grid [1 4 1] [text "a" text "b" text "c"]]  reduce [f/cols length? f/pane]'), '[[1 4 1] 3]');
  assert.equal(await ev('f: first layout/only [row right middle [text "a"]]  reduce [f/align f/valign]'), '[right middle]');
  assert.equal(await ev('f: first layout/only [row [text "a"]]  f/valign'), 'none');
  // only a row takes top, middle or bottom: after an input style the word still names the field
  assert.equal(await ev('f: first layout/only [field bottom "Bottom"]  reduce [f/name f/valign]'), '[bottom none]');
  assert.equal(await ev('f: first layout/only [grid 3 []]  reduce [f/cols f/pane]'), '[3 []]');
  assert.equal(await ev('p: first layout/only [column inert on-select [set \'got event/face] [text "a" field b "B"]]  ui-select p p/pane/2  reduce [same? got p/pane/2  same? p/selected p/pane/2]'), '[true true]');
  assert.equal(await ev('f: first layout/only [radio mode "View" ["Design" "Code"] segmented]  reduce [f/name f/segmented]'), '[mode true]');
  assert.equal(await ev('f: first layout/only [grid [small 1 large] [text "a" text "b" text "c"]]  reduce [f/cols length? f/pane]'), '[[small 1 large] 3]');
  link = [];
  const r = await ev(`v: view [screens [home #(en: "Home" es: "Inicio") [text "x"] about 'about [text "y"]]]
    sc: v/pane/1  reduce [tr sc/pane/1/text  pick sc/data 6]`);
  assert.equal(r, '["Home" about]');
});


test('rows: a field made of rows the user adds and removes', async () => {
  const start = `v: view [form [rows items "Lines" min 1 max 2 [field product "Product" required  number qty "Qty"] submit "Go"]]
    f: v/pane/1  r: f/pane/1  e: first r/pane  add: last r/pane  `;
  assert.equal(await ev(start + 'reduce [length? r/pane e/style r/value/1/product]'), '[2 entry none]');
  // a required field of a row holds the form back
  assert.equal(await ev(start + 'f/pane/2/disabled'), 'true');
  // the fields of a row are not fields of the form, and each row is its own scope
  assert.equal(await ev(start + `ui-input e/pane/1 "Pen"  ui-input e/pane/2 "2"
    reduce [form-values f  e/pane/1/form/style  f/pane/2/disabled]`), '[#(items: [#(product: "Pen" qty: 2)]) entry false]');
  // add up to max, remove down to min; equal rows are still different rows
  assert.equal(await ev(start + `ui-click add  a: reduce [length? r/value add/disabled]
    second-row: r/pane/2  ui-input second-row/pane/1 "x"
    ui-click last e/pane  b: first r/pane
    reduce [a length? r/value  b/pane/1/value  select last b/pane 'disabled]`), '[[2 true] 1 "x" true]');
  // code assigns the value: the rows are made again
  assert.equal(await ev(start + `r/value: reduce [#(product: "A" qty: 1) #(product: "B" qty: 2)]  ui-rows r
    reduce [length? r/pane  r/pane/2/pane/1/value]`), '[3 "B"]');
  assert.equal(await ev(start + `set-values f #(items: [#(product: "C" qty: 3)])  r/pane/1/pane/2/value`), '3');
  // read-only: no buttons, no rules, nothing to change
  assert.equal(await ev(`r: first layout/only [rows items readonly min 1 [field a required]]
    e: first r/pane  reduce [e/pane/1/readonly  select last e/pane 'hidden  select last r/pane 'hidden]`), '[true true true]');
  // the count is checked
  assert.equal(await ev(`r: first layout/only [rows items required [field a]]  validate-face r`), '"This field is required"');
  assert.equal(await ev(`r: first layout/only [rows items max 1 [field a]]  r/value: [#(a: 1) #(a: 2)]  validate-face r`), '"Must have at most 1 rows"');
  // an action as a second block runs when a row is added or changes
  assert.equal(await ev(`n: 0  v: view [rows items [field a] [n: n + 1]]  r: v/pane/1
    ui-click last r/pane  e: first r/pane  ui-input e/pane/1 "x"  n`), '2');
});

// Without a browser there are no rounds: `ui-react v` is what the host does after each one.
test('calc: a field whose value comes from a formula', async () => {
  const f = `v: view [form [number qty "Qty"  number price "Price"  number total "Total" calc [values/qty * values/price]  number twice calc [values/total * 2]]]
    f: v/pane/1  q: f/pane/1  p: f/pane/2  t: f/pane/3  react: does [ui-react v]  react  `;
  assert.equal(await ev(f + 'reduce [t/readonly t/value]'), '[true none]');
  assert.equal(await ev(f + 'ui-input q "2"  ui-input p "3"  react  reduce [t/value f/pane/4/value]'), '[6 12]');
  assert.equal(await ev(f + 'ui-input q "2"  ui-input p "3"  react  ui-input q none  react  reduce [t/value f/pane/4/value]'), '[none none]');
  // in a row, values is the row, and the total of the rows follows
  const r = `v: view [form [
      rows items [number qty  number price  number total calc [values/qty * values/price]]
      number sum calc [s: 0  foreach x any [values/items []] [s: s + any [x/total 0]]  s]
    ]]
    f: v/pane/1  r: f/pane/1  ui-click last r/pane  ui-click last r/pane  ui-react v  `;
  assert.equal(await ev(r + `a: r/pane/1/pane  b: r/pane/2/pane
    ui-input a/1 "2"  ui-input a/2 "3"  ui-input b/1 "4"  ui-input b/2 "5"  ui-react v
    reduce [a/3/value b/3/value f/pane/2/value]`), '[6 20 26]');
});

test('react and is: a face follows the facets its block reads', async () => {
  const v = `n: 0  v: view [
      name: field "Name"
      greeting: text is [either name/value [rejoin ["Hello, " name/value]] ["Nobody"]]
      shout: text react [n: n + 1  face/text: uppercase copy any [greeting/text ""]]
      button "Clear" react later [face/disabled: not name/value]
    ]
    nm: v/pane/1  g: v/pane/2  s: v/pane/3  b: v/pane/4  react: does [ui-react v]  `;
  // when shown: is and react run, react later does not
  assert.equal(await ev(v + 'react  reduce [g/text s/text n b/disabled]'), '["Nobody" "NOBODY" 1 false]');
  // a change runs what reads it, and what reads that, in the same round; nothing changed, nothing runs
  assert.equal(await ev(v + 'react  ui-input nm "ada"  react  r: reduce [g/text s/text n]  react  append r n'),
    '["Hello, ada" "HELLO, ADA" 2 2]');
  assert.equal(await ev(v + 'react  ui-input nm "ada"  react  ui-input nm none  react  b/disabled'), 'true');
  // the order follows what feeds what, whatever the order of the faces
  assert.equal(await ev(`v: view [
      b: text is [rejoin [a/text "+"]]
      c: text is [rejoin [a/text b/text]]
      a: text "x"
    ]
    ui-react v  v/pane/3/text: "y"  ui-react v  reduce [v/pane/1/text v/pane/2/text]`), '["y+" "yy+"]');
  // a cycle is cut and said
  assert.match(await ev(`v: view [
      a: text "1" react [b/text: rejoin [face/text "a"]]
      b: text react [a/text: rejoin [face/text "b"]]
    ]
    ui-react v`), /react: left out, what it reads changed again after it ran \(a cycle\)/);
  // an error in a reaction reaches the host, after the others ran
  assert.match(await ev(`v: view [t: text is [1 / 0]  u: text is ["ok"]]  e: try [ui-react v]  reduce [v/pane/2/text e/id]`), /"ok"/);
});

test('react and is follow any object down a path: a machine, its data, settings', async () => {
  const m = `m: machine [
      data [bike: none  parts: 0]
      initial received
      state received []
      state repairing []
      from received to repairing on start set [bike: event/bike]
      from repairing to received on again
    ]
    settings: make object! [look: make object! [dark: false]]
    v: view [
      text is [form m/state]
      text is [either in? m 'repairing ["Working"] ["Waiting"]]
      text is [any [m/data/bike "None"]]
      text is [either settings/look/dark ["Dark"] ["Light"]]
    ]
    shown: does [ui-react v  collect [foreach f v/pane [keep f/text]]]  `;
  assert.equal(await ev(m + 'shown'), '["received" "Waiting" "None" "Light"]');
  assert.equal(await ev(m + 'shown  send m [start bike: "Brompton"]  shown'), '["repairing" "Working" "Brompton" "Light"]');
  // restart makes new data: the reaction reads the new one
  assert.equal(await ev(m + 'send m [start bike: "Brompton"]  shown  restart m  shown'), '["received" "Waiting" "None" "Light"]');
  // an object put in place of another, deeper down
  assert.equal(await ev(m + 'shown  settings/look: make object! [dark: true]  shown'), '["received" "Waiting" "None" "Dark"]');
  // a path to a field the object has not is not read
  assert.equal(await ev(`o: make object! [a: 1]  v: view [text is [any [attempt [o/b] "no"]]]  ui-react v  v/pane/1/text`), '"no"');
});

test('steps led by a machine: a state it has not, or a when, is a problem', async () => {
  const m = `m: machine [initial start  state start []  state finish []  from start to finish on next]  `;
  assert.match(await ev(m + `e: try [view [form [steps m [start "A" [] finsh "B" []]]]]  e/message`), /m has no state finsh; did you mean finish\?/);
  assert.match(await ev(m + `e: try [view [form [steps m [start "A" [] finish "B" when [true] []]]]]  e/message`), /it chooses where Next goes, with no when/);
});

test('a lookup keeps what was chosen, and only the answer to the last search', async () => {
  const r = await ev(`
    people: [#(value: "1" text: "Ana") #(value: "2" text: "Luis")]
    found: []
    root: view [form [
        lookup one "One" required on-search [append found event/query  people]
        lookup many "Many" multiple known #("7" "Eva") on-search [people]
    ]]
    fs: select first root/pane 'pane
    o: fs/1  m: fs/2
    out: reduce [o/name validate-face o]
    ui-lookup-search o "a"
    append out reduce [found length? o/options]
    ui-lookup-pick o first people
    append out reduce [o/value select o/known "1" validate-face o]
    m/value: ["7"]
    ui-lookup-pick m second people
    ui-lookup-pick m second people
    append/only out m/value
    append out select m/known "2"
    ui-lookup-remove m 1
    append/only out m/value
    ui-lookup-remove m 1
    append out m/value
    append/only out to block! form-values first root/pane
    out`);
  assert.equal(r, '[one "This field is required" ["a"] 2 "1" "Ana" none ["7" "2"] "Luis" ["2"] none [one "1" many none]]');
});

test('a lookup takes the screens its values link to, also as a column of rows', async () => {
  const r = await ev(`
    root: view [form [
        lookup who "Who" readonly links #("ada" client/ada)
        rows people "People" readonly [lookup who "Who" links #("bob" client/bob)]
    ]]
    fs: select first root/pane 'pane
    w: fs/1  p: fs/2
    p/value: [#(who: "bob")]  ui-rows p
    g: first select first p/pane 'pane
    reduce [select w/links "ada" select g/links "bob" g/readonly g/value]`);
  assert.equal(r, '[client/ada client/bob true "bob"]');
});

test('a lookup drops what a search answers once the user has typed on, and works with no on-search', async () => {
  const r = await ev(`
    root: view [form [
        lookup late "Late" on-search [face/query: "typed on"  [#(value: "1" text: "Old")]]
        lookup bare "Bare"
    ]]
    fs: select first root/pane 'pane
    ui-lookup-search fs/1 "first"
    ui-lookup-search fs/2 "x"
    reduce [fs/1/options fs/2/options]`);
  assert.equal(r, '[none []]');
});

test('the palette finds screens, buttons, links and menu items on show, and what on-find gives', async () => {
  link = ['home'];
  const app = `
    picked: none
    v: view [
      on-find [either value = "ada" [["Ada Lovelace" [client 1]]] [[]]]
      global main: screens [
        home "Home" [
          button "Save" key "Ctrl+S" [picked: 'save]
          button "Gone" hidden
          button "Off" disabled
          button "Export" menu ["As CSV" csv "More" ["As PDF" pdf]] on-menu [picked: event/picked]
          tabs ["One" [link "Help" https://example.com] "Two" [button "Hidden in two"]]
        ]
        about "About" [text "x"]
        client "Client" [id] [text "y"]
      ]
    ]
    labels: func [found] [collect [foreach [l k s t] found [keep l]]]
  `;
  assert.equal(await ev(app + 'labels ui-palette v ""'),
    '["Home" "About" "Save" "Export › As CSV" "Export › More › As PDF" "Help"]');
  assert.equal(await ev(app + 'found: ui-palette v "sav"  reduce [found/2 found/3]'), '[action "Ctrl+S"]');
  assert.equal(await ev(app + 'labels ui-palette v "pdf"'), '["Export › More › As PDF"]');
  assert.equal(await ev(app + 'labels ui-palette v "ada"'), '["Ada Lovelace"]');
  assert.equal(await ev(app + 'found: ui-palette v "pdf"  ui-palette-pick v found/2 found/4  picked'), 'pdf');
  // the view opens on the screen of the link, which the next ones change
  assert.equal(await ev(app + 'found: ui-palette v "ada"  ui-palette-pick v found/2 found/4  main/value'), '[client "1"]');
  assert.equal(await ev(app + 'found: ui-palette v "about"  ui-palette-pick v found/2 found/4  main/value'), '[about]');
});

test('a number that counts runs through values of the kind and digits of the one it ends on', () => {
  const lang = 'en';
  const value = (src: string): Cell => load(src).s.data[0]!;
  const at = (to: Cell, x: number): string => shownLocal(countStep(to, x), lang);
  assert.equal(at(value('1200'), 512.7), '513');
  assert.equal(at(value('12.5'), 3.14159), '3.1');
  assert.equal(at(value('12.5%'), 0.031234), '3.1%');
  assert.equal(at(value('EUR$1200'), 512.678), '€513.00');
  assert.equal(at(value('EUR$12.50'), 3.14159), '€3.10');
  assert.equal(amountOf(value('EUR$12.50')), 12.5);
  assert.equal(amountOf(value('"12"')), null);
});

test('code keeps its text as written, with its lines and spaces', async () => {
  assert.equal(await ev(`
    c: first layout/only [code {view [^/    text "x"^/]} muted]
    reduce [c/style c/text c/role]`), '[code {view [\n    text "x"\n]} muted]');
});
