// --- drawings and charts ---------------------------------------------------------------

import { K, money, decToNumber, decFromNumber, intern, type Cell } from '../../core/index.ts';
import { drawSvg, type El } from '../draw.ts';
import { rowField } from '../rows.ts';
import { chartSvg, SERIES_COLORS, pieColor, type ChartKind, type Series } from '../chart.ts';
import { get, str, own, display, flag, word } from './faces.ts';
import { type Mounted, el } from './mount.ts';
import { columns, cellText } from './tables.ts';
import { watchSize } from './sizes.ts';

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgNode(e: El): SVGElement {
  const n = document.createElementNS(SVG_NS, e.tag);
  for (const [k, v] of Object.entries(e.attrs)) n.setAttribute(k, v);
  if (e.text !== undefined) n.textContent = e.text;
  for (const k of e.kids) n.append(svgNode(k));
  return n;
}

/** A canvas: one SVG whose viewBox is the canvas's extent, as wide as it fits up to that. */
export function buildCanvas(m: Mounted): HTMLElement {
  const node = el('div', 'tb-canvas');
  const svg = document.createElementNS(SVG_NS, 'svg');
  node.append(svg);
  m.kids = svg;
  return node;
}

export function syncCanvas(m: Mounted): void {
  const svg = m.kids as SVGSVGElement;
  const ext = get(m.face, 'extent');
  const [w, h] = ext.t === K.Pair ? [ext.x, ext.y] : [300, 150];
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  // with a text, the drawing is a picture with that name; without, it is decoration
  const t = str(m.face, 'text');
  if (t !== null) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t);
    svg.removeAttribute('aria-hidden');
  } else {
    svg.removeAttribute('role');
    svg.removeAttribute('aria-label');
    svg.setAttribute('aria-hidden', 'true');
  }
  const { kids, error } = drawSvg(get(m.face, 'draw'));
  if (error !== null) console.warn(`Trebol: ${error}`);
  svg.replaceChildren(...kids.map(svgNode));
}

export interface ChartParts { caption: HTMLElement; plot: HTMLElement; svg: SVGSVGElement; legend: HTMLElement; table: HTMLTableElement; empty: HTMLElement; width: number }

export const CHART_HEIGHT: Record<string, number> = { small: 160, medium: 240, large: 360 };

/**
 * A chart: its text as a caption, the plot, a legend, and the same numbers as a
 * table that only a screen reader reads. It is drawn at the width it gets, and
 * again when that changes, so its text stays the size of the page's.
 */
export function buildChart(m: Mounted): HTMLElement {
  const node = el('figure', 'tb-chart');
  const caption = el('figcaption', 'tb-chart-caption');
  const plot = el('div', 'tb-chart-plot');
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  plot.append(svg);
  const legend = el('ul', 'tb-chart-legend');
  const table = el('table', 'tb-sr-only') as HTMLTableElement;
  const empty = el('p', 'tb-chart-empty');
  node.append(caption, plot, legend, empty, table);
  const parts: ChartParts = { caption, plot, svg, legend, table, empty, width: 0 };
  m.kids = parts;
  watchSize(plot, () => {
    if (plot.clientWidth !== parts.width) drawChart(m);
  });
  return node;
}

/** A cell of a chart as a number, or null. */
export function chartNumber(v: Cell): number | null {
  if (v.t === K.Integer) return Number(v.v);
  if (v.t === K.Decimal || v.t === K.Percent) return v.v;
  if (v.t === K.Money) return decToNumber(v.v);
  return null;
}

/** How a number of the chart shows: as the values it stands for, money as money and percent as percent. */
export function chartFormat(sample: Cell | null): (n: number) => string {
  return n => {
    if (sample !== null && sample.t === K.Money) {
      const d = decFromNumber(Math.round(n * 100) / 100);
      if (d !== null) return display(money(d, sample.cur));
    }
    if (sample !== null && sample.t === K.Percent) return display({ t: K.Percent, v: n });
    return display(Number.isInteger(n) ? { t: K.Integer, v: n } : { t: K.Decimal, v: n });
  };
}

export function syncChart(m: Mounted): void {
  const p = m.kids as ChartParts;
  const t = str(m.face, 'text');
  p.caption.textContent = t ?? '';
  p.caption.hidden = t === null;
  drawChart(m);
}

export function drawChart(m: Mounted): void {
  const f = m.face;
  const p = m.kids as ChartParts;
  const cols = columns(f);
  const data = get(f, 'data');
  const rows = data.t === K.Block ? data.s.data.slice(data.i) : [];
  const kind = (word(f, 'kind') ?? 'bar') as ChartKind;
  const labels = rows.map(r => cellText(rowField(r, cols[0]?.sym ?? intern('label'))));
  let sample: Cell | null = null;
  const series: Series[] = cols.slice(1).map((c, k) => ({
    name: c.label,
    color: SERIES_COLORS[k % SERIES_COLORS.length]!,
    values: rows.map(r => {
      const v = rowField(r, c.sym);
      const n = chartNumber(v);
      if (n !== null && sample === null) sample = v;
      return n;
    }),
  }));
  const format = chartFormat(sample);
  const nothing = rows.length === 0 || series.length === 0;
  p.empty.hidden = !nothing;
  p.plot.hidden = nothing;
  if (nothing) {
    p.empty.textContent = own('empty');
    p.legend.replaceChildren();
    p.table.replaceChildren();
    return;
  }
  const width = p.plot.clientWidth || 600;
  const height = CHART_HEIGHT[word(f, 'size') ?? 'medium'] ?? 240;
  p.width = p.plot.clientWidth;
  // no width of its own: it takes the plot's, so it never widens what holds it
  p.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  p.svg.replaceChildren(...chartSvg({ kind, labels, series, stacked: flag(f, 'stacked'), width, height, format }).map(svgNode));
  // the legend names the series, or a pie's slices
  const keys = kind === 'pie' ? labels.map((l, i) => [l, pieColor(i)] as const) : series.length > 1 ? series.map(s => [s.name, s.color] as const) : [];
  p.legend.replaceChildren(...keys.map(([name, color]) => {
    const li = el('li', 'tb-chart-key');
    const swatch = el('span', 'tb-chart-swatch');
    swatch.style.setProperty('--tb-swatch', color);
    li.append(swatch, name);
    return li;
  }));
  p.legend.hidden = keys.length === 0;
  // the same numbers for a screen reader
  const cap = el('caption');
  cap.textContent = str(f, 'text') ?? '';
  const head = el('tr');
  for (const c of cols) {
    const th = el('th');
    th.textContent = c.label;
    head.append(th);
  }
  const body = rows.map(r => {
    const tr = el('tr');
    for (const c of cols) {
      const td = el('td');
      td.textContent = cellText(rowField(r, c.sym));
      tr.append(td);
    }
    return tr;
  });
  p.table.replaceChildren(cap, el('thead'), el('tbody'));
  p.table.tHead!.append(head);
  p.table.tBodies[0]!.append(...body);
}

