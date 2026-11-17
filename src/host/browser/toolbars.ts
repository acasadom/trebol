// --- toolbars and breadcrumbs -------------------------------------------------------

import { K, NONE, form, wordOf, type Cell, type ObjectCell } from '../../core/index.ts';
import { translate } from '../index.ts';
import { get, keepOwn, word } from './faces.ts';
import { type Mounted, host, byNode, fire, el } from './mount.ts';
import { openMenu } from './menus.ts';
import { sync } from './sync.ts';

export const BAR_ITEMS = 'button, a[href], input, select, textarea, [tabindex]';

/** The controls of a toolbar, in order; `shown` skips hidden and disabled ones. */
export function barItems(bar: HTMLElement, shown = true): HTMLElement[] {
  return Array.from(bar.querySelectorAll<HTMLElement>(BAR_ITEMS)).filter(e => e.closest('.tb-toolbar') === bar
    && (!shown || e.getClientRects().length > 0 && !(e as HTMLButtonElement).disabled));
}

export function buildToolbar(): HTMLElement {
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
export function syncToolbar(bar: HTMLElement): void {
  for (const e of Array.from(bar.children)) {
    const m = byNode.get(e);
    if (m !== undefined && m.el === e && word(m.face, 'style') === 'button') sync(m);
  }
  // the bar may not be on the page yet, so visibility is checked only when moving
  const items = barItems(bar, false);
  const current = items.find(e => e.tabIndex === 0 && e.hasAttribute('tabindex')) ?? items[0];
  for (const e of items) e.tabIndex = e === current ? 0 : -1;
}

export interface Crumb { text: string; id: Cell }

/** The items of a breadcrumb: a label and a word or path each, the last one maybe without. */
export function crumbs(face: ObjectCell): Crumb[] {
  const d = get(face, 'data');
  if (d.t !== K.Block) return [];
  const out: Crumb[] = [];
  const cells = d.s.data.slice(d.i);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    if (c.t !== K.String && c.t !== K.Map) continue;
    const next = cells[i + 1];
    const id = next !== undefined && (next.t === K.Word || next.t === K.Path) ? next : NONE;
    if (id !== NONE) i++;
    out.push({ text: translate(c, host.rt), id });
  }
  return out;
}

export function buildBreadcrumb(m: Mounted): HTMLElement {
  const nav = el('nav', 'tb-breadcrumb');
  keepOwn(nav, 'breadcrumb', 'aria-label');
  m.box = el('ol');
  nav.append(m.box);
  return nav;
}

/** Rebuilds the items; on narrow screens the middle ones hide behind a "…" that lists them in a menu. */
export function syncBreadcrumb(m: Mounted): void {
  const f = m.face;
  const items = crumbs(f);
  // choosing an item sets value, which repaints the face: keep the nodes (and the focus) if nothing changed
  const signature = items.map(c => `${c.text}\u0000${form(c.id)}`).join('\u0001');
  if (m.kids === signature) return;
  m.kids = signature;
  // a lit-word or lit-path, so that passing it on does not evaluate it
  const pick = (c: Crumb): void => void fire('ui-crumb', f, c.id.t === K.Path ? ({ ...c.id, t: K.LitPath } as Cell) : wordOf(K.LitWord, form(c.id)));
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

