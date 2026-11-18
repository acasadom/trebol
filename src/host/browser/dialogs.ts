// --- dialogs, tabs and toasts --------------------------------------------------------

import { K, NONE, TRUE, FALSE, native, value, intern, spell, text, UNSET, throwError, type Cell, type ObjectCell, type WordCell, type StringCell } from '../../core/index.ts';
import { spawn } from '../scheduler.ts';
import { iconNode } from '../icons.ts';
import { devLog } from '../devlog.ts';
import { get, str, own, keepOwn, flag, word, children } from './faces.ts';
import { type Mounted, host, byCtx, newId, fire, el, build } from './mount.ts';
import { int } from './drag.ts';
import { here, setHere } from './screens.ts';
import { rootFace } from './page.ts';
import { narrowAt } from './narrow.ts';

export function buildDialog(face: ObjectCell, m: Mounted): HTMLElement {
  const d = el('dialog', 'tb-dialog');
  const head = el('header', 'tb-dialog-head');
  const title = el('h2', 'tb-dialog-title');
  title.id = `tb-${newId()}`;
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

export function syncDialog(m: Mounted): void {
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

export function buildTabs(face: ObjectCell, m: Mounted): HTMLElement {
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
    b.id = `tb-${newId()}`;
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

export function syncTabs(m: Mounted): void {
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

// A form in steps shows one step at a time under a bar of their titles; the steps
// done can be chosen again. Each step the user moves on to is an entry in the
// history, so the browser's Back returns to the step before.
export interface StepsState {
  steps: { face: ObjectCell; li: HTMLLIElement; button: HTMLButtonElement; num: HTMLElement; title: HTMLElement }[];
  count: HTMLElement;
  /** The history entries of this face: the depth of each and the step it shows. */
  trail: { depth: number; step: number }[];
  shown: number;
}
export const stepsState = new WeakMap<Mounted, StepsState>();
export const mountedSteps = new Set<Mounted>();

export function buildSteps(face: ObjectCell, m: Mounted): HTMLElement {
  const node = el('div', 'tb-steps');
  const bar = el('ol', 'tb-steps-bar');
  keepOwn(bar, 'steps', 'aria-label');
  const count = el('p', 'tb-steps-count');
  node.append(bar, count);
  const v = get(face, 'value');
  const st: StepsState = { steps: [], count, trail: [{ depth: here.depth, step: v.t === K.Integer ? Number(v.v) : 1 }], shown: 0 };
  let nav: ObjectCell | null = null;
  children(face).forEach((c, i) => {
    if (word(c, 'style') !== 'step') {
      nav = c;
      const n = build(c);
      n.classList.add('tb-steps-nav');
      node.append(n);
      return;
    }
    const li = el('li');
    const b = el('button', 'tb-steps-item');
    b.type = 'button';
    const num = el('span', 'tb-steps-num');
    const title = el('span', 'tb-steps-title');
    b.append(num, title);
    b.addEventListener('click', () => void fire('ui-step-go', face, int(i + 1)));
    li.append(b);
    bar.append(li);
    node.append(build(c));
    st.steps.push({ face: c, li, button: b, num, title });
  });
  // Enter in a field goes to the next step; on the last one it sends the form
  node.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' || ev.defaultPrevented || !(ev.target instanceof HTMLInputElement) || !inTextBox(ev.target)) return;
    const next = nav === null ? undefined : children(nav)[1];
    if (next === undefined || flag(next, 'hidden')) return;
    ev.preventDefault();
    byCtx.get(next.ctx)?.el.click();
  });
  stepsState.set(m, st);
  mountedSteps.add(m);
  return node;
}

export function syncSteps(m: Mounted): void {
  const st = stepsState.get(m);
  if (st === undefined) return;
  const v = get(m.face, 'value');
  const at = v.t === K.Integer ? Number(v.v) : 1;
  const live = st.steps.filter(s => !flag(s.face, 'hidden'));
  const k = live.findIndex(s => s === st.steps[at - 1]);
  st.steps.forEach((s, i) => {
    const j = live.indexOf(s);
    const title = str(s.face, 'text') ?? '';
    s.li.hidden = j < 0;
    s.li.classList.toggle('tb-done', j >= 0 && j < k);
    s.li.classList.toggle('tb-current', j === k);
    s.num.textContent = String(j + 1);
    s.title.textContent = title;
    s.button.disabled = j < 0 || j >= k;
    if (j === k) s.button.setAttribute('aria-current', 'step');
    else s.button.removeAttribute('aria-current');
    const panel = byCtx.get(s.face.ctx)?.el;
    if (panel === undefined) return;
    panel.hidden = i !== at - 1;
    panel.setAttribute('aria-label', title);
  });
  st.count.textContent = k < 0 ? '' : `${own('step-of', String(k + 1), String(live.length))} · ${str(live[k]!.face, 'text') ?? ''}`;
  if (st.shown !== 0 && st.shown !== at) {
    stepHistory(st, at, st.shown);
    const panel = byCtx.get(st.steps[at - 1]!.face.ctx)?.el;
    if (m.el.getBoundingClientRect().top < 0) m.el.scrollIntoView({ block: 'start' });
    panel?.focus({ preventScroll: true });
  }
  st.shown = at;
}

/** A new step on show: forward is a new history entry; back returns to the entry that showed it. */
export function stepHistory(st: StepsState, to: number, from: number): void {
  const cur = st.trail.find(x => x.depth === here.depth);
  // Back or Forward brought it: the history is already there
  if (cur?.step === to) return;
  if (to > from) {
    setHere({ depth: here.depth + 1, top: here.depth + 1 });
    st.trail = st.trail.filter(x => x.depth < here.depth);
    st.trail.push({ depth: here.depth, step: to });
    history.pushState({ ...here }, '');
    return;
  }
  const back = st.trail.filter(x => x.depth < here.depth && x.step === to).pop();
  if (back !== undefined) history.go(back.depth - here.depth);
  else if (cur !== undefined) cur.step = to;
}

/** Back or Forward landed on an entry a form in steps made: it shows that step again. */
export function stepsLanded(): void {
  const d = (history.state as { depth?: number } | null)?.depth;
  if (typeof d !== 'number') return;
  for (const m of mountedSteps) {
    if (!m.el.isConnected) {
      mountedSteps.delete(m);
      continue;
    }
    const hit = stepsState.get(m)!.trail.find(x => x.depth === d);
    if (hit === undefined) continue;
    setHere({ depth: d, top: here.top });
    void fire('ui-step-go', m.face, int(hit.step));
  }
}

// A split shows two panes side by side with a handle between them; on narrow
// screens it shows one pane, the one its value names, and the second pane
// gets a back button.
export function buildSplit(face: ObjectCell, m: Mounted): HTMLElement {
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

export function syncSplit(m: Mounted): void {
  const v = get(m.face, 'value');
  const pane = v.t === K.Integer && Number(v.v) === 2 ? '2' : '1';
  const was = m.el.dataset['pane'];
  if (was === pane) return;
  m.el.dataset['pane'] = pane;
  // on narrow screens the other pane just appeared: take the focus there
  if (was !== undefined && narrowAt(m.el)) {
    const shown = m.el.children[pane === '2' ? 2 : 0] as HTMLElement;
    (shown.querySelector<HTMLElement>('.tb-selected') ?? shown).focus();
  }
}

export let toasts: HTMLElement | null = null;
/** The notices with an Undo button on show, by the id ui.trb gave them. */
export const undoToasts = new Map<number, HTMLElement>();

native('show-toast', '["Shows a short message at the edge of the screen." message [string!] kind [word! none!] undo [integer! none!] "With an Undo button: the id of what it undoes"]', (_t, f) => {
  if (toasts === null) {
    // a manual popover sits in the top layer, so toasts show above open dialogs
    toasts = el('div', 'tb-toasts');
    toasts.popover = 'manual';
    toasts.setAttribute('aria-live', 'polite');
    document.body.append(toasts);
  }
  const kind = f.args[1]!.t === K.Word ? spell((f.args[1] as WordCell).sym).toLowerCase() : null;
  const id = f.args[2]!.t === K.Integer ? Number((f.args[2] as { v: number | bigint }).v) : null;
  const t = el('div', kind !== null ? `tb-toast tb-${kind}` : 'tb-toast');
  if (kind === 'danger') t.setAttribute('role', 'alert');
  const message = text(f.args[0] as StringCell);
  devLog.note('toast', kind !== null ? `${kind}: ${message}` : message);
  const said = el('span', 'tb-toast-text');
  t.append(said);
  const box = toasts;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const dismiss = (): void => {
    clearTimeout(timer);
    t.remove();
    if (box.childElementCount === 0 && box.matches(':popover-open')) box.hidePopover();
  };
  // gone without Undo: ui.trb runs what waited for it
  const gone = (): void => {
    dismiss();
    if (id !== null && undoToasts.delete(id)) fireRoot('ui-toast-gone', id);
  };
  t.addEventListener('click', gone);
  const wait = id !== null ? 8000 : kind === 'danger' ? 6000 : 4000;
  if (id !== null) {
    const undo = el('button', 'tb-toast-undo');
    undo.type = 'button';
    keepOwn(undo, 'undo');
    undo.addEventListener('click', ev => {
      ev.stopPropagation();
      dismiss();
      if (undoToasts.delete(id)) fireRoot('ui-toast-undo', id);
    });
    t.append(undo);
    t.dataset.tbUndo = String(id);
    undoToasts.set(id, t);
    // while the pointer or the keyboard is on it, it waits: the user has time to read and choose
    const hold = (): void => clearTimeout(timer);
    const resume = (): void => {
      if (!t.matches(':hover') && !t.contains(document.activeElement)) timer = setTimeout(gone, wait);
    };
    t.addEventListener('pointerenter', hold);
    t.addEventListener('focusin', hold);
    t.addEventListener('pointerleave', resume);
    t.addEventListener('focusout', () => setTimeout(resume));
  }
  timer = setTimeout(gone, wait);
  if (box.matches(':popover-open')) box.hidePopover();
  box.append(t);
  box.showPopover();
  // screen readers announce text that changes inside a live region already shown
  setTimeout(() => { said.textContent = message; }, 50);
  return value(f.args[0]!);
});

native('hide-toast', '["Takes away a notice with an Undo button, by its id." id [integer!]]', (_t, f) => {
  const id = Number((f.args[0] as { v: number | bigint }).v);
  const t = undoToasts.get(id);
  if (t !== undefined) {
    undoToasts.delete(id);
    const box = t.parentElement;
    t.remove();
    if (box !== null && box.childElementCount === 0 && box.matches(':popover-open')) box.hidePopover();
  }
  return value(UNSET);
});

/** A box where Ctrl+Z undoes typing: a text input, a text area or rich text. */
export function inTextBox(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset'].includes(target.type);
}

/** Runs a function of ui.trb for the page, not for one face: the view on show is its face. */
export function fireRoot(fn: string, id: number): void {
  const n = int(id);
  if (rootFace !== null) void fire(fn, rootFace, n);
  else spawn(host.sch, { data: [{ t: K.Word, sym: intern(fn), bind: host.rt.lib }, NONE, n] }, 0);
}

native('show-confirm', '["Asks a question in a small dialog; true when the user says yes." question [string!] yes [string! none!] no [string! none!] kind [word! none!]]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  const answer = (at: number, key: string): string => f.args[at]!.t === K.String ? text(f.args[at] as StringCell) : own(key);
  const danger = f.args[3]!.t === K.Word && spell((f.args[3] as WordCell).sym).toLowerCase() === 'danger';
  const d = el('dialog', 'tb-dialog tb-confirm');
  d.setAttribute('role', 'alertdialog');
  const body = el('div', 'tb-dialog-body');
  const q = el('p', 'tb-confirm-question');
  q.id = `tb-${newId()}`;
  q.textContent = text(f.args[0] as StringCell);
  d.setAttribute('aria-labelledby', q.id);
  const row = el('div', 'tb-row tb-right');
  const no = el('button', 'tb-button');
  const yes = el('button', danger ? 'tb-button tb-danger' : 'tb-button tb-primary');
  no.type = yes.type = 'button';
  no.textContent = answer(2, 'no');
  yes.textContent = answer(1, 'yes');
  row.append(no, yes);
  body.append(q, row);
  d.append(body);
  const p = new Promise<Cell>(resolve => {
    const done = (ok: boolean): void => {
      d.close();
      d.remove();
      resolve(ok ? TRUE : FALSE);
    };
    yes.addEventListener('click', () => done(true));
    no.addEventListener('click', () => done(false));
    // Esc is no
    d.addEventListener('cancel', ev => { ev.preventDefault(); done(false); });
  });
  document.body.append(d);
  // over an open dialog too: the top layer stacks dialogs in the order they open
  d.showModal();
  // what cannot be undone starts on no, so Enter does not do it by mistake
  (danger ? no : yes).focus();
  return { k: 'await', p };
});

native('print-faces', '["Opens the print dialog for the page, or for one face only." face [object! none!]]', (_t, f) => {
  const target = f.args[0]!.t === K.Object ? byCtx.get((f.args[0] as ObjectCell).ctx)?.el : undefined;
  if (f.args[0]!.t === K.Object && (target === undefined || !target.isConnected)) {
    return throwError('script', 'not-shown', 'print-page/only needs a face on the screen');
  }
  if (target !== undefined) {
    target.classList.add('tb-print-target');
    document.documentElement.classList.add('tb-print-only');
    addEventListener('afterprint', () => {
      target.classList.remove('tb-print-target');
      document.documentElement.classList.remove('tb-print-only');
    }, { once: true });
  }
  print();
  return value(UNSET);
});

