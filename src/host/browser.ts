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
  K, NONE, TRUE, FALSE, native, value, string, form, ctxFind, intern, spell, text,
  type Cell, type ObjectCell, type BlockCell, type WordCell, type StringCell, type Ctx,
} from '../core/index.ts';
import { startHost, startUi, runSource, report, type Host } from './index.ts';
import { spawn, taskResult } from './scheduler.ts';
import { themeCss, DEFAULT_THEME, type ThemeParams } from './theme.ts';

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
}

let host: Host;
/** Mounted faces by their node and by their input. */
const byNode = new WeakMap<Element, Mounted>();
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
  const m: Mounted = { face, el: null!, input: null, label: null, error: null, kids: get(face, 'children') };
  let node: HTMLElement;
  if (INPUTS.has(style)) {
    node = buildInput(face, style, m);
  } else if (style === 'check') {
    node = buildCheck(face, m);
  } else {
    switch (style) {
      case 'view': node = el('main', 'tb-view'); break;
      case 'column': node = el('div', 'tb-column'); break;
      case 'row': node = el('div', 'tb-row'); break;
      case 'grid': node = el('div', 'tb-grid'); break;
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
        f.addEventListener('submit', ev => {
          ev.preventDefault();
          const b = f.querySelector<HTMLButtonElement>('button[type="submit"]');
          const submit = b !== null ? byNode.get(b) : undefined;
          if (submit && !b!.disabled) clickSubmit(submit.face, f);
        });
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
        b.type = flag(face, 'submit') ? 'submit' : 'button';
        if (!flag(face, 'submit')) b.addEventListener('click', () => void fire('ui-click', face));
        node = b;
        break;
      }
      default: node = el('div');
    }
    if (children(face).length > 0) appendChildren(node, face, style);
  }
  m.el = node;
  byNode.set(node, m);
  if (m.input !== null) byNode.set(m.input, m);
  byCtx.set(face.ctx, m);
  face.ctx.watch = dirty;
  sync(m);
  return node;
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

function clickSubmit(face: ObjectCell, formEl: HTMLFormElement): void {
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
  control.append(input, error);
  wrap.append(label, control);
  m.input = input;
  m.label = label;
  m.error = error;
  return wrap;
}

function buildCheck(face: ObjectCell, m: Mounted): HTMLElement {
  const row = el('div', 'tb-check-row tb-control');
  const label = el('label', 'tb-check');
  const box = el('input');
  box.type = 'checkbox';
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

// --- syncing -----------------------------------------------------------------------

function sync(m: Mounted): void {
  const f = m.face;
  const style = word(f, 'style') ?? '';
  const role = word(f, 'role');
  const t = str(f, 'text');
  const hidden = flag(f, 'hidden');
  const err = str(f, 'error');
  const cls: string[] = [];
  if (hidden) cls.push('tb-hidden');
  if (flag(f, 'fill')) cls.push('tb-fill');
  if (role !== null && !INPUTS.has(style)) cls.push(`tb-${role}`);
  const size = word(f, 'size');
  if (size === 'small') cls.push('tb-small');
  const align = word(f, 'align');
  if (align !== null && style === 'row') cls.push(`tb-${align}`);
  if (err !== null) cls.push('tb-invalid');
  if (flag(f, 'pending')) cls.push('tb-pending');
  setExtra(m.el, cls);

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
    m.input.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
    if (m.error !== null) m.error.textContent = err ?? '';
    return;
  }
  switch (style) {
    case 'title': case 'heading': case 'text': case 'button': case 'link':
      m.el.textContent = t ?? '';
      break;
    case 'grid': {
      const cols = get(f, 'cols');
      m.el.style.setProperty('--tb-cols', cols.t === K.Integer ? String(cols.v) : '2');
      break;
    }
  }
  if (m.el instanceof HTMLButtonElement) m.el.disabled = flag(f, 'disabled');
  // children replaced by code: rebuild this container
  const kids = get(f, 'children');
  if (kids.t === K.Block && (m.kids as BlockCell | undefined)?.s !== kids.s) {
    m.kids = kids;
    const keep = m.el.querySelector(':scope > .tb-panel-title');
    m.el.replaceChildren(...(keep ? [keep] : []));
    appendChildren(m.el, f, style);
  }
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
