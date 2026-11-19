// A grid with `resize`: a handle in the gap between two columns, dragged with the mouse or moved
// with the arrow keys, makes one of them wider. The column that changes is one of a set width
// (small, medium, large, or one a handle sized before); between two weighted columns it is the
// left one, which keeps that width from then on. Double-click a handle to give its column back
// the width written. Widths are kept in the browser, so the page opens as the user left it.

import { type ObjectCell } from '../../core/index.ts';
import { keepOwn } from './faces.ts';
import { el } from './mount.ts';

const LEAST = 96;     // the narrowest a column gets
const STEP = 16;      // a key press, 64 with Shift

interface Grid { face: ObjectCell; written: string[]; widths: (number | null)[]; key: string | null; place: () => void }
const grids = new WeakMap<HTMLElement, Grid>();

/** The written tracks of a grid, with any width a handle gave. */
function tracks(g: Grid): string {
  return g.written.map((t, i) => (g.widths[i] !== null && g.widths[i] !== undefined ? `${g.widths[i]}px` : t)).join(' ');
}

/** A column of a set width, which a handle can size on its own. */
const isSet = (g: Grid, i: number): boolean => (g.widths[i] ?? null) !== null || g.written[i]!.startsWith('var(');

/** The column a handle between i and i + 1 sizes, and which way it grows. */
function target(g: Grid, i: number): [number, number] {
  if (isSet(g, i)) return [i, 1];
  if (isSet(g, i + 1)) return [i + 1, -1];
  return [i, 1];
}

/** Which of the page's resizable grids it is, with its columns: the key its widths are kept under. */
function storeKey(node: HTMLElement, g: Grid): string {
  return `${Array.from(document.querySelectorAll('.tb-grid.tb-resize')).indexOf(node)}:${g.written.join(' ')}`;
}

function load(g: Grid): void {
  try {
    const saved = JSON.parse(localStorage.getItem(`trebol-grid:${location.pathname}:${g.key}`) ?? 'null') as unknown;
    if (Array.isArray(saved) && saved.length === g.written.length) g.widths = saved.map(w => (typeof w === 'number' ? w : null));
  } catch { /* no storage: written widths */ }
}

function save(g: Grid): void {
  if (g.key === null) return;
  try {
    localStorage.setItem(`trebol-grid:${location.pathname}:${g.key}`, JSON.stringify(g.widths));
  } catch { /* no storage: kept until the page closes */ }
}

/** The tracks of a grid laid out now, in pixels. */
function laidOut(node: HTMLElement): number[] {
  return getComputedStyle(node).gridTemplateColumns.split(' ').map(parseFloat).filter(n => !Number.isNaN(n));
}

/** Sets a grid's columns from the written ones; with `resize`, handles size them. */
export function syncResize(node: HTMLElement, face: ObjectCell, written: string[], on: boolean): void {
  let g = grids.get(node);
  if (!on) {
    node.classList.remove('tb-resize');
    if (written.length > 0) node.style.setProperty('--tb-tracks', written.join(' '));
    else node.style.removeProperty('--tb-tracks');
    if (g !== undefined) {
      for (const h of Array.from(node.querySelectorAll(':scope > .tb-grid-handle'))) h.remove();
      grids.delete(node);
    }
    return;
  }
  node.classList.add('tb-resize');
  if (g === undefined || g.written.join(' ') !== written.join(' ')) {
    const fresh: Grid = { face, written, widths: written.map(() => null), key: null, place: () => {} };
    fresh.place = () => placeHandles(node, fresh);
    if (g === undefined) new ResizeObserver(() => grids.get(node)?.place()).observe(node);
    g = fresh;
    grids.set(node, g);
  }
  node.style.setProperty('--tb-tracks', tracks(g));
  g.place();
}

/** Puts a handle in each gap between columns; none when the grid shows one column. */
function placeHandles(node: HTMLElement, g: Grid): void {
  // once on the page, the widths the user left
  if (g.key === null && node.isConnected) {
    g.key = storeKey(node, g);
    load(g);
    node.style.setProperty('--tb-tracks', tracks(g));
  }
  const cols = laidOut(node);
  const n = cols.length > 1 && cols.length === g.written.length ? cols.length - 1 : 0;
  let handles = Array.from(node.querySelectorAll<HTMLElement>(':scope > .tb-grid-handle'));
  for (const h of handles.slice(n)) h.remove();
  for (let i = handles.length; i < n; i++) node.append(handle(node, g, i));
  handles = Array.from(node.querySelectorAll<HTMLElement>(':scope > .tb-grid-handle'));
  const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
  const pad = parseFloat(getComputedStyle(node).paddingLeft) || 0;
  let x = pad;
  handles.forEach((h, i) => {
    x += cols[i]!;
    h.style.left = `${x + gap / 2}px`;
    const [t] = target(g, i);
    h.setAttribute('aria-valuenow', String(Math.round(cols[t]!)));
    x += gap;
  });
}

function handle(node: HTMLElement, g0: Grid, i: number): HTMLElement {
  const h = el('div', 'tb-grid-handle');
  h.tabIndex = 0;
  h.setAttribute('role', 'separator');
  h.setAttribute('aria-orientation', 'vertical');
  h.setAttribute('aria-valuemin', String(LEAST));
  keepOwn(h, 'resize-panes', 'aria-label');
  // the grid's record is looked up on use: a new layout replaces it
  const grid = (): Grid => grids.get(node) ?? g0;
  const resize = (t: number, px: number): void => {
    const g = grid();
    const cols = laidOut(node);
    const others = cols.reduce((s, c, j) => s + (j === t ? 0 : isSet(g, j) ? c : LEAST), 0);
    const room = node.clientWidth - (parseFloat(getComputedStyle(node).columnGap) || 0) * (cols.length - 1) - others;
    g.widths[t] = Math.round(Math.max(LEAST, Math.min(px, room)));
    node.style.setProperty('--tb-tracks', tracks(g));
    g.place();
  };
  let start: { x: number; width: number; t: number; way: number } | null = null;
  h.addEventListener('pointerdown', ev => {
    const [t, way] = target(grid(), i);
    start = { x: ev.clientX, width: laidOut(node)[t]!, t, way };
    h.setPointerCapture(ev.pointerId);
    h.classList.add('tb-dragging');
    ev.preventDefault();
  });
  h.addEventListener('pointermove', ev => {
    if (start === null || !h.hasPointerCapture(ev.pointerId)) return;
    resize(start.t, start.width + (ev.clientX - start.x) * start.way);
  });
  const end = (): void => {
    if (start === null) return;
    start = null;
    h.classList.remove('tb-dragging');
    save(grid());
  };
  h.addEventListener('pointerup', end);
  h.addEventListener('pointercancel', end);
  h.addEventListener('dblclick', () => {
    const g = grid();
    g.widths[target(g, i)[0]] = null;
    node.style.setProperty('--tb-tracks', tracks(g));
    g.place();
    save(g);
  });
  h.addEventListener('keydown', ev => {
    const by = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0;
    if (by === 0) return;
    ev.preventDefault();
    const [t, way] = target(grid(), i);
    resize(t, laidOut(node)[t]! + by * way * (ev.shiftKey ? 4 * STEP : STEP));
    save(grid());
  });
  return h;
}

/** Its children were built again, and the handles with them went: put them back. */
export function placeResize(node: HTMLElement): void {
  grids.get(node)?.place();
}
