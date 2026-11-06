// The browser host: boots Trebol in a page, renders faces to the DOM and
// turns DOM events into tasks.
//
// A page needs only:
//
//   <script type="module">import 'trebol/browser';</script>
//   <script type="text/trebol" src="app.trb"></script>
//
// (`trebol dev` resolves `trebol/browser` to this file.)
//
// There is one DOM node per face and no virtual DOM. Setting a field of a
// mounted face marks it dirty (see `ctxSet` in the core); after every round
// of scheduler slices the host copies the fields of the dirty faces to their
// nodes, so `total/text: "42"` shows up without any explicit refresh.
// Changing a series in place (`append f/text "x"`) does not mark the face:
// set the field again to repaint it.

import {
  K, NONE, TRUE, FALSE, native, value, string, form, ctxFind, intern, spell, text, canon, blockOf, wordOf, char,
  type Cell, type MapCell, type ObjectCell, type BlockCell, type WordCell, type StringCell, type Ctx, type Sym,
} from '../core/index.ts';
import { mapAt, startHost, startUi, runSource, report, shown, translate, uiText, activeLanguage, editLocal, readLocal, readDate, weekStart, LOCAL_KINDS, type Host } from './index.ts';
import { spawn, taskResult } from './scheduler.ts';
import { themeCss, DEFAULT_THEME, type ThemeParams } from './theme.ts';
import { iconNode } from './icons.ts';
import { parseMd, printMd, safeHref, type Block, type Inline } from './markdown.ts';
import { fileHandle } from './net.ts';

// --- reading faces -----------------------------------------------------------------

function get(face: ObjectCell, name: string): Cell {
  const i = ctxFind(face.ctx, intern(name));
  return i < 0 ? NONE : face.ctx.vals[i]!;
}

function str(face: ObjectCell, name: string): string | null {
  const v = get(face, name);
  if (v.t === K.None) return null;
  // a text per language, or a word of the dictionary: in the active language
  if (v.t === K.Map || ((name === 'text' || name === 'hint') && v.t === K.Word)) return translate(v, host.rt);
  return form(v);
}

/** What a choice or radio option is worth: itself, or the `value` of a map #(value: .. text: ..). */
function optionValue(o: Cell): string {
  const v = o.t === K.Map ? mapAt(o as MapCell, 'value') : null;
  return form(v ?? o);
}

/** What a choice or radio option shows, in the active language. */
function optionText(o: Cell): string {
  const t = o.t === K.Map ? mapAt(o as MapCell, 'text') : null;
  return t !== null ? translate(t, host.rt) : optionValue(o);
}

/** The options of a choice or radio. */
function optionsOf(face: ObjectCell): Cell[] {
  const opts = get(face, 'options');
  return opts.t === K.Block ? opts.s.data.slice(opts.i) : [];
}

/** One of Trebol's own texts (`i18n/ui`) in the active language. */
function own(key: string, ...args: string[]): string {
  return uiText(host.rt, key, ...args);
}

/** Gives a node built once one of Trebol's own texts (its text or an attribute); `repaint` keeps it in the active language. */
function keepOwn(node: HTMLElement, key: string, attr?: string): void {
  node.dataset.tbOwn = attr === undefined ? key : `${attr} ${key}`;
  showOwn(node);
}

function showOwn(node: HTMLElement): void {
  const [a, k] = node.dataset.tbOwn!.split(' ');
  if (k === undefined) node.textContent = own(a!);
  else node.setAttribute(a!, own(k));
}

/** A value as it shows on screen: dates, numbers and money in the active language. */
function display(v: Cell): string {
  return LOCAL_KINDS.has(v.t) ? shown(v, activeLanguage(host.rt)) : form(v);
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
  const c = get(face, 'pane');
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
  /** The keys of the open nodes of a tree. */
  open: Set<string> | null;
  /** Rows: what the rows were last checked against. Rich text: the Markdown on screen. */
  shown: unknown;
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

const ACTIVE: ReadonlySet<number> = new Set([K.Word, K.SetWord, K.GetWord, K.Paren, K.Path, K.SetPath, K.GetPath, K.Function, K.Native]);

/** Runs a UI event function (ui-input, ui-blur, ui-click) as a new task. */
function fire(fn: string, face: ObjectCell, ...args: Cell[]): Promise<Cell> {
  // a word, path or paren given as data (a dropped `date`) is quoted, so it is passed, not evaluated
  const quote: Cell = { t: K.Word, sym: intern('quote'), bind: host.rt.lib };
  const call: Cell[] = [{ t: K.Word, sym: intern(fn), bind: host.rt.user }, face, ...args.flatMap(a => ACTIVE.has(a.t) ? [quote, a] : [a])];
  const t = taskResult(spawn(host.sch, { data: call }, 0));
  t.catch(e => console.error(report(e as ObjectCell)));
  return t;
}

function el<T extends keyof HTMLElementTagNameMap>(tag: T, cls?: string): HTMLElementTagNameMap[T] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

const INPUTS = new Set(['field', 'password', 'number', 'money', 'date', 'area', 'choice']);

function build(face: ObjectCell): HTMLElement {
  const style = word(face, 'style') ?? 'face';
  const m: Mounted = {
    face, el: null!, input: null, label: null, error: null, kids: get(face, 'pane'),
    box: null, rows: null, empty: null, button: null, radios: null, open: null, shown: undefined,
  };
  let node: HTMLElement;
  if (INPUTS.has(style)) {
    node = buildInput(face, style, m);
  } else if (style === 'check' || style === 'toggle') {
    node = buildCheck(face, m, style === 'toggle');
  } else if (style === 'radio') {
    node = buildRadio(face, m);
  } else if (style === 'upload') {
    node = buildUpload(face, m);
  } else if (style === 'rich') {
    node = buildRich(face, m);
  } else {
    switch (style) {
      case 'view': node = el('main', 'tb-view'); break;
      case 'column': node = el('div', 'tb-column'); break;
      case 'row': node = el('div', 'tb-row'); break;
      case 'toolbar': node = buildToolbar(); break;
      case 'breadcrumb': node = buildBreadcrumb(m); break;
      case 'rows': node = buildRowsField(m); break;
      case 'entry': {
        node = el('div', 'tb-entry');
        node.setAttribute('role', 'group');
        break;
      }
      case 'grid': node = el('div', 'tb-grid'); break;
      case 'scroll': {
        // focusable, so keyboard users can scroll it too
        node = el('div', 'tb-scroll');
        node.tabIndex = 0;
        node.setAttribute('role', 'region');
        break;
      }
      case 'panel': node = el('section', 'tb-panel'); break;
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
        a.href = screenHref(get(face, 'value')) ?? str(face, 'value') ?? '#';
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
      case 'tree': node = buildTree(face, m); break;
      case 'dialog': node = buildDialog(face, m); break;
      case 'tabs': node = buildTabs(face, m); break;
      case 'split': node = buildSplit(face, m); break;
      case 'screens': {
        node = el('div', 'tb-screens');
        screensFace = face;
        break;
      }
      case 'screen': {
        node = el('section', 'tb-screen');
        const t = str(face, 'text');
        if (t !== null) {
          node.setAttribute('aria-label', t);
          document.title = t;
          titleFace = face;
        }
        break;
      }
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
  listen(m, style);
  sync(m);
  return node;
}

// --- general events ------------------------------------------------------------------

/** Runs a face's on-xxx handler; `words` are the event's own [word: value ...]. */
function fireEvent(face: ObjectCell, name: string, words: [string, Cell][] = []): void {
  const extra = words.flatMap(([w, v]) => [wordOf(K.SetWord, w), v]);
  void fire('ui-event', face, wordOf(K.LitWord, name), blockOf(K.Block, extra));
}

/** Keydown events some face's on-key already saw; the view gets the rest. */
const seenKeys = new WeakSet<Event>();
/** The view with an on-key handler, if any. */
let viewKeys: ObjectCell | null = null;
/** Mounted buttons and links with a shortcut. */
const shortcuts = new Set<Mounted>();

function listen(m: Mounted, style: string): void {
  const f = m.face;
  const node = m.el;
  const left = (ev: FocusEvent): boolean => !node.contains(ev.relatedTarget as Node | null);
  if (handlerFor(f, 'on-focus')) node.addEventListener('focusin', ev => { if (left(ev)) fireEvent(f, 'on-focus'); });
  if (handlerFor(f, 'on-unfocus')) node.addEventListener('focusout', ev => { if (left(ev)) fireEvent(f, 'on-unfocus'); });
  if (handlerFor(f, 'on-over')) {
    // as in Red, event/away? is true when the pointer leaves
    node.addEventListener('pointerenter', () => fireEvent(f, 'on-over', [['away?', FALSE]]));
    node.addEventListener('pointerleave', () => fireEvent(f, 'on-over', [['away?', TRUE]]));
  }
  if (handlerFor(f, 'on-dbl-click')) node.addEventListener('dblclick', () => fireEvent(f, 'on-dbl-click'));
  if (handlerFor(f, 'on-key')) {
    if (style === 'view') viewKeys = f;
    else node.addEventListener('keydown', ev => {
      if (seenKeys.has(ev) || keyCell(ev) === null) return;
      seenKeys.add(ev);
      fireEvent(f, 'on-key', keyWords(ev));
    });
  }
  if (str(f, 'shortcut') !== null) shortcuts.add(m);
  if (flag(f, 'drop')) dropZones.add(m);
  const menu = get(f, 'menu');
  // a button or link without an action opens its menu; anything else has it as its context menu
  if (menu.t === K.Block && (style === 'button' || style === 'link') && get(f, 'action').t !== K.Block) {
    node.setAttribute('aria-haspopup', 'menu');
    node.setAttribute('aria-expanded', 'false');
    node.addEventListener('click', ev => {
      ev.preventDefault();
      const r = node.getBoundingClientRect();
      openMenu(trebolEntries(f, menu as BlockCell, NONE), r.left, r.bottom + 4, node);
    });
  } else if (menu.t === K.Block || flag(f, 'drag')) {
    node.addEventListener('contextmenu', ev => {
      const target = ev.target as Element;
      const data = style === 'table' || style === 'list' || style === 'tree';
      const item = data ? target.closest(style === 'tree' ? '[role="treeitem"]' : 'tr, li') : null;
      if (item === null && data && menu.t !== K.Block) return;
      const row = item !== null ? rowOf.get(item) ?? NONE : NONE;
      const entries = menu.t === K.Block ? trebolEntries(f, menu as BlockCell, row) : [];
      // faces you can drag can also be moved to a drop zone from the menu, without a mouse
      if (flag(f, 'drag')) {
        const zones = moveTargets(f, item !== null ? row : get(f, 'value'));
        if (zones.length > 0) {
          if (entries.length > 0) entries.push({ text: '', divider: true });
          entries.push({ text: own('move-to'), sub: zones });
        }
      }
      if (entries.length === 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      // from the keyboard (Menu key, Shift+F10) there is no pointer: open by the focused element
      let { clientX: x, clientY: y } = ev;
      if (x === 0 && y === 0) {
        const r = (item ?? (document.activeElement && node.contains(document.activeElement) ? document.activeElement : node)).getBoundingClientRect();
        x = r.left + 8;
        y = r.top + Math.min(r.height, 40);
      }
      openMenu(entries, x, y, (item as HTMLElement | null) ?? (target as HTMLElement));
    });
  }
}

// --- drag and drop -----------------------------------------------------------------
//
// Pointer events rather than HTML drag and drop, so it also works with touch
// (after a long press) and shows the theme's own indicator.

/** Mounted faces that accept drops. */
const dropZones = new Set<Mounted>();

/** What is being dragged: a face, or a row of a table, list or tree. */
interface Source {
  face: ObjectCell;
  el: HTMLElement;
  payload: Cell;
  /** The container it can be reordered in, and its position there (0-based). */
  within: Mounted | null;
  index: number;
  /** The element holding a row and its siblings (a tree has one per level). */
  group: HTMLElement | null;
}

/**
 * Where a drag would land. In a tree, `group` holds the siblings it goes
 * between, `parent` is their node (none at the root) and `into` the row of a
 * folder it goes into, at the end.
 */
interface Target { m: Mounted; index: number; reorder: boolean; group?: HTMLElement; parent?: Cell; into?: HTMLElement }

const isData = (m: Mounted): boolean => m.rows !== null;

/** The elements a drop target places things between: rows, or child faces. */
function slots(m: Mounted): HTMLElement[] {
  if (isData(m)) return Array.from(m.box!.children) as HTMLElement[];
  return children(m.face).map(c => byCtx.get(c.ctx)?.el).filter((e): e is HTMLElement => e !== undefined && e.isConnected);
}

function mountedAbove(e: Element | null): Mounted | undefined {
  for (let x = e; x !== null; x = x.parentElement) {
    const m = byNode.get(x);
    if (m !== undefined && m.el === x) return m;
  }
  return undefined;
}

/** The drag source at an element: a draggable face, a row, or a child of a reorderable container. */
function sourceAt(start: Element): Source | null {
  if (start.closest('input, textarea, select, [contenteditable], .tb-split-handle, .tb-menu') !== null) return null;
  for (let e: Element | null = start; e !== null; e = e.parentElement) {
    const row = rowOf.get(e);
    if (row !== undefined) {
      const m = mountedAbove(e)!;
      if (!flag(m.face, 'drag') && !flag(m.face, 'reorder')) return null;
      const group = e.parentElement!;
      const index = Array.prototype.indexOf.call(group.children, e);
      return { face: m.face, el: e as HTMLElement, payload: row, within: flag(m.face, 'reorder') ? m : null, index, group };
    }
    const m = byNode.get(e);
    if (m === undefined || m.el !== e) continue;
    const parent = mountedAbove(e.parentElement);
    const reorder = parent !== undefined && !isData(parent) && flag(parent.face, 'reorder');
    if (flag(m.face, 'drag') && !isData(m) || reorder) {
      const index = reorder ? slots(parent!).indexOf(e as HTMLElement) : -1;
      return { face: m.face, el: e as HTMLElement, payload: get(m.face, 'value'), within: reorder ? parent! : null, index, group: null };
    }
  }
  return null;
}

/** The drop target under a point, and the insertion index there. */
function targetAt(src: Source, x: number, y: number): Target | null {
  for (let m = mountedAbove(document.elementFromPoint(x, y)); m !== undefined; m = mountedAbove(m.el.parentElement)) {
    if (m.open !== null) {
      const t = treeTarget(m, src, x, y);
      if (t !== null) return t;
      continue;
    }
    const reorder = m === src.within;
    if ((reorder || flag(m.face, 'drop')) && m.el !== src.el && !src.el.contains(m.el)) {
      return { m, index: insertionAt(m, x, y), reorder };
    }
  }
  return null;
}

const horizontal = (m: Mounted): boolean => word(m.face, 'style') === 'row';

function insertionAt(m: Mounted, x: number, y: number): number {
  const across = horizontal(m);
  let i = 0;
  for (const e of slots(m)) {
    const r = e.getBoundingClientRect();
    if ((across ? x : y) > (across ? r.left + r.width / 2 : r.top + r.height / 2)) i++;
  }
  return i;
}

let line: HTMLElement | null = null;

/** Shows where a drop would land: a line between slots, and the target outlined. */
function indicate(t: Target | null): void {
  document.querySelectorAll('.tb-drop-over').forEach(e => e.classList.remove('tb-drop-over'));
  if (t === null) { line?.remove(); line = null; return; }
  if (t.into !== undefined) {
    // into a folder: outline its row instead of drawing a line
    t.into.querySelector(':scope > .tb-tree-row')!.classList.add('tb-drop-over');
    line?.remove();
    line = null;
    return;
  }
  t.m.el.classList.add('tb-drop-over');
  if (line === null) {
    line = el('div', 'tb-drop-line');
    line.setAttribute('aria-hidden', 'true');
    document.body.append(line);
  }
  const across = horizontal(t.m);
  const all = t.group !== undefined ? Array.from(t.group.children) : slots(t.m);
  const box = (t.group ?? t.m.box ?? t.m.el).getBoundingClientRect();
  const before = all[t.index]?.getBoundingClientRect();
  const after = all[t.index - 1]?.getBoundingClientRect();
  line.classList.toggle('tb-across', across);
  if (across) {
    const at = before && after ? (after.right + before.left) / 2 : before ? before.left - 3 : after ? after.right + 3 : box.left + 8;
    const r = before ?? after ?? box;
    Object.assign(line.style, { left: `${at - 1}px`, top: `${r.top}px`, width: '', height: `${r.height}px` });
  } else {
    const at = before && after ? (after.bottom + before.top) / 2 : before ? before.top - 3 : after ? after.bottom + 3 : box.top + 8;
    const r = before ?? after ?? box;
    Object.assign(line.style, { left: `${r.left}px`, top: `${at - 1}px`, width: `${r.width}px`, height: '' });
  }
}

/** Ends a drag on a target: a move inside its container, or a drop. */
function land(src: Source, t: Target): void {
  if (t.reorder) {
    const to = t.index > src.index ? t.index - 1 : t.index;
    if (to !== src.index) void reorder(t.m, src.index, to, t.group, t.parent);
  } else {
    void fire('ui-drop', t.m.face, src.payload, src.face, int(t.index + 1), t.parent ?? NONE);
  }
}

const int = (n: number): Cell => ({ t: K.Integer, v: n });

/** Moves a child or row and keeps the focus on it once the page is repainted. */
async function reorder(m: Mounted, from: number, to: number, group?: HTMLElement, parent: Cell = NONE): Promise<void> {
  const had = document.activeElement !== null && document.activeElement !== document.body && m.el.contains(document.activeElement);
  await fire('ui-reorder', m.face, int(from + 1), int(to + 1), parent);
  syncDirty();
  if (!had) return;
  const e = (group !== undefined ? Array.from(group.children) as HTMLElement[] : slots(m))[to];
  const focusable = e?.matches('[tabindex], button, a, input, textarea, select') ? e : e?.querySelector<HTMLElement>('[tabindex], button, a, input, textarea, select');
  (focusable ?? null)?.focus();
}

/** "Move to" entries: the visible drop zones other than the face itself. */
function moveTargets(face: ObjectCell, payload: Cell): MenuEntry[] {
  const out: MenuEntry[] = [];
  for (const z of dropZones) {
    if (!z.el.isConnected) { dropZones.delete(z); continue; }
    if (z.face.ctx === face.ctx || z.el.getClientRects().length === 0) continue;
    out.push({
      text: str(z.face, 'text') ?? word(z.face, 'style') ?? '',
      run: () => void fire('ui-drop', z.face, payload, face, int(slots(z).length + 1), NONE),
    });
  }
  return out;
}

interface Dragging { src: Source; x: number; y: number; id: number; on: boolean; ghost: HTMLElement | null; target: Target | null; timer: number }
let dragging: Dragging | null = null;

function startDrag(d: Dragging): void {
  d.on = true;
  d.ghost = el('div', 'tb-drag-ghost');
  d.ghost.textContent = (d.src.el.innerText || d.src.el.textContent || '').split('\n').find(t => t.trim() !== '')?.trim() ?? '';
  d.ghost.setAttribute('aria-hidden', 'true');
  document.body.append(d.ghost);
  d.src.el.classList.add('tb-dragging');
  getSelection()?.removeAllRanges();
  document.documentElement.classList.add('tb-drag-active');
  moveDrag(d, d.x, d.y);
}

function moveDrag(d: Dragging, x: number, y: number): void {
  d.ghost!.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
  d.target = targetAt(d.src, x, y);
  indicate(d.target);
}

function endDrag(drop: boolean): void {
  const d = dragging;
  if (d === null) return;
  dragging = null;
  clearTimeout(d.timer);
  if (!d.on) return;
  d.ghost?.remove();
  d.src.el.classList.remove('tb-dragging');
  document.documentElement.classList.remove('tb-drag-active');
  indicate(null);
  if (drop && d.target !== null) land(d.src, d.target);
  // the click that ends a drag is not a click
  addEventListener('click', swallowClick, true);
  setTimeout(() => removeEventListener('click', swallowClick, true), 0);
}

function swallowClick(ev: Event): void {
  ev.stopPropagation();
  ev.preventDefault();
}

function onPointerDown(ev: PointerEvent): void {
  if (ev.button !== 0 || dragging !== null) return;
  const src = sourceAt(ev.target as Element);
  if (src === null) return;
  const d: Dragging = { src, x: ev.clientX, y: ev.clientY, id: ev.pointerId, on: false, ghost: null, target: null, timer: 0 };
  dragging = d;
  // on touch a long press starts the drag, so a swipe still scrolls
  if (ev.pointerType === 'touch') d.timer = setTimeout(() => { if (dragging === d) startDrag(d); }, 400) as unknown as number;
}

function onPointerMove(ev: PointerEvent): void {
  const d = dragging;
  if (d === null || ev.pointerId !== d.id) return;
  if (!d.on) {
    const far = Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 5;
    if (!far) return;
    if (ev.pointerType === 'touch') return endDrag(false);
    d.x = ev.clientX;
    d.y = ev.clientY;
    startDrag(d);
  }
  ev.preventDefault();
  moveDrag(d, ev.clientX, ev.clientY);
}

/** Alt+Up and Alt+Down move the focused row or child inside a reorderable container. */
function onReorderKey(ev: KeyboardEvent): void {
  if (!ev.altKey || ev.ctrlKey || ev.metaKey || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
  const at = document.activeElement;
  if (at === null) return;
  const src = sourceAt(at);
  if (src === null || src.within === null) return;
  const to = src.index + (ev.key === 'ArrowUp' ? -1 : 1);
  if (to < 0 || to >= (src.group !== null ? src.group.children.length : slots(src.within).length)) return;
  ev.preventDefault();
  seenKeys.add(ev);
  const group = src.group ?? undefined;
  void reorder(src.within, src.index, to, group, group !== undefined && src.within.open !== null ? groupParent(src.within, group) : NONE);
}

// --- menus ---------------------------------------------------------------------------

/** The open menus, outermost first. */
const menus: HTMLElement[] = [];
/** Where focus goes back when the menus close. */
let menuOpener: HTMLElement | null = null;

function closeMenus(from = 0, refocus = true): void {
  for (const mn of menus.splice(from)) {
    mn.hidePopover?.();
    mn.remove();
  }
  if (from === 0) {
    menuOpener?.setAttribute('aria-expanded', 'false');
    if (!menuOpener?.hasAttribute('aria-haspopup')) menuOpener?.removeAttribute('aria-expanded');
    if (refocus) menuOpener?.focus();
    menuOpener = null;
    document.removeEventListener('pointerdown', outsideMenu, true);
  } else {
    (menus[from - 1]?.querySelector('[aria-expanded="true"]') as HTMLElement | null)?.setAttribute('aria-expanded', 'false');
  }
}

function outsideMenu(ev: PointerEvent): void {
  if (!menus.some(mn => mn.contains(ev.target as Node))) closeMenus(0, false);
}

function menuItems(mn: HTMLElement): HTMLElement[] {
  return Array.from(mn.querySelectorAll<HTMLElement>(':scope > [role="menuitem"]'));
}

interface MenuEntry {
  text: string;
  icon?: string | null;
  divider?: boolean;
  sub?: MenuEntry[];
  run?: () => void;
}

/** A menu block of the dialect as menu entries; choosing one runs ui-menu. */
function trebolEntries(face: ObjectCell, items: BlockCell, row: Cell): MenuEntry[] {
  return (items.s.data.slice(items.i).filter(x => x.t === K.Object) as ObjectCell[]).map(item => {
    const sub = get(item, 'items');
    return {
      text: str(item, 'text') ?? '',
      icon: iconName(item),
      divider: flag(item, 'divider'),
      sub: sub.t === K.Block ? trebolEntries(face, sub as BlockCell, row) : undefined,
      run: () => void fire('ui-menu', face, item, row),
    };
  });
}

/** Opens a menu at x, y; level > 0 is a submenu. */
function openMenu(entries: MenuEntry[], x: number, y: number, opener: HTMLElement, level = 0): void {
  closeMenus(level, false);
  if (level === 0) {
    menuOpener = opener;
    if (opener.hasAttribute('aria-haspopup')) opener.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outsideMenu, true);
  }
  const mn = el('div', 'tb-menu');
  mn.setAttribute('role', 'menu');
  mn.setAttribute('popover', 'manual');
  const label = opener.getAttribute('aria-label') ?? opener.textContent;
  if (label) mn.setAttribute('aria-label', label.trim());
  for (const item of entries) {
    if (item.divider) {
      const d = el('div', 'tb-menu-divider');
      d.setAttribute('role', 'separator');
      mn.append(d);
      continue;
    }
    const b = el('button', 'tb-menu-item');
    b.type = 'button';
    b.tabIndex = -1;
    b.setAttribute('role', 'menuitem');
    const svg = item.icon ? icon(item.icon) : null;
    const text = el('span');
    text.textContent = item.text;
    b.append(svg ?? el('span', 'tb-menu-gap'), text);
    const sub = item.sub;
    if (sub !== undefined) {
      b.setAttribute('aria-haspopup', 'menu');
      b.setAttribute('aria-expanded', 'false');
      const chevron = icon('chevron-right');
      if (chevron !== null) b.append(chevron);
      const openSub = (): void => {
        const r = b.getBoundingClientRect();
        openMenu(sub, r.right - 4, r.top - 5, b, level + 1);
        b.setAttribute('aria-expanded', 'true');
      };
      b.addEventListener('click', openSub);
      b.addEventListener('keydown', ev => { if (ev.key === 'ArrowRight') { ev.preventDefault(); openSub(); } });
    } else {
      b.addEventListener('click', () => {
        closeMenus();
        item.run?.();
      });
    }
    b.addEventListener('pointerenter', () => b.focus());
    mn.append(b);
  }
  mn.addEventListener('keydown', ev => {
    seenKeys.add(ev);
    const list = menuItems(mn);
    const at = list.indexOf(document.activeElement as HTMLElement);
    const n = list.length;
    const to = ev.key === 'ArrowDown' ? (at + 1) % n : ev.key === 'ArrowUp' ? (at - 1 + n) % n
      : ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : -1;
    if (to >= 0) {
      ev.preventDefault();
      list[to]?.focus();
    } else if (ev.key === 'Escape' || (ev.key === 'ArrowLeft' && level > 0)) {
      ev.preventDefault();
      ev.stopPropagation();
      if (level > 0) { closeMenus(level); opener.focus(); } else closeMenus();
    } else if (ev.key === 'Tab') {
      ev.preventDefault();
      closeMenus();
    } else if (ev.key.length === 1 && /\S/.test(ev.key)) {
      // type a letter to jump to the next item that starts with it
      const k = ev.key.toLowerCase();
      const next = [...list.slice(at + 1), ...list.slice(0, at + 1)].find(b => b.textContent?.trim().toLowerCase().startsWith(k));
      next?.focus();
    }
  });
  // keep the icon column only when some item has an icon
  if (mn.querySelector('.tb-menu-item > svg:first-child') === null) mn.querySelectorAll('.tb-menu-gap').forEach(g => g.remove());
  // in the top layer, so it shows above an open dialog
  document.body.append(mn);
  mn.showPopover?.();
  const r = mn.getBoundingClientRect();
  mn.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  mn.style.top = `${Math.max(8, y + r.height > innerHeight - 8 ? y - r.height : y)}px`;
  menus.push(mn);
  menuItems(mn)[0]?.focus();
}

// --- calendar ------------------------------------------------------------------------
//
// The calendar of a date field: a grid of days, as in the WAI-ARIA date picker
// pattern. Arrows move by days and weeks, Page Up/Down by months, Home/End to
// the ends of the week, Enter or Space picks, Esc closes. Days are UTC dates.

interface Calendar { face: ObjectCell; opener: HTMLButtonElement; box: HTMLElement; month: HTMLElement; at: Date }
let calendar: Calendar | null = null;

const DAY_MS = 86400000;

/** A date! cell as a UTC date at midnight, or null. */
function utcDate(v: Cell): Date | null {
  return v.t === K.Date ? new Date(Date.UTC(v.v.y, v.v.m - 1, v.v.d)) : null;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The date argument of a min or max rule of a face, or null. */
function dateRule(face: ObjectCell, rule: string): Date | null {
  const rules = get(face, 'rules');
  if (rules.t !== K.Block) return null;
  for (const r of rules.s.data) {
    if (r.t !== K.Block || r.s.data[0]?.t !== K.Word || spell((r.s.data[0] as WordCell).sym) !== rule) continue;
    return utcDate(r.s.data[1] ?? NONE);
  }
  return null;
}

function openCalendar(face: ObjectCell, opener: HTMLButtonElement): void {
  closeCalendar(false);
  const today = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const box = el('div', 'tb-calendar');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', opener.getAttribute('aria-label') ?? own('choose-date'));
  box.setAttribute('popover', 'manual');
  const month = el('h2', 'tb-calendar-month');
  month.id = `tb-${nextId++}`;
  month.setAttribute('aria-live', 'polite');
  const step = (name: string, label: string, by: number): HTMLButtonElement => {
    const b = el('button', 'tb-calendar-step');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    const svg = icon(name);
    if (svg !== null) b.append(svg);
    b.addEventListener('click', () => {
      if (calendar === null) return;
      calendar.at = addMonths(calendar.at, by);
      renderCalendar();
    });
    return b;
  };
  const head = el('div', 'tb-calendar-head');
  head.append(step('chevron-left', own('previous-month'), -1), month, step('chevron-right', own('next-month'), 1));
  box.append(head);
  calendar = { face, opener, box, month, at: utcDate(get(face, 'value')) ?? today };
  opener.setAttribute('aria-expanded', 'true');
  box.addEventListener('keydown', calendarKey);
  box.addEventListener('focusout', ev => {
    if (calendar?.box === box && !box.contains(ev.relatedTarget as Node | null) && ev.relatedTarget !== null) closeCalendar(false);
  });
  document.addEventListener('pointerdown', outsideCalendar, true);
  document.body.append(box);
  box.showPopover?.();
  renderCalendar();
  const r = opener.closest('.tb-date')!.getBoundingClientRect();
  const c = box.getBoundingClientRect();
  box.style.left = `${Math.max(8, Math.min(r.right - c.width, innerWidth - c.width - 8))}px`;
  box.style.top = `${r.bottom + 4 + c.height > innerHeight - 8 ? Math.max(8, r.top - 4 - c.height) : r.bottom + 4}px`;
  focusDay();
}

function closeCalendar(refocus = true): void {
  if (calendar === null) return;
  const { box, opener } = calendar;
  calendar = null;
  box.hidePopover?.();
  box.remove();
  opener.setAttribute('aria-expanded', 'false');
  document.removeEventListener('pointerdown', outsideCalendar, true);
  if (refocus) opener.focus();
}

function outsideCalendar(ev: PointerEvent): void {
  if (calendar !== null && !calendar.box.contains(ev.target as Node) && !calendar.opener.contains(ev.target as Node)) closeCalendar(false);
}

/** Draws the month of the focused day; the head stays. */
function renderCalendar(): void {
  const cal = calendar!;
  const lang = activeLanguage(host.rt);
  const at = cal.at;
  const min = dateRule(cal.face, 'min');
  const max = dateRule(cal.face, 'max');
  const chosen = utcDate(get(cal.face, 'value'));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => new Intl.DateTimeFormat(lang, { timeZone: 'UTC', ...opts });

  cal.month.textContent = fmt({ month: 'long', year: 'numeric' }).format(at);
  const grid = el('table', 'tb-calendar-grid');
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-labelledby', cal.month.id);
  const first = weekStart(lang) % 7;
  const names = el('tr');
  for (let i = 0; i < 7; i++) {
    // 4-Jan-1970 was a Sunday
    const day = new Date(Date.UTC(1970, 0, 4 + ((first + i) % 7)));
    const th = el('th');
    th.scope = 'col';
    th.abbr = fmt({ weekday: 'long' }).format(day);
    th.textContent = fmt({ weekday: 'narrow' }).format(day);
    names.append(th);
  }
  const thead = el('thead');
  thead.append(names);
  const body = el('tbody');
  const start = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1);
  let ms = start - ((new Date(start).getUTCDay() - first + 7) % 7) * DAY_MS;
  const label = fmt({ dateStyle: 'full' });
  do {
    const row = el('tr');
    for (let i = 0; i < 7; i++, ms += DAY_MS) {
      const d = new Date(ms);
      const td = el('td', 'tb-calendar-day');
      td.setAttribute('role', 'gridcell');
      td.textContent = String(d.getUTCDate());
      td.setAttribute('aria-label', label.format(d));
      td.dataset.day = isoDay(d);
      td.tabIndex = ms === at.getTime() ? 0 : -1;
      if (d.getUTCMonth() !== at.getUTCMonth()) td.classList.add('tb-calendar-other');
      if (ms === today) td.setAttribute('aria-current', 'date');
      td.setAttribute('aria-selected', chosen !== null && ms === chosen.getTime() ? 'true' : 'false');
      if ((min !== null && d < min) || (max !== null && d > max)) td.setAttribute('aria-disabled', 'true');
      td.addEventListener('click', () => pickDay(d));
      row.append(td);
    }
    body.append(row);
  } while (new Date(ms).getUTCMonth() === at.getUTCMonth());
  grid.append(thead, body);
  cal.box.querySelector('table')?.remove();
  cal.box.append(grid);
}

function addMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n;
  // the same day, or the last one of a shorter month
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
}

function focusDay(): void {
  calendar?.box.querySelector<HTMLElement>('td[tabindex="0"]')?.focus();
}

function pickDay(d: Date): void {
  const cal = calendar;
  if (cal === null) return;
  if (cal.box.querySelector(`td[data-day="${isoDay(d)}"]`)?.getAttribute('aria-disabled') === 'true') return;
  const face = cal.face;
  closeCalendar();
  void fire('ui-input', face, string(isoDay(d))).then(() => fire('ui-blur', face));
}

function calendarKey(ev: KeyboardEvent): void {
  const cal = calendar;
  if (cal === null) return;
  seenKeys.add(ev);
  if (ev.key === 'Escape') {
    ev.preventDefault();
    ev.stopPropagation();
    closeCalendar();
    return;
  }
  if (!(ev.target instanceof HTMLTableCellElement)) return;
  const at = cal.at;
  const first = weekStart(activeLanguage(host.rt)) % 7;
  const back = (at.getUTCDay() - first + 7) % 7;
  const days: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -back, End: 6 - back };
  let to: Date | null = null;
  if (ev.key in days) to = new Date(at.getTime() + days[ev.key]! * DAY_MS);
  else if (ev.key === 'PageUp' || ev.key === 'PageDown') to = addMonths(at, (ev.key === 'PageUp' ? -1 : 1) * (ev.shiftKey ? 12 : 1));
  else if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    pickDay(at);
    return;
  }
  if (to === null) return;
  ev.preventDefault();
  cal.at = to;
  if (to.getUTCMonth() === at.getUTCMonth()) {
    cal.box.querySelectorAll<HTMLElement>('td[tabindex="0"]').forEach(td => { td.tabIndex = -1; });
    const td = cal.box.querySelector<HTMLElement>(`td[data-day="${isoDay(to)}"]`)!;
    td.tabIndex = 0;
    td.focus();
  } else {
    renderCalendar();
    focusDay();
  }
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Dead', 'Unidentified']);

/** Keys that are characters in Red's event/key. */
const KEY_CHARS: Record<string, number> = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8 };
/** Keys that are words in Red's event/key. */
const KEY_WORDS: Record<string, string> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Home: 'home', End: 'end',
  PageUp: 'page-up', PageDown: 'page-down', Insert: 'insert', Delete: 'delete',
};

/** A key as Red gives it in event/key: a char! (#"a", #"^M" for Enter) or a word ('left, 'F2). */
function keyCell(ev: KeyboardEvent): Cell | null {
  if (MODIFIER_KEYS.has(ev.key)) return null;
  const c = KEY_CHARS[ev.key];
  if (c !== undefined) return char(c);
  const cps = [...ev.key];
  if (cps.length === 1) return char(cps[0]!.codePointAt(0)!);
  if (/^F\d+$/.test(ev.key)) return wordOf(K.LitWord, ev.key);
  return wordOf(K.LitWord, KEY_WORDS[ev.key] ?? ev.key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase());
}

function keyWords(ev: KeyboardEvent): [string, Cell][] {
  const b = (x: boolean): Cell => x ? TRUE : FALSE;
  return [['key', keyCell(ev)!], ['ctrl?', b(ev.ctrlKey)], ['shift?', b(ev.shiftKey)], ['alt?', b(ev.altKey)], ['meta?', b(ev.metaKey)]];
}

const APPLE = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const KEY_NAMES: Record<string, string> = {
  esc: 'escape', space: ' ', del: 'delete', up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright',
};

interface Shortcut { key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean }

/** "Ctrl+Shift+K" -> its parts; Ctrl also means Cmd on Apple devices. */
function parseShortcut(spec: string): Shortcut {
  const parts = spec.toLowerCase().split('+').map(p => p.trim());
  const key = parts.pop() ?? '';
  const has = (...names: string[]): boolean => parts.some(p => names.includes(p));
  return { key: KEY_NAMES[key] ?? key, ctrl: has('ctrl', 'control'), shift: has('shift'), alt: has('alt', 'option'), meta: has('meta', 'cmd') };
}

function matches(ev: KeyboardEvent, s: Shortcut): boolean {
  const ctrl = APPLE ? ev.metaKey || ev.ctrlKey : ev.ctrlKey;
  if (ctrl !== (s.ctrl || (APPLE && s.meta)) || ev.shiftKey !== s.shift || ev.altKey !== s.alt) return false;
  if (!APPLE && ev.metaKey !== s.meta) return false;
  // letters and digits by physical key, so Shift or Alt do not change them
  if (/^[a-z]$/.test(s.key)) return ev.code === `Key${s.key.toUpperCase()}`;
  if (/^[0-9]$/.test(s.key)) return ev.code === `Digit${s.key}`;
  return ev.key.toLowerCase() === s.key;
}

/** How a shortcut is announced (aria-keyshortcuts) and shown (tooltip). */
function shortcutAria(spec: string): string {
  return spec.split('+').map(p => {
    const w = p.trim().toLowerCase();
    if (w === 'ctrl' || w === 'control') return APPLE ? 'Meta' : 'Control';
    if (w === 'cmd') return 'Meta';
    return p.trim().length === 1 ? p.trim().toUpperCase() : p.trim();
  }).join('+');
}

function shortcutLabel(spec: string): string {
  return APPLE ? spec.replace(/ctrl|control/i, 'Cmd') : spec;
}

/** Shortcuts beat the browser's own keys; the view's on-key gets keys nobody handled. */
function onKeyDown(ev: KeyboardEvent): void {
  const modal = Array.from(document.querySelectorAll('dialog[open]')).pop();
  for (const m of shortcuts) {
    if (!m.el.isConnected) { shortcuts.delete(m); continue; }
    const spec = str(m.face, 'shortcut');
    if (spec === null || !matches(ev, parseShortcut(spec))) continue;
    // only what the user can see: not in a hidden tab, a closed dialog or behind a modal
    if (m.el.getClientRects().length === 0 || (modal !== undefined && !modal.contains(m.el))) continue;
    ev.preventDefault();
    seenKeys.add(ev);
    m.el.click();
    return;
  }
}

function onViewKey(ev: KeyboardEvent): void {
  if (viewKeys === null || seenKeys.has(ev) || keyCell(ev) === null) return;
  fireEvent(viewKeys, 'on-key', keyWords(ev));
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
  const hint = str(face, 'hint');
  if (hint !== null) return hint;
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
      const n = build(c);
      if (style === 'toolbar' && n.tagName === 'HR') n.setAttribute('aria-orientation', 'vertical');
      node.append(n);
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
    const first = el('option');
    first.value = '';
    sel.append(first);
    for (const o of optionsOf(face)) {
      const opt = el('option');
      opt.value = optionValue(o);
      opt.textContent = optionText(o);
      sel.append(opt);
    }
    input = sel;
  } else {
    const i = el('input', 'tb-input');
    i.type = style === 'password' ? 'password' : hasRule(face, 'email') ? 'email' : hasRule(face, 'url') ? 'url' : 'text';
    if (style === 'number' || style === 'money' || hasRule(face, 'integer')) i.inputMode = hasRule(face, 'integer') ? 'numeric' : 'decimal';
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
    // an amount goes to Trebol as 1234.5 and a date as 2026-11-03; what is not one goes as typed
    const lang = activeLanguage(host.rt);
    const typed = style === 'money' ? readLocal(input.value, lang) ?? input.value
      : style === 'date' ? readDate(input.value, lang) ?? input.value : input.value;
    void fire('ui-input', face, typed === '' ? NONE : string(typed));
  });
  // an amount shows formatted, and is edited as a plain number of the active language
  if (style === 'money') input.addEventListener('focus', () => { input.value = editLocal(get(face, 'value'), activeLanguage(host.rt)); });
  input.addEventListener('blur', () => void fire('ui-blur', face));
  const iconWord = style === 'area' || style === 'choice' ? null : iconName(face);
  const svg = iconWord !== null ? icon(iconWord) : null;
  if (style === 'date') {
    const box = el('div', 'tb-date');
    const pick = el('button', 'tb-date-button');
    pick.type = 'button';
    pick.setAttribute('aria-haspopup', 'dialog');
    pick.setAttribute('aria-expanded', 'false');
    const cal = icon('calendar');
    if (cal !== null) pick.append(cal);
    pick.addEventListener('click', () => (calendar?.opener === pick ? closeCalendar() : openCalendar(face, pick)));
    box.append(input, pick);
    control.append(box, error);
  } else if (svg !== null) {
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
  m.radios = [];
  for (const o of optionsOf(face)) {
    const option = el('label', 'tb-check');
    const r = el('input');
    r.type = 'radio';
    r.name = id;
    r.value = optionValue(o);
    r.addEventListener('change', () => {
      if (r.checked) void fire('ui-input', face, string(r.value)).then(() => fire('ui-blur', face));
    });
    const caption = el('span');
    caption.textContent = optionText(o);
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

// An upload: a button that is also a place to drop files, and the list of the
// chosen ones. Files go to Trebol as handles; their bytes stay in the browser.

function buildUpload(face: ObjectCell, m: Mounted): HTMLElement {
  const id = `tb-${nextId++}`;
  const wrap = el('div', 'tb-field');
  const label = el('label', 'tb-label');
  label.htmlFor = id;
  const control = el('div', 'tb-control');
  const zone = el('div', 'tb-upload');
  const picker = el('input');
  picker.type = 'file';
  picker.hidden = true;
  picker.tabIndex = -1;
  const choose = el('button', 'tb-button');
  choose.type = 'button';
  choose.id = id;
  const svg = icon('upload');
  if (svg !== null) choose.append(svg);
  choose.append(el('span'));
  const hint = el('span', 'tb-upload-hint');
  const error = el('div', 'tb-error');
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  choose.setAttribute('aria-describedby', error.id);
  const list = el('ul', 'tb-upload-list');
  choose.addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => {
    const files = [...(picker.files ?? [])];
    picker.value = '';
    if (files.length > 0) chooseFiles(face, files);
  });
  const hasFiles = (ev: DragEvent): boolean => ev.dataTransfer?.types.includes('Files') === true;
  zone.addEventListener('dragover', ev => {
    if (!hasFiles(ev) || choose.disabled) return;
    ev.preventDefault();
    ev.dataTransfer!.dropEffect = 'copy';
    zone.classList.add('tb-drop-over');
  });
  zone.addEventListener('dragleave', ev => {
    if (!zone.contains(ev.relatedTarget as Node | null)) zone.classList.remove('tb-drop-over');
  });
  zone.addEventListener('drop', ev => {
    zone.classList.remove('tb-drop-over');
    if (!hasFiles(ev) || choose.disabled) return;
    ev.preventDefault();
    chooseFiles(face, [...ev.dataTransfer!.files]);
  });
  zone.append(choose, hint, picker);
  control.append(zone, list, error);
  wrap.append(label, control);
  m.label = label;
  m.error = error;
  m.button = choose;
  m.box = list;
  return wrap;
}

/** The accept list of an upload: extensions ("pdf") and types ("image/*"). */
function acceptList(face: ObjectCell): string[] {
  const a = get(face, 'accept');
  return a.t === K.Block ? a.s.data.slice(a.i).map(x => form(x).trim().toLowerCase()).filter(x => x !== '') : [];
}

function accepts(file: File, list: string[]): boolean {
  if (list.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return list.some(x => x.includes('/')
    ? (x.endsWith('/*') ? type.startsWith(x.slice(0, -1)) : type === x)
    : name.endsWith(x.startsWith('.') ? x : `.${x}`));
}

function chooseFiles(face: ObjectCell, files: File[]): void {
  const list = acceptList(face);
  const ok = files.filter(f => accepts(f, list));
  const taken = flag(face, 'multiple') ? ok : ok.slice(0, 1);
  const cells: Cell[] = [];
  for (const f of taken) cells.push(string(f.name), int(f.size), string(f.type), fileHandle(f));
  const refused = files.filter(f => !accepts(f, list)).map(f => string(f.name));
  void fire('ui-files', face, blockOf(K.Block, cells), blockOf(K.Block, refused));
}

/** A size in bytes as it reads in a language: 12 kB, 3.4 MB. */
function fileSize(bytes: number, lang: string): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'];
  let n = bytes;
  let u = 0;
  while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
  try {
    return new Intl.NumberFormat(lang, { style: 'unit', unit: units[u], unitDisplay: 'short', maximumFractionDigits: u === 0 ? 0 : 1 }).format(n);
  } catch {
    return `${bytes} B`;
  }
}

function syncUpload(m: Mounted, err: string | null): void {
  const f = m.face;
  const label = m.label!;
  label.textContent = str(f, 'text') ?? '';
  label.classList.toggle('tb-required', required(f));
  const many = flag(f, 'multiple');
  const choose = m.button!;
  (choose.lastChild as HTMLElement).textContent = own(many ? 'choose-files' : 'choose-file');
  choose.disabled = flag(f, 'disabled') || flag(f, 'readonly');
  choose.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
  const zone = choose.parentElement!;
  (zone.querySelector('.tb-upload-hint') as HTMLElement).textContent = own(many ? 'drop-files' : 'drop-file');
  const picker = zone.querySelector('input') as HTMLInputElement;
  picker.multiple = many;
  picker.accept = acceptList(f).map(x => (x.includes('/') || x.startsWith('.') ? x : `.${x}`)).join(',');
  m.error!.textContent = err ?? '';
  const v = get(f, 'value');
  const files = v.t === K.Block ? v.s.data.slice(v.i).filter(x => x.t === K.Object) as ObjectCell[] : [];
  const lang = activeLanguage(host.rt);
  const items = files.map((file, i) => {
    const li = el('li');
    const name = el('span', 'tb-upload-name');
    name.textContent = str(file, 'name') ?? '';
    const size = el('span', 'tb-upload-size');
    const n = get(file, 'size');
    size.textContent = n.t === K.Integer ? fileSize(Number(n.v), lang) : '';
    const remove = el('button', 'tb-upload-remove');
    remove.type = 'button';
    remove.disabled = choose.disabled;
    remove.setAttribute('aria-label', own('remove-file', name.textContent ?? ''));
    const x = icon('close');
    if (x !== null) remove.append(x);
    remove.addEventListener('click', () => {
      choose.focus();
      void fire('ui-remove-file', f, int(i + 1));
    });
    li.append(name, size, remove);
    return li;
  });
  m.box!.replaceChildren(...items);
  m.box!.hidden = items.length === 0;
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

/** No rule applies to a read-only face, so it never asks for a value. */
function required(f: ObjectCell): boolean {
  return hasRule(f, 'required') && !flag(f, 'readonly');
}

function syncRadio(m: Mounted, err: string | null): void {
  const f = m.face;
  m.label!.textContent = str(f, 'text') ?? '';
  m.label!.classList.toggle('tb-required', required(f));
  const v = get(f, 'value');
  const want = v.t === K.None ? null : form(v);
  for (const r of m.radios!) {
    r.checked = r.value === want;
    r.disabled = flag(f, 'disabled') || flag(f, 'readonly');
  }
  const group = m.radios![0]?.parentElement!.parentElement;
  group?.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
  group?.setAttribute('aria-required', required(f) ? 'true' : 'false');
  m.error!.textContent = err ?? '';
}

// --- rows ---------------------------------------------------------------------------
//
// The dialect makes the rows as faces; the host only draws them, as one line each
// with the labels of the first line as the headers, or as cards on narrow screens.

function buildRowsField(m: Mounted): HTMLElement {
  const id = `tb-${nextId++}`;
  const wrap = el('div', 'tb-field');
  const label = el('div', 'tb-label');
  label.id = id;
  const control = el('div', 'tb-control');
  const box = el('div', 'tb-rows');
  box.setAttribute('role', 'group');
  box.setAttribute('aria-labelledby', id);
  const error = el('div', 'tb-error');
  error.setAttribute('aria-live', 'polite');
  control.append(box, error);
  wrap.append(label, control);
  m.label = label;
  m.error = error;
  m.box = box;
  return wrap;
}

function syncRowsField(m: Mounted, err: string | null): void {
  const f = m.face;
  m.label!.textContent = str(f, 'text') ?? '';
  m.label!.classList.toggle('tb-required', required(f));
  m.error!.textContent = err ?? '';
  // code gave it a new value or changed its flags: the dialect makes the rows again
  const v = get(f, 'value');
  const now = [v.t === K.Block ? v.s : null, flag(f, 'readonly'), flag(f, 'disabled')];
  const was = m.shown as unknown[] | undefined;
  if (was === undefined || now.some((x, i) => x !== was[i])) {
    m.shown = now;
    void fire('ui-rows', f);
  }
}

/** Puts the rows in their new order, keeping the nodes (and the focus) of the ones that stay. */
function placeEntries(m: Mounted): void {
  const box = m.box!;
  const faces = children(m.face);
  const active = document.activeElement;
  const fresh: HTMLElement[] = [];
  const nodes = faces.map(c => {
    const old = byCtx.get(c.ctx);
    if (old !== undefined && old.el.parentElement === box) return old.el;
    const n = build(c);
    fresh.push(n);
    return n;
  });
  let cursor = box.firstChild;
  for (const n of nodes) {
    if (n === cursor) cursor = cursor.nextSibling;
    else box.insertBefore(n, cursor);
  }
  while (cursor !== null) {
    const next = cursor.nextSibling;
    box.removeChild(cursor);
    cursor = next;
  }
  const add = nodes[nodes.length - 1];
  // the button pressed went away with its row, or a row was just added
  if (active !== null && active !== document.body && !active.isConnected) (add as HTMLElement | undefined)?.focus();
  else if (fresh.length === 1 && (active === add || active === document.body)) {
    fresh[0]!.querySelector<HTMLElement>('input, textarea, select, [contenteditable="true"]')?.focus();
  }
}

// --- rich text -----------------------------------------------------------------------
//
// An editable box whose value is Markdown (see markdown.ts). The box is drawn from
// the tree with text nodes and read back the same way; pasting takes only the text.

const RICH_TOOLS: readonly [string, string][] = [
  ['bold', 'bold'], ['italic', 'italic'], ['heading', 'heading'],
  ['list', 'bullet-list'], ['list-ordered', 'number-list'], ['link', 'link'],
];

function inlineNodes(items: Inline[]): Node[] {
  return items.flatMap((x): Node[] => {
    switch (x.k) {
      case 'text': return [document.createTextNode(x.text)];
      case 'br': return [el('br')];
      case 'b': case 'i': {
        const e = el(x.k);
        e.append(...inlineNodes(x.kids));
        return [e];
      }
      case 'a': {
        if (!safeHref(x.href)) return inlineNodes(x.kids);
        const a = el('a');
        a.href = x.href;
        a.rel = 'noopener noreferrer';
        a.target = '_blank';
        a.append(...inlineNodes(x.kids));
        return [a];
      }
    }
  });
}

function blockNodes(blocks: Block[]): Node[] {
  return blocks.map(b => {
    if (b.k === 'p' || b.k === 'h') {
      const e = b.k === 'p' ? el('p') : el(`h${b.level}` as 'h1' | 'h2' | 'h3');
      e.append(...inlineNodes(b.kids));
      return e;
    }
    const list = el(b.k);
    for (const item of b.items) {
      const li = el('li');
      li.append(...inlineNodes(item));
      list.append(li);
    }
    return list;
  });
}

function readInline(nodes: Iterable<Node>): Inline[] {
  const out: Inline[] = [];
  for (const n of nodes) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = (n.textContent ?? '').replace(/\u00a0/g, ' ').replace(/[\n\r]+/g, ' ');
      const last = out[out.length - 1];
      if (t === '') continue;
      if (last?.k === 'text') last.text += t;
      else out.push({ k: 'text', text: t });
    } else if (n instanceof HTMLElement) {
      const kids = readInline(n.childNodes);
      switch (n.tagName) {
        case 'BR': out.push({ k: 'br' }); break;
        case 'B': case 'STRONG': if (kids.length > 0) out.push({ k: 'b', kids }); break;
        case 'I': case 'EM': if (kids.length > 0) out.push({ k: 'i', kids }); break;
        case 'A': if (kids.length > 0) out.push({ k: 'a', href: n.getAttribute('href') ?? '', kids }); break;
        default: out.push(...kids);
      }
    }
  }
  // the browser ends an empty or last line with a <br> that shows nothing
  while (out[out.length - 1]?.k === 'br') out.pop();
  return out;
}

const RICH_BLOCK = /^(P|DIV|H[1-6]|UL|OL|BLOCKQUOTE|SECTION)$/;

function readBlocks(box: HTMLElement): Block[] {
  const out: Block[] = [];
  let loose: Node[] = [];
  const flush = (): void => {
    const kids = readInline(loose);
    if (kids.length > 0) out.push({ k: 'p', kids });
    loose = [];
  };
  for (const n of box.childNodes) {
    if (!(n instanceof HTMLElement) || !RICH_BLOCK.test(n.tagName)) {
      loose.push(n);
      continue;
    }
    flush();
    if (n.tagName === 'UL' || n.tagName === 'OL') {
      const items = [...n.children].map(li => readInline(li.childNodes)).filter(x => x.length > 0);
      if (items.length > 0) out.push({ k: n.tagName === 'UL' ? 'ul' : 'ol', items });
    } else if (n.tagName === 'DIV' || n.tagName === 'SECTION' || n.tagName === 'BLOCKQUOTE') {
      out.push(...readBlocks(n));
    } else {
      const kids = readInline(n.childNodes);
      if (kids.length === 0) continue;
      if (n.tagName === 'P') out.push({ k: 'p', kids });
      else out.push({ k: 'h', level: Math.min(3, Number(n.tagName[1])), kids });
    }
  }
  flush();
  return out;
}

function buildRich(face: ObjectCell, m: Mounted): HTMLElement {
  const id = `tb-${nextId++}`;
  const wrap = el('div', 'tb-field');
  const label = el('div', 'tb-label');
  label.id = id;
  const control = el('div', 'tb-control');
  const shell = el('div', 'tb-rich');
  const tools = el('div', 'tb-rich-tools');
  tools.setAttribute('role', 'toolbar');
  const box = el('div', 'tb-input tb-rich-box');
  box.setAttribute('role', 'textbox');
  box.setAttribute('aria-multiline', 'true');
  box.setAttribute('aria-labelledby', id);
  const linkRow = el('div', 'tb-rich-link');
  linkRow.hidden = true;
  const linkInput = el('input', 'tb-input');
  linkInput.type = 'url';
  const linkOk = el('button', 'tb-button tb-small');
  linkOk.type = 'button';
  linkRow.append(linkInput, linkOk);
  const error = el('div', 'tb-error');
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  box.setAttribute('aria-describedby', error.id);
  label.addEventListener('click', () => box.focus());

  const changed = (): void => {
    const md = printMd(readBlocks(box));
    if (md === m.shown) return;
    m.shown = md;
    void fire('ui-input', face, md === '' ? NONE : string(md));
  };
  box.addEventListener('input', changed);
  box.addEventListener('paste', ev => {
    ev.preventDefault();
    document.execCommand('insertText', false, ev.clipboardData?.getData('text/plain') ?? '');
  });
  box.addEventListener('drop', ev => ev.preventDefault());
  wrap.addEventListener('focusout', ev => {
    if (!wrap.contains(ev.relatedTarget as Node | null)) void fire('ui-blur', face);
  });

  let saved: Range | null = null;
  const inHeading = (): boolean => {
    const n = getSelection()?.anchorNode ?? null;
    return (n instanceof Element ? n : n?.parentElement)?.closest('h1, h2, h3') != null;
  };
  const command = (what: string): void => {
    box.focus();
    switch (what) {
      case 'bold': case 'italic': document.execCommand(what); break;
      case 'heading': document.execCommand('formatBlock', false, inHeading() ? 'P' : 'H2'); break;
      case 'bullet-list': document.execCommand('insertUnorderedList'); break;
      case 'number-list': document.execCommand('insertOrderedList'); break;
      case 'link': {
        const s = getSelection();
        saved = s !== null && s.rangeCount > 0 && box.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
        linkRow.hidden = false;
        linkInput.value = '';
        linkInput.removeAttribute('aria-invalid');
        linkInput.focus();
        return;
      }
    }
    changed();
  };
  for (const [name, what] of RICH_TOOLS) {
    const b = el('button', 'tb-rich-tool');
    b.type = 'button';
    b.dataset['tool'] = what;
    const svg = icon(name);
    if (svg !== null) b.append(svg);
    // pressing a tool keeps the selection in the text
    b.addEventListener('mousedown', ev => ev.preventDefault());
    b.addEventListener('click', () => command(what));
    tools.append(b);
  }
  const addLink = (): void => {
    const typed = linkInput.value.trim();
    const url = /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`;
    if (typed === '' || !safeHref(url)) {
      linkInput.setAttribute('aria-invalid', 'true');
      return;
    }
    linkRow.hidden = true;
    box.focus();
    const s = getSelection();
    if (saved !== null && s !== null) {
      s.removeAllRanges();
      s.addRange(saved);
    }
    if (saved === null || saved.collapsed) document.execCommand('insertText', false, typed);
    if (saved !== null && !saved.collapsed) document.execCommand('createLink', false, url);
    else {
      // what was just typed becomes the link
      const r = getSelection()?.getRangeAt(0);
      if (r !== undefined) {
        const node = r.startContainer;
        const start = Math.max(0, r.startOffset - typed.length);
        const whole = document.createRange();
        whole.setStart(node, start);
        whole.setEnd(node, r.startOffset);
        s?.removeAllRanges();
        s?.addRange(whole);
        document.execCommand('createLink', false, url);
      }
    }
    changed();
  };
  linkOk.addEventListener('click', addLink);
  linkInput.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      addLink();
    } else if (ev.key === 'Escape') {
      ev.stopPropagation();
      linkRow.hidden = true;
      box.focus();
    }
  });
  shell.append(tools, linkRow, box);
  control.append(shell, error);
  wrap.append(label, control);
  m.label = label;
  m.error = error;
  m.box = box;
  return wrap;
}

function syncRich(m: Mounted, err: string | null): void {
  const f = m.face;
  const box = m.box!;
  m.label!.textContent = str(f, 'text') ?? '';
  m.label!.classList.toggle('tb-required', required(f));
  const shell = box.parentElement!;
  const readonly = flag(f, 'readonly');
  const disabled = flag(f, 'disabled');
  const locked = readonly || disabled;
  box.contentEditable = locked ? 'false' : 'true';
  box.tabIndex = disabled ? -1 : 0;
  box.setAttribute('aria-readonly', locked ? 'true' : 'false');
  box.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  box.setAttribute('aria-required', required(f) ? 'true' : 'false');
  box.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
  const tools = shell.querySelector<HTMLElement>('.tb-rich-tools')!;
  tools.hidden = locked;
  tools.setAttribute('aria-label', str(f, 'text') ?? '');
  for (const b of tools.querySelectorAll<HTMLButtonElement>('button')) {
    const name = own(b.dataset['tool']!);
    b.setAttribute('aria-label', name);
    b.title = name;
  }
  const linkRow = shell.querySelector<HTMLElement>('.tb-rich-link')!;
  if (locked) linkRow.hidden = true;
  linkRow.querySelector('input')!.placeholder = own('link-url');
  linkRow.querySelector('button')!.textContent = own('link-add');
  m.error!.textContent = err ?? '';
  // never fight the user's typing: only what code set is drawn again
  const md = str(f, 'value') ?? '';
  if (md !== m.shown && document.activeElement !== box) {
    m.shown = md;
    box.replaceChildren(...blockNodes(parseMd(md)));
  }
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
    if (w.t === K.Word) out.push({ sym: (w as WordCell).sym, label: translate(d[i + 1]!, host.rt) });
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
  if (v.t === K.Logic) return own(v.v ? 'yes' : 'no');
  return display(v);
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
  // headers may be texts per language: show them in the active one
  if (table) {
    const ths = box.parentElement!.querySelectorAll('thead th');
    cols.forEach((c, i) => { if (ths[i] !== undefined && ths[i]!.textContent !== c.label) ths[i]!.textContent = c.label; });
  }
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
  m.empty!.textContent = str(f, 'text') ?? own('empty');
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

// --- trees ---------------------------------------------------------------------------

const CHILDREN = intern('children');
const EXPANDED = intern('expanded');

function treeItems(m: Mounted): HTMLElement[] {
  return Array.from(m.box!.querySelectorAll<HTMLElement>('[role="treeitem"]'));
}

/** The node whose children a group holds; none for the root. */
function groupParent(m: Mounted, group: HTMLElement): Cell {
  if (group === m.box) return NONE;
  const item = group.closest('[role="treeitem"]');
  return item !== null ? rowOf.get(item) ?? NONE : NONE;
}

function buildTree(face: ObjectCell, m: Mounted): HTMLElement {
  const wrap = el('div', 'tb-tree-wrap');
  const box = el('ul', 'tb-tree');
  box.setAttribute('role', 'tree');
  const empty = el('p', 'tb-empty');
  wrap.append(box, empty);
  box.addEventListener('click', ev => {
    const target = ev.target as Element;
    const item = target.closest<HTMLElement>('[role="treeitem"]');
    if (item === null) return;
    if (target.closest('.tb-tree-toggle') !== null) return toggleNode(m, item);
    focusItem(m, item);
    selectNode(m, item);
  });
  box.addEventListener('keydown', ev => treeKey(m, ev));
  m.box = box;
  m.rows = new Map();
  m.empty = empty;
  m.open = new Set();
  return wrap;
}

function newTreeItem(): HTMLElement {
  const li = el('li');
  li.setAttribute('role', 'treeitem');
  const row = el('div', 'tb-tree-row');
  const toggle = el('span', 'tb-tree-toggle');
  toggle.setAttribute('aria-hidden', 'true');
  const chevron = icon('chevron-right');
  if (chevron !== null) toggle.append(chevron);
  row.append(toggle, el('span', 'tb-tree-label'));
  const group = el('ul');
  group.setAttribute('role', 'group');
  li.append(row, group);
  return li;
}

/** Creates, updates, moves or removes the items of a tree, level by level, by key. */
function syncTree(m: Mounted): void {
  const f = m.face;
  const label = columns(f)[0]?.sym ?? intern('name');
  const keyWord = get(f, 'key');
  const key = keyWord.t === K.Word || keyWord.t === K.LitWord ? (keyWord as WordCell).sym : intern('id');
  const selected = get(f, 'selected');
  const old = m.rows!;
  const open = m.open!;
  const next = new Map<string, HTMLElement>();
  const level = (group: HTMLElement, nodes: Cell[], depth: number, parentKey: string): void => {
    let cursor = group.firstChild;
    nodes.forEach((node, i) => {
      const id = rowField(node, key);
      let k = id.t === K.None ? `${parentKey}/${i}` : `${id.t}:${form(id)}`;
      if (next.has(k)) k = `${parentKey}/${i}#${k}`;
      const known = old.get(k);
      const item = known ?? newTreeItem();
      next.set(k, item);
      rowOf.set(item, node);
      item.dataset['key'] = k;
      item.setAttribute('aria-level', String(depth));
      item.style.setProperty('--tb-level', String(depth - 1));
      const text = cellText(rowField(node, label));
      const name = item.firstElementChild!.lastElementChild!;
      if (name.textContent !== text) name.textContent = text;
      const kids = rowField(node, CHILDREN);
      const folder = kids.t === K.Block;
      // `expanded: true` opens a node the first time it shows
      if (folder && known === undefined && rowField(node, EXPANDED).t === K.Logic && (rowField(node, EXPANDED) as { v: boolean }).v) open.add(k);
      const isOpen = folder && open.has(k);
      if (folder) item.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      else item.removeAttribute('aria-expanded');
      const sub = item.lastElementChild as HTMLElement;
      if (isOpen) level(sub, (kids as BlockCell).s.data.slice((kids as BlockCell).i), depth + 1, k);
      else sub.replaceChildren();
      sub.hidden = sub.childElementCount === 0;
      const on = selected.t !== K.None && sameRow(selected, node);
      item.classList.toggle('tb-selected', on);
      item.setAttribute('aria-selected', on ? 'true' : 'false');
      if (item !== cursor) group.insertBefore(item, cursor);
      else cursor = cursor.nextSibling;
    });
    // whatever is left after the last placed item is gone from the data
    while (cursor !== null) {
      const gone = cursor;
      cursor = cursor.nextSibling;
      gone.remove();
    }
  };
  const data = get(f, 'data');
  level(m.box!, data.t === K.Block ? data.s.data.slice(data.i) : [], 1, '');
  m.rows = next;
  // one Tab stop: the item that had it, else the selected one, else the first
  const items = treeItems(m);
  const current = items.find(e => e.tabIndex === 0 && e.hasAttribute('tabindex'))
    ?? items.find(e => e.classList.contains('tb-selected')) ?? items[0];
  for (const e of items) e.tabIndex = e === current ? 0 : -1;
  m.empty!.textContent = str(f, 'text') ?? own('empty');
  m.empty!.hidden = items.length > 0;
}

function focusItem(m: Mounted, item: HTMLElement): void {
  for (const e of treeItems(m)) e.tabIndex = e === item ? 0 : -1;
  item.focus();
}

function selectNode(m: Mounted, item: HTMLElement): void {
  const node = rowOf.get(item);
  if (node !== undefined) void fire('ui-select', m.face, node);
}

/** Opens or closes a folder; opening runs on-expand, which may load its children. */
function toggleNode(m: Mounted, item: HTMLElement, want?: boolean): void {
  if (!item.hasAttribute('aria-expanded')) return;
  const k = item.dataset['key']!;
  const open = want ?? !m.open!.has(k);
  if (open === m.open!.has(k)) return;
  const inside = document.activeElement !== item && item.contains(document.activeElement);
  if (open) m.open!.add(k);
  else m.open!.delete(k);
  syncTree(m);
  if (inside) focusItem(m, item);
  const node = rowOf.get(item);
  if (open && node !== undefined) void fire('ui-expand', m.face, node);
}

/** The keys of the treeview pattern: arrows, Home, End, Enter, Space and a letter to jump. */
function treeKey(m: Mounted, ev: KeyboardEvent): void {
  const item = (ev.target as Element).closest<HTMLElement>('[role="treeitem"]');
  if (item === null || ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const items = treeItems(m);
  const i = items.indexOf(item);
  const expanded = item.getAttribute('aria-expanded');
  let to: HTMLElement | null | undefined = null;
  switch (ev.key) {
    case 'ArrowDown': to = items[i + 1]; break;
    case 'ArrowUp': to = items[i - 1]; break;
    case 'Home': to = items[0]; break;
    case 'End': to = items[items.length - 1]; break;
    case 'ArrowRight':
      if (expanded === 'false') toggleNode(m, item, true);
      else if (expanded === 'true') to = item.querySelector<HTMLElement>('[role="treeitem"]');
      break;
    case 'ArrowLeft':
      if (expanded === 'true') toggleNode(m, item, false);
      else to = item.parentElement!.closest<HTMLElement>('[role="treeitem"]');
      break;
    case 'Enter': case ' ': selectNode(m, item); break;
    default: {
      if (ev.key.length !== 1 || ev.key.trim() === '') return;
      const c = ev.key.toLowerCase();
      const label = (e: HTMLElement): string => (e.querySelector('.tb-tree-label')?.textContent ?? '').toLowerCase();
      to = [...items.slice(i + 1), ...items.slice(0, i)].find(e => label(e).startsWith(c));
    }
  }
  ev.preventDefault();
  if (to) focusItem(m, to);
}

/** Where a drag over a tree lands: between siblings, or into a folder when over the middle of its row. */
function treeTarget(m: Mounted, src: Source, x: number, y: number): Target | null {
  const at = document.elementFromPoint(x, y)?.closest<HTMLElement>('[role="treeitem"]');
  const drop = flag(m.face, 'drop');
  let t: Target;
  if (at === null || at === undefined || !m.box!.contains(at)) {
    t = { m, index: insertionAt(m, x, y), reorder: false, group: m.box!, parent: NONE };
  } else {
    const r = at.querySelector(':scope > .tb-tree-row')!.getBoundingClientRect();
    if (at.hasAttribute('aria-expanded') && y > r.top + r.height / 4 && y < r.bottom - r.height / 4) {
      const node = rowOf.get(at)!;
      const kids = rowField(node, CHILDREN) as BlockCell;
      t = { m, index: kids.s.data.length - kids.i, reorder: false, group: at.lastElementChild as HTMLElement, parent: node, into: at };
    } else {
      const group = at.parentElement!;
      const index = Array.prototype.indexOf.call(group.children, at) + (y > r.top + r.height / 2 ? 1 : 0);
      t = { m, index, reorder: false, group, parent: groupParent(m, group) };
    }
  }
  // never into itself or below itself
  if (src.el === t.into || src.el.contains(t.group!)) return null;
  t.reorder = src.within === m && t.group === src.group && t.into === undefined;
  return t.reorder || drop ? t : null;
}

// --- toolbars and breadcrumbs -------------------------------------------------------

const BAR_ITEMS = 'button, a[href], input, select, textarea, [tabindex]';

/** The controls of a toolbar, in order; `shown` skips hidden and disabled ones. */
function barItems(bar: HTMLElement, shown = true): HTMLElement[] {
  return Array.from(bar.querySelectorAll<HTMLElement>(BAR_ITEMS)).filter(e => e.closest('.tb-toolbar') === bar
    && (!shown || e.getClientRects().length > 0 && !(e as HTMLButtonElement).disabled));
}

function buildToolbar(): HTMLElement {
  const bar = el('div', 'tb-toolbar');
  bar.setAttribute('role', 'toolbar');
  // one Tab stop: the arrows move between the controls (roving tabindex)
  bar.addEventListener('keydown', ev => {
    const at = ev.target as HTMLElement;
    if (ev.altKey || ev.ctrlKey || ev.metaKey || at.matches('input, select, textarea')) return;
    const items = barItems(bar);
    const i = items.indexOf(at);
    if (i < 0) return;
    const to = ev.key === 'ArrowRight' ? (i + 1) % items.length : ev.key === 'ArrowLeft' ? (i - 1 + items.length) % items.length
      : ev.key === 'Home' ? 0 : ev.key === 'End' ? items.length - 1 : -1;
    if (to < 0) return;
    ev.preventDefault();
    items[to]!.focus();
  });
  bar.addEventListener('focusin', ev => {
    const at = ev.target as HTMLElement;
    if (!barItems(bar, false).includes(at)) return;
    for (const e of barItems(bar, false)) e.tabIndex = e === at ? 0 : -1;
  });
  return bar;
}

/** Keeps exactly one control of a toolbar in the Tab order, and the text of its buttons as their tooltip. */
function syncToolbar(bar: HTMLElement): void {
  for (const e of Array.from(bar.children)) {
    const m = byNode.get(e);
    if (m !== undefined && m.el === e && word(m.face, 'style') === 'button') sync(m);
  }
  // the bar may not be on the page yet, so visibility is checked only when moving
  const items = barItems(bar, false);
  const current = items.find(e => e.tabIndex === 0 && e.hasAttribute('tabindex')) ?? items[0];
  for (const e of items) e.tabIndex = e === current ? 0 : -1;
}

interface Crumb { text: string; id: Cell }

/** The items of a breadcrumb: a label and a word each, the last one maybe without a word. */
function crumbs(face: ObjectCell): Crumb[] {
  const d = get(face, 'data');
  if (d.t !== K.Block) return [];
  const out: Crumb[] = [];
  const cells = d.s.data.slice(d.i);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    if (c.t !== K.String && c.t !== K.Map) continue;
    const next = cells[i + 1];
    const id = next !== undefined && next.t === K.Word ? next : NONE;
    if (id !== NONE) i++;
    out.push({ text: translate(c, host.rt), id });
  }
  return out;
}

function buildBreadcrumb(m: Mounted): HTMLElement {
  const nav = el('nav', 'tb-breadcrumb');
  keepOwn(nav, 'breadcrumb', 'aria-label');
  m.box = el('ol');
  nav.append(m.box);
  return nav;
}

/** Rebuilds the items; on narrow screens the middle ones hide behind a "…" that lists them in a menu. */
function syncBreadcrumb(m: Mounted): void {
  const f = m.face;
  const items = crumbs(f);
  // choosing an item sets value, which repaints the face: keep the nodes (and the focus) if nothing changed
  const signature = items.map(c => `${c.text}\u0000${form(c.id)}`).join('\u0001');
  if (m.kids === signature) return;
  m.kids = signature;
  const pick = (c: Crumb): void => void fire('ui-crumb', f, wordOf(K.LitWord, form(c.id)));
  const middle = items.length > 3 ? items.slice(1, -2) : [];
  const nodes: HTMLElement[] = items.map((c, i) => {
    const li = el('li');
    if (middle.includes(c)) li.className = 'tb-crumb-middle';
    if (c.id === NONE) {
      const span = el('span', 'tb-crumb');
      span.textContent = c.text;
      if (i === items.length - 1) span.setAttribute('aria-current', 'page');
      li.append(span);
    } else {
      const b = el('button', 'tb-crumb');
      b.type = 'button';
      b.textContent = c.text;
      b.addEventListener('click', () => pick(c));
      li.append(b);
    }
    return li;
  });
  if (middle.length > 0) {
    const li = el('li', 'tb-crumb-more');
    const b = el('button', 'tb-crumb');
    b.type = 'button';
    b.textContent = '…';
    keepOwn(b, 'more-levels', 'aria-label');
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', () => {
      const r = b.getBoundingClientRect();
      openMenu(middle.map(c => ({ text: c.text, run: () => pick(c) })), r.left, r.bottom + 4, b);
    });
    li.append(b);
    nodes.splice(1, 0, li);
  }
  m.box!.replaceChildren(...nodes);
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
  keepOwn(x, 'close', 'aria-label');
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
  keepOwn(handle, 'resize-panes', 'aria-label');
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
  keepOwn(caption, 'back');
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
  if (flag(f, 'drop')) cls.push('tb-drop-zone');
  if (role !== null && !INPUTS.has(style)) cls.push(`tb-${role}`);
  const size = word(f, 'size');
  if (size !== null) cls.push(`tb-${size}`);
  const align = word(f, 'align');
  if (align !== null && style === 'row') cls.push(`tb-${align}`);
  if (err !== null) cls.push('tb-invalid');
  if (flag(f, 'pending')) cls.push('tb-pending');
  setExtra(m.el, cls);
  // shown as it is, but it and its children cannot be used
  m.el.inert = flag(f, 'inert');
  // a face you can drag takes the focus, so the keyboard reaches its menu and moves it
  if (flag(f, 'drag') && !isData(m) && m.el.tabIndex < 0) m.el.tabIndex = 0;
  space(m.el, 'padding', get(f, 'pad'));
  space(m.el, 'gap', get(f, 'gap'));

  if (style === 'radio') return syncRadio(m, err);
  if (style === 'upload') return syncUpload(m, err);
  if (style === 'rich') return syncRich(m, err);
  if (m.input !== null) {
    if (m.label !== null) {
      m.label.textContent = t ?? '';
      m.label.classList.toggle('tb-required', required(f) && style !== 'check');
    }
    const v = get(f, 'value');
    if (m.input instanceof HTMLInputElement && m.input.type === 'checkbox') {
      m.input.checked = v.t === K.Logic && v.v;
    } else {
      const want = v.t === K.None ? str(f, 'typed') ?? '' : style === 'money' || style === 'date' ? display(v) : form(v);
      // never fight the user's typing: only push values that differ from what code set
      if (document.activeElement !== m.input && m.input.value !== want) m.input.value = want;
      const hint = str(f, 'hint');
      if (m.input instanceof HTMLSelectElement) {
        const select = m.input;
        select.options[0]!.textContent = hint ?? own('choose');
        optionsOf(f).forEach((o, i) => {
          const opt = select.options[i + 1];
          if (opt) opt.textContent = optionText(o);
        });
      }
      else if (hint !== null) m.input.placeholder = hint;
    }
    const readonly = flag(f, 'readonly');
    // text can be read-only; a choice or a checkbox can only be disabled
    const typing = m.input instanceof HTMLTextAreaElement || (m.input instanceof HTMLInputElement && m.input.type !== 'checkbox');
    if (typing) (m.input as HTMLInputElement | HTMLTextAreaElement).readOnly = readonly;
    m.input.disabled = flag(f, 'disabled') || (readonly && !typing);
    if (style === 'date') {
      const pick = m.input.nextElementSibling as HTMLButtonElement;
      pick.disabled = m.input.disabled || readonly;
      pick.setAttribute('aria-label', t !== null ? own('choose-date-of', t) : own('choose-date'));
    }
    m.input.setAttribute('aria-required', required(f) ? 'true' : 'false');
    m.input.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
    if (m.error !== null) m.error.textContent = err ?? '';
    return;
  }
  switch (style) {
    case 'title': case 'heading': case 'text': {
      const tv = get(f, 'text');
      m.el.textContent = tv.t === K.None ? '' : tv.t === K.Map || tv.t === K.Word ? translate(tv, host.rt) : display(tv);
      break;
    }
    case 'button': case 'link': {
      (m.label ?? m.el).textContent = t ?? '';
      const named = iconLabel(f);
      if (named !== null) m.el.setAttribute('aria-label', named);
      else m.el.removeAttribute('aria-label');
      const keys = str(f, 'shortcut');
      if (keys !== null) m.el.setAttribute('aria-keyshortcuts', shortcutAria(keys));
      else m.el.removeAttribute('aria-keyshortcuts');
      // in a toolbar, narrow screens show only the icon, so the text goes in the tooltip too
      const bar = m.label !== null && m.el.parentElement?.classList.contains('tb-toolbar') === true;
      const tip = named ?? (keys !== null || bar ? t : null);
      m.el.title = tip === null ? '' : keys === null ? tip : `${tip} (${shortcutLabel(keys)})`;
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
    case 'rows': syncRowsField(m, err); break;
    case 'tree': syncTree(m); return;
    case 'breadcrumb': syncBreadcrumb(m); return;
    case 'toolbar': {
      if (t !== null) m.el.setAttribute('aria-label', t);
      else m.el.removeAttribute('aria-label');
      break;
    }
    case 'dialog': syncDialog(m); break;
    case 'tabs': syncTabs(m); return;
    case 'split': syncSplit(m); return;
    case 'tab': if (m.button !== null) m.button.textContent = t ?? ''; break;
    case 'panel': {
      let h = m.el.querySelector<HTMLElement>(':scope > .tb-panel-title');
      if (t === null) h?.remove();
      else {
        if (h === null) {
          h = el('h2', 'tb-panel-title');
          m.el.prepend(h);
        }
        h.textContent = t;
      }
      break;
    }
    case 'scroll': {
      if (t !== null) m.el.setAttribute('aria-label', t);
      else m.el.removeAttribute('aria-label');
      break;
    }
    case 'grid': {
      const cols = get(f, 'cols');
      m.el.style.setProperty('--tb-cols', cols.t === K.Integer ? String(cols.v) : '2');
      // [1 4 1]: a column per weight, never narrower than what it holds
      const weights = cols.t === K.Block ? cols.s.data.slice(cols.i).filter(c => c.t === K.Integer) : [];
      if (weights.length > 0) m.el.style.setProperty('--tb-tracks', weights.map(w => `minmax(min-content, ${form(w)}fr)`).join(' '));
      else m.el.style.removeProperty('--tb-tracks');
      break;
    }
  }
  if (style === 'toolbar') syncToolbar(m.el);
  if (m.el instanceof HTMLButtonElement) {
    // a submit stays focusable while the form has errors; clicking it shows them
    if (flag(f, 'submit')) m.el.setAttribute('aria-disabled', flag(f, 'disabled') ? 'true' : 'false');
    else m.el.disabled = flag(f, 'disabled');
  }
  // children replaced by code: rebuild this container
  const kids = get(f, 'pane');
  if (kids.t === K.Block && (m.kids as BlockCell | undefined)?.s !== kids.s) {
    m.kids = kids;
    if (style === 'rows') {
      placeEntries(m);
      void fire('ui-pane', f);
      return;
    }
    const box = m.box ?? m.el;
    const keep = box.querySelector(':scope > .tb-panel-title');
    box.replaceChildren(...(keep ? [keep] : []));
    appendChildren(box, f, style);
    // let the dialect link the new faces to their view and form
    void fire('ui-pane', f);
    if (style === 'screens') enteredScreen(box);
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

// --- screens ---------------------------------------------------------------------
//
// The page's link is `#/name/arg...`, each part URI-encoded. `go` pushes a
// history entry; back, forward and links to a screen change the hash, and the
// host passes the new route to `ui-route`.

/** The screens face of the page. */
let screensFace: ObjectCell | null = null;
/** Where a change of screen is announced. */
let screenNews: HTMLElement | null = null;

function routeParts(): string[] {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === '') return [];
  return h.split('/').map(p => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
}

function routeBlock(): BlockCell {
  return blockOf(K.Block, routeParts().map(p => string(p)));
}

/** `#/client/42` for the word `client` or the path `client/42`; null for anything else. */
function screenHref(v: Cell): string | null {
  const part = (c: Cell): string => encodeURIComponent(c.t === K.String ? text(c as StringCell) : c.t === K.Word ? spell((c as WordCell).sym) : form(c));
  if (v.t === K.Word) return '#/' + part(v);
  if (v.t === K.Path) return '#/' + v.s.data.slice(v.i).map(part).join('/');
  return null;
}

native('route', '[]', () => value(routeBlock()));

native('set-route', '[route [block!] replace [logic!]]', (_t, f) => {
  const href = screenHref({ ...(f.args[0] as BlockCell), t: K.Path } as Cell) ?? '#/';
  const replace = f.args[1]!.t === K.Logic && f.args[1]!.v;
  if (replace) history.replaceState(null, '', href);
  else history.pushState(null, '', href);
  return value(f.args[0]!);
});

/** After code showed another screen: focus it and announce its title. */
function enteredScreen(box: HTMLElement): void {
  const screen = box.firstElementChild as HTMLElement | null;
  if (screen === null) return;
  const heading = screen.querySelector<HTMLElement>('h1, h2');
  const target = heading ?? screen;
  if (target.tabIndex < 0) target.tabIndex = -1;
  target.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  if (screenNews === null) {
    screenNews = el('div', 'tb-sr-only');
    screenNews.setAttribute('aria-live', 'polite');
    document.body.append(screenNews);
  }
  const news = screenNews;
  news.textContent = '';
  setTimeout(() => { news.textContent = screen.getAttribute('aria-label') ?? ''; }, 50);
}

// --- natives -----------------------------------------------------------------------

native('repaint', '[]', () => {
  // after a change of language: every mounted face shows its values again
  document.documentElement.lang = activeLanguage(host.rt);
  if (titleFace !== null) document.title = str(titleFace, 'text') ?? document.title;
  for (const e of Array.from(document.querySelectorAll<HTMLElement>('[data-tb-own]'))) showOwn(e);
  for (const e of Array.from(document.querySelectorAll('*'))) {
    const m = byNode.get(e);
    if (m !== undefined && m.el === e) sync(m);
  }
  return value(NONE);
});

let root: HTMLElement | null = null;
/** The face whose text is the page title: the view's title, or the screen shown. */
let titleFace: ObjectCell | null = null;

native('show', '[face [object!]]', (_t, f) => {
  const face = f.args[0] as ObjectCell;
  viewKeys = null;
  screensFace = null;
  document.documentElement.lang = activeLanguage(host.rt);
  const node = build(face);
  if (root !== null) root.replaceWith(node);
  else document.body.append(node);
  root = node;
  const title = children(face).find(c => word(c, 'style') === 'title');
  // a screen names the page itself
  if (title !== undefined && screensFace === null) {
    document.title = str(title, 'text') ?? document.title;
    titleFace = title;
  }
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
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keydown', onReorderKey);
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove, { passive: false });
  document.addEventListener('pointerup', () => endDrag(true));
  document.addEventListener('pointercancel', () => endDrag(false));
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && dragging?.on) { ev.preventDefault(); seenKeys.add(ev); endDrag(false); } }, true);
  // a touch drag must not scroll the page
  document.addEventListener('touchmove', ev => { if (dragging?.on) ev.preventDefault(); }, { passive: false });
  document.addEventListener('keydown', onViewKey);
  window.addEventListener('hashchange', () => {
    if (screensFace !== null) void fire('ui-route', screensFace, routeBlock());
  });
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
