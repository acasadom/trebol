// --- trees ---------------------------------------------------------------------------

import { K, NONE, form, intern, type Cell, type ObjectCell, type BlockCell, type WordCell } from '../../core/index.ts';
import { rowField } from '../rows.ts';
import { get, str, own, flag, icon } from './faces.ts';
import { type Mounted, rowOf, fire, el } from './mount.ts';
import { type Source, type Target, insertionAt } from './drag.ts';
import { columns, sameRow, cellText } from './tables.ts';

export const CHILDREN = intern('children');
export const EXPANDED = intern('expanded');

export function treeItems(m: Mounted): HTMLElement[] {
  return Array.from(m.box!.querySelectorAll<HTMLElement>('[role="treeitem"]'));
}

/** The node whose children a group holds; none for the root. */
export function groupParent(m: Mounted, group: HTMLElement): Cell {
  if (group === m.box) return NONE;
  const item = group.closest('[role="treeitem"]');
  return item !== null ? rowOf.get(item) ?? NONE : NONE;
}

export function buildTree(face: ObjectCell, m: Mounted): HTMLElement {
  const wrap = el('div', 'tb-tree-wrap');
  const box = el('ul', 'tb-tree');
  box.setAttribute('role', 'tree');
  const empty = el('p', 'tb-empty');
  wrap.append(box, empty);
  box.addEventListener('click', ev => {
    const target = ev.target as Element;
    const item = target.closest<HTMLElement>('[role="treeitem"]');
    if (item === null) return;
    if (target.closest('.tb-tree-toggle') !== null) return toggleNode(m, item);
    focusItem(m, item);
    selectNode(m, item);
  });
  box.addEventListener('keydown', ev => treeKey(m, ev));
  m.box = box;
  m.rows = new Map();
  m.empty = empty;
  m.open = new Set();
  return wrap;
}

export function newTreeItem(): HTMLElement {
  const li = el('li');
  li.setAttribute('role', 'treeitem');
  const row = el('div', 'tb-tree-row');
  const toggle = el('span', 'tb-tree-toggle');
  toggle.setAttribute('aria-hidden', 'true');
  const chevron = icon('chevron-right');
  if (chevron !== null) toggle.append(chevron);
  row.append(toggle, el('span', 'tb-tree-label'));
  const group = el('ul');
  group.setAttribute('role', 'group');
  li.append(row, group);
  return li;
}

/** Creates, updates, moves or removes the items of a tree, level by level, by key. */
export function syncTree(m: Mounted): void {
  const f = m.face;
  const label = columns(f)[0]?.sym ?? intern('name');
  const keyWord = get(f, 'key');
  const key = keyWord.t === K.Word || keyWord.t === K.LitWord ? (keyWord as WordCell).sym : intern('id');
  const selected = get(f, 'selected');
  const old = m.rows!;
  const open = m.open!;
  const next = new Map<string, HTMLElement>();
  const level = (group: HTMLElement, nodes: Cell[], depth: number, parentKey: string): void => {
    let cursor = group.firstChild;
    nodes.forEach((node, i) => {
      const id = rowField(node, key);
      let k = id.t === K.None ? `${parentKey}/${i}` : `${id.t}:${form(id)}`;
      if (next.has(k)) k = `${parentKey}/${i}#${k}`;
      const known = old.get(k);
      const item = known ?? newTreeItem();
      next.set(k, item);
      rowOf.set(item, node);
      item.dataset['key'] = k;
      item.setAttribute('aria-level', String(depth));
      item.style.setProperty('--tb-level', String(depth - 1));
      const text = cellText(rowField(node, label));
      const name = item.firstElementChild!.lastElementChild!;
      if (name.textContent !== text) name.textContent = text;
      const kids = rowField(node, CHILDREN);
      const folder = kids.t === K.Block;
      // `expanded: true` opens a node the first time it shows
      if (folder && known === undefined && rowField(node, EXPANDED).t === K.Logic && (rowField(node, EXPANDED) as { v: boolean }).v) open.add(k);
      const isOpen = folder && open.has(k);
      if (folder) item.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      else item.removeAttribute('aria-expanded');
      const sub = item.lastElementChild as HTMLElement;
      if (isOpen) level(sub, (kids as BlockCell).s.data.slice((kids as BlockCell).i), depth + 1, k);
      else sub.replaceChildren();
      sub.hidden = sub.childElementCount === 0;
      const on = selected.t !== K.None && sameRow(selected, node);
      item.classList.toggle('tb-selected', on);
      item.setAttribute('aria-selected', on ? 'true' : 'false');
      if (item !== cursor) group.insertBefore(item, cursor);
      else cursor = cursor.nextSibling;
    });
    // whatever is left after the last placed item is gone from the data
    while (cursor !== null) {
      const gone = cursor;
      cursor = cursor.nextSibling;
      gone.remove();
    }
  };
  const data = get(f, 'data');
  level(m.box!, data.t === K.Block ? data.s.data.slice(data.i) : [], 1, '');
  m.rows = next;
  // one Tab stop: the item that had it, else the selected one, else the first
  const items = treeItems(m);
  const current = items.find(e => e.tabIndex === 0 && e.hasAttribute('tabindex'))
    ?? items.find(e => e.classList.contains('tb-selected')) ?? items[0];
  for (const e of items) e.tabIndex = e === current ? 0 : -1;
  m.empty!.textContent = str(f, 'text') ?? own('empty');
  m.empty!.hidden = items.length > 0;
}

export function focusItem(m: Mounted, item: HTMLElement): void {
  for (const e of treeItems(m)) e.tabIndex = e === item ? 0 : -1;
  item.focus();
}

export function selectNode(m: Mounted, item: HTMLElement): void {
  const node = rowOf.get(item);
  if (node !== undefined) void fire('ui-select', m.face, node);
}

/** Opens or closes a folder; opening runs on-expand, which may load its children. */
export function toggleNode(m: Mounted, item: HTMLElement, want?: boolean): void {
  if (!item.hasAttribute('aria-expanded')) return;
  const k = item.dataset['key']!;
  const open = want ?? !m.open!.has(k);
  if (open === m.open!.has(k)) return;
  const inside = document.activeElement !== item && item.contains(document.activeElement);
  if (open) m.open!.add(k);
  else m.open!.delete(k);
  syncTree(m);
  if (inside) focusItem(m, item);
  const node = rowOf.get(item);
  if (open && node !== undefined) void fire('ui-expand', m.face, node);
}

/** The keys of the treeview pattern: arrows, Home, End, Enter, Space and a letter to jump. */
export function treeKey(m: Mounted, ev: KeyboardEvent): void {
  const item = (ev.target as Element).closest<HTMLElement>('[role="treeitem"]');
  if (item === null || ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const items = treeItems(m);
  const i = items.indexOf(item);
  const expanded = item.getAttribute('aria-expanded');
  let to: HTMLElement | null | undefined = null;
  switch (ev.key) {
    case 'ArrowDown': to = items[i + 1]; break;
    case 'ArrowUp': to = items[i - 1]; break;
    case 'Home': to = items[0]; break;
    case 'End': to = items[items.length - 1]; break;
    case 'ArrowRight':
      if (expanded === 'false') toggleNode(m, item, true);
      else if (expanded === 'true') to = item.querySelector<HTMLElement>('[role="treeitem"]');
      break;
    case 'ArrowLeft':
      if (expanded === 'true') toggleNode(m, item, false);
      else to = item.parentElement!.closest<HTMLElement>('[role="treeitem"]');
      break;
    case 'Enter': case ' ': selectNode(m, item); break;
    default: {
      if (ev.key.length !== 1 || ev.key.trim() === '') return;
      const c = ev.key.toLowerCase();
      const label = (e: HTMLElement): string => (e.querySelector('.tb-tree-label')?.textContent ?? '').toLowerCase();
      to = [...items.slice(i + 1), ...items.slice(0, i)].find(e => label(e).startsWith(c));
    }
  }
  ev.preventDefault();
  if (to) focusItem(m, to);
}

/** Where a drag over a tree lands: between siblings, or into a folder when over the middle of its row. */
export function treeTarget(m: Mounted, src: Source, x: number, y: number): Target | null {
  const at = document.elementFromPoint(x, y)?.closest<HTMLElement>('[role="treeitem"]');
  const drop = flag(m.face, 'drop');
  let t: Target;
  if (at === null || at === undefined || !m.box!.contains(at)) {
    t = { m, index: insertionAt(m, x, y), reorder: false, group: m.box!, parent: NONE };
  } else {
    const r = at.querySelector(':scope > .tb-tree-row')!.getBoundingClientRect();
    if (at.hasAttribute('aria-expanded') && y > r.top + r.height / 4 && y < r.bottom - r.height / 4) {
      const node = rowOf.get(at)!;
      const kids = rowField(node, CHILDREN) as BlockCell;
      t = { m, index: kids.s.data.length - kids.i, reorder: false, group: at.lastElementChild as HTMLElement, parent: node, into: at };
    } else {
      const group = at.parentElement!;
      const index = Array.prototype.indexOf.call(group.children, at) + (y > r.top + r.height / 2 ? 1 : 0);
      t = { m, index, reorder: false, group, parent: groupParent(m, group) };
    }
  }
  // never into itself or below itself
  if (src.el === t.into || src.el.contains(t.group!)) return null;
  t.reorder = src.within === m && t.group === src.group && t.into === undefined;
  return t.reorder || drop ? t : null;
}

