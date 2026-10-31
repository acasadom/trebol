// The browser host: boots Trebol in a page, renders faces to the DOM and
// turns DOM events into tasks.
//
// A page needs only:
//
//   <script type="module" src=".../src/host/browser.ts"></script>
//   <script type="text/trebol" src="app.trb"></script>
//
// There is one DOM node per face and no virtual DOM. Setting a field of a
// mounted face marks it dirty (see `ctxSet` in the core); after every round
// of scheduler slices the host copies the fields of the dirty faces to their
// nodes, so `total/text: "42"` shows up without any explicit refresh.
// Changing a series in place (`append f/text "x"`) does not mark the face:
// set the field again to repaint it.

import {
  K, NONE, TRUE, FALSE, native, value, string, form, ctxFind, intern, spell, text, canon,
  type Cell, type ObjectCell, type BlockCell, type WordCell, type StringCell, type Ctx, type Sym,
} from '../core/index.ts';
import { startHost, startUi, runSource, report, type Host } from './index.ts';
import { spawn, taskResult } from './scheduler.ts';
import { themeCss, DEFAULT_THEME, type ThemeParams } from './theme.ts';
import { iconNode } from './icons.ts';

// --- reading faces -----------------------------------------------------------------

function get(face: ObjectCell, name: string): Cell {
  const i = ctxFind(face.ctx, intern(name));
  return i < 0 ? NONE : face.ctx.vals[i]!;
}

function str(face: ObjectCell, name: string): string | null {
  const v = get(face, name);
  return v.t === K.None ? null : form(v);
}

function flag(face: ObjectCell, name: string): boolean {
  const v = get(face, name);
  return !(v.t === K.None || (v.t === K.Logic && !v.v));
}

function word(face: ObjectCell, name: string): string | null {
  const v = get(face, name);
  return v.t === K.Word || v.t === K.LitWord ? spell((v as WordCell).sym).toLowerCase() : null;
}

function children(face: ObjectCell): ObjectCell[] {
  const c = get(face, 'children');
  if (c.t !== K.Block) return [];
  return c.s.data.slice(c.i).filter(x => x.t === K.Object) as ObjectCell[];
}

/** The name of a face's icon (`#search` -> "search"). */
function iconName(face: ObjectCell): string | null {
  const v = get(face, 'icon');
  return v.t === K.Issue ? spell((v as WordCell).sym).toLowerCase() : null;
}

function icon(name: string, label: string | null = null): SVGSVGElement | null {
  const svg = iconNode(name, label);
  if (svg === null) console.warn(`Trebol: unknown icon #${name}`);
  return svg;
}

function hasRule(face: ObjectCell, rule: string): boolean {
  const rules = get(face, 'rules');
  if (rules.t !== K.Block) return false;
  return rules.s.data.some(r => r.t === K.Block && r.s.data[0]?.t === K.Word && spell((r.s.data[0] as WordCell).sym) === rule);
}

// --- mounting ----------------------------------------------------------------------

/** What the host keeps for each mounted face. */
interface Mounted {
  face: ObjectCell;
  el: HTMLElement;
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  label: HTMLElement | null;
  error: HTMLElement | null;
  kids: unknown;
  /** Where children or rows go, when it is not `el`. */
  box: HTMLElement | null;
  /** Rows of a table or list, by key. */
  rows: Map<string, HTMLElement> | null;
  /** Shown instead of the rows when there are none. */
  empty: HTMLElement | null;
  /** The tab button of a tab face. */
  button: HTMLButtonElement | null;
  /** The options of a radio. */
  radios: HTMLInputElement[] | null;
}

let host: Host;
/** Mounted faces by their node and by their input. */
const byNode = new WeakMap<Element, Mounted>();
/** The row cell each table row or list item shows. */
const rowOf = new WeakMap<Element, Cell>();
/** Mounted faces by context; a face rebuilt in a new container replaces its entry. */
const byCtx = new WeakMap<Ctx, Mounted>();
/** Contexts of mounted faces written since the last repaint (filled by the core). */
const dirty: Ctx[] = [];
let nextId = 1;

/** Runs a UI event function (ui-input, ui-blur, ui-click) as a new task. */
function fire(fn: string, face: ObjectCell, arg?: Cell): Promise<Cell> {
  const call: Cell[] = [{ t: K.Word, sym: intern(fn), bind: host.rt.user }, face];
  if (arg !== undefined) call.push(arg);
  const t = taskResult(spawn(host.sch, { data: call }, 0));
  t.catch(e => console.error(report(e as ObjectCell)));
  return t;
}

function el<T extends keyof HTMLElementTagNameMap>(tag: T, cls?: string): HTMLElementTagNameMap[T] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

const INPUTS = new Set(['field', 'password', 'number', 'area', 'choice']);

function build(face: ObjectCell): HTMLElement {
  const style = word(face, 'style') ?? 'face';
  const m: Mounted = {
    face, el: null!, input: null, label: null, error: null, kids: get(face, 'children'),
    box: null, rows: null, empty: null, button: null, radios: null,
  };
  let node: HTMLElement;
  if (INPUTS.has(style)) {
    node = buildInput(face, style, m);
  } else if (style === 'check' || style === 'toggle') {
    node = buildCheck(face, m, style === 'toggle');
  } else if (style === 'radio') {
    node = buildRadio(face, m);
  } else {
    switch (style) {
      case 'view': node = el('main', 'tb-view'); break;
      case 'column': node = el('div', 'tb-column'); break;
      case 'row': node = el('div', 'tb-row'); break;
      case 'grid': node = el('div', 'tb-grid'); break;
      case 'scroll': {
        // focusable, so keyboard users can scroll it too
        node = el('div', 'tb-scroll');
        node.tabIndex = 0;
        node.setAttribute('role', 'region');
        break;
      }
      case 'panel': {
        node = el('section', 'tb-panel');
        const t = str(face, 'text');
        if (t !== null) {
          const h = el('h2', 'tb-panel-title');
          h.textContent = t;
          node.append(h);
        }
        break;
      }
      case 'form': {
        const f = el('form', 'tb-form');
        f.noValidate = true;
        // Enter in a field clicks the submit button, which handles it
        f.addEventListener('submit', ev => ev.preventDefault());
        node = f;
        break;
      }
      case 'title': node = el('h1', 'tb-title'); break;
      case 'heading': node = el('h2', 'tb-heading'); break;
      case 'text': node = el('p', 'tb-text'); break;
      case 'divider': node = el('hr', 'tb-divider'); break;
      case 'link': {
        const a = el('a', 'tb-link');
        a.href = str(face, 'value') ?? '#';
        withIcon(a, face, m);
        a.addEventListener('click', ev => {
          if (get(face, 'action').t === K.Block) {
            ev.preventDefault();
            void fire('ui-click', face);
          }
        });
        node = a;
        break;
      }
      case 'button': {
        const b = el('button', 'tb-button');
        const submit = flag(face, 'submit');
        b.type = submit ? 'submit' : 'button';
        b.addEventListener('click', ev => {
          if (!submit) return void fire('ui-click', face);
          ev.preventDefault();
          clickSubmit(face, b.closest<HTMLElement>('form, .tb-view') ?? document.body);
        });
        withIcon(b, face, m);
        node = b;
        break;
      }
      case 'progress': node = buildProgress(m); break;
      case 'image': node = el('img', 'tb-image'); break;
      case 'icon': node = el('span', 'tb-icon-face'); break;
      case 'table': case 'list': node = buildRows(face, style, m); break;
      case 'dialog': node = buildDialog(face, m); break;
      case 'tabs': node = buildTabs(face, m); break;
      case 'split': node = buildSplit(face, m); break;
      case 'tab': {
        node = el('div', 'tb-tab-panel');
        node.setAttribute('role', 'tabpanel');
        break;
      }
      default: node = el('div');
    }
    if (children(face).length > 0 && style !== 'tabs' && style !== 'split') appendChildren(m.box ?? node, face, style);
  }
  m.el = node;
  byNode.set(node, m);
  if (m.input !== null) byNode.set(m.input, m);
  byCtx.set(face.ctx, m);
  face.ctx.watch = dirty;
  sync(m);
  return node;
}

/** Puts the face's icon before its caption, which then goes in `m.label`. */
function withIcon(node: HTMLElement, face: ObjectCell, m: Mounted): void {
  const name = iconName(face);
  const svg = name !== null ? icon(name) : null;
  if (svg === null) return;
  m.label = el('span');
  node.append(svg, m.label);
  node.classList.add('tb-has-icon');
}

/** A face with an icon and no text is named after its icon: #arrow-left -> "Arrow left". */
function iconLabel(face: ObjectCell): string | null {
  const name = iconName(face);
  if (name === null || str(face, 'text') !== null) return null;
  const words = name.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Children of a container; consecutive buttons in a form share an action row. */
function appendChildren(node: HTMLElement, face: ObjectCell, style: string): void {
  let actions: HTMLElement | null = null;
  for (const c of children(face)) {
    const isButton = word(c, 'style') === 'button';
    if (style === 'form' && isButton) {
      if (actions === null) {
        actions = el('div', 'tb-actions');
        node.append(actions);
      }
      actions.append(build(c));
    } else {
      actions = null;
      node.append(build(c));
    }
  }
}

function clickSubmit(face: ObjectCell, formEl: HTMLElement): void {
  void fire('ui-click', face).then(() => {
    // after a failed submit, take the user to the first problem
    for (const i of Array.from(formEl.querySelectorAll<HTMLElement>('input, textarea, select'))) {
      const m = byNode.get(i);
      if (m !== undefined && get(m.face, 'error').t === K.String) return i.focus();
    }
  });
}

function buildInput(face: ObjectCell, style: string, m: Mounted): HTMLElement {
  const id = `tb-${nextId++}`;
  const wrap = el('div', 'tb-field');
  const label = el('label', 'tb-label');
  label.htmlFor = id;
  const control = el('div', 'tb-control');
  let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  if (style === 'area') {
    input = el('textarea', 'tb-input');
  } else if (style === 'choice') {
    const sel = el('select', 'tb-input');
    const opts = get(face, 'options');
    const first = el('option');
    first.value = '';
    first.textContent = str(face, 'hint') ?? 'Choose…';
    sel.append(first);
    if (opts.t === K.Block) {
      for (const o of opts.s.data.slice(opts.i)) {
        const opt = el('option');
        opt.value = opt.textContent = form(o);
        sel.append(opt);
      }
    }
    input = sel;
  } else {
    const i = el('input', 'tb-input');
    i.type = style === 'password' ? 'password' : hasRule(face, 'email') ? 'email' : hasRule(face, 'url') ? 'url' : 'text';
    if (style === 'number' || hasRule(face, 'integer')) i.inputMode = hasRule(face, 'integer') ? 'numeric' : 'decimal';
    if (style === 'password') i.autocomplete = 'new-password';
    input = i;
  }
  input.id = id;
  const error = el('div', 'tb-error');
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  input.setAttribute('aria-describedby', error.id);
  const name = word(face, 'name');
  if (name !== null) input.name = name;
  input.addEventListener(style === 'choice' ? 'change' : 'input', () => {
    void fire('ui-input', face, input.value === '' ? NONE : string(input.value));
  });
  input.addEventListener('blur', () => void fire('ui-blur', face));
  const iconWord = style === 'area' || style === 'choice' ? null : iconName(face);
  const svg = iconWord !== null ? icon(iconWord) : null;
  if (svg !== null) {
    const box = el('div', 'tb-input-icon');
    box.append(svg, input);
    control.append(box, error);
  } else {
    control.append(input, error);
  }
  wrap.append(label, control);
  m.input = input;
  m.label = label;
  m.error = error;
  return wrap;
}

function buildCheck(face: ObjectCell, m: Mounted, toggle: boolean): HTMLElement {
  const row = el('div', 'tb-check-row tb-control');
  const label = el('label', toggle ? 'tb-check tb-switch' : 'tb-check');
  const box = el('input');
  box.type = 'checkbox';
  if (toggle) box.setAttribute('role', 'switch');
  const caption = el('span');
  const error = el('div', 'tb-error');
  error.id = `tb-${nextId++}-error`;
  error.setAttribute('aria-live', 'polite');
  box.setAttribute('aria-describedby', error.id);
  box.addEventListener('change', () => {
    void fire('ui-input', face, box.checked ? TRUE : FALSE).then(() => fire('ui-blur', face));
  });
  label.append(box, caption);
  row.append(label, error);
  m.input = box;
  m.label = caption;
  m.error = error;
  return row;
}

function buildRadio(face: ObjectCell, m: Mounted): HTMLElement {
  const id = `tb-${nextId++}`;
  const wrap = el('div', 'tb-field');
  const label = el('span', 'tb-label');
  label.id = id;
  const control = el('div', 'tb-control');
  const group = el('div', 'tb-radios');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-labelledby', id);
  const error = el('div', 'tb-error');
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  group.setAttribute('aria-describedby', error.id);
  const opts = get(face, 'options');
  m.radios = [];
  for (const o of opts.t === K.Block ? opts.s.data.slice(opts.i) : []) {
    const option = el('label', 'tb-check');
    const r = el('input');
    r.type = 'radio';
    r.name = id;
    r.value = form(o);
    r.addEventListener('change', () => {
      if (r.checked) void fire('ui-input', face, string(r.value)).then(() => fire('ui-blur', face));
    });
    const caption = el('span');
    caption.textContent = r.value;
    option.append(r, caption);
    group.append(option);
    m.radios.push(r);
  }
  control.append(group, error);
  wrap.append(label, control);
  m.label = label;
  m.error = error;
  return wrap;
}

function buildProgress(m: Mounted): HTMLElement {
  const wrap = el('div', 'tb-progress-wrap');
  const label = el('span', 'tb-progress-label');
  label.id = `tb-${nextId++}`;
  const track = el('div', 'tb-progress');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.append(el('div', 'tb-progress-bar'));
  wrap.append(label, track);
  m.label = label;
  m.box = track;
  return wrap;
}

/** A progress value as a fraction, or null while it is unknown. */
function fraction(v: Cell): number | null {
  const n = v.t === K.Percent || v.t === K.Decimal ? v.v : v.t === K.Integer ? Number(v.v) : null;
  return n === null || Number.isNaN(n) ? null : Math.min(1, Math.max(0, n));
}

function syncProgress(m: Mounted): void {
  const t = str(m.face, 'text');
  const label = m.label!;
  label.textContent = t ?? '';
  label.hidden = t === null;
  const track = m.box!;
  if (t !== null) track.setAttribute('aria-labelledby', label.id);
  else track.removeAttribute('aria-labelledby');
  const n = fraction(get(m.face, 'value'));
  track.classList.toggle('tb-indeterminate', n === null);
  const bar = track.firstChild as HTMLElement;
  if (n === null) {
    track.removeAttribute('aria-valuenow');
    bar.style.removeProperty('width');
  } else {
    track.setAttribute('aria-valuenow', String(Math.round(n * 100)));
    bar.style.width = `${n * 100}%`;
  }
}

function syncIcon(m: Mounted): void {
  const name = iconName(m.face) ?? '';
  const label = str(m.face, 'text');
  const key = `${name} ${label ?? ''}`;
  if (m.el.dataset['icon'] === key) return;
  m.el.dataset['icon'] = key;
  const svg = name !== '' ? icon(name, label) : null;
  m.el.replaceChildren(...(svg !== null ? [svg] : []));
}

function syncRadio(m: Mounted, err: string | null): void {
  const f = m.face;
  m.label!.textContent = str(f, 'text') ?? '';
  m.label!.classList.toggle('tb-required', hasRule(f, 'required'));
  const v = get(f, 'value');
  const want = v.t === K.None ? null : form(v);
  for (const r of m.radios!) {
    r.checked = r.value === want;
    r.disabled = flag(f, 'disabled');
  }
  const group = m.radios![0]?.parentElement!.parentElement;
  group?.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
  group?.setAttribute('aria-required', hasRule(f, 'required') ? 'true' : 'false');
  m.error!.textContent = err ?? '';
}

// --- tables and lists ---------------------------------------------------------------

interface Column { sym: Sym; label: string }

function columns(face: ObjectCell): Column[] {
  const c = get(face, 'columns');
  if (c.t !== K.Block) return [];
  const out: Column[] = [];
  const d = c.s.data;
  for (let i = c.i; i + 1 < d.length; i += 2) {
    const w = d[i]!;
    if (w.t === K.Word) out.push({ sym: (w as WordCell).sym, label: form(d[i + 1]!) });
  }
  return out;
}

/** A field of a map! or object! row; map keys may be words or strings. */
function rowField(row: Cell, sym: Sym): Cell {
  if (row.t === K.Object) {
    const i = ctxFind(row.ctx, sym);
    return i < 0 ? NONE : row.ctx.vals[i]!;
  }
  if (row.t === K.Map) {
    const d = row.s.data;
    const c = canon(sym);
    for (let i = 0; i + 1 < d.length; i += 2) {
      const k = d[i]!;
      if (k.t === K.Word || k.t === K.SetWord || k.t === K.LitWord) {
        if (canon((k as WordCell).sym) === c) return d[i + 1]!;
      } else if (k.t === K.String && canon(intern(text(k as StringCell))) === c) {
        return d[i + 1]!;
      }
    }
  }
  return NONE;
}

function sameRow(a: Cell, b: Cell): boolean {
  if (a.t === K.Map && b.t === K.Map) return a.s === b.s;
  if (a.t === K.Object && b.t === K.Object) return a.ctx === b.ctx;
  return false;
}

function cellText(v: Cell): string {
  if (v.t === K.None) return '';
  if (v.t === K.Logic) return v.v ? 'Yes' : 'No';
  return form(v);
}

const NUMERIC: ReadonlySet<number> = new Set([K.Integer, K.Decimal, K.Money, K.Percent]);

function buildRows(face: ObjectCell, style: string, m: Mounted): HTMLElement {
  const wrap = el('div', style === 'table' ? 'tb-table-wrap' : 'tb-list-wrap');
  let box: HTMLElement;
  if (style === 'table') {
    // explicit roles keep the table semantics when narrow screens restyle it as cards
    const table = el('table', 'tb-table');
    table.setAttribute('role', 'table');
    const head = el('thead');
    const tr = el('tr');
    tr.setAttribute('role', 'row');
    for (const c of columns(face)) {
      const th = el('th');
      th.scope = 'col';
      th.setAttribute('role', 'columnheader');
      th.textContent = c.label;
      tr.append(th);
    }
    head.append(tr);
    box = el('tbody');
    table.append(head, box);
    wrap.append(table);
  } else {
    box = el('ul', 'tb-list');
    wrap.append(box);
  }
  const empty = el('p', 'tb-empty');
  wrap.append(empty);
  const choose = (target: EventTarget | null): void => {
    const item = (target as Element | null)?.closest(style === 'table' ? 'tr' : 'li');
    const row = item ? rowOf.get(item) : undefined;
    if (row !== undefined) void fire('ui-select', face, row);
  };
  box.addEventListener('click', ev => choose(ev.target));
  box.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      choose(ev.target);
    }
  });
  m.box = box;
  m.rows = new Map();
  m.empty = empty;
  return wrap;
}

/** Creates, updates, moves or removes only the rows whose key changed. */
function syncRows(m: Mounted): void {
  const f = m.face;
  const box = m.box!;
  const table = box.tagName === 'TBODY';
  const cols = columns(f);
  const data = get(f, 'data');
  const rows = data.t === K.Block ? data.s.data.slice(data.i) : [];
  const keyWord = get(f, 'key');
  const key = keyWord.t === K.Word || keyWord.t === K.LitWord ? (keyWord as WordCell).sym : intern('id');
  const selected = get(f, 'selected');
  const selectable = handlerFor(f, 'on-select');
  box.parentElement!.classList.toggle('tb-selectable', selectable);
  const old = m.rows!;
  const next = new Map<string, HTMLElement>();
  let cursor = box.firstChild;
  rows.forEach((row, i) => {
    const id = rowField(row, key);
    let k = id.t === K.None ? `#${i}` : `${id.t}:${form(id)}`;
    if (next.has(k)) k = `${k}#${i}`;
    let item = old.get(k);
    if (item === undefined) item = table ? newTableRow(cols) : newListItem();
    next.set(k, item);
    rowOf.set(item, row);
    fillRow(item, row, cols, table);
    if (selectable) item.tabIndex = 0;
    else item.removeAttribute('tabindex');
    const on = selected.t !== K.None && sameRow(selected, row);
    item.classList.toggle('tb-selected', on);
    if (selectable) item.setAttribute('aria-selected', on ? 'true' : 'false');
    else item.removeAttribute('aria-selected');
    if (item !== cursor) box.insertBefore(item, cursor);
    else cursor = cursor.nextSibling;
  });
  for (const [k, item] of old) if (next.get(k) !== item) item.remove();
  m.rows = next;
  m.empty!.textContent = str(f, 'text') ?? 'Nothing to show yet';
  m.empty!.hidden = rows.length > 0;
}

function newTableRow(cols: Column[]): HTMLElement {
  const tr = el('tr');
  tr.setAttribute('role', 'row');
  for (const c of cols) {
    const td = el('td');
    td.setAttribute('role', 'cell');
    td.dataset['label'] = c.label;
    tr.append(td);
  }
  return tr;
}

function newListItem(): HTMLElement {
  const li = el('li');
  li.append(el('span', 'tb-list-primary'), el('span', 'tb-list-secondary'));
  return li;
}

function fillRow(item: HTMLElement, row: Cell, cols: Column[], table: boolean): void {
  const set = (e: Element, t: string): void => {
    if (e.textContent !== t) e.textContent = t;
  };
  if (table) {
    cols.forEach((c, i) => {
      const v = rowField(row, c.sym);
      const td = item.children[i]!;
      set(td, cellText(v));
      td.classList.toggle('tb-num', NUMERIC.has(v.t));
    });
    return;
  }
  // a list shows its first column, then the others on a quieter line
  const [first, ...rest] = cols.map(c => cellText(rowField(row, c.sym)));
  set(item.children[0]!, first ?? '');
  set(item.children[1]!, rest.filter(Boolean).join(' · '));
}

function handlerFor(face: ObjectCell, name: string): boolean {
  const ev = get(face, 'events');
  if (ev.t !== K.Block) return false;
  const c = canon(intern(name));
  return ev.s.data.some(x => x.t === K.Word && canon((x as WordCell).sym) === c);
}

// --- dialogs, tabs and toasts --------------------------------------------------------

function buildDialog(face: ObjectCell, m: Mounted): HTMLElement {
  const d = el('dialog', 'tb-dialog');
  const head = el('header', 'tb-dialog-head');
  const title = el('h2', 'tb-dialog-title');
  title.id = `tb-${nextId++}`;
  d.setAttribute('aria-labelledby', title.id);
  const x = el('button', 'tb-dialog-close');
  x.type = 'button';
  x.setAttribute('aria-label', 'Close');
  x.textContent = '×';
  x.addEventListener('click', () => void fire('ui-close', face));
  head.append(title, x);
  const body = el('div', 'tb-dialog-body');
  d.append(head, body);
  // Esc: let the face decide, so code that keeps it open still wins
  d.addEventListener('cancel', ev => {
    ev.preventDefault();
    void fire('ui-close', face);
  });
  m.label = title;
  m.box = body;
  return d;
}

function syncDialog(m: Mounted): void {
  const d = m.el as HTMLDialogElement;
  m.label!.textContent = str(m.face, 'text') ?? '';
  const open = !flag(m.face, 'hidden');
  if (open === d.open) return;
  if (!d.isConnected) {
    queueMicrotask(() => { if (d.isConnected) syncDialog(m); });
    return;
  }
  if (!open) return d.close();
  d.showModal();
  // after this repaint, which never writes into a focused input
  queueMicrotask(() => d.querySelector<HTMLElement>('input, textarea, select')?.focus());
}

function buildTabs(face: ObjectCell, m: Mounted): HTMLElement {
  const node = el('div', 'tb-tabs');
  const list = el('div', 'tb-tablist');
  list.setAttribute('role', 'tablist');
  node.append(list);
  const tabs = children(face);
  const pick = (i: number): void => {
    void fire('ui-input', face, { t: K.Integer, v: i + 1 });
    (list.children[i] as HTMLElement | undefined)?.focus();
  };
  tabs.forEach((t, i) => {
    const panel = build(t);
    const b = el('button', 'tb-tab');
    b.type = 'button';
    b.id = `tb-${nextId++}`;
    panel.id = `${b.id}-panel`;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', panel.id);
    panel.setAttribute('aria-labelledby', b.id);
    b.textContent = str(t, 'text') ?? '';
    b.addEventListener('click', () => pick(i));
    const tm = byCtx.get(t.ctx)!;
    tm.button = b;
    list.append(b);
    node.append(panel);
  });
  list.addEventListener('keydown', ev => {
    const at = Array.prototype.indexOf.call(list.children, document.activeElement);
    const n = tabs.length;
    const to = ev.key === 'ArrowRight' ? (at + 1) % n : ev.key === 'ArrowLeft' ? (at - 1 + n) % n
      : ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : -1;
    if (to < 0 || at < 0) return;
    ev.preventDefault();
    pick(to);
  });
  m.box = list;
  return node;
}

function syncTabs(m: Mounted): void {
  const v = get(m.face, 'value');
  const tabs = children(m.face);
  const at = v.t === K.Integer ? Math.min(Math.max(Number(v.v), 1), tabs.length) - 1 : 0;
  tabs.forEach((t, i) => {
    const tm = byCtx.get(t.ctx);
    if (tm === undefined || tm.button === null) return;
    const on = i === at;
    tm.button.setAttribute('aria-selected', on ? 'true' : 'false');
    tm.button.tabIndex = on ? 0 : -1;
    tm.el.hidden = !on;
  });
}

// A split shows two panes side by side with a handle between them; on narrow
// screens it shows one pane, the one its value names, and the second pane
// gets a back button.
function buildSplit(face: ObjectCell, m: Mounted): HTMLElement {
  const node = el('div', 'tb-split');
  const [a, b] = children(face);
  const first = el('div', 'tb-split-pane');
  const second = el('div', 'tb-split-pane');
  first.tabIndex = second.tabIndex = -1;
  const handle = el('div', 'tb-split-handle');
  handle.tabIndex = 0;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', 'Resize panes');
  handle.setAttribute('aria-valuemin', '20');
  handle.setAttribute('aria-valuemax', '80');
  const resize = (pct: number): void => {
    const p = Math.round(Math.min(80, Math.max(20, pct)));
    node.style.setProperty('--tb-split', `${p}%`);
    handle.setAttribute('aria-valuenow', String(p));
  };
  resize(40);
  handle.addEventListener('pointerdown', ev => {
    handle.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  handle.addEventListener('pointermove', ev => {
    if (!handle.hasPointerCapture(ev.pointerId)) return;
    const r = node.getBoundingClientRect();
    resize(((ev.clientX - r.left) / r.width) * 100);
  });
  handle.addEventListener('keydown', ev => {
    const now = Number(handle.getAttribute('aria-valuenow'));
    const to = ev.key === 'ArrowLeft' ? now - 5 : ev.key === 'ArrowRight' ? now + 5
      : ev.key === 'Home' ? 20 : ev.key === 'End' ? 80 : null;
    if (to === null) return;
    ev.preventDefault();
    resize(to);
  });
  const back = el('button', 'tb-button tb-split-back');
  back.type = 'button';
  const arrow = iconNode('arrow-left');
  const caption = el('span');
  caption.textContent = 'Back';
  back.append(...(arrow !== null ? [arrow] : []), caption);
  back.addEventListener('click', () => void fire('ui-input', face, { t: K.Integer, v: 1 }));
  if (a !== undefined) first.append(build(a));
  second.append(back);
  if (b !== undefined) second.append(build(b));
  node.append(first, handle, second);
  return node;
}

function syncSplit(m: Mounted): void {
  const v = get(m.face, 'value');
  const pane = v.t === K.Integer && Number(v.v) === 2 ? '2' : '1';
  const was = m.el.dataset['pane'];
  if (was === pane) return;
  m.el.dataset['pane'] = pane;
  // on narrow screens the other pane just appeared: take the focus there
  if (was !== undefined && matchMedia('(max-width: 640px)').matches) {
    const shown = m.el.children[pane === '2' ? 2 : 0] as HTMLElement;
    (shown.querySelector<HTMLElement>('.tb-selected') ?? shown).focus();
  }
}

let toasts: HTMLElement | null = null;

native('show-toast', '[message [string!] kind [word! none!]]', (_t, f) => {
  if (toasts === null) {
    // a manual popover sits in the top layer, so toasts show above open dialogs
    toasts = el('div', 'tb-toasts');
    toasts.popover = 'manual';
    toasts.setAttribute('aria-live', 'polite');
    document.body.append(toasts);
  }
  const kind = f.args[1]!.t === K.Word ? spell((f.args[1] as WordCell).sym).toLowerCase() : null;
  const t = el('div', kind !== null ? `tb-toast tb-${kind}` : 'tb-toast');
  if (kind === 'danger') t.setAttribute('role', 'alert');
  const message = text(f.args[0] as StringCell);
  const box = toasts;
  const dismiss = (): void => {
    t.remove();
    if (box.childElementCount === 0 && box.matches(':popover-open')) box.hidePopover();
  };
  t.addEventListener('click', dismiss);
  setTimeout(dismiss, kind === 'danger' ? 6000 : 4000);
  if (box.matches(':popover-open')) box.hidePopover();
  box.append(t);
  box.showPopover();
  // screen readers announce text that changes inside a live region already shown
  setTimeout(() => { t.textContent = message; }, 50);
  return value(f.args[0]!);
});

// --- syncing -----------------------------------------------------------------------

function sync(m: Mounted): void {
  const f = m.face;
  const style = word(f, 'style') ?? '';
  const role = word(f, 'role');
  const t = str(f, 'text');
  const hidden = flag(f, 'hidden');
  const err = str(f, 'error');
  const cls: string[] = [];
  if (hidden && style !== 'dialog') cls.push('tb-hidden');
  if (flag(f, 'fill')) cls.push('tb-fill');
  if (flag(f, 'narrow-only')) cls.push('tb-narrow-only');
  if (flag(f, 'wide-only')) cls.push('tb-wide-only');
  if (role !== null && !INPUTS.has(style)) cls.push(`tb-${role}`);
  const size = word(f, 'size');
  if (size !== null) cls.push(`tb-${size}`);
  const align = word(f, 'align');
  if (align !== null && style === 'row') cls.push(`tb-${align}`);
  if (err !== null) cls.push('tb-invalid');
  if (flag(f, 'pending')) cls.push('tb-pending');
  setExtra(m.el, cls);
  space(m.el, 'padding', get(f, 'pad'));
  space(m.el, 'gap', get(f, 'gap'));

  if (style === 'radio') return syncRadio(m, err);
  if (m.input !== null) {
    if (m.label !== null) {
      m.label.textContent = t ?? '';
      m.label.classList.toggle('tb-required', hasRule(f, 'required') && style !== 'check');
    }
    const v = get(f, 'value');
    if (m.input instanceof HTMLInputElement && m.input.type === 'checkbox') {
      m.input.checked = v.t === K.Logic && v.v;
    } else {
      const want = v.t === K.None ? '' : form(v);
      // never fight the user's typing: only push values that differ from what code set
      if (document.activeElement !== m.input && m.input.value !== want) m.input.value = want;
      const hint = str(f, 'hint');
      if (hint !== null && !(m.input instanceof HTMLSelectElement)) m.input.placeholder = hint;
    }
    m.input.disabled = flag(f, 'disabled');
    m.input.setAttribute('aria-required', hasRule(f, 'required') ? 'true' : 'false');
    m.input.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
    if (m.error !== null) m.error.textContent = err ?? '';
    return;
  }
  switch (style) {
    case 'title': case 'heading': case 'text':
      m.el.textContent = t ?? '';
      break;
    case 'button': case 'link': {
      (m.label ?? m.el).textContent = t ?? '';
      const named = iconLabel(f);
      if (named !== null) m.el.setAttribute('aria-label', named);
      else m.el.removeAttribute('aria-label');
      m.el.title = named ?? '';
      break;
    }
    case 'progress': syncProgress(m); return;
    case 'icon': syncIcon(m); return;
    case 'image': {
      const img = m.el as HTMLImageElement;
      const src = str(f, 'value') ?? '';
      if (img.getAttribute('src') !== src) img.src = src;
      img.alt = t ?? '';
      return;
    }
    case 'table': case 'list': syncRows(m); return;
    case 'dialog': syncDialog(m); break;
    case 'tabs': syncTabs(m); return;
    case 'split': syncSplit(m); return;
    case 'tab': if (m.button !== null) m.button.textContent = t ?? ''; break;
    case 'scroll': {
      if (t !== null) m.el.setAttribute('aria-label', t);
      else m.el.removeAttribute('aria-label');
      break;
    }
    case 'grid': {
      const cols = get(f, 'cols');
      m.el.style.setProperty('--tb-cols', cols.t === K.Integer ? String(cols.v) : '2');
      break;
    }
  }
  if (m.el instanceof HTMLButtonElement) {
    // a submit stays focusable while the form has errors; clicking it shows them
    if (flag(f, 'submit')) m.el.setAttribute('aria-disabled', flag(f, 'disabled') ? 'true' : 'false');
    else m.el.disabled = flag(f, 'disabled');
  }
  // children replaced by code: rebuild this container
  const kids = get(f, 'children');
  if (kids.t === K.Block && (m.kids as BlockCell | undefined)?.s !== kids.s) {
    m.kids = kids;
    const box = m.box ?? m.el;
    const keep = box.querySelector(':scope > .tb-panel-title');
    box.replaceChildren(...(keep ? [keep] : []));
    appendChildren(box, f, style);
  }
}

/** Sets a spacing property to a step of the theme's scale, or back to the stylesheet's. */
function space(e: HTMLElement, prop: string, v: Cell): void {
  if (v.t === K.Integer) e.style.setProperty(prop, `var(--tb-space-${v.v})`);
  else e.style.removeProperty(prop);
}

/** Sets the face-driven classes, keeping the base classes from build. */
function setExtra(e: HTMLElement, cls: string[]): void {
  const prev = (e.dataset['tb'] ?? '').split(' ').filter(Boolean);
  for (const c of prev) if (!cls.includes(c)) e.classList.remove(c);
  for (const c of cls) e.classList.add(c);
  e.dataset['tb'] = cls.join(' ');
}

function syncDirty(): void {
  for (const ctx of dirty) {
    ctx.dirty = false;
    const m = byCtx.get(ctx);
    if (m !== undefined && m.el.isConnected) sync(m);
  }
  dirty.length = 0;
}

// --- natives -----------------------------------------------------------------------

let root: HTMLElement | null = null;

native('show', '[face [object!]]', (_t, f) => {
  const face = f.args[0] as ObjectCell;
  const node = build(face);
  if (root !== null) root.replaceWith(node);
  else document.body.append(node);
  root = node;
  const title = children(face).find(c => word(c, 'style') === 'title');
  if (title !== undefined) document.title = str(title, 'text') ?? document.title;
  return value(face);
});

const THEME_WORDS: Record<string, readonly string[]> = {
  neutral: ['cool', 'neutral', 'warm'],
  density: ['compact', 'normal', 'comfortable'],
  radius: ['sharp', 'soft', 'round'],
  mode: ['light', 'dark', 'auto'],
};

/** Theme parameters from a theme object, keeping defaults for anything missing or unknown. */
export function themeParams(obj: ObjectCell): ThemeParams {
  const p: ThemeParams = { ...DEFAULT_THEME };
  const num = (n: string): number | null => {
    const v = get(obj, n);
    return v.t === K.Integer ? Number(v.v) : v.t === K.Decimal ? v.v : null;
  };
  p.base = num('base') ?? p.base;
  p.accent = num('accent') ?? (p.base + 180) % 360;
  for (const [key, allowed] of Object.entries(THEME_WORDS)) {
    const w = word(obj, key);
    if (w !== null && allowed.includes(w)) (p as unknown as Record<string, string>)[key] = w;
  }
  const font = get(obj, 'font');
  if (font.t === K.Word) p.font = spell(font.sym).toLowerCase();
  else if (font.t === K.String) p.font = text(font as StringCell);
  return p;
}

function setTheme(p: ThemeParams): void {
  let tag = document.getElementById('tb-theme');
  if (tag === null) {
    tag = el('style');
    tag.id = 'tb-theme';
    document.head.append(tag);
  }
  tag.textContent = themeCss(p);
}

native('apply-theme', '[spec [object!]]', (_t, f) => {
  setTheme(themeParams(f.args[0] as ObjectCell));
  return value(f.args[0]!);
});

// --- boot --------------------------------------------------------------------------

async function boot(): Promise<void> {
  setTheme(DEFAULT_THEME);
  host = startHost();
  host.sch.afterPump = syncDirty;
  await startUi(host);
  for (const s of Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="text/trebol"]'))) {
    const src = s.getAttribute('src');
    const url = src !== null ? new URL(src, location.href).href : location.href;
    const code = src !== null ? await (await fetch(url)).text() : s.textContent ?? '';
    try {
      await runSource(host, code, url);
    } catch (e) {
      console.error(e instanceof Error ? e.message : report(e as ObjectCell));
    }
  }
}

void boot();
