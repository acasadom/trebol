// --- faces ---------------------------------------------------------------------------

import { K, form, type ObjectCell, type BlockCell, type Ctx } from '../../core/index.ts';
import { side, state, panel, opener, outline, pickButton, tree, setTree, detail, setDetail, picked, setPicked, pointed, setPointed, picking, storePicking, el, button } from './state.ts';
import { get, faceRef, on, moldShort, placeOf } from './read.ts';
import { inDevtools, openTab, refresh } from '../devtools.ts';

export const faceKeys = new WeakMap<Ctx, number>();
export let nextKey = 1;

export function faceKey(face: ObjectCell): number {
  let k = faceKeys.get(face.ctx);
  if (k === undefined) faceKeys.set(face.ctx, k = nextKey++);
  return k;
}

export function buildFaces(pane: HTMLElement): void {
  setTree(el('div', 'tb-dev-tree'));
  tree.setAttribute('aria-label', 'Faces on the page');
  tree.addEventListener('pointerleave', () => point(null));
  setDetail(el('div', 'tb-dev-detail'));
  pane.append(tree, detail);
}

/** The faces on the page, in the order of their nodes, with how deep each is. */
export function facesOnPage(): { face: ObjectCell; el: Element; depth: number }[] {
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

export function drawTree(): void {
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

export function drawDetail(): void {
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

export function pick(face: ObjectCell | null): void {
  setPicked(face);
  point(null);
  refresh();
}

/** Draws the outline around a face, or hides it. */
export function point(face: ObjectCell | null): void {
  setPointed(face);
  placeOutline();
}

export function placeOutline(): void {
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

export function setPicking(on: boolean): void {
  storePicking(on);
  pickButton.setAttribute('aria-pressed', String(on));
  document.documentElement.classList.toggle('tb-dev-picking', on);
  if (on) openTab('faces');
  else point(null);
}

export function pickTarget(ev: Event): { face: ObjectCell; el: HTMLElement } | null {
  const t = ev.target;
  if (!(t instanceof Element) || inDevtools(t) || t === opener) return null;
  return side.faceAt(t);
}

export function pickMove(ev: PointerEvent): void {
  if (!picking) return;
  const at = pickTarget(ev);
  if (at !== null) point(at.face);
}

export function pickDown(ev: PointerEvent): void {
  if (!picking || pickTarget(ev) === null) return;
  // the face does not get the press: no focus, no drag
  ev.preventDefault();
  ev.stopImmediatePropagation();
}

export function pickClick(ev: MouseEvent): void {
  if (!picking) return;
  const at = pickTarget(ev);
  if (at === null) return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  setPicking(false);
  pick(at.face);
}

