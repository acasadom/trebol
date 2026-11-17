// --- rows ---------------------------------------------------------------------------
//
// The dialect makes the rows as faces; the host only draws them, as one line each
// with the labels of the first line as the headers, or as cards on narrow screens.

import { K } from '../../core/index.ts';
import { get, str, flag, children } from './faces.ts';
import { type Mounted, byCtx, newId, fire, el, build } from './mount.ts';
import { required } from './fields.ts';

export function buildRowsField(m: Mounted): HTMLElement {
  const id = `tb-${newId()}`;
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

export function syncRowsField(m: Mounted, err: string | null): void {
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
export function placeEntries(m: Mounted): void {
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

