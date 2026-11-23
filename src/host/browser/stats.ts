// --- a stat: a number that stands for something ------------------------------------------
// Its label, its number (which counts with `count`), the line under it (its hint) and its trend,
// drawn as a small line that ends on a dot. The role colours the number and the line.

import { K, type Cell } from '../../core/index.ts';
import { amountOf } from '../index.ts';
import { get, str, display, flag } from './faces.ts';
import { type Mounted, newId, el } from './mount.ts';
import { countRun } from './count.ts';

const SVG = 'http://www.w3.org/2000/svg';
/** The box the trend is drawn in; the page stretches it to the width of the stat. */
export const TREND_W = 100;
export const TREND_H = 32;

export function buildStat(m: Mounted): HTMLElement {
  const wrap = el('div', 'tb-stat');
  wrap.setAttribute('role', 'group');
  const label = el('span', 'tb-stat-label');
  label.id = `tb-${newId()}`;
  wrap.setAttribute('aria-labelledby', label.id);
  const num = el('span', 'tb-stat-value');
  const note = el('span', 'tb-stat-note');
  // the line is for the eye: the number and the line under it are what a screen reader reads
  const trend = el('div', 'tb-stat-trend');
  trend.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${TREND_W} ${TREND_H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const area = document.createElementNS(SVG, 'path');
  area.setAttribute('class', 'tb-stat-area');
  const line = document.createElementNS(SVG, 'path');
  line.setAttribute('class', 'tb-stat-line');
  svg.append(area, line);
  const plot = el('div', 'tb-stat-plot');
  plot.append(svg, el('span', 'tb-stat-dot'));
  trend.append(plot);
  wrap.append(label, num, note, trend);
  m.label = label;
  m.box = num;
  return wrap;
}

/** The numbers of a trend block, oldest first; what is no number is left out. */
export function trendNumbers(v: Cell): number[] {
  if (v.t !== K.Block) return [];
  return v.s.data.slice(v.i).map(amountOf).filter((n): n is number => n !== null && Number.isFinite(n));
}

/**
 * The line through the numbers and the area under it, in a box of TREND_W by TREND_H, and where the last point
 * is as fractions of the box (the dot is drawn by the page, so stretching the box never makes it an oval).
 * A flat trend is a line across the middle. Fewer than two numbers draw nothing.
 */
export function trendPath(ns: number[]): { line: string; area: string; last: { x: number; y: number } } | null {
  if (ns.length < 2) return null;
  const lo = Math.min(...ns);
  const hi = Math.max(...ns);
  const pad = 3;
  const y = (n: number): number => (hi === lo ? TREND_H / 2 : pad + (TREND_H - 2 * pad) * (1 - (n - lo) / (hi - lo)));
  const pts = ns.map((n, i) => [(i / (ns.length - 1)) * TREND_W, y(n)] as const);
  const r = (n: number): string => String(Math.round(n * 100) / 100);
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${r(px)} ${r(py)}`).join(' ');
  const area = `${line} L${TREND_W} ${TREND_H} L0 ${TREND_H} Z`;
  const [lx, ly] = pts[pts.length - 1]!;
  return { line, area, last: { x: lx / TREND_W, y: ly / TREND_H } };
}

export function syncStat(m: Mounted): void {
  const f = m.face;
  m.label!.textContent = str(f, 'text') ?? '';
  const v = get(f, 'value');
  const num = m.box!;
  const shown = v.t === K.None ? '' : display(v);
  // the number is as large as the width of the stat lets a number of its length be
  num.style.setProperty('--tb-stat-chars', String(Math.max(4, [...shown].length)));
  if (!(flag(f, 'count') && countRun(m, v, num))) num.textContent = shown;
  const note = m.el.querySelector<HTMLElement>(':scope > .tb-stat-note')!;
  const hint = str(f, 'hint');
  note.textContent = hint ?? '';
  note.hidden = hint === null;
  const trend = m.el.querySelector<HTMLElement>(':scope > .tb-stat-trend')!;
  const p = trendPath(trendNumbers(get(f, 'trend')));
  trend.hidden = p === null;
  if (p === null) return;
  const [area, line] = Array.from(trend.querySelectorAll('path'));
  area!.setAttribute('d', p.area);
  line!.setAttribute('d', p.line);
  const dot = trend.querySelector<HTMLElement>('.tb-stat-dot')!;
  dot.style.left = `${p.last.x * 100}%`;
  dot.style.top = `${p.last.y * 100}%`;
}
