// --- swipe ---------------------------------------------------------------------------
//
// On a phone, swiping a row of a table or list that has a menu to the left
// shows its first actions behind it, as mail apps do, the danger ones red, and
// More for the whole menu. A move more down than across still scrolls.

import { type ObjectCell } from '../../core/index.ts';
import { own, icon } from './faces.ts';
import { rowOf, el } from './mount.ts';
import { contextEntries } from './events.ts';
import { mountedAbove, dragging, swallowClick } from './drag.ts';
import { type MenuEntry, openMenu } from './menus.ts';

export interface Swipe {
  face: ObjectCell; row: HTMLElement; x: number; y: number; id: number;
  /** Where the row stood when the finger went down (0, or open), and where it is now: 0 or less. */
  from: number; at: number; on: boolean; box: HTMLElement; width: number;
}
/** The row under the finger, and the one left open. */
export let swipe: Swipe | null = null;
export let swiped: Swipe | null = null;

export const SWIPE_BUTTON = 76;

export function swipeRows(node: HTMLElement, f: ObjectCell): void {
  node.classList.add('tb-swipe');
  node.addEventListener('pointerdown', ev => {
    if (ev.pointerType !== 'touch' || swipe !== null || !matchMedia('(max-width: 640px)').matches) return;
    const row = (ev.target as Element).closest<HTMLElement>('tr, li');
    // a row of this face, not of one inside it
    if (row === null || !rowOf.has(row) || mountedAbove(row)?.el !== node) return;
    if (swiped !== null && swiped.row !== row) closeSwipe();
    const open = swiped?.row === row ? swiped : null;
    const box = open?.box ?? swipeBox(f, row);
    if (box === null) return;
    swipe = {
      face: f, row, x: ev.clientX, y: ev.clientY, id: ev.pointerId,
      from: open?.at ?? 0, at: open?.at ?? 0, on: false, box, width: box.childElementCount * SWIPE_BUTTON,
    };
  });
}

/** The buttons behind a row: its first two plain actions, and More if the menu has others. */
export function swipeBox(f: ObjectCell, row: HTMLElement): HTMLElement | null {
  const all = contextEntries(f, row);
  const shown = all.filter(e => !e.divider && e.sub === undefined).slice(0, 2);
  if (shown.length === 0) return null;
  const box = el('div', 'tb-swipe-actions');
  // its corners are those of the row, or of the list a first or last row is the edge of
  const rs = getComputedStyle(row);
  const list = getComputedStyle(row.parentElement!);
  const first = row.previousElementSibling === null;
  const last = row.nextElementSibling === null;
  box.style.borderTopRightRadius = first && rs.borderTopRightRadius === '0px' ? list.borderTopRightRadius : rs.borderTopRightRadius;
  box.style.borderBottomRightRadius = last && rs.borderBottomRightRadius === '0px' ? list.borderBottomRightRadius : rs.borderBottomRightRadius;
  box.style.borderTopLeftRadius = rs.borderTopLeftRadius;
  box.style.borderBottomLeftRadius = rs.borderBottomLeftRadius;
  const button = (e: MenuEntry, cls: string, run: (b: HTMLElement) => void): void => {
    const b = el('button', cls);
    b.type = 'button';
    const svg = e.icon ? icon(e.icon) : null;
    const text = el('span');
    text.textContent = e.text;
    b.append(...(svg !== null ? [svg] : []), text);
    b.addEventListener('click', () => run(b));
    box.append(b);
  };
  if (all.filter(e => !e.divider).length > shown.length) {
    button({ text: own('more-actions'), icon: 'menu' }, 'tb-swipe-action tb-swipe-more', b => {
      const r = b.getBoundingClientRect();
      closeSwipe();
      openMenu(all, r.left, r.bottom, row);
    });
  }
  for (const e of shown.reverse()) {
    button(e, e.danger ? 'tb-swipe-action tb-danger' : 'tb-swipe-action', () => {
      closeSwipe();
      e.run?.();
    });
  }
  return box;
}

/** Shows the row moved to at (0 or less) and the buttons in the room it leaves. */
export function placeSwipe(s: Swipe): void {
  s.row.style.transform = s.at === 0 ? '' : `translateX(${s.at}px)`;
  // where the row ends without the move, so it holds while the row settles
  const r = s.row.getBoundingClientRect();
  const right = r.right - (new DOMMatrix(getComputedStyle(s.row).transform).m41);
  Object.assign(s.box.style, {
    top: `${r.top}px`, height: `${r.height}px`, left: `${right + s.at}px`, width: `${-s.at}px`,
  });
}

export function settleSwipe(s: Swipe, at: number): void {
  s.at = at;
  s.row.classList.add('tb-swipe-settle');
  s.box.classList.add('tb-swipe-settle');
  placeSwipe(s);
  if (at === 0) {
    // the buttons go once the row is back
    const done = (): void => { if (swiped !== s && swipe?.row !== s.row) { s.box.remove(); s.row.classList.remove('tb-swipe-settle'); } };
    s.row.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 300);
  }
}

export function closeSwipe(): void {
  const s = swiped;
  if (s === null) return;
  swiped = null;
  if (s.row.isConnected) settleSwipe(s, 0);
  else s.box.remove();
}

export function onSwipeMove(ev: PointerEvent): void {
  const s = swipe;
  if (s === null || ev.pointerId !== s.id) return;
  const dx = ev.clientX - s.x;
  const dy = ev.clientY - s.y;
  if (!s.on) {
    if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { swipe = null; return; }
    if (Math.abs(dx) <= 10) return;
    // a row held long enough is being dragged, not swiped
    if (dragging?.on) { swipe = null; return; }
    s.on = true;
    s.row.classList.remove('tb-swipe-settle');
    s.box.classList.remove('tb-swipe-settle');
    if (!s.box.isConnected) document.body.append(s.box);
  }
  ev.preventDefault();
  // past the buttons it moves at a third of the finger, as if held back
  const at = Math.min(0, s.from + dx);
  s.at = at < -s.width ? -s.width + (at + s.width) / 3 : at;
  placeSwipe(s);
}

export function onSwipeEnd(ev: PointerEvent): void {
  const s = swipe;
  if (s === null || ev.pointerId !== s.id) return;
  swipe = null;
  if (!s.on) {
    // a tap on the open row closes it, and does not select it
    if (swiped?.row === s.row && ev.type === 'pointerup') { closeSwipe(); swallowNextClick(); }
    return;
  }
  swallowNextClick();
  const open = ev.type === 'pointerup' && s.at < -s.width / 2;
  if (open) swiped = s;
  else if (swiped?.row === s.row) swiped = null;
  settleSwipe(s, open ? -s.width : 0);
}

/** The click that ends a move is not a click. */
export function swallowNextClick(): void {
  addEventListener('click', swallowClick, true);
  setTimeout(() => removeEventListener('click', swallowClick, true), 0);
}

/** A touch outside the open row and its buttons, or a scroll, closes it. */
export function outsideSwipe(ev: Event): void {
  const s = swiped;
  if (s === null) return;
  const t = ev.target as Node | null;
  if (ev.type === 'pointerdown' && t !== null && (s.box.contains(t) || s.row.contains(t))) return;
  closeSwipe();
}

