// An orbit: one node of a graph in the centre and its neighbours on rings around it.
//
//   orbit "Organization" [
//       focus pleno
//       nodes [pleno "Pleno municipal" [primary count 9]  marta "Marta Ibáñez" [accent]]
//       edges [pleno marta "Members"  marta pleno "Holder" [dashed]]
//       trail [ayuntamiento organos]
//   ]
//
// The person moves through the graph one node at a time; the app gives the
// node in the centre and what is around it each time. This module reads the
// block, places the nodes and builds each bubble as plain elements in unit
// space (radius 1), scaled by its radius; the browser host animates them.

import { K, I64, spell, text, type Cell, type BlockCell, type WordCell, type StringCell } from '../core/index.ts';
import { svgEl, drawColor, type El } from './draw.ts';

export type EdgeLook = 'solid' | 'dashed' | 'faint';

export interface OrbitNode {
  key: string;
  /** The id as the app gave it: what face/value is when the person picks it. */
  id: Cell;
  /** A string, or a text per language. */
  title: Cell;
  color: string;
  /** How many it holds: small moons around it and a number under its title. */
  count: number | null;
  /** It stands for many: a second ring. */
  many: boolean;
  /** A shortcut or link: a dashed border. */
  dashed: boolean;
  /** A ring of steps around it, the one at `at` the current one (1-based); 0 for none. */
  steps: number;
  at: number;
}

export interface OrbitEdge {
  from: string;
  to: string;
  label: Cell | null;
  look: EdgeLook;
}

export interface OrbitSpec {
  focus: string | null;
  nodes: Map<string, OrbitNode>;
  edges: OrbitEdge[];
  /** The nodes the person came from, most recent last. */
  trail: string[];
}

const HINT_WORDS = ['many', 'dashed', 'count', 'steps', 'at'];
const EDGE_LOOKS: readonly string[] = ['solid', 'dashed', 'faint'];

/** What tells nodes apart: an id is a word, an integer, a string or an issue. */
export function idKey(c: Cell): string | null {
  switch (c.t) {
    case K.Word: case K.LitWord: return `w:${spell((c as WordCell).sym)}`;
    case K.Integer: return `i:${I64.toString(c.v)}`;
    case K.String: return `s:${text(c as StringCell)}`;
    case K.Issue: return `#:${spell((c as WordCell).sym)}`;
    default: return null;
  }
}

const isText = (c: Cell | undefined): boolean => c !== undefined && (c.t === K.String || c.t === K.Map);
const wordOf = (c: Cell | undefined): string | null => (c !== undefined && c.t === K.Word ? spell((c as WordCell).sym) : null);
const intOf = (c: Cell | undefined): number | null => (c !== undefined && c.t === K.Integer ? I64.toNumber(c.v) : null);
const cellsOf = (b: BlockCell): Cell[] => b.s.data.slice(b.i);

class OrbitError extends Error {}

/** The orbit a block describes, and what was wrong with it; what is wrong is left out. */
export function readOrbit(data: Cell): { spec: OrbitSpec; error: string | null } {
  const spec: OrbitSpec = { focus: null, nodes: new Map(), edges: [], trail: [] };
  if (data.t !== K.Block) return { spec, error: data.t === K.None ? null : 'orbit: an orbit takes a block' };
  try {
    const d = cellsOf(data as BlockCell);
    for (let i = 0; i < d.length; i++) {
      const w = wordOf(d[i]);
      const arg = d[++i];
      if (w === 'focus') {
        const k = arg === undefined ? null : idKey(arg);
        if (k === null) throw new OrbitError('focus takes the id of a node');
        spec.focus = k;
      } else if (w === 'nodes' && arg?.t === K.Block) readNodes(cellsOf(arg as BlockCell), spec);
      else if (w === 'edges' && arg?.t === K.Block) readEdges(cellsOf(arg as BlockCell), spec);
      else if (w === 'trail' && arg?.t === K.Block) {
        for (const c of cellsOf(arg as BlockCell)) {
          const k = idKey(c);
          if (k === null) throw new OrbitError('trail takes the ids of nodes');
          spec.trail.push(k);
        }
      } else throw new OrbitError('an orbit takes focus id, nodes [...], edges [...] and trail [...]');
    }
    return { spec, error: null };
  } catch (e) {
    if (e instanceof OrbitError) return { spec, error: `orbit: ${e.message}` };
    throw e;
  }
}

function readNodes(d: Cell[], spec: OrbitSpec): void {
  for (let i = 0; i < d.length; i++) {
    const id = d[i]!;
    const key = idKey(id);
    if (key === null || !isText(d[i + 1])) throw new OrbitError('nodes takes an id and a title for each, then a block of hints if it has any');
    const node: OrbitNode = { key, id, title: d[++i]!, color: 'var(--tb-primary)', count: null, many: false, dashed: false, steps: 0, at: 0 };
    if (d[i + 1]?.t === K.Block) readHints(cellsOf(d[++i] as BlockCell), node);
    spec.nodes.set(key, node);
  }
}

function readHints(h: Cell[], node: OrbitNode): void {
  for (let i = 0; i < h.length; i++) {
    const w = wordOf(h[i]);
    if (w === 'many') node.many = true;
    else if (w === 'dashed') node.dashed = true;
    else if (w === 'count') {
      const n = intOf(h[++i]);
      if (n === null) throw new OrbitError('count takes an integer');
      node.count = n;
    } else if (w === 'steps') {
      const n = intOf(h[++i]);
      const at = wordOf(h[i + 1]) === 'at' ? intOf(h[i += 2]) : 0;
      if (n === null || n < 1 || at === null) throw new OrbitError('steps takes how many, then at and the current one: steps 5 at 2');
      node.steps = n;
      node.at = Math.max(0, Math.min(n, at));
    } else {
      const c = w === null || HINT_WORDS.includes(w) ? undefined : drawColor(w);
      if (c === undefined || c === null) throw new OrbitError(`a node's hints are a role or color, many, dashed, count n and steps n at k, not ${w ?? 'that'}`);
      node.color = c;
    }
  }
}

function readEdges(d: Cell[], spec: OrbitSpec): void {
  for (let i = 0; i < d.length; i++) {
    const from = idKey(d[i]!);
    const to = d[i + 1] === undefined ? null : idKey(d[++i]!);
    if (from === null || to === null) throw new OrbitError('edges takes two ids for each, then a label and a block with solid, dashed or faint if it has them');
    const label = isText(d[i + 1]) ? d[++i]! : null;
    let look: EdgeLook = 'solid';
    if (d[i + 1]?.t === K.Block) {
      const b = cellsOf(d[++i] as BlockCell);
      const w = wordOf(b[0]);
      if (b.length !== 1 || w === null || !EDGE_LOOKS.includes(w)) throw new OrbitError('an edge looks solid, dashed or faint');
      look = w as EdgeLook;
    }
    spec.edges.push({ from, to, label, look });
  }
}

// --- where things go ----------------------------------------------------------------------

export type Role = 'focus' | 'near' | 'more' | 'trail';

/** Where a bubble is, in the orbit's own space with the focus at 0,0: its centre, radius and opacity. */
export interface Place { x: number; y: number; r: number; o: number }

export interface Placed extends Place { key: string; role: Role }

export const FOCUS_R = 92;
/** Neighbours on show at once; past that, a "+N more" bubble pages through them. */
export const PAGE = 30;
/** Past this many neighbours, edge labels show only on hover. */
export const MANY = 18;
const TRAIL_SHOWN = 4;
/** The key of the "+N more" bubble: no id gives it. */
export const MORE = '\u0000more';

export interface Box { x0: number; y0: number; x1: number; y1: number }

export interface OrbitLayout {
  placed: Placed[];
  /** The box everything drawn fits in, titles too: the camera fits it. */
  box: Box;
  /** The neighbours not on this page; 0 when they all fit. */
  left: number;
  pages: number;
}

/** The neighbours of the focus: every node given that is neither it nor in the trail, in the order given. */
export function neighbours(spec: OrbitSpec): string[] {
  const back = new Set(spec.trail);
  return [...spec.nodes.keys()].filter(k => k !== spec.focus && !back.has(k));
}

/** Places the focus, its neighbours on rings (the given page of them) and the last few of the trail. */
export function layoutOrbit(spec: OrbitSpec, page = 0): OrbitLayout {
  const placed: Placed[] = [];
  if (spec.focus === null) return { placed, box: { x0: -FOCUS_R, y0: -FOCUS_R, x1: FOCUS_R, y1: FOCUS_R }, left: 0, pages: 1 };
  placed.push({ key: spec.focus, role: 'focus', x: 0, y: 0, r: FOCUS_R, o: 1 });
  let near = neighbours(spec);
  const pages = Math.max(1, Math.ceil(near.length / PAGE));
  let left = 0;
  if (near.length > PAGE) {
    const start = (page % pages) * PAGE;
    left = near.length - Math.min(near.length, start + PAGE);
    near = near.slice(start, start + PAGE);
  }
  const count = near.length + (pages > 1 ? 1 : 0);
  // fewer neighbours, bigger bubbles
  const r = Math.max(24, Math.min(62, 66 - count * 1.6));
  const slots: Array<{ x: number; y: number }> = [];
  let R = FOCUS_R + r + 120;
  let outer = FOCUS_R;
  for (let i = 0, ring = 0; i < count; ring++) {
    const fits = Math.max(6, Math.floor((2 * Math.PI * R) / (2 * r + 30)));
    const here = Math.min(fits, count - i);
    for (let k = 0; k < here; k++) {
      // every other ring turns half a step, so bubbles do not line up behind each other
      const a = -Math.PI / 2 + (2 * Math.PI * k) / here + (ring % 2 === 1 ? Math.PI / here : 0);
      slots.push({ x: Math.cos(a) * R, y: Math.sin(a) * R });
    }
    i += here;
    outer = R + r;
    R += 2 * r + 46;
  }
  near.forEach((key, j) => placed.push({ key, role: 'near', ...slots[j]!, r, o: 1 }));
  if (pages > 1) placed.push({ key: MORE, role: 'more', ...slots[near.length]!, r, o: 1 });
  // the trail goes up and to the left, the most recent nearest, each smaller and fainter
  const back = spec.trail.filter(k => k !== spec.focus && spec.nodes.has(k)).slice(-TRAIL_SHOWN).reverse();
  const dir = -Math.PI * 0.9;
  const base = outer + 150;
  back.forEach((key, j) => {
    const d = base + j * 120;
    placed.push({ key, role: 'trail', x: Math.cos(dir) * d, y: Math.sin(dir) * d, r: 46 - j * 7, o: 0.8 - j * 0.17 });
  });
  // the camera fits every bubble, with room for the titles beside the small ones
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const p of placed) {
    const w = p.r * 1.5 + 40;
    const h = p.r * 1.5 + 24;
    box.x0 = Math.min(box.x0, p.x - w);
    box.x1 = Math.max(box.x1, p.x + w);
    box.y0 = Math.min(box.y0, p.y - h);
    box.y1 = Math.max(box.y1, p.y + h);
  }
  return { placed, box, left, pages };
}

/** The edges to draw between bubbles on show: those given between the focus and its neighbours, and the trail's dotted line. */
export function shownEdges(spec: OrbitSpec, placed: Placed[]): Array<OrbitEdge & { curve: number; trail: boolean }> {
  const role = new Map(placed.map(p => [p.key, p.role]));
  const out: Array<OrbitEdge & { curve: number; trail: boolean }> = [];
  const seen = new Set<string>();
  for (const e of spec.edges) {
    const a = role.get(e.from);
    const b = role.get(e.to);
    if ((a !== 'focus' && a !== 'near') || (b !== 'focus' && b !== 'near') || e.from === e.to) continue;
    // one line per pair: the first edge given between them says how it looks
    const pair = [e.from, e.to].sort().join('\u0001');
    if (seen.has(pair)) continue;
    seen.add(pair);
    // between two neighbours the line bends outwards, so it does not cross the focus
    out.push({ ...e, curve: a === 'near' && b === 'near' ? 0.35 : 0, trail: false });
  }
  if (role.has(MORE)) out.push({ from: spec.focus!, to: MORE, label: null, look: 'faint', curve: 0, trail: false });
  let prev = spec.focus!;
  for (const p of placed) {
    if (p.role !== 'trail') continue;
    out.push({ from: prev, to: p.key, label: null, look: 'faint', curve: 0, trail: true });
    prev = p.key;
  }
  return out;
}

/** The label of the edge between the focus and a neighbour, either way round; null if none. */
export function edgeLabel(spec: OrbitSpec, key: string): Cell | null {
  for (const e of spec.edges) {
    if (e.label !== null && ((e.from === spec.focus && e.to === key) || (e.to === spec.focus && e.from === key))) return e.label;
  }
  return null;
}

// --- a bubble ---------------------------------------------------------------------------------

/** A title in lines of at most `max` characters, three lines at most. */
export function wrapTitle(title: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of title.split(/\s+/).filter(w => w !== '')) {
    if (line !== '' && [...`${line} ${w}`].length > max) {
      lines.push(line);
      line = w;
    } else line = line === '' ? w : `${line} ${w}`;
  }
  if (line !== '') lines.push(line);
  if (lines.length > 3) {
    lines.length = 3;
    lines[2] = `${[...lines[2]!].slice(0, Math.max(1, max - 1)).join('')}…`;
  }
  return lines;
}

/** An arc of a circle of radius r from angle a0 to a1, as path data. */
export function arcPath(r: number, a0: number, a1: number): string {
  const p = (a: number): string => `${round(Math.cos(a) * r)},${round(Math.sin(a) * r)}`;
  return `M${p(a0)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`;
}

const round = (n: number): string => String(Math.round(n * 1000) / 1000);

export interface BubbleLook {
  role: Role;
  r: number;
  /** The camera's zoom once it fits: titles are sized for the screen at it, as the rest of the page's text. */
  scale: number;
  /** A title outside the bubble goes above it rather than under it: for bubbles above the focus, away from their edge. */
  above: boolean;
  title: string;
  color: string;
  /** The ids of the gradients for this color: body and halo. */
  body: string;
  halo: string;
  node: OrbitNode | null;
}

/** What a bubble draws, in unit space: halo, body, its rings, moons, title and count. */
export function bubble(b: BubbleLook): El[] {
  const n = b.node;
  const c = b.color;
  const focus = b.role === 'focus';
  const out: El[] = [
    svgEl('circle', { class: 'tb-orbit-halo', r: 1.45, fill: `url(#${b.halo})` }),
    svgEl('circle', {
      class: 'tb-orbit-body', r: 1, fill: `url(#${b.body})`, stroke: c, 'stroke-width': focus ? 2 : 1.4,
      ...(n?.dashed === true ? { 'stroke-dasharray': '4 4' } : {}),
      ...(b.role === 'trail' ? { 'stroke-opacity': 0.6 } : {}),
    }),
  ];
  // a node that stands for many wears a second ring
  if (n?.many === true) out.push(svgEl('circle', { class: 'tb-orbit-line', r: 1.09, stroke: c, 'stroke-opacity': 0.55 }));
  // steps: those done filled, the current one thicker and pulsing, those to come faint
  if (n !== null && n.steps > 0) {
    const gap = n.steps > 1 ? 0.09 : 0;
    for (let j = 0; j < n.steps; j++) {
      const a0 = -Math.PI / 2 + (2 * Math.PI * j) / n.steps + gap / 2;
      const a1 = a0 + (2 * Math.PI) / n.steps - gap;
      const now = j + 1 === n.at;
      out.push(svgEl('path', {
        class: now ? 'tb-orbit-step tb-orbit-now' : 'tb-orbit-step', d: arcPath(1.16, a0, n.steps > 1 ? a1 : a0 + 2 * Math.PI - 0.001), stroke: c,
        'stroke-opacity': j + 1 < n.at ? 0.9 : now ? 1 : 0.18, 'stroke-width': now ? 4 : 3,
      }));
    }
  }
  // moons: one per thing it holds, up to 14, turning slowly
  const count = n?.count ?? 0;
  if (count > 0 && !focus && b.role !== 'more') {
    const k = Math.min(count, 14);
    const moons: El[] = [];
    for (let j = 0; j < k; j++) {
      const a = (2 * Math.PI * j) / k;
      moons.push(svgEl('circle', { cx: Math.cos(a) * 1.24, cy: Math.sin(a) * 1.24, r: 0.05, fill: c, 'fill-opacity': 0.8 }));
    }
    out.push(svgEl('g', { class: 'tb-orbit-spin tb-orbit-fast' }, moons));
  }
  // titles inside big bubbles, under small ones, never smaller on screen than the page's small text
  const px = 1 / (b.r * b.scale);
  const inside = focus || (b.r >= 44 && 12 * px <= 0.26);
  const fs = focus ? Math.max(0.2, 14 * px) : inside ? Math.max(0.24, 12 * px) : 12.5 * px;
  const lines = wrapTitle(b.title, focus ? Math.max(8, Math.floor(3.2 / fs)) : inside ? 13 : 18);
  const top = inside ? -((lines.length - 1) * fs * 1.15) / 2 : b.above ? -1.34 - fs * 0.6 - (lines.length - 1) * fs * 1.15 : 1.34 + fs * 0.6;
  out.push(svgEl('text', { class: 'tb-orbit-title', 'font-size': fs, 'font-weight': focus ? 600 : 500 },
    lines.map((l, j) => svgEl('tspan', { x: 0, y: top + j * fs * 1.15 }, [], l))));
  if (count > 0 && inside) {
    const y = focus ? top - fs * 1.2 : top + (lines.length - 1) * fs * 1.15 + 0.3;
    out.push(svgEl('text', { class: 'tb-orbit-count', 'font-size': focus ? Math.max(0.12, 10 * px) : Math.max(0.16, 10 * px), y }, [], String(count)));
  }
  // the focus has two rings turning slowly, one each way
  if (focus) {
    out.push(svgEl('g', { class: 'tb-orbit-spin' }, [svgEl('circle', { class: 'tb-orbit-line', r: 1.24, stroke: c, 'stroke-opacity': 0.35, 'stroke-dasharray': '2 10' })]));
    out.push(svgEl('g', { class: 'tb-orbit-spin tb-orbit-rev' }, [svgEl('circle', { class: 'tb-orbit-line', r: 1.42, stroke: c, 'stroke-opacity': 0.18, 'stroke-dasharray': '40 14 4 14' })]));
  }
  return out;
}

/** The two gradients of a color: a body lighter in the middle and a soft halo. */
export function gradients(color: string, body: string, halo: string): El[] {
  const stop = (offset: string, opacity: number): El => svgEl('stop', { offset, 'stop-color': color, 'stop-opacity': opacity });
  return [
    svgEl('radialGradient', { id: body, cx: '50%', cy: '40%', r: '60%' }, [stop('0%', 0.05), stop('75%', 0.16), stop('100%', 0.38)]),
    svgEl('radialGradient', { id: halo }, [stop('55%', 0), stop('72%', 0.22), stop('100%', 0)]),
  ];
}

/** Where an edge's line goes, from bubble a to bubble b, cut at their borders; and the middle and angle for its label. */
export function edgePath(a: Place, b: Place, curve: number): { d: string; x: number; y: number; angle: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = a.x + ux * a.r * 1.04;
  const y1 = a.y + uy * a.r * 1.04;
  const x2 = b.x - ux * b.r * 1.04;
  const y2 = b.y - uy * b.r * 1.04;
  let mx = (x1 + x2) / 2;
  let my = (y1 + y2) / 2;
  let d = `M${round(x1)},${round(y1)} L${round(x2)},${round(y2)}`;
  if (curve !== 0) {
    const l = Math.hypot(x2 - x1, y2 - y1) || 1;
    let nx = -(y2 - y1) / l;
    let ny = (x2 - x1) / l;
    // bend away from the centre
    if (nx * mx + ny * my < 0) {
      nx = -nx;
      ny = -ny;
    }
    const cx = mx + nx * l * curve;
    const cy = my + ny * l * curve;
    d = `M${round(x1)},${round(y1)} Q${round(cx)},${round(cy)} ${round(x2)},${round(y2)}`;
    mx = (x1 + 2 * cx + x2) / 4;
    my = (y1 + 2 * cy + y2) / 4;
  }
  // labels never read upside down
  let angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return { d, x: mx, y: my, angle };
}

/** The ease of a move: slow at both ends. */
export const ease = (k: number): number => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/** Where the camera goes to show the whole box in a view of w by h: centred on it, zoomed to fit, within limits. */
export function fitCamera(w: number, h: number, box: Box): { x: number; y: number; s: number } {
  const s = Math.max(0.15, Math.min(1.25, w / (box.x1 - box.x0), h / (box.y1 - box.y0)));
  return { x: -((box.x0 + box.x1) / 2) * s, y: -((box.y0 + box.y1) / 2) * s, s };
}
