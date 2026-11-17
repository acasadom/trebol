// --- general events ------------------------------------------------------------------

import { K, NONE, TRUE, FALSE, intern, canon, blockOf, wordOf, type Cell, type ObjectCell, type BlockCell, type WordCell } from '../../core/index.ts';
import { get, str, own, flag, icon } from './faces.ts';
import { type Mounted, rowOf, fire, el } from './mount.ts';
import { swipeRows } from './swipe.ts';
import { dropZones, moveTargets } from './drag.ts';
import { type MenuEntry, trebolEntries, openMenu } from './menus.ts';
import { keyCell, keyWords } from './keys.ts';

/** Runs a face's on-xxx handler; `words` are the event's own [word: value ...]. */
export function fireEvent(face: ObjectCell, name: string, words: [string, Cell][] = []): void {
  const extra = words.flatMap(([w, v]) => [wordOf(K.SetWord, w), v]);
  void fire('ui-event', face, wordOf(K.LitWord, name), blockOf(K.Block, extra));
}

/** Keydown events some face's on-key already saw; the view gets the rest. */
export const seenKeys = new WeakSet<Event>();
/** The view with an on-key handler, if any. */
export let viewKeys: ObjectCell | null = null;
export function setViewKeys(v: ObjectCell | null): void {
  viewKeys = v;
}
/** Mounted buttons and links with a shortcut. */
export const shortcuts = new Set<Mounted>();

export function listen(m: Mounted, style: string): void {
  const f = m.face;
  const node = m.el;
  const left = (ev: FocusEvent): boolean => !node.contains(ev.relatedTarget as Node | null);
  if (handlerFor(f, 'on-focus')) node.addEventListener('focusin', ev => { if (left(ev)) fireEvent(f, 'on-focus'); });
  if (handlerFor(f, 'on-unfocus')) node.addEventListener('focusout', ev => { if (left(ev)) fireEvent(f, 'on-unfocus'); });
  if (handlerFor(f, 'on-over')) {
    // as in Red, event/away? is true when the pointer leaves
    node.addEventListener('pointerenter', () => fireEvent(f, 'on-over', [['away?', FALSE]]));
    node.addEventListener('pointerleave', () => fireEvent(f, 'on-over', [['away?', TRUE]]));
  }
  if (handlerFor(f, 'on-dbl-click')) node.addEventListener('dblclick', () => fireEvent(f, 'on-dbl-click'));
  if (handlerFor(f, 'on-end')) node.addEventListener('ended', () => fireEvent(f, 'on-end'));
  if (handlerFor(f, 'on-key')) {
    if (style === 'view') viewKeys = f;
    else node.addEventListener('keydown', ev => {
      if (seenKeys.has(ev) || keyCell(ev) === null) return;
      seenKeys.add(ev);
      fireEvent(f, 'on-key', keyWords(ev));
    });
  }
  if (str(f, 'shortcut') !== null) shortcuts.add(m);
  if (flag(f, 'drop')) dropZones.add(m);
  const menu = get(f, 'menu');
  // a button or link without an action opens its menu; anything else has it as its context menu
  if (menu.t === K.Block && (style === 'button' || style === 'link') && get(f, 'action').t !== K.Block) {
    node.setAttribute('aria-haspopup', 'menu');
    node.setAttribute('aria-expanded', 'false');
    // a chevron after the text (or alone after the icon) says it opens a menu; it turns up while open
    if (m.label === null) {
      m.label = el('span');
      node.prepend(m.label);
    }
    const chevron = icon('chevron-down');
    if (chevron !== null) {
      chevron.classList.add('tb-menu-chevron');
      node.append(chevron);
    }
    node.addEventListener('click', ev => {
      ev.preventDefault();
      const r = node.getBoundingClientRect();
      openMenu(trebolEntries(f, menu as BlockCell, NONE), r.left, r.bottom + 4, node);
    });
  } else if (menu.t === K.Block || flag(f, 'drag')) {
    if (menu.t === K.Block && (style === 'table' || style === 'list')) swipeRows(node, f);
    node.addEventListener('contextmenu', ev => {
      const target = ev.target as Element;
      const data = style === 'table' || style === 'list' || style === 'tree';
      const item = data ? target.closest(style === 'tree' ? '[role="treeitem"]' : 'tr, li') : null;
      if (item === null && data && get(f, 'menu').t !== K.Block) return;
      const entries = contextEntries(f, item);
      if (entries.length === 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      // from the keyboard (Menu key, Shift+F10) there is no pointer: open by the focused element
      let { clientX: x, clientY: y } = ev;
      if (x === 0 && y === 0) {
        const r = (item ?? (document.activeElement && node.contains(document.activeElement) ? document.activeElement : node)).getBoundingClientRect();
        x = r.left + 8;
        y = r.top + Math.min(r.height, 40);
      }
      openMenu(entries, x, y, (item as HTMLElement | null) ?? (target as HTMLElement));
    });
  }
}

/** The context menu of a face, or of one of its rows: its own items, then "Move to" if it can be dragged. */
export function contextEntries(f: ObjectCell, item: Element | null): MenuEntry[] {
  const menu = get(f, 'menu');
  const row = item !== null ? rowOf.get(item) ?? NONE : NONE;
  const entries = menu.t === K.Block ? trebolEntries(f, menu as BlockCell, row) : [];
  // faces you can drag can also be moved to a drop zone from the menu, without a mouse
  if (flag(f, 'drag')) {
    const zones = moveTargets(f, item !== null ? row : get(f, 'value'));
    if (zones.length > 0) {
      if (entries.length > 0) entries.push({ text: '', divider: true });
      entries.push({ text: own('move-to'), sub: zones });
    }
  }
  return entries;
}



export function handlerFor(face: ObjectCell, name: string): boolean {
  const ev = get(face, 'events');
  if (ev.t !== K.Block) return false;
  const c = canon(intern(name));
  return ev.s.data.some(x => x.t === K.Word && canon((x as WordCell).sym) === c);
}

