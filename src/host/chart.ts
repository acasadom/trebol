// Charts: bar, line, area and pie, drawn as SVG at the width they are given.
//
//   chart bar income [month "Month" repairs "Repairs" parts "Parts"]
//
// The first column labels each point; the others are the series. The host
// reads the rows and the theme, and redraws when the width changes, so text
// stays the size of the rest of the page instead of scaling with the chart.
// Like draw.ts, this builds plain elements and knows nothing of the DOM.

import { svgEl, type El } from './draw.ts';
import { extent } from '../core/arrays.ts';

export type ChartKind = 'bar' | 'line' | 'area' | 'pie';

export interface Series {
  name: string;
  /** One per label; null where a row has no number. */
  values: Array<number | null>;
  color: string;
}

export interface ChartSpec {
  kind: ChartKind;
  labels: string[];
  series: Series[];
  stacked: boolean;
  width: number;
  height: number;
  /** A number as it shows on screen: as the values it stands for (money, percent) in the active language. */
  format: (n: number) => string;
}

/** The colors series take in turn: the theme's own two, then Red's color words. */
export const SERIES_COLORS = [
  'var(--tb-primary)', 'var(--tb-accent)', 'var(--tb-c-teal)', 'var(--tb-c-orange)',
  'var(--tb-c-purple)', 'var(--tb-c-green)', 'var(--tb-c-pink)', 'var(--tb-c-gold)',
];

const FONT = 12;
const LABEL = { fill: 'var(--tb-muted)', 'font-size': FONT, 'font-family': 'var(--tb-font)' };

/** The elements of a chart, to go in an SVG of spec.width by spec.height. */
export function chartSvg(spec: ChartSpec): El[] {
  if (spec.labels.length === 0 || spec.series.length === 0) return [];
  return spec.kind === 'pie' ? pie(spec) : axes(spec);
}

/** Round steps for an axis from lo to hi: 0, 250, 500...; whole numbers only, when the values are. */
export function ticks(lo: number, hi: number, whole = false, most = 5): number[] {
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / most;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(whole ? 1 : 0, [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw && (!whole || Number.isInteger(s)))!);
  const out: number[] = [];
  // each step from its count, cut to 12 digits, so 0.6 is not 0.6000000000000001
  for (let k = Math.floor(lo / step); k * step <= hi + step * 1e-9; k++) out.push(Number((k * step).toPrecision(12)));
  if (out[out.length - 1]! < hi) out.push(out[out.length - 1]! + step);
  return out;
}

function axes(spec: ChartSpec): El[] {
  const { labels, series, width, height, stacked, format } = spec;
  const n = labels.length;
  const stack = stacked && spec.kind !== 'line';
  // the top of each point: its own value, or the sum below it when stacked
  const tops: number[][] = series.map(() => []);
  const bases: number[][] = series.map(() => []);
  for (let i = 0; i < n; i++) {
    let up = 0;
    let down = 0;
    series.forEach((s, k) => {
      const v = s.values[i] ?? 0;
      const base = stack ? (v >= 0 ? up : down) : 0;
      bases[k]![i] = base;
      tops[k]![i] = base + v;
      if (stack) v >= 0 ? (up += v) : (down += v);
    });
  }
  const all = tops.flat().concat(bases.flat(), [0]);
  const steps = ticks(...extent(all), all.every(Number.isInteger));
  const lo = steps[0]!;
  const hi = steps[steps.length - 1]!;
  const left = extent(steps.map(t => format(t).length))[1] * FONT * 0.6 + 8;
  const right = 8;
  const top = FONT;
  const bottom = FONT * 2 + 4;
  const plotW = Math.max(1, width - left - right);
  const plotH = Math.max(1, height - top - bottom);
  const y = (v: number) => top + plotH - ((v - lo) / (hi - lo)) * plotH;
  const out: El[] = [];
  for (const t of steps) {
    out.push(svgEl('line', { x1: left, x2: left + plotW, y1: y(t), y2: y(t), stroke: 'var(--tb-border)', 'stroke-width': t === 0 ? 1.5 : 1 }));
    out.push(svgEl('text', { ...LABEL, x: left - 6, y: y(t), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, [], format(t)));
  }
  // each label gets a band; bars sit inside it, points in its middle
  const band = plotW / n;
  const x = (i: number) => left + band * (i + 0.5);
  // as many labels as fit, evenly spread
  const room = Math.max(1, Math.floor(plotW / (Math.max(0, extent(labels.map(l => l.length))[1]) * FONT * 0.6 + 12)));
  const every = Math.ceil(n / room);
  labels.forEach((l, i) => {
    if (i % every === 0) out.push(svgEl('text', { ...LABEL, x: x(i), y: top + plotH + FONT + 4, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, [], l));
  });
  const tip = (i: number, s: Series) => svgEl('title', {}, [], `${labels[i]}, ${s.name}: ${s.values[i] === null ? '' : format(s.values[i]!)}`);
  if (spec.kind === 'bar') {
    const groups = stack ? 1 : series.length;
    const inner = band * 0.7;
    const w = inner / groups;
    series.forEach((s, k) => {
      for (let i = 0; i < n; i++) {
        if (s.values[i] === null) continue;
        const x0 = left + band * i + (band - inner) / 2 + (stack ? 0 : w * k);
        const a = y(Math.max(bases[k]![i]!, tops[k]![i]!));
        const b = y(Math.min(bases[k]![i]!, tops[k]![i]!));
        out.push(svgEl('rect', { x: x0 + 1, y: a, width: Math.max(1, w - 2), height: Math.max(0, b - a), fill: s.color, rx: 2 }, [tip(i, s)]));
      }
    });
    return out;
  }
  // line and area: the area first, so the lines go over every one of them
  const marks: El[] = [];
  series.forEach((s, k) => {
    const pts: string[] = [];
    for (let i = 0; i < n; i++) if (s.values[i] !== null) pts.push(`${x(i)},${y(tops[k]![i]!)}`);
    if (spec.kind === 'area') {
      const under: string[] = [];
      for (let i = n - 1; i >= 0; i--) if (s.values[i] !== null) under.push(`${x(i)},${y(bases[k]![i]!)}`);
      out.push(svgEl('polygon', { points: [...pts, ...under].join(' '), fill: s.color, 'fill-opacity': 0.18, stroke: 'none' }));
    }
    marks.push(svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    for (let i = 0; i < n; i++) {
      if (s.values[i] === null) continue;
      marks.push(svgEl('circle', { cx: x(i), cy: y(tops[k]![i]!), r: 3.5, fill: s.color, stroke: 'var(--tb-surface)', 'stroke-width': 1.5 }, [tip(i, s)]));
    }
  });
  return out.concat(marks);
}

/** A pie of the first series: one slice per label, the ones with nothing to show left out. */
function pie(spec: ChartSpec): El[] {
  const s = spec.series[0]!;
  const vals = s.values.map(v => (v === null || v < 0 ? 0 : v));
  const total = vals.reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  const r = Math.max(1, Math.min(spec.width, spec.height) / 2 - 4);
  const cx = spec.width / 2;
  const cy = spec.height / 2;
  const out: El[] = [];
  let at = -90;
  vals.forEach((v, i) => {
    if (v === 0) return;
    const sweep = (v / total) * 360;
    const tip = svgEl('title', {}, [], `${spec.labels[i]}: ${spec.format(v)} (${Math.round((v / total) * 100)}%)`);
    const paint = { fill: pieColor(i), stroke: 'var(--tb-surface)', 'stroke-width': 2 };
    if (sweep >= 359.999) {
      out.push(svgEl('circle', { cx, cy, r, ...paint }, [tip]));
    } else {
      const p = (deg: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)] as const;
      const [x0, y0] = p(at);
      const [x1, y1] = p(at + sweep);
      const d = `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x1},${y1} Z`;
      out.push(svgEl('path', { d, ...paint }, [tip]));
    }
    at += sweep;
  });
  return out;
}

/** The color of slice i of a pie: each label its own. */
export function pieColor(i: number): string {
  return SERIES_COLORS[i % SERIES_COLORS.length]!;
}
