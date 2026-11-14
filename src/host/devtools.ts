// The dev tools of trebol dev: a panel docked at the bottom of the page, opened
// with Ctrl+` or the small button in the corner. Only a page that trebol dev
// serves has them (it adds <meta name="trebol-dev">); a built page never does.
//
//   Faces    the faces on the page as a tree, and what one of them holds:
//            pick one on the page or in the tree; where it was written links
//            to the editor (vscode://).
//   Console  >> and == as in the trebol console, against the running app;
//            `face` is the face picked; print shows here too.
//   Log      events, requests, toasts, errors and warnings, newest last.

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

type Tab = 'faces' | 'console' | 'log';

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
  for (const [tab, label] of [['faces', 'Faces'], ['console', 'Console'], ['log', 'Log']] as const) {
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
    if (!state.open) return;
    placeOutline();
    if (state.tab === 'faces' && treeFrame === 0) treeFrame = requestAnimationFrame(() => {
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
