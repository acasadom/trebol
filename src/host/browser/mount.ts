// --- mounting ----------------------------------------------------------------------

import { K, NONE, string, ctxFind, intern, spell, type Cell, type ObjectCell, type WordCell, type Ctx } from '../../core/index.ts';
import { report, type Host } from '../index.ts';
import { spawn, taskResult, type HostTask } from '../scheduler.ts';
import { linkHref } from '../markdown.ts';
import { devLog } from '../devlog.ts';
import { faceRef } from '../devtools.ts';
import { get, str, flag, word, children, iconName, icon, paneFaces, drawnStyle } from './faces.ts';
import { listen } from './events.ts';
import { buildInput, buildCheck, buildSlider, buildRadio, buildProgress } from './fields.ts';
import { buildUpload, buildPhoto } from './uploads.ts';
import { buildDevice } from './device.ts';
import { buildWidget } from './widget.ts';
import { buildLookup } from './lookup.ts';
import { buildCanvas, buildChart } from './drawings.ts';
import { buildOrbit } from './orbits.ts';
import { buildRowsField } from './row-faces.ts';
import { buildRich } from './richtext.ts';
import { buildRows } from './tables.ts';
import { buildStat } from './stats.ts';
import { buildTimeline } from './timelines.ts';
import { buildTree } from './trees.ts';
import { buildToolbar, buildBreadcrumb } from './toolbars.ts';
import { buildDialog, buildTabs, buildSteps, buildSplit } from './dialogs.ts';
import { sync, placeScreen } from './sync.ts';
import { screenHref, setScreensFace } from './screens.ts';
import { setTitleFace } from './page.ts';

/** What the host keeps for each mounted face. */
export interface Mounted {
  face: ObjectCell;
  el: HTMLElement;
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  label: HTMLElement | null;
  error: HTMLElement | null;
  kids: unknown;
  /** A container: the faces its pane held when it was last drawn, so code that edits the pane in place redraws it. */
  paneFaces: Ctx[];
  /** Where children or rows go, when it is not `el`. */
  box: HTMLElement | null;
  /** Rows of a table or list, by key. */
  rows: Map<string, HTMLElement> | null;
  /** A table or list: all its rows, in the order shown, with their keys; only some may be drawn. */
  items: { row: Cell; k: string }[];
  /** A table or list: the rows drawn, [first, end), and about how tall each is. */
  first: number;
  end: number;
  rowHeight: number;
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
  /** An input: what the user typed still on its way to the face. */
  typing: number;
  /** An input: the value the user's typing gave the face; code that sets another one is shown even with the focus. */
  typed: Cell | null;
}

export let host: Host;
export function setHost(v: Host): void {
  host = v;
}
/** Mounted faces by their node and by their input. */
export const byNode = new WeakMap<Element, Mounted>();
/** The row cell each table row or list item shows. */
export const rowOf = new WeakMap<Element, Cell>();
/** Mounted faces by context; a face rebuilt in a new container replaces its entry. */
export const byCtx = new WeakMap<Ctx, Mounted>();
/** Contexts of mounted faces written since the last repaint (filled by the core). */
export const dirty: Ctx[] = [];
/** Mounted faces with react, is or calc; and whether one came since reactions last ran. */
export const reactors = new Set<Mounted>();
export let newReactor = false;
export function setNewReactor(v: typeof newReactor): void {
  newReactor = v;
}
/** The ui-react still running because a reaction waits (a fetch); the next one waits for it. */
export let reacting: HostTask | null = null;
export function setReacting(v: HostTask | null): void {
  reacting = v;
}
export let nextId = 1;
/** A new number for the id of an element. */
export function newId(): number {
  return nextId++;
}

export const ACTIVE: ReadonlySet<number> = new Set([K.Word, K.SetWord, K.GetWord, K.Paren, K.Path, K.SetPath, K.GetPath, K.Function, K.Native]);

/** The handler each UI event function runs, to name it in an error; the others go by their own name. */
export const HANDLERS: Record<string, string> = {
  'ui-click': 'action', 'ui-input': 'on-change', 'ui-files': 'on-change', 'ui-remove-file': 'on-change',
  'ui-lookup-pick': 'on-change', 'ui-lookup-remove': 'on-change', 'ui-lookup-search': 'on-search',
  'ui-select': 'on-select', 'ui-sort': 'on-sort', 'ui-drop': 'on-drop', 'ui-menu': 'on-menu',
  'ui-reorder': 'on-reorder', 'ui-expand': 'on-expand', 'ui-close': 'on-close',
};

/**
 * An error of a UI event function says where in the app it happened: `action of button "Save"`, not the
 * name of Trebol's own function (ui-click) that ran it.
 */
export function whereInApp(e: ObjectCell, fn: string, face: ObjectCell, args: Cell[]): void {
  const i = ctxFind(e.ctx, intern('where'));
  const w = i < 0 ? null : e.ctx.vals[i]!;
  if (w === null || w.t !== K.Word || spell((w as WordCell).sym) !== fn) return;
  const ev = fn === 'ui-event' && args[0] !== undefined && args[0].t === K.LitWord ? spell((args[0] as WordCell).sym) : null;
  e.ctx.vals[i] = string(`${ev ?? HANDLERS[fn] ?? fn.replace(/^ui-/, '')} of ${faceRef(face, host.rt)}`);
}

/**
 * Runs a UI event function (ui-input, ui-blur, ui-click) as a new task. An error is shown and gives none, so
 * what the caller does next (focus the first problem, blur) still runs and nothing is left unhandled.
 */
export function fire(fn: string, face: ObjectCell, ...args: Cell[]): Promise<Cell> {
  // a word, path or paren given as data (a dropped `date`) is quoted, so it is passed, not evaluated
  const quote: Cell = { t: K.Word, sym: intern('quote'), bind: host.rt.lib };
  const call: Cell[] = [{ t: K.Word, sym: intern(fn), bind: host.rt.lib }, face, ...args.flatMap(a => ACTIVE.has(a.t) ? [quote, a] : [a])];
  devLog.event(fn, face, args);
  return taskResult(spawn(host.sch, { data: call }, 0)).catch((e: unknown) => {
    if ((e as Cell).t === K.Error) whereInApp(e as ObjectCell, fn, face, args);
    showError(report(e as ObjectCell));
    return NONE;
  });
}

/** The panel of errors trebol dev shows on the page; null until the first one. */
export let devErrors: HTMLElement | null = null;

/**
 * An error nobody caught: in the console and, when trebol dev serves the page (it adds
 * `<meta name="trebol-dev">`), also on the page, so a broken app is not a blank page.
 */
export function showError(message: string): void {
  console.error(message);
  devLog.note('error', message);
  if (document.querySelector('meta[name="trebol-dev"]') === null) return;
  if (devErrors === null || !devErrors.isConnected) {
    // a manual popover sits in the top layer, above open dialogs
    const panel = el('section', 'tb-dev-errors');
    panel.popover = 'manual';
    panel.setAttribute('role', 'alert');
    panel.setAttribute('aria-label', 'Trebol error');
    const head = el('header');
    const title = el('span');
    title.textContent = 'Trebol error';
    const close = el('button', 'tb-button');
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', () => panel.remove());
    panel.addEventListener('keydown', ev => { if (ev.key === 'Escape') panel.remove(); });
    head.append(title, close);
    panel.append(head);
    document.body.append(panel);
    panel.showPopover();
    devErrors = panel;
  }
  const pre = el('pre');
  pre.textContent = message;
  devErrors.append(pre);
}

export function el<T extends keyof HTMLElementTagNameMap>(tag: T, cls?: string): HTMLElementTagNameMap[T] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

export const INPUTS = new Set(['field', 'password', 'number', 'money', 'date', 'date-range', 'time', 'area', 'choice']);

export function build(face: ObjectCell): HTMLElement {
  const style = drawnStyle(face) ?? 'face';
  const m: Mounted = {
    face, el: null!, input: null, label: null, error: null, kids: get(face, 'pane'), paneFaces: paneFaces(face),
    box: null, rows: null, empty: null, button: null, radios: null, open: null, shown: undefined,
    typing: 0, typed: null, items: [], first: 0, end: 0, rowHeight: 0,
  };
  let node: HTMLElement;
  if (INPUTS.has(style)) {
    node = buildInput(face, style, m);
  } else if (style === 'check' || style === 'toggle') {
    node = buildCheck(face, m, style === 'toggle');
  } else if (style === 'radio') {
    node = buildRadio(face, m);
  } else if (style === 'slider') {
    node = buildSlider(face, m);
  } else if (style === 'upload') {
    node = buildUpload(face, m);
  } else if (style === 'photo') {
    node = buildPhoto(face, m);
  } else if (style === 'widget') {
    node = buildWidget(face, m);
  } else if (style === 'device') {
    node = buildDevice(face, m);
  } else if (style === 'lookup') {
    node = buildLookup(face, m);
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
      case 'board': node = el('div', 'tb-board'); break;
      case 'desktop': node = el('div', 'tb-desktop'); break;
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
      case 'code': node = el('pre', 'tb-code'); break;
      case 'divider': node = el('hr', 'tb-divider'); break;
      case 'link': {
        const a = el('a', 'tb-link');
        a.href = screenHref(get(face, 'value')) ?? linkHref(str(face, 'value') ?? '#') ?? '#';
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
          if (!submit) {
            const done = fire('ui-click', face);
            // Next of a form in steps that stays: take the user to the first problem of the step
            const steps = b.closest('.tb-steps-nav')?.parentElement;
            if (steps) void done.then(() => focusProblem(steps.querySelector<HTMLElement>(':scope > .tb-step-panel:not([hidden])')));
            return;
          }
          ev.preventDefault();
          clickSubmit(face, b.closest<HTMLElement>('form, .tb-view') ?? document.body);
        });
        withIcon(b, face, m);
        node = b;
        break;
      }
      case 'tile': {
        const b = el('button', flag(face, 'linked') ? 'tb-tile tb-tile-linked' : 'tb-tile');
        b.type = 'button';
        b.addEventListener('click', () => void fire('ui-click', face));
        withIcon(b, face, m);
        node = b;
        break;
      }
      case 'progress': node = buildProgress(m); break;
      case 'stat': node = buildStat(m); break;
      case 'timeline': node = buildTimeline(m); break;
      case 'image': node = el('img', 'tb-image'); break;
      case 'video': case 'audio': {
        const media = el(style, `tb-${style}`) as HTMLMediaElement;
        media.controls = true;
        media.preload = 'metadata';
        if (media instanceof HTMLVideoElement) media.playsInline = true;
        node = media;
        break;
      }
      case 'backdrop': {
        // decoration behind its container: screen readers skip it
        node = el('div', 'tb-backdrop');
        node.setAttribute('aria-hidden', 'true');
        break;
      }
      case 'canvas': node = buildCanvas(m); break;
      case 'chart': node = buildChart(m); break;
      case 'orbit': node = buildOrbit(m); break;
      case 'icon': node = el('span', 'tb-icon-face'); break;
      case 'table': case 'list': node = buildRows(face, style, m); break;
      case 'tree': node = buildTree(face, m); break;
      case 'dialog': node = buildDialog(face, m); break;
      case 'tabs': node = buildTabs(face, m); break;
      case 'steps': node = buildSteps(face, m); break;
      case 'split': node = buildSplit(face, m); break;
      case 'screens': {
        node = el('div', 'tb-screens');
        setScreensFace(face);
        break;
      }
      case 'screen': {
        node = el('section', 'tb-screen');
        const t = str(face, 'text');
        if (t !== null) {
          node.setAttribute('aria-label', t);
          document.title = t;
          setTitleFace(face);
        }
        break;
      }
      case 'tab': {
        node = el('div', 'tb-tab-panel');
        node.setAttribute('role', 'tabpanel');
        break;
      }
      case 'step': {
        node = el('div', 'tb-step-panel');
        node.setAttribute('role', 'group');
        node.tabIndex = -1;
        break;
      }
      default: node = el('div');
    }
    if (style === 'screens') placeScreen(m, node);
    else if (children(face).length > 0 && style !== 'tabs' && style !== 'steps' && style !== 'split') appendChildren(m.box ?? node, face, style);
  }
  m.el = node;
  byNode.set(node, m);
  if (m.input !== null) byNode.set(m.input, m);
  byCtx.set(face.ctx, m);
  face.ctx.watch = dirty;
  if (get(face, 'reactions').t === K.Block) {
    reactors.add(m);
    newReactor = true;
  }
  listen(m, style);
  sync(m);
  return node;
}


/** Puts the face's icon before its caption, which then goes in `m.label`. */
export function withIcon(node: HTMLElement, face: ObjectCell, m: Mounted): void {
  const name = iconName(face);
  const svg = name !== null ? icon(name) : null;
  if (svg === null) return;
  m.label = el('span');
  node.append(svg, m.label);
  node.classList.add('tb-has-icon');
}

/** The small second icon of a tile (mark #list "List"), in a corner of its icon, and the name it adds. */
export function syncMark(m: Mounted): void {
  const f = m.face;
  const v = get(f, 'mark');
  const name = v.t === K.Issue ? spell((v as WordCell).sym).toLowerCase() : null;
  let mark = m.el.querySelector<HTMLElement>(':scope > .tb-tile-mark');
  if (mark?.dataset.icon !== (name ?? undefined)) {
    mark?.remove();
    mark = null;
    const svg = name !== null ? icon(name) : null;
    if (svg !== null) {
      mark = el('span', 'tb-tile-mark');
      mark.dataset.icon = name!;
      mark.setAttribute('aria-hidden', 'true');
      mark.append(svg);
      m.el.append(mark);
    }
  }
  const said = mark !== null ? str(f, 'mark-text') : null;
  if (said !== null && said !== '') m.el.setAttribute('aria-label', `${str(f, 'text') ?? ''}, ${said}`);
  else m.el.removeAttribute('aria-label');
}

/** A face with an icon and no text is named after its icon: #arrow-left -> "Arrow left". */
export function iconLabel(face: ObjectCell): string | null {
  const name = iconName(face);
  if (name === null || (str(face, 'text') ?? '') !== '') return null;
  const hint = str(face, 'hint');
  if (hint !== null) return hint;
  const words = name.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Children of a container; consecutive buttons in a form, or in a step of one, share an action row. */
export function appendChildren(node: HTMLElement, face: ObjectCell, style: string): void {
  let actions: HTMLElement | null = null;
  for (const c of children(face)) {
    const isButton = word(c, 'style') === 'button';
    if ((style === 'form' || style === 'step') && isButton) {
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

export function clickSubmit(face: ObjectCell, formEl: HTMLElement): void {
  // after a failed submit, take the user to the first problem
  void fire('ui-click', face).then(() => focusProblem(formEl));
}

export function focusProblem(scope: HTMLElement | null): void {
  for (const i of Array.from(scope?.querySelectorAll<HTMLElement>('input, textarea, select') ?? [])) {
    const m = byNode.get(i);
    if (m !== undefined && get(m.face, 'error').t === K.String) return i.focus();
  }
}

