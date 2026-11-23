// --- drag and drop -----------------------------------------------------------------
//
// Pointer events rather than HTML drag and drop, so it also works with touch
// (after a long press) and shows the theme's own indicator.

import { K, NONE, type Cell, type ObjectCell } from '../../core/index.ts';
import { inDevtools } from '../devtools.ts';
import { get, str, flag, word, children, drawnStyle } from './faces.ts';
import { type Mounted, byNode, rowOf, byCtx, fire, el } from './mount.ts';
import { seenKeys } from './events.ts';
import { swallowNextClick } from './swipe.ts';
import type { MenuEntry } from './menus.ts';
import { hostSorted } from './tables.ts';
import { groupParent, treeTarget } from './trees.ts';
import { syncDirty } from './sync.ts';

/** Mounted faces that accept drops. */
export const dropZones = new Set<Mounted>();

/** What is being dragged: a face, or a row of a table, list or tree. */
export interface Source {
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
export interface Target { m: Mounted; index: number; reorder: boolean; group?: HTMLElement; parent?: Cell; into?: HTMLElement }

export const isData = (m: Mounted): boolean => m.rows !== null;

/** The elements a drop target places things between: rows, or child faces. */
export function slots(m: Mounted): HTMLElement[] {
  if (isData(m)) return Array.from(m.box!.children) as HTMLElement[];
  return children(m.face).map(c => byCtx.get(c.ctx)?.el).filter((e): e is HTMLElement => e !== undefined && e.isConnected);
}

export function mountedAbove(e: Element | null): Mounted | undefined {
  for (let x = e; x !== null; x = x.parentElement) {
    const m = byNode.get(x);
    if (m !== undefined && m.el === x) return m;
  }
  return undefined;
}

/** The drag source at an element: a draggable face, a row, or a child of a reorderable container. */
export function sourceAt(start: Element): Source | null {
  if (start.closest('input, textarea, select, [contenteditable], .tb-split-handle, .tb-grid-handle, .tb-menu') !== null) return null;
  for (let e: Element | null = start; e !== null; e = e.parentElement) {
    const row = rowOf.get(e);
    if (row !== undefined) {
      const m = mountedAbove(e)!;
      // rows the host sorted are not in the order of data, so they cannot be moved
      const reorder = flag(m.face, 'reorder') && hostSorted(m.face) === null;
      if (!flag(m.face, 'drag') && !reorder) return null;
      const group = e.parentElement!;
      if (m.open === null) {
        // a table or list may not draw its first rows
        const index = m.first + Array.prototype.indexOf.call(group.children, e);
        return { face: m.face, el: e as HTMLElement, payload: row, within: reorder ? m : null, index, group: null };
      }
      const index = Array.prototype.indexOf.call(group.children, e);
      return { face: m.face, el: e as HTMLElement, payload: row, within: reorder ? m : null, index, group };
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
export function targetAt(src: Source, x: number, y: number): Target | null {
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

export const horizontal = (m: Mounted): boolean => drawnStyle(m.face) === 'row';

export function insertionAt(m: Mounted, x: number, y: number): number {
  const across = horizontal(m);
  let i = 0;
  for (const e of slots(m)) {
    const r = e.getBoundingClientRect();
    if ((across ? x : y) > (across ? r.left + r.width / 2 : r.top + r.height / 2)) i++;
  }
  return m.first + i;
}

/** How many things a container places: all the rows of a table or list, drawn or not. */
export function slotCount(m: Mounted): number {
  return isData(m) && m.open === null ? m.items.length : slots(m).length;
}

export let line: HTMLElement | null = null;

/** Shows where a drop would land: a line between slots, and the target outlined. */
export function indicate(t: Target | null): void {
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
  const at = t.group !== undefined ? t.index : t.index - t.m.first;
  const before = all[at]?.getBoundingClientRect();
  const after = all[at - 1]?.getBoundingClientRect();
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
export function land(src: Source, t: Target): void {
  if (t.reorder) {
    const to = t.index > src.index ? t.index - 1 : t.index;
    if (to !== src.index) void reorder(t.m, src.index, to, t.group, t.parent);
  } else {
    void fire('ui-drop', t.m.face, src.payload, src.face, int(t.index + 1), t.parent ?? NONE);
  }
}

export const int = (n: number): Cell => ({ t: K.Integer, v: n });

/** Moves a child or row and keeps the focus on it once the page is repainted. */
export async function reorder(m: Mounted, from: number, to: number, group?: HTMLElement, parent: Cell = NONE): Promise<void> {
  const had = document.activeElement !== null && document.activeElement !== document.body && m.el.contains(document.activeElement);
  await fire('ui-reorder', m.face, int(from + 1), int(to + 1), parent);
  syncDirty();
  if (!had) return;
  const e = group !== undefined ? group.children[to] as HTMLElement | undefined : slots(m)[to - m.first];
  const focusable = e?.matches('[tabindex], button, a, input, textarea, select') ? e : e?.querySelector<HTMLElement>('[tabindex], button, a, input, textarea, select');
  (focusable ?? null)?.focus();
}

/** "Move to" entries: the visible drop zones other than the face itself. */
export function moveTargets(face: ObjectCell, payload: Cell): MenuEntry[] {
  const out: MenuEntry[] = [];
  for (const z of dropZones) {
    if (!z.el.isConnected) { dropZones.delete(z); continue; }
    if (z.face.ctx === face.ctx || z.el.getClientRects().length === 0) continue;
    // nor the place it is already in: the lane of a card
    if (z.el.contains(byCtx.get(face.ctx)?.el ?? null)) continue;
    // a nameless zone around a named one is the same place
    if (str(z.face, 'text') === null && z.el.querySelector('.tb-drop-zone') !== null) continue;
    out.push({
      text: str(z.face, 'text') ?? word(z.face, 'style') ?? '',
      run: () => void fire('ui-drop', z.face, payload, face, int(slotCount(z) + 1), NONE),
    });
  }
  return out;
}

export interface Dragging { src: Source; x: number; y: number; id: number; on: boolean; ghost: HTMLElement | null; target: Target | null; timer: number }
export let dragging: Dragging | null = null;

export function startDrag(d: Dragging): void {
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

export function moveDrag(d: Dragging, x: number, y: number): void {
  d.ghost!.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
  d.target = targetAt(d.src, x, y);
  indicate(d.target);
}

export function endDrag(drop: boolean): void {
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
  swallowNextClick();
}

export function swallowClick(ev: Event): void {
  ev.stopPropagation();
  ev.preventDefault();
}

export function onPointerDown(ev: PointerEvent): void {
  if (ev.button !== 0 || dragging !== null) return;
  const src = sourceAt(ev.target as Element);
  if (src === null) return;
  const d: Dragging = { src, x: ev.clientX, y: ev.clientY, id: ev.pointerId, on: false, ghost: null, target: null, timer: 0 };
  dragging = d;
  // on touch a long press starts the drag, so a swipe still scrolls
  if (ev.pointerType === 'touch') d.timer = setTimeout(() => { if (dragging === d) startDrag(d); }, 400) as unknown as number;
}

export function onPointerMove(ev: PointerEvent): void {
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
export function onReorderKey(ev: KeyboardEvent): void {
  if (inDevtools(ev.target)) return;
  if (!ev.altKey || ev.ctrlKey || ev.metaKey || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
  const at = document.activeElement;
  if (at === null) return;
  const src = sourceAt(at);
  if (src === null || src.within === null) return;
  const to = src.index + (ev.key === 'ArrowUp' ? -1 : 1);
  if (to < 0 || to >= (src.group !== null ? src.group.children.length : slotCount(src.within))) return;
  ev.preventDefault();
  seenKeys.add(ev);
  const group = src.group ?? undefined;
  void reorder(src.within, src.index, to, group, group !== undefined && src.within.open !== null ? groupParent(src.within, group) : NONE);
}

