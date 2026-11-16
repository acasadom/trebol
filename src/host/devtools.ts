// The dev tools of trebol dev: a panel docked at the bottom of the page, opened
// with Ctrl+` or the small button in the corner. Only a page that trebol dev
// serves has them (it adds <meta name="trebol-dev">); a built page never does.
//
//   Faces    the faces on the page as a tree, and what one of them holds:
//            pick one on the page or in the tree; where it was written links
//            to the editor (vscode://).
//   Console  >> and == as in the trebol console, against the running app;
//            `face` is the face picked; print shows here too.
//   Machines the machines the program holds in its words: their states as a
//            tree, the ones they are in marked, and of the one chosen its
//            data, the ways out of its states and the events it takes now.
//   Log      events, requests, toasts, errors and warnings, and each change
//            of state of a machine, newest last.

import {
  K, NONE, load, LoadError, bindSeries, scriptStart, mold, form, ctxFind, intern, spell,
  type Cell, type ObjectCell, type WordCell, type BlockCell, type Ctx, type Runtime,
} from '../core/index.ts';
import { spawn, taskResult } from './scheduler.ts';
import { output, report, translate, type Host } from './index.ts';
import { devLog } from './devlog.ts';

/** What the dev tools need from the browser host. */
export interface DevSide {
  host: Host;
  /** The folder trebol dev serves, to link a face to its file; null if unknown. */
  root: string | null;
  /** The face whose own node this is, if any. */
  faceOf(e: Element): ObjectCell | null;
  /** The face of a node or of the nearest node around it that is one. */
  faceAt(e: Element): { face: ObjectCell; el: HTMLElement } | null;
  /** The node of a face on the page, if it is on the page. */
  nodeOf(face: ObjectCell): HTMLElement | null;
}

type Tab = 'faces' | 'machines' | 'console' | 'log';

/** The panel's state, kept across the reloads of live reload. */
interface State { open: boolean; tab: Tab; height: number }

const STATE_KEY = 'trebol-dev';
const HISTORY_KEY = 'trebol-dev-history';
const MAX_HISTORY = 100;
const MAX_LOG = 500;
const MAX_MOLD = 2000;

let side: DevSide;
let state: State = { open: false, tab: 'faces', height: 320 };
let panel: HTMLElement;
let opener: HTMLButtonElement;
let outline: HTMLElement;
let pickButton: HTMLButtonElement;
let tree: HTMLElement;
let detail: HTMLElement;
let consoleOut: HTMLElement;
let consoleIn: HTMLTextAreaElement;
let consoleFace: HTMLElement;
let logList: HTMLElement;
const tabs = new Map<Tab, { button: HTMLButtonElement; pane: HTMLElement }>();

/** The face chosen in Faces, `face` in Console. */
let picked: ObjectCell | null = null;
/** The face under the pointer or the tree row the pointer is on. */
let pointed: ObjectCell | null = null;
let picking = false;
let history: string[] = [];
let back = 0;
let lastLog: { key: string; li: HTMLElement; text: HTMLElement; count: number } | null = null;
let treeFrame = 0;
/** The code typed so far runs one piece after another. */
let running: Promise<void> = Promise.resolve();

function el<T extends keyof HTMLElementTagNameMap>(tag: T, cls?: string, content?: string): HTMLElementTagNameMap[T] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (content !== undefined) e.textContent = content;
  return e;
}

function button(cls: string, content: string, act: () => void): HTMLButtonElement {
  const b = el('button', cls, content);
  b.type = 'button';
  b.addEventListener('click', act);
  return b;
}

function read<T>(store: () => Storage, key: string, fallback: T): T {
  try {
    const v = store().getItem(key);
    return v === null ? fallback : { ...fallback, ...(JSON.parse(v) as T) };
  } catch {
    return fallback;
  }
}

function write(store: () => Storage, key: string, v: unknown): void {
  try {
    store().setItem(key, JSON.stringify(v));
  } catch {
    // a private window or blocked storage: the panel forgets, nothing else
  }
}

// --- reading faces -----------------------------------------------------------------

function get(face: ObjectCell, name: string): Cell {
  const i = ctxFind(face.ctx, intern(name));
  return i < 0 ? NONE : face.ctx.vals[i]!;
}

function wordText(v: Cell): string | null {
  return v.t === K.Word || v.t === K.LitWord ? spell((v as WordCell).sym) : null;
}

function short(s: string, most = 80): string {
  const line = s.replace(/\s+/g, ' ');
  return line.length > most ? line.slice(0, most - 1) + '…' : line;
}

/** How a face is named in the tree, the log and errors: its style, name and text (`field email "Email"`). */
export function faceRef(face: ObjectCell, rt: Runtime): string {
  const style = wordText(get(face, 'style')) ?? 'face';
  const name = wordText(get(face, 'name'));
  const t = get(face, 'text');
  const shown = t.t === K.None ? null : t.t === K.String || t.t === K.Map || t.t === K.Word ? translate(t, rt) : form(t);
  return [style, name, shown !== null && shown !== '' ? `"${short(shown, 40)}"` : null].filter(x => x !== null).join(' ');
}

function on(face: ObjectCell, name: string): boolean {
  const v = get(face, name);
  return !(v.t === K.None || (v.t === K.Logic && !v.v));
}

function moldShort(v: Cell, most = MAX_MOLD): string {
  const s = mold(v);
  return s.length > most ? s.slice(0, most - 1) + '…' : s;
}

/** A face's file:line:col and a vscode:// link to it, when the file is in the folder trebol dev serves. */
function placeOf(face: ObjectCell): { text: string; href: string | null } | null {
  const v = get(face, 'place');
  if (v.t !== K.String) return null;
  const at = form(v);
  const m = /^(.*):(\d+):(\d+)$/.exec(at);
  if (m === null) return { text: at, href: null };
  let url: URL;
  try {
    url = new URL(m[1]!);
  } catch {
    return { text: at, href: null };
  }
  const path = decodeURIComponent(url.pathname);
  const text = `${path.slice(1)}:${m[2]}:${m[3]}`;
  const mine = url.origin === location.origin && !path.startsWith('/@trebol/') && side.root !== null;
  return { text, href: mine ? `vscode://file${side.root!.replace(/\/$/, '')}${path}:${m[2]}:${m[3]}` : null };
}

// --- the panel -----------------------------------------------------------------------

/** Starts the dev tools on a page served by trebol dev; not in a frame (the documentation's examples). */
export function startDevtools(s: DevSide): void {
  if (window !== window.top) return;
  side = s;
  state = read(() => sessionStorage, STATE_KEY, state);
  history = read<{ lines: string[] }>(() => localStorage, HISTORY_KEY, { lines: [] }).lines;

  panel = el('section', 'tb-dev-tools');
  panel.popover = 'manual';
  panel.setAttribute('aria-label', 'Trebol dev tools');
  const grip = el('div', 'tb-dev-grip');
  grip.addEventListener('pointerdown', resizeFrom);
  const head = el('header');
  const list = el('div', 'tb-dev-tabs');
  list.setAttribute('role', 'tablist');
  head.append(list);
  const body = el('div', 'tb-dev-body');
  for (const [tab, label] of [['faces', 'Faces'], ['machines', 'Machines'], ['console', 'Console'], ['log', 'Log']] as const) {
    const b = button('tb-dev-tab', label, () => openTab(tab));
    b.setAttribute('role', 'tab');
    b.id = `tb-dev-tab-${tab}`;
    const pane = el('div', `tb-dev-pane tb-dev-${tab}`);
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', b.id);
    list.append(b);
    body.append(pane);
    tabs.set(tab, { button: b, pane });
  }
  pickButton = button('tb-dev-button', 'Pick', () => setPicking(!picking));
  pickButton.title = 'Click a face on the page to see it here';
  pickButton.setAttribute('aria-pressed', 'false');
  const close = button('tb-dev-button', 'Close', () => setOpen(false));
  close.title = 'Close (Ctrl+`)';
  head.append(el('span', 'tb-dev-space'), pickButton, close);
  panel.append(grip, head, body);
  // keys typed here are not for a face around the panel, and Escape does not close a dialog it is in
  panel.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Escape') ev.preventDefault();
  });
  buildFaces(tabs.get('faces')!.pane);
  buildMachines(tabs.get('machines')!.pane);
  buildConsole(tabs.get('console')!.pane);
  buildLog(tabs.get('log')!.pane);

  opener = button('tb-dev-opener', 'Trebol', () => setOpen(true));
  opener.popover = 'manual';
  opener.title = 'Dev tools (Ctrl+`)';
  outline = el('div', 'tb-dev-outline');
  outline.popover = 'manual';
  outline.setAttribute('aria-hidden', 'true');
  document.body.append(panel, opener, outline);

  addEventListener('keydown', ev => {
    if (ev.ctrlKey && !ev.altKey && !ev.metaKey && ev.code === 'Backquote') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      setOpen(!state.open);
    } else if (picking && ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      setPicking(false);
    }
  }, true);
  addEventListener('pointermove', pickMove, true);
  addEventListener('pointerdown', pickDown, true);
  addEventListener('click', pickClick, true);
  addEventListener('scroll', () => placeOutline(), { capture: true, passive: true });
  addEventListener('resize', () => {
    setHeight(state.height);
    placeOutline();
  });

  hook();
  openTab(state.tab);
  setOpen(state.open);
}

/** Keys typed in the panel are not the app's: its shortcuts and on-key leave them. */
export function inDevtools(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.tb-dev-tools') !== null;
}

/**
 * Puts the panel, its opener and the outline inside the dialog on show, or back in the body: while a
 * modal dialog is open everything outside it is inert, the panel too.
 */
function home(): void {
  const modals = document.querySelectorAll('dialog:modal');
  const into = modals.length > 0 ? modals[modals.length - 1]! : document.body;
  if (panel.parentElement === into) return;
  for (const e of [panel, opener, outline]) {
    const shown = e.matches(':popover-open');
    into.append(e);
    if (shown) e.showPopover();
  }
}

function setOpen(open: boolean): void {
  state.open = open;
  write(() => sessionStorage, STATE_KEY, state);
  home();
  if (open) {
    opener.hidePopover();
    panel.showPopover();
    setHeight(state.height);
    refresh();
    if (state.tab === 'console') consoleIn.focus();
  } else {
    setPicking(false);
    point(null);
    const focused = panel.contains(document.activeElement);
    panel.hidePopover();
    opener.showPopover();
    if (focused) opener.focus();
    document.body.style.paddingBottom = '';
  }
}

function setHeight(h: number): void {
  state.height = Math.round(Math.max(140, Math.min(h, innerHeight - 60)));
  panel.style.height = `${state.height}px`;
  // the end of the page stays reachable above the panel
  if (state.open) document.body.style.paddingBottom = `${state.height}px`;
}

function resizeFrom(ev: PointerEvent): void {
  ev.preventDefault();
  const grip = ev.currentTarget as HTMLElement;
  grip.setPointerCapture(ev.pointerId);
  const move = (e: PointerEvent): void => setHeight(innerHeight - e.clientY);
  const up = (): void => {
    grip.removeEventListener('pointermove', move);
    grip.removeEventListener('pointerup', up);
    write(() => sessionStorage, STATE_KEY, state);
  };
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', up);
}

function openTab(tab: Tab): void {
  state.tab = tab;
  write(() => sessionStorage, STATE_KEY, state);
  for (const [t, { button: b, pane }] of tabs) {
    b.setAttribute('aria-selected', String(t === tab));
    b.tabIndex = t === tab ? 0 : -1;
    pane.hidden = t !== tab;
  }
  refresh();
  placeOutline();
  if (tab === 'console' && state.open) consoleIn.focus();
  if (tab === 'log') logList.scrollTop = logList.scrollHeight;
}

/** What the host tells: events, requests, notes and repaints. */
function hook(): void {
  devLog.event = (fn, face, args) => {
    if (fn === 'ui-blur') return;
    let what = fn.replace(/^ui-/, '');
    let rest = args;
    if (fn === 'ui-event' && args[0] !== undefined) {
      what = wordText(args[0]) ?? what;
      rest = [];
    }
    const shown = rest.length > 0 && rest[0]!.t !== K.Object ? ' ' + short(mold(rest[0]!), 60) : '';
    log('event', `${what} · ${faceRef(face, side.host.rt)}${shown}`, `${fn} ${faceKey(face)}`);
  };
  devLog.request = (verb, url, status, ms, problem) => {
    let where = url;
    try {
      const u = new URL(url, location.href);
      if (u.origin === location.origin) where = u.pathname + u.search;
    } catch {
      // not a URL: shown as given
    }
    const outcome = status !== null ? String(status) : `failed (${problem ?? 'network'})`;
    log(status !== null && status < 400 ? 'request' : 'failed', `${verb} ${where} ${outcome} · ${ms} ms`);
  };
  devLog.note = (kind, text) => log(kind, text);
  devLog.repainted = () => {
    home();
    noteMachines();
    if (!state.open) return;
    placeOutline();
    if ((state.tab === 'faces' || state.tab === 'machines') && treeFrame === 0) treeFrame = requestAnimationFrame(() => {
      treeFrame = 0;
      refresh();
    });
  };
  const line = output.line;
  output.line = text => {
    line(text);
    say('out', text);
  };
}

function refresh(): void {
  if (!state.open) return;
  if (state.tab === 'faces') {
    drawTree();
    drawDetail();
  }
  if (state.tab === 'machines') void drawMachines();
  consoleFace.textContent = picked !== null ? `face: ${faceRef(picked, side.host.rt)}` : 'face: none (pick one in Faces)';
}

// --- faces ---------------------------------------------------------------------------

const faceKeys = new WeakMap<Ctx, number>();
let nextKey = 1;

function faceKey(face: ObjectCell): number {
  let k = faceKeys.get(face.ctx);
  if (k === undefined) faceKeys.set(face.ctx, k = nextKey++);
  return k;
}

function buildFaces(pane: HTMLElement): void {
  tree = el('div', 'tb-dev-tree');
  tree.setAttribute('aria-label', 'Faces on the page');
  tree.addEventListener('pointerleave', () => point(null));
  detail = el('div', 'tb-dev-detail');
  pane.append(tree, detail);
}

/** The faces on the page, in the order of their nodes, with how deep each is. */
function facesOnPage(): { face: ObjectCell; el: Element; depth: number }[] {
  const out: { face: ObjectCell; el: Element; depth: number }[] = [];
  const walk = (e: Element, depth: number): void => {
    for (const c of Array.from(e.children)) {
      if (c === panel || c === opener || c === outline) continue;
      const f = side.faceOf(c);
      if (f !== null) out.push({ face: f, el: c, depth });
      walk(c, f !== null ? depth + 1 : depth);
    }
  };
  walk(document.body, 0);
  return out;
}

function drawTree(): void {
  const top = tree.scrollTop;
  tree.replaceChildren();
  for (const { face, el: node, depth } of facesOnPage()) {
    const row = button('tb-dev-node', faceRef(face, side.host.rt), () => pick(face));
    row.style.paddingLeft = `${8 + depth * 14}px`;
    if (face.ctx === picked?.ctx) row.setAttribute('aria-current', 'true');
    if ((node as HTMLElement).offsetParent === null && getComputedStyle(node).position !== 'fixed') row.classList.add('tb-dev-unseen');
    row.addEventListener('pointerenter', () => point(face));
    tree.append(row);
  }
  tree.scrollTop = top;
}

function drawDetail(): void {
  detail.replaceChildren();
  if (picked === null) {
    detail.append(el('p', 'tb-dev-hint', 'Pick a face on the page, or choose one in the tree.'));
    return;
  }
  const f = picked;
  const title = el('h3', undefined, faceRef(f, side.host.rt));
  detail.append(title);
  const where = placeOf(f);
  if (where !== null) {
    const p = el('p', 'tb-dev-place');
    if (where.href !== null) {
      const a = el('a', undefined, where.text);
      a.href = where.href;
      a.title = 'Open in VS Code';
      p.append(a);
    } else p.textContent = where.text;
    detail.append(p);
  }
  if (side.nodeOf(f) === null) detail.append(el('p', 'tb-dev-hint', 'Not on the page any more.'));
  const dl = el('dl');
  const row = (k: string, v: string): void => {
    dl.append(el('dt', undefined, k), el('dd', undefined, v));
  };
  for (const n of ['style', 'name', 'text', 'value', 'error', 'rules', 'hint', 'role']) {
    const v = get(f, n);
    if (v.t !== K.None) row(n, moldShort(v, 400));
  }
  const events: string[] = [];
  if (get(f, 'action').t === K.Block) events.push('action');
  const ev = get(f, 'events');
  if (ev.t === K.Block) {
    for (const c of (ev as BlockCell).s.data.slice(ev.i)) if (c.t !== K.Block) events.push(form(c));
  }
  if (events.length > 0) row('events', events.join(' '));
  const flags = ['required', 'disabled', 'hidden', 'readonly'].filter(n => on(f, n));
  if (flags.length > 0) row('flags', flags.join(' '));
  const data = get(f, 'data');
  if (data.t === K.Block) row('rows', String((data as BlockCell).s.data.length - data.i));
  detail.append(dl);
}

function pick(face: ObjectCell | null): void {
  picked = face;
  point(null);
  refresh();
}

/** Draws the outline around a face, or hides it. */
function point(face: ObjectCell | null): void {
  pointed = face;
  placeOutline();
}

function placeOutline(): void {
  const face = pointed ?? (state.open && state.tab === 'faces' ? picked : null);
  const node = face !== null ? side.nodeOf(face) : null;
  const r = node?.getBoundingClientRect();
  if (r === undefined || (r.width === 0 && r.height === 0)) {
    if (outline.matches(':popover-open')) outline.hidePopover();
    return;
  }
  Object.assign(outline.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  outline.classList.toggle('tb-dev-pointed', pointed !== null);
  // shown again so it stays above a dialog opened since
  if (outline.matches(':popover-open')) outline.hidePopover();
  outline.showPopover();
}

function setPicking(on: boolean): void {
  picking = on;
  pickButton.setAttribute('aria-pressed', String(on));
  document.documentElement.classList.toggle('tb-dev-picking', on);
  if (on) openTab('faces');
  else point(null);
}

function pickTarget(ev: Event): { face: ObjectCell; el: HTMLElement } | null {
  const t = ev.target;
  if (!(t instanceof Element) || inDevtools(t) || t === opener) return null;
  return side.faceAt(t);
}

function pickMove(ev: PointerEvent): void {
  if (!picking) return;
  const at = pickTarget(ev);
  if (at !== null) point(at.face);
}

function pickDown(ev: PointerEvent): void {
  if (!picking || pickTarget(ev) === null) return;
  // the face does not get the press: no focus, no drag
  ev.preventDefault();
  ev.stopImmediatePropagation();
}

function pickClick(ev: MouseEvent): void {
  if (!picking) return;
  const at = pickTarget(ev);
  if (at === null) return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  setPicking(false);
  pick(at.face);
}

// --- machines ------------------------------------------------------------------------

/** A machine the program holds: the word (or object/field) it is in. */
interface Found { name: string; m: ObjectCell }

let machineList: HTMLElement;
let machineDetail: HTMLElement;
/** The machine chosen, by its context, and the state chosen in it (its key as mold gives it). */
let chosen: { ctx: Ctx; state: string | null } | null = null;
/** What each machine's state was at the last repaint, for the log. */
const seenState = new WeakMap<Ctx, string>();
let drawing = 0;

function buildMachines(pane: HTMLElement): void {
  machineList = el('div', 'tb-dev-tree');
  machineList.setAttribute('aria-label', 'Machines and their states');
  machineDetail = el('div', 'tb-dev-detail');
  pane.append(machineList, machineDetail);
}

function field(o: ObjectCell, name: string): Cell | null {
  const i = ctxFind(o.ctx, intern(name));
  return i < 0 ? null : o.ctx.vals[i]!;
}

function isMachine(v: Cell): v is ObjectCell {
  return v.t === K.Object && field(v as ObjectCell, 'nodes') !== null && field(v as ObjectCell, 'queue') !== null
    && field(v as ObjectCell, 'scope') !== null && field(v as ObjectCell, 'state') !== null;
}

/** The machines in the words of the program, and in the fields of the objects in them; no others. */
function findMachines(): Found[] {
  const out: Found[] = [];
  const seen = new Set<Ctx>();
  const user = side.host.rt.user;
  const add = (name: string, v: Cell): void => {
    if (!isMachine(v) || seen.has(v.ctx)) return;
    seen.add(v.ctx);
    out.push({ name, m: v });
  };
  user.keys.forEach((k, i) => {
    const v = user.vals[i]!;
    add(spell(k), v);
    if (v.t === K.Object && !isMachine(v) && field(v as ObjectCell, 'style') === null) {
      const o = v as ObjectCell;
      o.ctx.keys.forEach((f, j) => add(`${spell(k)}/${spell(f)}`, o.ctx.vals[j]!));
    }
  });
  return out;
}

/** A line in the log for each machine whose state changed since the last repaint. */
function noteMachines(): void {
  for (const { name, m } of findMachines()) {
    const now = mold(field(m, 'state') ?? NONE);
    const was = seenState.get(m.ctx);
    seenState.set(m.ctx, now);
    if (was !== undefined && was !== now) log('machine', `${name}: ${was} → ${now}`);
  }
}

/** The value after a word in a block of plain data, as graph-of gives it. */
function pickKey(b: Cell | null, key: string): Cell | null {
  if (b === null || b.t !== K.Block) return null;
  const d = (b as BlockCell).s.data.slice((b as BlockCell).i);
  for (let i = 0; i + 1 < d.length; i += 2) if (wordText(d[i]!) === key) return d[i + 1]!;
  return null;
}

function pairs(b: Cell | null): [Cell, Cell][] {
  if (b === null || b.t !== K.Block) return [];
  const d = (b as BlockCell).s.data.slice((b as BlockCell).i);
  const out: [Cell, Cell][] = [];
  for (let i = 0; i + 1 < d.length; i += 2) out.push([d[i]!, d[i + 1]!]);
  return out;
}

/** The values of a block or a path. */
function items(b: Cell | null): Cell[] {
  return b === null || (b.t !== K.Block && b.t !== K.Path) ? [] : (b as BlockCell).s.data.slice((b as BlockCell).i);
}

function truthy(v: Cell | null): boolean {
  return v !== null && !(v.t === K.None || (v.t === K.Logic && !v.v));
}

async function graphOf(m: ObjectCell): Promise<Cell> {
  const fn: WordCell = { t: K.Word, sym: intern('graph-of'), bind: side.host.rt.user };
  return taskResult(spawn(side.host.sch, { data: [fn, m] } as unknown as BlockCell['s'], 0));
}

/** A way as one line: `on start → work`, with where and set when it has them. */
function wayText(w: Cell): string {
  const on = pickKey(w, 'on');
  const ev = on !== null && on.t === K.Block ? items(on).map(form).join(' ') : null;
  const to = pickKey(w, 'to');
  const parts: string[] = [];
  if (ev !== null) parts.push(`on ${ev}`);
  if (to !== null) parts.push(`→ ${mold(to)}`);
  else {
    const branches = items(pickKey(w, 'branches')).map(b => `${wordText(items(b)[0]!) === 'else' ? 'else ' : ''}${mold(pickKey(b, 'to') ?? NONE)}`);
    parts.push(`→ ${wordText(items(w)[2]!) ?? 'choose'} [${branches.join(' | ')}]`);
  }
  const where = pickKey(w, 'where');
  if (truthy(where)) parts.push(`where ${short(mold(where!), 40)}`);
  const set = pickKey(w, 'set');
  if (truthy(set)) parts.push(`set ${short(mold(set!), 40)}`);
  if (ev === null) parts.unshift('at once');
  return parts.join(' ');
}

async function drawMachines(): Promise<void> {
  const ticket = ++drawing;
  const found = findMachines();
  const graphs: Cell[] = [];
  for (const f of found) {
    try {
      graphs.push(await graphOf(f.m));
    } catch {
      graphs.push(NONE);
    }
  }
  if (ticket !== drawing) return;
  const top = machineList.scrollTop;
  machineList.replaceChildren();
  machineDetail.replaceChildren();
  if (found.length === 0) {
    machineList.append(el('p', 'tb-dev-hint', 'No machine in the words of the program.'));
    return;
  }
  if (chosen === null || !found.some(f => f.m.ctx === chosen!.ctx)) chosen = { ctx: found[0]!.m.ctx, state: null };
  found.forEach((f, i) => {
    const g = graphs[i]!;
    const head = button('tb-dev-node tb-dev-machine-head', `${f.name}  ${mold(field(f.m, 'state') ?? NONE)}`, () => {
      chosen = { ctx: f.m.ctx, state: null };
      void drawMachines();
    });
    if (chosen!.ctx === f.m.ctx && chosen!.state === null) head.setAttribute('aria-current', 'true');
    machineList.append(head);
    for (const [key, info] of pairs(pickKey(g, 'states'))) {
      const k = mold(key);
      const depth = key.t === K.Path ? items(key).length : 1;
      const name = key.t === K.Path ? form(items(key).at(-1)!) : form(key);
      const kind = wordText(pickKey(info, 'kind') ?? NONE);
      const marks = [
        truthy(pickKey(info, 'initial')) ? '›' : ' ',
        kind === 'final' ? '(final)' : kind === 'parallel' ? '(parallel)' : '',
      ];
      const row = button('tb-dev-node', `${marks[0]} ${name} ${marks[1]}`.trimEnd(), () => {
        chosen = { ctx: f.m.ctx, state: k };
        void drawMachines();
      });
      row.style.paddingLeft = `${8 + depth * 14}px`;
      if (truthy(pickKey(info, 'on'))) row.classList.add('tb-dev-on');
      if (chosen!.ctx === f.m.ctx && chosen!.state === k) row.setAttribute('aria-current', 'true');
      machineList.append(row);
    }
  });
  machineList.scrollTop = top;
  const at = found.findIndex(f => f.m.ctx === chosen!.ctx);
  drawMachine(found[at]!, graphs[at]!);
}

function drawMachine(f: Found, g: Cell): void {
  const d = machineDetail;
  d.append(el('h3', undefined, chosen!.state === null ? f.name : `${f.name} · ${chosen!.state}`));
  const dl = el('dl');
  const row = (k: string, v: string): void => {
    dl.append(el('dt', undefined, k), el('dd', undefined, v));
  };
  const states = pairs(pickKey(g, 'states'));
  const on = new Set(states.filter(([, info]) => truthy(pickKey(info, 'on'))).map(([k]) => mold(k)));
  const ways = items(pickKey(g, 'ways'));
  row('state', mold(field(f.m, 'state') ?? NONE));
  const data = field(f.m, 'data');
  if (data !== null && data.t === K.Object) {
    const o = data as ObjectCell;
    row('data', o.ctx.keys.map((k, i) => `${spell(k)}: ${moldShort(o.ctx.vals[i]!, 200)}`).join('\n') || '(none)');
  }
  // what can? says yes to: the events of the ways out of the states it is in
  const now = new Set<string>();
  for (const w of ways) {
    const from = pickKey(w, 'from');
    if (from !== null && on.has(mold(from))) for (const e of items(pickKey(w, 'on'))) now.add(form(e));
  }
  row('takes now', now.size > 0 ? [...now].join(' ') : '(nothing)');
  if (truthy(field(f.m, 'done'))) row('done', mold(field(f.m, 'outcome') ?? NONE));
  if (chosen!.state !== null) {
    const info = states.find(([k]) => mold(k) === chosen!.state)?.[1] ?? null;
    for (const n of ['kind', 'timeout', 'outcome', 'invoke', 'for', 'defer']) {
      const v = pickKey(info, n);
      if (v !== null && truthy(v) && !(v.t === K.Block && items(v).length === 0)) row(n, n === 'invoke' && v.t === K.Block ? 'a machine of its own' : moldShort(v, 200));
    }
    if (truthy(pickKey(info, 'run'))) row('run', moldShort(pickKey(info, 'run')!, 200));
  }
  const mine = ways.filter(w => chosen!.state === null || mold(pickKey(w, 'from') ?? NONE) === chosen!.state);
  if (mine.length > 0) {
    row('ways', mine.map(w => (chosen!.state === null ? `${mold(pickKey(w, 'from') ?? NONE)} ` : '') + wayText(w)).join('\n'));
  }
  d.append(dl);
}

// --- console -------------------------------------------------------------------------

// Load errors that mean "the input is not finished yet" (as in the trebol console).
const UNFINISHED = /: missing ([\])]|} to close (string|binary))$/;

function buildConsole(pane: HTMLElement): void {
  consoleOut = el('div', 'tb-dev-out');
  consoleOut.setAttribute('role', 'log');
  consoleOut.setAttribute('aria-label', 'Console output');
  consoleFace = el('div', 'tb-dev-face');
  const row = el('div', 'tb-dev-prompt');
  consoleIn = el('textarea', 'tb-dev-in');
  consoleIn.rows = 1;
  consoleIn.spellcheck = false;
  consoleIn.setAttribute('aria-label', 'Trebol code to run');
  consoleIn.placeholder = 'face/text: "Hello"';
  consoleIn.addEventListener('keydown', consoleKey);
  consoleIn.addEventListener('input', fitInput);
  row.append(el('span', 'tb-dev-sign', '>>'), consoleIn);
  row.addEventListener('click', () => consoleIn.focus());
  pane.append(consoleOut, consoleFace, row);
}

function fitInput(): void {
  consoleIn.style.height = 'auto';
  consoleIn.style.height = `${Math.min(consoleIn.scrollHeight, 160)}px`;
}

function setInput(src: string): void {
  consoleIn.value = src;
  fitInput();
  consoleIn.setSelectionRange(src.length, src.length);
}

function consoleKey(ev: KeyboardEvent): void {
  const src = consoleIn.value;
  if (ev.key === 'Enter' && !ev.shiftKey) {
    if (src.trim() === '' || unfinished(src)) return;
    ev.preventDefault();
    setInput('');
    running = running.then(() => run(src));
  } else if (ev.key === 'ArrowUp' && !src.slice(0, consoleIn.selectionStart).includes('\n') && back < history.length) {
    ev.preventDefault();
    back++;
    setInput(history[history.length - back]!);
  } else if (ev.key === 'ArrowDown' && !src.slice(consoleIn.selectionEnd).includes('\n') && back > 0) {
    ev.preventDefault();
    back--;
    setInput(back === 0 ? '' : history[history.length - back]!);
  }
}

function unfinished(src: string): boolean {
  try {
    load(src);
    return false;
  } catch (e) {
    return e instanceof LoadError && UNFINISHED.test(e.message);
  }
}

function say(kind: 'in' | 'out' | 'value' | 'error', text: string): void {
  const line = el('pre', `tb-dev-said-${kind}`, text);
  const end = consoleOut.scrollTop + consoleOut.clientHeight >= consoleOut.scrollHeight - 4;
  consoleOut.append(line);
  while (consoleOut.childElementCount > MAX_LOG) consoleOut.firstElementChild!.remove();
  if (end) consoleOut.scrollTop = consoleOut.scrollHeight;
}

/** Runs code typed in the console in the app's user context, `face` being the face picked. */
async function run(src: string): Promise<void> {
  back = 0;
  if (history[history.length - 1] !== src) history.push(src);
  history = history.slice(-MAX_HISTORY);
  write(() => localStorage, HISTORY_KEY, { lines: history });
  say('in', src.split('\n').map((l, i) => (i === 0 ? '>> ' : '   ') + l).join('\n'));
  consoleOut.scrollTop = consoleOut.scrollHeight;
  let code;
  try {
    code = load(src);
  } catch (e) {
    say('error', `** Syntax error: ${(e as Error).message}`);
    return;
  }
  const rt = side.host.rt;
  bindSeries(code.s, rt.user, true);
  if (picked !== null) bindSeries(code.s, { keys: [intern('face')], vals: [picked], parent: null });
  try {
    const v = await taskResult(spawn(side.host.sch, code.s, scriptStart(code).start));
    if (v.t === K.Error) say('error', form(v));
    else if (v.t !== K.Unset) say('value', `== ${moldShort(v)}`);
  } catch (e) {
    say('error', report(e as ObjectCell));
  }
}

// --- log -----------------------------------------------------------------------------

function buildLog(pane: HTMLElement): void {
  const bar = el('div', 'tb-dev-bar');
  bar.append(button('tb-dev-button', 'Clear', () => {
    logList.replaceChildren();
    lastLog = null;
  }));
  logList = el('ol', 'tb-dev-entries');
  logList.setAttribute('aria-label', 'What the app did');
  pane.append(bar, logList);
}

/** Adds a line to the log; the same one again (typing in a field) counts instead of adding. */
function log(kind: string, text: string, key?: string): void {
  if (key !== undefined && lastLog?.key === key && lastLog.li.isConnected) {
    lastLog.count++;
    lastLog.text.textContent = `${text} (×${lastLog.count})`;
    return;
  }
  const li = el('li', `tb-dev-${kind}`);
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const t = el('span', 'tb-dev-text', text);
  li.append(el('time', undefined, time), el('span', 'tb-dev-kind', kind), t);
  const end = logList.scrollTop + logList.clientHeight >= logList.scrollHeight - 4;
  logList.append(li);
  while (logList.childElementCount > MAX_LOG) logList.firstElementChild!.remove();
  if (end) logList.scrollTop = logList.scrollHeight;
  lastLog = key !== undefined ? { key, li, text: t, count: 1 } : null;
}
