// Charts: bar, line, area and pie, drawn as SVG at the width they are given.
//
//   chart bar income [month "Month" repairs "Repairs" parts "Parts"]
//
// The first column labels each point; the others are the series. When every
// label is a moment (a date!, or a text in ISO form) the points go on a time
// axis, at the distance in time between them; a series with right-axis has its
// own scale on the right; and a line of more points than fit gets no dots. The host
// reads the rows and the theme, and redraws when the width changes, so text
// stays the size of the rest of the page instead of scaling with the chart.
// Like draw.ts, this builds plain elements and knows nothing of the DOM.

import { svgEl, type El } from './draw.ts';
import { extent } from '../core/arrays.ts';
import { timeTicks, thinned } from './chart-time.ts';

export type ChartKind = 'bar' | 'line' | 'area' | 'pie';

export interface Series {
  name: string;
  /** One per label; null where a row has no number. */
  values: Array<number | null>;
  color: string;
  /** On its own scale, with its numbers on the right. */
  right?: boolean;
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
  /** The numbers of the series on the right, when they are of another kind than those on the left. */
  rightFormat?: (n: number) => string;
  /** On a time axis, the moment of each label in milliseconds, oldest first; the labels then say the moments. */
  times?: number[];
  /** The language the time axis speaks. */
  lang?: string;
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

/** Where an axis chart puts things: the plot's box, each point's place across, and the steps up each side. */
export interface ChartFrame {
  left: number; top: number; plotW: number; plotH: number;
  /** The place across of each point, in the order of the labels. */
  xs: number[];
  /** Too many points for a dot each: the line is drawn thinned, and the pointer reads the values instead. */
  dense: boolean;
}

/** A side of the chart: its series, where each starts and ends (stacked or not), its steps and its scale. */
interface Side { ks: number[]; steps: number[]; lo: number; hi: number; format: (n: number) => string }

/** The steps up the chart: about one for each 36 pixels of height, from two to five. */
function stepsFor(plotH: number): number {
  return Math.max(2, Math.min(5, Math.floor(plotH / 36)));
}

const TOP = FONT;
const BOTTOM = FONT * 2 + 4;

function sides(spec: ChartSpec, tops: number[][], bases: number[][]): { left: Side; right: Side | null } {
  const { series } = spec;
  const most = stepsFor(spec.height - TOP - BOTTOM);
  const anyLeft = series.some(s => !s.right);
  const side = (ks: number[], format: (n: number) => string): Side => {
    const all = ks.flatMap(k => tops[k]!.concat(bases[k]!)).concat([0]);
    const steps = ticks(...extent(all), all.every(Number.isInteger), most);
    return { ks, steps, lo: steps[0]!, hi: steps[steps.length - 1]!, format };
  };
  const ks = series.map((_, k) => k);
  const onRight = anyLeft ? ks.filter(k => series[k]!.right) : [];
  const left = side(ks.filter(k => !onRight.includes(k)), spec.format);
  const right = onRight.length > 0 ? side(onRight, spec.rightFormat ?? spec.format) : null;
  return { left, right };
}

/** Where each value of each series starts and ends: on zero, or on the ones below it when stacked on its side. */
function stacks(spec: ChartSpec): { tops: number[][]; bases: number[][] } {
  const { series } = spec;
  const n = spec.labels.length;
  const stack = spec.stacked && spec.kind !== 'line';
  const tops: number[][] = series.map(() => []);
  const bases: number[][] = series.map(() => []);
  for (let i = 0; i < n; i++) {
    const up = [0, 0];
    const down = [0, 0];
    series.forEach((s, k) => {
      const v = s.values[i] ?? 0;
      const at = s.right ? 1 : 0;
      const base = stack ? (v >= 0 ? up[at]! : down[at]!) : 0;
      bases[k]![i] = base;
      tops[k]![i] = base + v;
      if (stack) v >= 0 ? (up[at]! += v) : (down[at]! += v);
    });
  }
  return { tops, bases };
}

function labelWidth(texts: string[]): number {
  return extent(texts.map(t => t.length))[1] * FONT * 0.6;
}

/** The frame of an axis chart: the same one the drawing uses, for a pointer to find the points by. */
export function chartFrame(spec: ChartSpec): ChartFrame {
  const { tops, bases } = stacks(spec);
  return frameOf(spec, sides(spec, tops, bases));
}

function frameOf(spec: ChartSpec, s: { left: Side; right: Side | null }): ChartFrame {
  const { width, height, times } = spec;
  const n = spec.labels.length;
  const left = labelWidth(s.left.steps.map(s.left.format)) + 8;
  const right = s.right === null ? 8 : labelWidth(s.right.steps.map(s.right.format)) + 8;
  const plotW = Math.max(1, width - left - right);
  const plotH = Math.max(1, height - TOP - BOTTOM);
  let xs: number[];
  if (times && times.length === n && n > 0) {
    const t0 = times[0]!;
    const t1 = times[n - 1]!;
    // bars need half a bar of room at each end; points go to the edges
    let gap = Infinity;
    for (let i = 1; i < n; i++) if (times[i]! > times[i - 1]!) gap = Math.min(gap, times[i]! - times[i - 1]!);
    const pad = spec.kind === 'bar' ? (Number.isFinite(gap) ? gap / 2 : 1) : 0;
    const a = t0 - pad;
    const b = t1 + pad;
    xs = times.map(t => (b > a ? left + ((t - a) / (b - a)) * plotW : left + plotW / 2));
  } else {
    const band = plotW / Math.max(1, n);
    xs = Array.from({ length: n }, (_, i) => left + band * (i + 0.5));
  }
  const dense = spec.kind !== 'bar' && n > plotW / 6;
  return { left, top: TOP, plotW, plotH, xs, dense };
}

function axes(spec: ChartSpec): El[] {
  const { labels, series, times } = spec;
  const n = labels.length;
  const stack = spec.stacked && spec.kind !== 'line';
  const { tops, bases } = stacks(spec);
  const s = sides(spec, tops, bases);
  const f = frameOf(spec, s);
  const { left, top, plotW, plotH, xs, dense } = f;
  const scale = (side: Side) => (v: number) => top + plotH - ((v - side.lo) / (side.hi - side.lo)) * plotH;
  const yLeft = scale(s.left);
  const yRight = s.right === null ? yLeft : scale(s.right);
  const yOf = (k: number) => (series[k]!.right && s.right !== null ? yRight : yLeft);
  const out: El[] = [];
  // with two sides, each side's numbers take the color of its series when it has only one
  const ink = (side: Side) => (s.right !== null && side.ks.length === 1 ? series[side.ks[0]!]!.color : LABEL.fill);
  for (const t of s.left.steps) {
    out.push(svgEl('line', { x1: left, x2: left + plotW, y1: yLeft(t), y2: yLeft(t), stroke: 'var(--tb-border)', 'stroke-width': t === 0 ? 1.5 : 1 }));
    out.push(svgEl('text', { ...LABEL, fill: ink(s.left), x: left - 6, y: yLeft(t), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, [], s.left.format(t)));
  }
  if (s.right !== null) {
    for (const t of s.right.steps) {
      out.push(svgEl('text', { ...LABEL, fill: ink(s.right), x: left + plotW + 6, y: yRight(t), 'text-anchor': 'start', 'dominant-baseline': 'middle' }, [], s.right.format(t)));
    }
  }
  const below = top + plotH + FONT + 4;
  if (times && times.length === n) {
    // a time axis: round steps of the calendar, placed where they fall
    const t0 = times[0]!;
    const t1 = times[n - 1]!;
    const at = (ms: number) => (n > 1 && t1 > t0 ? xs[0]! + ((ms - t0) / (t1 - t0)) * (xs[n - 1]! - xs[0]!) : xs[0]!);
    for (const t of timeTicks(t0, t1, plotW, spec.lang ?? 'en', FONT * 0.6)) {
      const x = at(t.ms);
      out.push(svgEl('line', { x1: x, x2: x, y1: top + plotH, y2: top + plotH + 4, stroke: 'var(--tb-border)', 'stroke-width': 1 }));
      out.push(svgEl('text', { ...LABEL, x, y: below, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, [], t.text));
    }
  } else {
    // as many labels as fit, evenly spread
    const room = Math.max(1, Math.floor(plotW / (Math.max(0, extent(labels.map(l => l.length))[1]) * FONT * 0.6 + 12)));
    const every = Math.ceil(n / room);
    labels.forEach((l, i) => {
      if (i % every === 0) out.push(svgEl('text', { ...LABEL, x: xs[i]!, y: below, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, [], l));
    });
  }
  const formatOf = (k: number) => (series[k]!.right && s.right !== null ? s.right.format : s.left.format);
  const tip = (i: number, k: number) => svgEl('title', {}, [], `${labels[i]}, ${series[k]!.name}: ${series[k]!.values[i] === null ? '' : formatOf(k)(series[k]!.values[i]!)}`);
  if (spec.kind === 'bar') {
    // the room of a bar: its share of the width, or on a time axis the nearest two points' distance
    let band = plotW / Math.max(1, n);
    if (times && n > 1) for (let i = 1; i < n; i++) if (xs[i]! > xs[i - 1]!) band = Math.min(band, xs[i]! - xs[i - 1]!);
    const groups = stack ? (s.right === null ? 1 : 2) : series.length;
    const inner = band * 0.7;
    const w = inner / groups;
    series.forEach((ser, k) => {
      const slot = stack ? (ser.right && s.right !== null ? 1 : 0) : k;
      const y = yOf(k);
      for (let i = 0; i < n; i++) {
        if (ser.values[i] === null) continue;
        const x0 = xs[i]! - inner / 2 + w * slot;
        const a = y(Math.max(bases[k]![i]!, tops[k]![i]!));
        const b = y(Math.min(bases[k]![i]!, tops[k]![i]!));
        out.push(svgEl('rect', { x: x0 + (w > 3 ? 1 : 0), y: a, width: Math.max(1, w - (w > 3 ? 2 : 0)), height: Math.max(0, b - a), fill: ser.color, rx: w > 6 ? 2 : 0 }, [tip(i, k)]));
      }
    });
    return out;
  }
  // line and area: the area first, so the lines go over every one of them
  const marks: El[] = [];
  series.forEach((ser, k) => {
    const y = yOf(k);
    const tk = tops[k]!;
    const keep = dense ? thinned(xs, tk.map((v, i) => (ser.values[i] === null ? null : v))) : xs.map((_, i) => i).filter(i => ser.values[i] !== null);
    const pts = keep.map(i => `${r1(xs[i]!)},${r1(y(tk[i]!))}`);
    if (spec.kind === 'area') {
      const under = keep.slice().reverse().map(i => `${r1(xs[i]!)},${r1(y(bases[k]![i]!))}`);
      out.push(svgEl('polygon', { points: [...pts, ...under].join(' '), fill: ser.color, 'fill-opacity': 0.18, stroke: 'none' }));
    }
    marks.push(svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: ser.color, 'stroke-width': dense ? 1.5 : 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    if (dense) return;
    for (const i of keep) {
      marks.push(svgEl('circle', { cx: xs[i]!, cy: y(tk[i]!), r: 3.5, fill: ser.color, stroke: 'var(--tb-surface)', 'stroke-width': 1.5 }, [tip(i, k)]));
    }
  });
  return out.concat(marks);
}

/** A place to a tenth of a pixel, so a long line is not written with seventeen digits a point. */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
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
