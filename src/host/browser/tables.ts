// --- tables and lists ---------------------------------------------------------------

import { K, NONE, form, intern, spell, canon, type Cell, type ObjectCell, type BlockCell, type WordCell, type Sym } from '../../core/index.ts';
import { translate, activeLanguage } from '../index.ts';
import { rowField, groupRow, sortGroups, rowWindow, DRAW_ALL_UP_TO } from '../rows.ts';
import { mayMove, rowPlaces, moveRows, leaveRow } from '../motion.ts';
import { get, str, own, display, flag, icon } from './faces.ts';
import { type Mounted, host, rowOf, fire, el } from './mount.ts';
import { handlerFor } from './events.ts';

/** A column; `image` when it shows each row's picture, `round` when cut to a circle. */
export interface Column { sym: Sym; word: Cell; label: string; image: boolean; round: boolean }

export function columns(face: ObjectCell): Column[] {
  const c = get(face, 'columns');
  if (c.t !== K.Block) return [];
  const out: Column[] = [];
  const d = c.s.data;
  for (let i = c.i; i + 1 < d.length; i += 2) {
    const w = d[i]!;
    if (w.t !== K.Word) continue;
    // a column of images keeps its label in a block with what it is: ["Photo" image round]
    const spec = d[i + 1]!;
    const parts = spec.t === K.Block ? (spec as BlockCell).s.data.slice((spec as BlockCell).i) : [spec];
    const has = (name: string): boolean => parts.some(p => p.t === K.Word && canon((p as WordCell).sym) === canon(intern(name)));
    out.push({ sym: (w as WordCell).sym, word: w, label: translate(parts[0] ?? NONE, host.rt), image: has('image'), round: has('round') });
  }
  return out;
}

/** The picture of a row in a column of images, from an address or a file; without one, an empty place for it. */
export function thumb(box: Element, v: Cell, round: boolean): void {
  const src = v.t === K.String || v.t === K.Url || v.t === K.File ? form(v) : '';
  const old = box.querySelector<HTMLElement>(':scope > .tb-thumb');
  let pic = old;
  if (src === '' ? pic?.tagName !== 'SPAN' : pic?.tagName !== 'IMG') {
    // decoration: the row's text says who or what it is
    pic = el(src === '' ? 'span' : 'img', 'tb-thumb');
    if (src !== '') (pic as HTMLImageElement).alt = '';
    if (old !== null) old.replaceWith(pic);
    else box.prepend(pic);
  }
  if (src !== '' && pic!.getAttribute('src') !== src) (pic as HTMLImageElement).src = src;
  pic!.classList.toggle('tb-round', round);
}

export function sameRow(a: Cell, b: Cell): boolean {
  if (a.t === K.Map && b.t === K.Map) return a.s === b.s;
  if (a.t === K.Object && b.t === K.Object) return a.ctx === b.ctx;
  return false;
}

export function cellText(v: Cell): string {
  if (v.t === K.None) return '';
  if (v.t === K.Logic) return own(v.v ? 'yes' : 'no');
  return display(v);
}

export const NUMERIC: ReadonlySet<number> = new Set([K.Integer, K.Decimal, K.Money, K.Percent]);

export function buildRows(face: ObjectCell, style: string, m: Mounted): HTMLElement {
  const wrap = el('div', style === 'table' ? 'tb-table-wrap' : 'tb-list-wrap');
  let box: HTMLElement;
  if (style === 'table') {
    // explicit roles keep the table semantics when narrow screens restyle it as cards
    const table = el('table', 'tb-table');
    table.setAttribute('role', 'table');
    const head = el('thead');
    const tr = el('tr');
    tr.setAttribute('role', 'row');
    const cols = columns(face);
    for (const _ of cols) {
      const th = el('th');
      th.scope = 'col';
      th.setAttribute('role', 'columnheader');
      tr.append(th);
    }
    head.append(tr);
    head.addEventListener('click', ev => {
      const th = (ev.target as Element).closest('th');
      const c = th !== null && th.querySelector('.tb-sort') !== null ? cols[th.cellIndex] : undefined;
      if (c !== undefined) void fire('ui-sort', face, c.word);
    });
    box = el('tbody');
    // the totals row sits outside tbody, so it is never chosen, sorted or moved
    const foot = el('tfoot');
    const totals = newTableRow(cols);
    totals.className = 'tb-totals';
    foot.append(totals);
    // the room of the rows not drawn, above and below the ones drawn
    const room = (): HTMLElement => {
      const b = el('tbody', 'tb-room');
      b.setAttribute('aria-hidden', 'true');
      const r = el('tr');
      r.append(el('td'));
      b.append(r);
      return b;
    };
    table.append(head, room(), box, room(), foot);
    wrap.append(table);
  } else {
    box = el('ul', 'tb-list');
    wrap.append(box);
  }
  const empty = el('p', 'tb-empty');
  wrap.append(empty);
  const choose = (target: EventTarget | null): void => {
    const item = (target as Element | null)?.closest(style === 'table' ? 'tr' : 'li');
    const row = item ? rowOf.get(item) : undefined;
    if (row !== undefined) void fire('ui-select', face, row);
  };
  box.addEventListener('click', ev => choose(ev.target));
  box.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      choose(ev.target);
    }
  });
  m.box = box;
  m.rows = new Map();
  m.empty = empty;
  return wrap;
}

/** The rows of a table or list in the order shown, with their keys; then draws them. */
export function syncRows(m: Mounted): void {
  const f = m.face;
  const data = get(f, 'data');
  let rows = data.t === K.Block ? data.s.data.slice(data.i) : [];
  if (m.box!.tagName === 'TBODY') {
    syncHead(f, m.box!.parentElement as HTMLTableElement, columns(f));
    const order = hostSorted(f);
    if (order !== null) rows = sortGroups(rows, order.sym, order.desc, activeLanguage(host.rt), cellText);
  }
  const keyWord = get(f, 'key');
  const key = keyWord.t === K.Word || keyWord.t === K.LitWord ? (keyWord as WordCell).sym : intern('id');
  const seen = new Set<string>();
  m.items = rows.map((row, i) => {
    const group = groupRow(row);
    let k: string;
    if (group !== null) k = `${group.kind}#${i}`;
    else {
      const id = rowField(row, key);
      k = id.t === K.None ? `#${i}` : `${id.t}:${form(id)}`;
      if (seen.has(k)) k = `${k}#${i}`;
    }
    seen.add(k);
    return { row, k };
  });
  drawRows(m);
  m.empty!.textContent = str(f, 'text') ?? own('empty');
  m.empty!.hidden = rows.length > 0;
}

/** Tables and lists with too many rows to draw them all. */
export const longRows = new Set<Mounted>();
/** While printing, every row is drawn. */
export let printing = false;

/** The rows to draw: all of them, or those near the screen. */
export function rowsToDraw(m: Mounted): { first: number; end: number } {
  const count = m.items.length;
  if (count <= DRAW_ALL_UP_TO || printing) return { first: 0, end: count };
  // where the first row would be: the rows drawn start below the room of those that are not
  const top = m.box!.getBoundingClientRect().top - m.first * m.rowHeight;
  const now = m.end > m.first ? { first: m.first, end: m.end } : undefined;
  return rowWindow(count, m.rowHeight || 48, -top, innerHeight, now);
}

/** Creates, updates, moves or removes only the rows drawn whose key changed. */
export function drawRows(m: Mounted, again = true): void {
  const f = m.face;
  const box = m.box!;
  const table = box.tagName === 'TBODY';
  const cols = columns(f);
  const selected = get(f, 'selected');
  const selectable = handlerFor(f, 'on-select');
  box.parentElement!.classList.toggle('tb-selectable', selectable);
  const { first, end } = rowsToDraw(m);
  const count = m.items.length;
  const old = m.rows!;
  const next = new Map<string, HTMLElement>();
  const morph = morphName(get(f, 'morph'));
  const keyWord = get(f, 'key');
  const keySym = keyWord.t === K.Word || keyWord.t === K.LitWord ? (keyWord as WordCell).sym : intern('id');
  // rows added, taken away or in another order move to their places, when all of them are drawn
  const moved = old.size > 0 && count <= DRAW_ALL_UP_TO && !printing && box.isConnected && mayMove()
    && !sameKeys(old, m.items) && m.items.some(it => old.has(it.k));
  const was = moved ? rowPlaces(old.values()) : null;
  let cursor = box.firstChild;
  for (let i = first; i < end; i++) {
    const { row, k } = m.items[i]!;
    const group = groupRow(row);
    let item = old.get(k);
    if (group !== null) {
      // a group's head or foot: kept by its place, never chosen, dragged or sorted
      if (item === undefined) item = group.kind === 'head' ? newGroupHead(cols, table) : table ? newTableRow(cols) : newListItem();
      item.className = `tb-group-${group.kind} tb-level-${group.level}`;
      if (group.kind === 'head') {
        const t = translate(group.value, host.rt);
        const cell = item.firstElementChild!;
        if (cell.textContent !== t) cell.textContent = t;
        if (table) (cell as HTMLTableCellElement).colSpan = Math.max(1, cols.length);
      } else fillRow(item, group.value, cols, table);
    } else {
      if (item === undefined) item = table ? newTableRow(cols) : newListItem();
      rowOf.set(item, row);
      // morph 'client: the row is "client <its key>", for a face of the next screen to become
      if (morph !== null) item.dataset['tbMorph'] = `${morph} ${form(rowField(row, keySym))}`;
      else delete item.dataset['tbMorph'];
      fillRow(item, row, cols, table);
      if (selectable) item.tabIndex = 0;
      else item.removeAttribute('tabindex');
      const on = selected.t !== K.None && sameRow(selected, row);
      item.classList.toggle('tb-selected', on);
      if (selectable) item.setAttribute('aria-selected', on ? 'true' : 'false');
      else item.removeAttribute('aria-selected');
    }
    next.set(k, item);
    // with rows left undrawn, each says where it is among all of them
    if (count > end - first) {
      item.setAttribute(table ? 'aria-rowindex' : 'aria-posinset', String(table ? i + 2 : i + 1));
      if (!table) item.setAttribute('aria-setsize', String(count));
    } else {
      item.removeAttribute(table ? 'aria-rowindex' : 'aria-posinset');
      item.removeAttribute('aria-setsize');
    }
    if (item !== cursor) box.insertBefore(item, cursor);
    else cursor = cursor.nextSibling;
  }
  for (const [k, item] of old) {
    if (next.get(k) === item) continue;
    if (was !== null) leaveRow(item, was.get(item)!);
    else item.remove();
  }
  m.rows = next;
  if (was !== null) moveRows(next.values(), was);
  m.first = first;
  m.end = end;
  if (table) {
    if (count > end - first) box.parentElement!.setAttribute('aria-rowcount', String(count + 1));
    else box.parentElement!.removeAttribute('aria-rowcount');
  }
  if (count <= DRAW_ALL_UP_TO) {
    longRows.delete(m);
    room(m, 0, 0);
    if (table) keepColumns(box.parentElement as HTMLTableElement, false);
    return;
  }
  longRows.add(m);
  if (table) keepColumns(box.parentElement as HTMLTableElement, true);
  // how tall a row is, from those drawn; the room of the others follows it
  const drawn = end - first;
  const h = box.getBoundingClientRect().height - (table ? 0 : parseFloat(box.style.paddingTop || '0') + parseFloat(box.style.paddingBottom || '0'));
  if (drawn > 0 && h > 0) m.rowHeight = h / drawn;
  room(m, first * m.rowHeight, (count - end) * m.rowHeight);
  // a first guess of the height may have drawn the wrong rows
  if (again) {
    const want = rowsToDraw(m);
    if (want.first !== first || want.end !== end) drawRows(m, false);
  }
}

/** A morph name, 'logo or [client 7], as text: "logo", "client 7"; null for none. */
export function morphName(v: Cell): string | null {
  if (v.t === K.Word || v.t === K.LitWord) return spell((v as WordCell).sym);
  if (v.t === K.Block) return v.s.data.slice(v.i).map(c => form(c)).join(' ');
  return null;
}

/** Whether the rows drawn are the rows to draw, in the same order. */
export function sameKeys(old: Map<string, HTMLElement>, items: { k: string }[]): boolean {
  if (old.size !== items.length) return false;
  let i = 0;
  for (const k of old.keys()) if (items[i++]!.k !== k) return false;
  return true;
}

/**
 * A long table keeps the widths its columns first took, as shares of its width,
 * so they do not change with the rows drawn while it scrolls.
 */
export function keepColumns(table: HTMLTableElement, keep: boolean): void {
  const ths = Array.from(table.tHead!.rows[0]!.cells);
  if (!keep) {
    table.classList.remove('tb-fixed');
    for (const th of ths) th.style.width = '';
    return;
  }
  if (table.classList.contains('tb-fixed')) return;
  const widths = ths.map(th => th.getBoundingClientRect().width);
  const all = widths.reduce((a, b) => a + b, 0);
  // on a narrow screen the rows are cards and the headers take no room: later
  if (all === 0) return;
  ths.forEach((th, i) => { th.style.width = `${(widths[i]! / all) * 100}%`; });
  table.classList.add('tb-fixed');
}

/** Sets the room of the rows not drawn above and below those drawn. */
export function room(m: Mounted, above: number, below: number): void {
  const box = m.box!;
  if (box.tagName === 'TBODY') {
    for (const [b, px] of [[box.previousElementSibling, above], [box.nextElementSibling, below]] as const) {
      const td = (b as HTMLElement).querySelector('td')!;
      td.style.height = `${px}px`;
      (b as HTMLElement).hidden = px === 0;
    }
    return;
  }
  box.style.paddingTop = above > 0 ? `${above}px` : '';
  box.style.paddingBottom = below > 0 ? `${below}px` : '';
}

export let rowsFrame = 0;

/** On a scroll or a resize, the long tables and lists draw the rows now near the screen. */
export function onRowsMoved(): void {
  if (rowsFrame !== 0 || longRows.size === 0) return;
  rowsFrame = requestAnimationFrame(() => {
    rowsFrame = 0;
    for (const m of longRows) {
      if (!m.box!.isConnected) { longRows.delete(m); continue; }
      const want = rowsToDraw(m);
      if (want.first !== m.first || want.end !== m.end) drawRows(m);
    }
  });
}

/** Printing draws every row, and the screen goes back to drawing some after. */
export function onPrint(on: boolean): void {
  printing = on;
  for (const m of longRows) {
    if (!m.box!.isConnected) continue;
    // all the rows cover the screen, but are not to be kept
    if (!on) m.end = m.first;
    drawRows(m);
  }
}

/** Headers in the active language; in a sortable table each is a button, with an arrow on the sorted one. */
export function syncHead(f: ObjectCell, table: HTMLTableElement, cols: Column[]): void {
  const sortable = flag(f, 'sortable') || handlerFor(f, 'on-sort');
  const order = sortedBy(f);
  const ths = table.tHead!.rows[0]!.cells;
  cols.forEach((c, i) => {
    const th = ths[i];
    if (th === undefined) return;
    const on = order !== null && canon(order.sym) === canon(c.sym);
    let button = th.querySelector<HTMLButtonElement>('.tb-sort');
    if (sortable && button === null) {
      button = el('button', 'tb-sort');
      button.type = 'button';
      button.append(el('span'));
      th.replaceChildren(button);
    } else if (!sortable && button !== null) {
      th.replaceChildren();
      button = null;
    }
    const label = button !== null ? button.firstChild! : th;
    if (label.textContent !== c.label) label.textContent = c.label;
    if (button !== null) {
      // the button stays, so a header chosen from the keyboard keeps the focus
      const arrow = on && order.desc ? 'arrow-down' : 'arrow-up';
      const svg = button.querySelector('svg');
      if (svg?.dataset['icon'] !== arrow) {
        const next = icon(arrow);
        if (next !== null) {
          next.dataset['icon'] = arrow;
          if (svg) svg.replaceWith(next);
          else button.append(next);
        }
      }
      button.querySelector('svg')?.classList.toggle('tb-sort-idle', !on);
    }
    if (on) th.setAttribute('aria-sort', order.desc ? 'descending' : 'ascending');
    else th.removeAttribute('aria-sort');
  });
  const totals = get(f, 'totals');
  const foot = table.tFoot!;
  foot.hidden = totals.t === K.None;
  if (totals.t !== K.None) fillRow(foot.rows[0]!, totals, cols, true);
}

/** A table's sorted facet: [column asc] or [column desc]. */
export function sortedBy(f: ObjectCell): { sym: Sym; desc: boolean } | null {
  const v = get(f, 'sorted');
  if (v.t !== K.Block || v.s.data.length - v.i < 2) return null;
  const c = v.s.data[v.i]!;
  const o = v.s.data[v.i + 1]!;
  if ((c.t !== K.Word && c.t !== K.LitWord) || (o.t !== K.Word && o.t !== K.LitWord)) return null;
  return { sym: (c as WordCell).sym, desc: canon((o as WordCell).sym) === canon(intern('desc')) };
}

/** The order the host applies itself: a sortable table without on-sort, which sorts for itself. */
export function hostSorted(f: ObjectCell): { sym: Sym; desc: boolean } | null {
  return flag(f, 'sortable') && !handlerFor(f, 'on-sort') ? sortedBy(f) : null;
}

/** A group's title, the width of the whole row. */
export function newGroupHead(cols: Column[], table: boolean): HTMLElement {
  if (!table) {
    const li = el('li');
    li.append(el('span'));
    return li;
  }
  const tr = el('tr');
  tr.setAttribute('role', 'row');
  const th = el('th');
  th.scope = 'rowgroup';
  th.setAttribute('role', 'rowheader');
  th.colSpan = Math.max(1, cols.length);
  tr.append(th);
  return tr;
}

export function newTableRow(cols: Column[]): HTMLElement {
  const tr = el('tr');
  tr.setAttribute('role', 'row');
  for (const c of cols) {
    const td = el('td');
    td.setAttribute('role', 'cell');
    td.dataset['label'] = c.label;
    tr.append(td);
  }
  return tr;
}

export function newListItem(): HTMLElement {
  const li = el('li');
  const texts = el('span', 'tb-list-texts');
  texts.append(el('span', 'tb-list-primary'), el('span', 'tb-list-secondary'));
  li.append(texts);
  return li;
}

export function fillRow(item: HTMLElement, row: Cell, cols: Column[], table: boolean): void {
  const set = (e: Element, t: string): void => {
    if (e.textContent !== t) e.textContent = t;
  };
  if (table) {
    cols.forEach((c, i) => {
      const v = rowField(row, c.sym);
      const td = item.children[i]!;
      if (c.image) {
        td.classList.add('tb-thumb-cell');
        return thumb(td, v, c.round);
      }
      set(td, cellText(v));
      td.classList.toggle('tb-num', NUMERIC.has(v.t));
    });
    return;
  }
  // a list shows its picture first, then its first column, and the others on a quieter line
  const pic = cols.find(c => c.image);
  if (pic !== undefined) thumb(item, rowField(row, pic.sym), pic.round);
  else item.querySelector(':scope > .tb-thumb')?.remove();
  const [first, ...rest] = cols.filter(c => !c.image).map(c => cellText(rowField(row, c.sym)));
  const texts = item.querySelector(':scope > .tb-list-texts')!;
  set(texts.children[0]!, first ?? '');
  set(texts.children[1]!, rest.filter(Boolean).join(' · '));
}
