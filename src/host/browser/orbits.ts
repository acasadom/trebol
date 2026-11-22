// --- orbits -------------------------------------------------------------------------------

import { NONE, TRUE, FALSE, type Cell } from '../../core/index.ts';
import { translate } from '../index.ts';
import { readOrbit, layoutOrbit, shownEdges, edgeLabel, bubble, gradients, edgePath, ease, fitCamera, MANY, type OrbitSpec, type Role, type Place, type Placed, type Box } from '../orbit.ts';
import { get, str, own, flag } from './faces.ts';
import { type Mounted, host, fire, el } from './mount.ts';
import { SVG_NS, svgNode } from './drawings.ts';
import { watchSize } from './sizes.ts';

export interface OrbitVis {
  key: string;
  /** Moved and faded; `inner`, inside it, is scaled by the radius. Chrome draws a faded group of tiny units blurred, so the two stay apart. */
  g: SVGGElement;
  inner: SVGGElement;
  role: Role;
  cur: Place;
  from: Place;
  to: Place;
  dying: boolean;
}

export interface OrbitLine { a: string; b: string; path: SVGPathElement; text: SVGTextElement | null; curve: number }

export interface OrbitState {
  svg: SVGSVGElement;
  defs: SVGDefsElement;
  world: SVGGElement;
  lines: SVGGElement;
  bubbles: SVGGElement;
  vis: Map<string, OrbitVis>;
  edges: OrbitLine[];
  /** What it shows: the spec as read, and a signature of it that tells when it changed. */
  spec: OrbitSpec;
  signature: string;
  /** The page of neighbours on show, and the focus it is a page of. */
  page: number;
  pageOf: string | null;
  box: Box;
  /** The bubbles of the last layout, and how many neighbours were left off its page. */
  placed: Placed[];
  left: number;
  cam: { x: number; y: number; s: number };
  camFrom: { x: number; y: number; s: number } | null;
  camTo: { x: number; y: number; s: number } | null;
  anim: number;
  /** The node the person picked last: new neighbours grow from it. */
  picked: string | null;
  /** The pick came from the keyboard: once redrawn, the focus goes back to the orbit. */
  byKey: boolean;
  dragged: boolean;
  gradients: Map<string, [string, string]>;
  width: number;
  height: number;
}

export let orbitCount = 0;

/** An orbit: an SVG the size of the face, a world the camera moves, edges under the bubbles. */
export function buildOrbit(m: Mounted): HTMLElement {
  const node = el('div', 'tb-orbit');
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('role', 'group');
  svg.setAttribute('tabindex', '-1');
  const defs = document.createElementNS(SVG_NS, 'defs') as SVGDefsElement;
  const world = document.createElementNS(SVG_NS, 'g') as SVGGElement;
  const lines = document.createElementNS(SVG_NS, 'g') as SVGGElement;
  const bubbles = document.createElementNS(SVG_NS, 'g') as SVGGElement;
  world.append(lines, bubbles);
  svg.append(defs, world);
  node.append(svg);
  const st: OrbitState = {
    svg, defs, world, lines, bubbles, vis: new Map(), edges: [], spec: readOrbit(NONE).spec, signature: '', page: 0, pageOf: null,
    box: { x0: -100, y0: -100, x1: 100, y1: 100 }, placed: [], left: 0, cam: { x: 0, y: 0, s: 1 }, camFrom: null, camTo: null, anim: 0, picked: null, byKey: false, dragged: false,
    gradients: new Map(), width: 0, height: 0,
  };
  m.kids = st;
  orbitCamera(m, st);
  orbitKeys(m, st);
  watchSize(svg, () => {
    if (svg.clientWidth === st.width && svg.clientHeight === st.height) return;
    st.width = svg.clientWidth;
    st.height = svg.clientHeight;
    // a move under way ends where the new size fits; titles take the new zoom
    const fit = fitCamera(st.width, st.height, st.box);
    if (st.camTo !== null) st.camTo = fit;
    else st.cam = fit;
    orbitDressAll(m, st, fit.s);
    orbitApplyCam(st);
    orbitDrawEdges(st);
  });
  return node;
}

/** Drag to pan, Ctrl and the wheel (or a pinch) to zoom about the pointer, double click to fit again. */
export function orbitCamera(m: Mounted, st: OrbitState): void {
  const { svg } = st;
  let drag: { x: number; y: number; cx: number; cy: number; id: number } | null = null;
  svg.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    drag = { x: ev.clientX, y: ev.clientY, cx: st.cam.x, cy: st.cam.y, id: ev.pointerId };
    st.dragged = false;
  });
  svg.addEventListener('pointermove', ev => {
    if (drag === null || ev.pointerId !== drag.id) return;
    const dx = ev.clientX - drag.x;
    const dy = ev.clientY - drag.y;
    if (!st.dragged && Math.hypot(dx, dy) > 4) {
      st.dragged = true;
      svg.setPointerCapture(ev.pointerId);
      svg.classList.add('tb-orbit-panning');
    }
    if (st.dragged) {
      st.cam = { ...st.cam, x: drag.cx + dx, y: drag.cy + dy };
      orbitApplyCam(st);
    }
  });
  const end = (): void => {
    drag = null;
    svg.classList.remove('tb-orbit-panning');
    // the click that ends a drag picks nothing
    setTimeout(() => { st.dragged = false; }, 0);
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', ev => {
    // the page scrolls past an orbit; with Ctrl (or a pinch), or when it fills the window, the wheel zooms
    if (!ev.ctrlKey && !ev.metaKey && !flag(m.face, 'fit')) return;
    ev.preventDefault();
    const box = svg.getBoundingClientRect();
    const ox = box.width / 2 + st.cam.x;
    const oy = box.height / 2 + st.cam.y;
    const s = Math.max(0.15, Math.min(4, st.cam.s * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015))));
    const px = ev.clientX - box.left;
    const py = ev.clientY - box.top;
    const wx = (px - ox) / st.cam.s;
    const wy = (py - oy) / st.cam.s;
    st.cam = { x: px - box.width / 2 - wx * s, y: py - box.height / 2 - wy * s, s };
    orbitApplyCam(st);
  }, { passive: false });
  svg.addEventListener('dblclick', ev => {
    if ((ev.target as Element).closest('.tb-orbit-node') !== null) return;
    st.camFrom = { ...st.cam };
    st.camTo = fitCamera(st.width, st.height, st.box);
    orbitAnimate(st, 500);
  });
}

/** Tab goes through the neighbours, Enter or Space picks one, Escape or Backspace steps back. */
export function orbitKeys(m: Mounted, st: OrbitState): void {
  st.svg.addEventListener('keydown', ev => {
    const g = (ev.target as Element).closest('.tb-orbit-node');
    if ((ev.key === 'Enter' || ev.key === ' ') && g !== null) {
      ev.preventDefault();
      orbitPick(m, st, (g as SVGGElement).dataset['key']!, true);
    } else if ((ev.key === 'Escape' || ev.key === 'Backspace') && st.spec.trail.length > 0) {
      const back = [...st.spec.trail].reverse().find(k => st.spec.nodes.has(k));
      if (back === undefined) return;
      ev.preventDefault();
      ev.stopPropagation();
      orbitPick(m, st, back, true);
    }
  });
}

/** The person picked a bubble: a neighbour enters, the trail steps back, "+N more" turns the page. */
export function orbitPick(m: Mounted, st: OrbitState, key: string, byKey: boolean): void {
  if (flag(m.face, 'disabled')) return;
  const v = st.vis.get(key);
  if (v === undefined || v.dying) return;
  if (v.role === 'more') {
    st.page++;
    st.picked = st.spec.focus;
    orbitRender(m, st);
    return;
  }
  const node = st.spec.nodes.get(key);
  if (node === undefined || v.role === 'focus') return;
  st.picked = key;
  st.byKey = byKey;
  void fire('ui-orbit', m.face, node.id, v.role === 'trail' ? TRUE : FALSE);
}

export function syncOrbit(m: Mounted): void {
  const st = m.kids as OrbitState;
  const { spec, error } = readOrbit(get(m.face, 'data'));
  if (error !== null) console.warn(`Trebol: ${error}`);
  const t = str(m.face, 'text');
  const focus = spec.focus === null ? undefined : spec.nodes.get(spec.focus);
  const focusTitle = focus === undefined ? '' : translate(focus.title, host.rt);
  st.svg.setAttribute('aria-label', t === null ? focusTitle : focusTitle === '' ? t : `${t}: ${focusTitle}`);
  // a repaint of the same thing in the same language keeps what is on screen, moving or not
  const signature = orbitSignature(spec);
  if (signature === st.signature) return;
  st.signature = signature;
  st.spec = spec;
  if (spec.focus !== st.pageOf) {
    st.page = 0;
    st.pageOf = spec.focus;
  }
  orbitRender(m, st);
}

export function orbitSignature(spec: OrbitSpec): string {
  const tx = (c: Cell | null): string => (c === null ? '' : translate(c, host.rt));
  const nodes = [...spec.nodes.values()].map(n => [n.key, tx(n.title), n.color, n.count, n.many, n.dashed, n.steps, n.at].join('\u0002'));
  const edges = spec.edges.map(e => [e.from, e.to, tx(e.label), e.look].join('\u0002'));
  return [spec.focus ?? '', nodes.join('\u0001'), edges.join('\u0001'), spec.trail.join('\u0001')].join('\u0000');
}

/** The ids of the gradients of a color, made the first time it is used. */
export function orbitGradients(st: OrbitState, color: string): [string, string] {
  let ids = st.gradients.get(color);
  if (ids === undefined) {
    const n = `tb-orbit${orbitCount++}`;
    ids = [`${n}-body`, `${n}-halo`];
    st.gradients.set(color, ids);
    st.defs.append(...gradients(color, ids[0], ids[1]).map(svgNode));
  }
  return ids;
}

/** Moves from what is on screen to what the spec says: bubbles that stay move, new ones grow from the one picked, the rest fade. */
export function orbitRender(m: Mounted, st: OrbitState): void {
  const { spec } = st;
  const lay = layoutOrbit(spec, st.page);
  st.box = lay.box;
  const want = new Map(lay.placed.map(p => [p.key, p]));
  for (const [k, v] of [...st.vis]) {
    if (v.dying) continue;
    const p = want.get(k);
    if (p === undefined || p.role !== v.role || p.role === 'more') {
      // gone, or something else now: it fades where it is, and a new one takes its key
      v.dying = true;
      v.from = { ...v.cur };
      v.to = { ...v.cur, r: v.cur.r * (p === undefined ? 0.4 : 1), o: 0 };
      v.g.setAttribute('tabindex', '-1');
      v.g.setAttribute('aria-hidden', 'true');
      st.vis.delete(k);
      st.vis.set(`${k}\u0000old${orbitCount++}`, v);
      if (p !== undefined) st.vis.set(k, orbitBubble(m, st, p, { ...v.cur }));
    } else {
      v.from = { ...v.cur };
      v.to = p;
    }
  }
  const was = st.picked === null ? undefined : [...st.vis.values()].find(v => v.key === st.picked);
  const spawn = was !== undefined ? was.cur : { x: 0, y: 0 };
  for (const p of lay.placed) {
    if (st.vis.has(p.key)) continue;
    st.vis.set(p.key, orbitBubble(m, st, p, { x: spawn.x, y: spawn.y, r: p.r * 0.2, o: 0 }));
  }
  st.width = st.svg.clientWidth;
  st.height = st.svg.clientHeight;
  st.camFrom = { ...st.cam };
  st.camTo = fitCamera(st.width || 600, st.height || 480, lay.box);
  st.placed = lay.placed;
  st.left = lay.left;
  orbitDressAll(m, st, st.camTo.s);
  st.bubbles.append(...lay.placed.map(p => st.vis.get(p.key)!.g));
  st.picked = null;
  orbitAnimate(st, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900);
  if (st.byKey) {
    st.byKey = false;
    st.svg.focus();
  }
}

/** Every bubble on show drawn anew (its title, hints and size may have changed), and the edges, for the camera's zoom. */
export function orbitDressAll(m: Mounted, st: OrbitState, scale: number): void {
  for (const p of st.placed) {
    const v = st.vis.get(p.key);
    if (v !== undefined) orbitDress(m, st, v, p, st.left, scale);
  }
  orbitEdges(st, st.placed, scale);
}

export function orbitBubble(m: Mounted, st: OrbitState, p: Placed, start: Place): OrbitVis {
  const g = document.createElementNS(SVG_NS, 'g') as SVGGElement;
  const inner = document.createElementNS(SVG_NS, 'g') as SVGGElement;
  g.append(inner);
  g.dataset['key'] = p.key;
  g.addEventListener('click', ev => {
    if (st.dragged) return;
    ev.stopPropagation();
    orbitPick(m, st, p.key, false);
  });
  // with many neighbours, the labels of a bubble's edges show while the pointer is on it
  g.addEventListener('pointerenter', () => orbitHover(st, p.key, true));
  g.addEventListener('pointerleave', () => orbitHover(st, p.key, false));
  g.addEventListener('focus', () => orbitHover(st, p.key, true));
  g.addEventListener('blur', () => orbitHover(st, p.key, false));
  st.bubbles.append(g);
  return { key: p.key, g, inner, role: p.role, cur: start, from: { ...start }, to: p, dying: false };
}

/** What a bubble shows and how it reads: a link to a neighbour, back to the trail, or the next page. */
export function orbitDress(m: Mounted, st: OrbitState, v: OrbitVis, p: Placed, left: number, scale: number): void {
  const node = st.spec.nodes.get(p.key) ?? null;
  const title = p.role === 'more' ? (left > 0 ? own('orbit-more', String(left)) : own('orbit-first')) : node === null ? '' : translate(node.title, host.rt);
  const color = p.role === 'more' ? 'var(--tb-muted)' : node?.color ?? 'var(--tb-primary)';
  const [body, halo] = orbitGradients(st, color);
  const label = p.role === 'near' ? orbitEdgeText(st.spec, p.key) : '';
  const said = p.role === 'trail' ? own('orbit-back-to', title) : label === '' ? title : `${title}, ${label}`;
  v.g.setAttribute('class', `tb-orbit-node tb-orbit-${p.role}`);
  const tip = document.createElementNS(SVG_NS, 'title');
  tip.textContent = said;
  v.g.replaceChildren(tip, v.inner);
  v.inner.replaceChildren(...bubble({ role: p.role, r: p.r, scale, above: p.role !== 'trail' && p.y < -1, title, color, body, halo, node }).map(svgNode));
  if (p.role === 'focus') {
    // Chrome stops Tab on an SVG group with a click handler unless told not to
    v.g.setAttribute('tabindex', '-1');
    v.g.removeAttribute('role');
    v.g.removeAttribute('aria-label');
    v.g.setAttribute('aria-hidden', 'true');
  } else {
    v.g.setAttribute('tabindex', '0');
    v.g.setAttribute('role', p.role === 'more' ? 'button' : 'link');
    v.g.setAttribute('aria-label', said);
    v.g.removeAttribute('aria-hidden');
  }
  if (flag(m.face, 'disabled')) v.g.setAttribute('tabindex', '-1');
}

export function orbitEdgeText(spec: OrbitSpec, key: string): string {
  const c = edgeLabel(spec, key);
  return c === null ? '' : translate(c, host.rt);
}

export function orbitEdges(st: OrbitState, placed: Placed[], scale: number): void {
  const many = placed.filter(p => p.role === 'near').length > MANY;
  st.edges = shownEdges(st.spec, placed).map(e => {
    const path = document.createElementNS(SVG_NS, 'path') as SVGPathElement;
    path.setAttribute('class', `tb-orbit-edge tb-orbit-edge-${e.trail ? 'trail' : e.look}`);
    let text: SVGTextElement | null = null;
    if (e.label !== null) {
      text = document.createElementNS(SVG_NS, 'text') as SVGTextElement;
      text.setAttribute('class', many ? 'tb-orbit-label tb-orbit-later' : 'tb-orbit-label');
      // the size of the page's small text once the camera fits
      text.style.fontSize = `${11 / scale}px`;
      text.style.strokeWidth = `${3 / scale}px`;
      text.textContent = translate(e.label, host.rt);
    }
    return { a: e.from, b: e.to, path, text, curve: e.curve };
  });
  st.lines.replaceChildren(...st.edges.flatMap(e => (e.text === null ? [e.path] : [e.path, e.text])));
  st.lines.setAttribute('aria-hidden', 'true');
}

export function orbitHover(st: OrbitState, key: string, on: boolean): void {
  for (const e of st.edges) if (e.text !== null && (e.a === key || e.b === key)) e.text.classList.toggle('tb-orbit-shown', on);
}

export function orbitApplyCam(st: OrbitState): void {
  const w = st.svg.clientWidth || st.width;
  const h = st.svg.clientHeight || st.height;
  st.world.setAttribute('transform', `translate(${w / 2 + st.cam.x},${h / 2 + st.cam.y}) scale(${st.cam.s})`);
}

/** Tweens every bubble and the camera from where they are to where they go; 0 ms puts them there at once. */
export function orbitAnimate(st: OrbitState, ms: number): void {
  cancelAnimationFrame(st.anim);
  const t0 = performance.now();
  const step = (now: number): void => {
    const k = ms === 0 ? 1 : ease(Math.min(1, (now - t0) / ms));
    for (const v of st.vis.values()) {
      if (v.from !== v.to || v.dying) {
        const f = v.from;
        const t = v.to;
        v.cur = { x: f.x + (t.x - f.x) * k, y: f.y + (t.y - f.y) * k, r: f.r + (t.r - f.r) * k, o: f.o + (t.o - f.o) * k };
      }
      v.g.setAttribute('transform', `translate(${v.cur.x},${v.cur.y})`);
      v.inner.setAttribute('transform', `scale(${Math.max(v.cur.r, 0.001)})`);
      v.g.style.opacity = String(v.cur.o);
      v.g.style.pointerEvents = v.cur.o < 0.05 ? 'none' : '';
    }
    if (st.camFrom !== null && st.camTo !== null) {
      const a = st.camFrom;
      const b = st.camTo;
      st.cam = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, s: a.s + (b.s - a.s) * k };
    }
    orbitApplyCam(st);
    orbitDrawEdges(st);
    if (k < 1) st.anim = requestAnimationFrame(step);
    else {
      st.camFrom = st.camTo = null;
      for (const [k2, v] of st.vis) {
        if (v.dying) {
          v.g.remove();
          st.vis.delete(k2);
        }
      }
    }
  };
  if (ms === 0) step(t0);
  else st.anim = requestAnimationFrame(step);
}

export function orbitDrawEdges(st: OrbitState): void {
  for (const e of st.edges) {
    const a = st.vis.get(e.a);
    const b = st.vis.get(e.b);
    if (a === undefined || b === undefined) {
      e.path.setAttribute('d', '');
      continue;
    }
    const at = edgePath(a.cur, b.cur, e.curve);
    e.path.setAttribute('d', at.d);
    const o = String(Math.min(a.cur.o, b.cur.o));
    e.path.style.opacity = o;
    if (e.text !== null) {
      e.text.setAttribute('transform', `translate(${at.x},${at.y}) rotate(${at.angle}) translate(0,-5)`);
      e.text.style.opacity = o;
    }
  }
}

