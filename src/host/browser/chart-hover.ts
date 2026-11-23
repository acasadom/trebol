// --- the pointer on a chart's line ------------------------------------------------------------
// A line of more points than have room for a dot each has no dots to hover, so the pointer reads it: a rule
// down the plot at the nearest point, and a tip with its moment or label and the value of each series.

import type { ChartFrame, ChartSpec } from '../chart.ts';
import { nearest } from '../chart-time.ts';
import { el } from './mount.ts';

/** What the pointer reads: the frame the chart was drawn in, what it was drawn from, and at what width. */
export interface ChartHover { frame: ChartFrame; spec: ChartSpec; width: number }

interface HoverParts { plot: HTMLElement; svg: SVGSVGElement; tip: HTMLElement; rule: HTMLElement; hover: ChartHover | null; pointer: number | null }

/** Listen to the pointer over a chart's plot, once; it reads whatever the chart last drew. */
export function chartHover(p: HoverParts): void {
  p.plot.addEventListener('pointermove', e => {
    p.pointer = e.clientX;
    showTip(p, e.clientX);
  });
  p.plot.addEventListener('pointerleave', () => {
    p.pointer = null;
    hideTip(p);
  });
}

/** After the chart is drawn again, at a new width or with new rows, the tip follows the pointer still on it. */
export function retip(p: HoverParts): void {
  if (p.pointer === null) hideTip(p);
  else showTip(p, p.pointer);
}

export function hideTip(p: { tip: HTMLElement; rule: HTMLElement }): void {
  p.tip.hidden = true;
  p.rule.hidden = true;
}

function showTip(p: HoverParts, clientX: number): void {
  const h = p.hover;
  if (h === null) return hideTip(p);
  const box = p.svg.getBoundingClientRect();
  if (box.width === 0) return hideTip(p);
  // the drawing is as many units wide as the plot was pixels when drawn
  const x = ((clientX - box.left) / box.width) * h.width;
  const { frame, spec } = h;
  if (x < frame.left - 8 || x > frame.left + frame.plotW + 8) return hideTip(p);
  const i = nearest(frame.xs, x);
  if (i < 0) return hideTip(p);
  const k = box.width / h.width;
  const at = frame.xs[i]! * k;
  p.rule.hidden = false;
  p.rule.style.left = `${at}px`;
  p.rule.style.top = `${frame.top * k}px`;
  p.rule.style.height = `${frame.plotH * k}px`;
  const twoSides = spec.series.some(s => s.right) && spec.series.some(s => !s.right);
  const head = el('div', 'tb-chart-tip-head');
  head.textContent = spec.labels[i] ?? '';
  const lines = spec.series.map(s => {
    const line = el('div', 'tb-chart-tip-line');
    const swatch = el('span', 'tb-chart-swatch');
    swatch.style.setProperty('--tb-swatch', s.color);
    const v = s.values[i];
    const format = s.right && twoSides ? spec.rightFormat ?? spec.format : spec.format;
    line.append(swatch, `${s.name}: ${v === null || v === undefined ? '–' : format(v)}`);
    return line;
  });
  p.tip.replaceChildren(head, ...lines);
  p.tip.hidden = false;
  // beside the rule, on the side with room
  const w = p.tip.offsetWidth;
  const left = at + 12 + w > box.width ? at - 12 - w : at + 12;
  p.tip.style.left = `${Math.max(0, left)}px`;
  p.tip.style.top = `${frame.top * k}px`;
}
