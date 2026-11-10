// The draw dialect: a block of drawing commands, as in Red, drawn as SVG.
//
//   canvas 120x120 [fill-pen primary circle 60x60 50 pen text line 30x60 90x60]
//
// Coordinates are in the canvas's own space (its extent); the SVG scales to
// the room it gets. Colors are the theme's roles or Red's color words, which
// the theme works out for light and dark (`--tb-c-red` and so on), never RGB.
// This module builds a tree of plain elements and knows nothing of the DOM,
// so the tests run it in Node; the browser host turns the tree into nodes.

import { K, I64, spell, text, type Cell, type BlockCell, type WordCell, type StringCell } from '../core/index.ts';

/** An SVG element to make: its tag, attributes, children and text. */
export interface El {
  tag: string;
  attrs: Record<string, string>;
  kids: El[];
  text?: string;
}

export const svgEl = (tag: string, attrs: Record<string, string | number> = {}, kids: El[] = [], txt?: string): El => {
  const a: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) a[k] = typeof v === 'number' ? round(v) : v;
  return txt === undefined ? { tag, attrs: a, kids } : { tag, attrs: a, kids, text: txt };
};

const round = (n: number): string => String(Math.round(n * 100) / 100);

/** Theme roles a drawing may use as colors. */
export const DRAW_ROLES = ['primary', 'accent', 'danger', 'success', 'warning', 'muted', 'text', 'border', 'surface', 'bg'] as const;

/**
 * Red's color words Trebol knows, as OKLCH hue and chroma with a lightness for
 * light and one for dark mode, so each one reads on the background of either.
 * black and white stay what they say in both.
 */
export const DRAW_COLORS: Record<string, { h: number; c: number; light: number; dark: number }> = {
  red: { h: 27, c: 0.2, light: 0.58, dark: 0.7 },
  maroon: { h: 15, c: 0.13, light: 0.38, dark: 0.58 },
  orange: { h: 55, c: 0.17, light: 0.68, dark: 0.76 },
  brown: { h: 50, c: 0.1, light: 0.45, dark: 0.62 },
  gold: { h: 85, c: 0.15, light: 0.76, dark: 0.8 },
  yellow: { h: 100, c: 0.17, light: 0.86, dark: 0.88 },
  olive: { h: 115, c: 0.12, light: 0.5, dark: 0.68 },
  green: { h: 145, c: 0.17, light: 0.6, dark: 0.74 },
  teal: { h: 185, c: 0.11, light: 0.58, dark: 0.72 },
  aqua: { h: 195, c: 0.12, light: 0.78, dark: 0.82 },
  cyan: { h: 210, c: 0.12, light: 0.72, dark: 0.8 },
  sky: { h: 235, c: 0.1, light: 0.75, dark: 0.8 },
  blue: { h: 260, c: 0.19, light: 0.55, dark: 0.7 },
  navy: { h: 265, c: 0.14, light: 0.32, dark: 0.55 },
  violet: { h: 290, c: 0.15, light: 0.62, dark: 0.75 },
  purple: { h: 305, c: 0.18, light: 0.5, dark: 0.68 },
  magenta: { h: 330, c: 0.24, light: 0.6, dark: 0.72 },
  pink: { h: 350, c: 0.13, light: 0.75, dark: 0.8 },
  silver: { h: 0, c: 0, light: 0.8, dark: 0.75 },
  gray: { h: 0, c: 0, light: 0.6, dark: 0.62 },
  black: { h: 0, c: 0, light: 0.15, dark: 0.15 },
  white: { h: 0, c: 0, light: 1, dark: 1 },
};

/** The commands of the dialect, and how each is written. */
export const DRAW_COMMANDS: Record<string, string> = {
  pen: 'pen color',
  'fill-pen': 'fill-pen color',
  'line-width': 'line-width number',
  'line-cap': 'line-cap flat | square | round',
  'line-join': 'line-join miter | round | bevel',
  font: 'font [size: number bold italic]',
  line: 'line point point ...',
  box: 'box top-left bottom-right [corner-radius]',
  triangle: 'triangle point point point',
  polygon: 'polygon point point point ...',
  circle: 'circle center radius [radius-y]',
  ellipse: 'ellipse top-left size',
  arc: 'arc center radius begin sweep [closed]',
  curve: 'curve start control end, or curve start control control end',
  text: 'text top-left string',
  translate: 'translate offset',
  rotate: 'rotate angle [center]',
  scale: 'scale x y',
  push: 'push [commands]',
};

interface State {
  pen: string | null;
  fill: string | null;
  width: number;
  cap: string;
  join: string;
  size: number;
  bold: boolean;
  italic: boolean;
}

const START: State = { pen: 'var(--tb-text)', fill: null, width: 1, cap: 'butt', join: 'miter', size: 15, bold: false, italic: false };

/** A color word as CSS; null for off, undefined when it is no color. */
export function drawColor(w: string): string | null | undefined {
  if (w === 'off' || w === 'none' || w === 'transparent') return null;
  if ((DRAW_ROLES as readonly string[]).includes(w)) return `var(--tb-${w})`;
  if (DRAW_COLORS[w] !== undefined) return `var(--tb-c-${w})`;
  return undefined;
}

class DrawError extends Error {}

/** The SVG elements of a draw block, and what was wrong with it, if anything. Drawing stops at the first error. */
export function drawSvg(block: Cell): { kids: El[]; error: string | null } {
  const out: El[] = [];
  if (block.t !== K.Block) return { kids: out, error: block.t === K.None ? null : 'draw takes a block' };
  try {
    run(block as BlockCell, { ...START }, out);
    return { kids: out, error: null };
  } catch (e) {
    if (e instanceof DrawError) return { kids: out, error: e.message };
    throw e;
  }
}

function run(b: BlockCell, st: State, out: El[]): void {
  const d = b.s.data;
  let i = b.i;
  let into = out;
  const word = (c: Cell | undefined): string | null =>
    c !== undefined && (c.t === K.Word || c.t === K.LitWord) ? spell((c as WordCell).sym).toLowerCase() : null;
  const num = (c: Cell | undefined): number | null =>
    c === undefined ? null : c.t === K.Integer ? I64.toNumber(c.v) : c.t === K.Decimal ? c.v : null;
  const fail = (cmd: string): never => {
    throw new DrawError(`draw: ${cmd} is written ${DRAW_COMMANDS[cmd]}`);
  };
  const point = (cmd: string): [number, number] => {
    const c = d[i];
    if (c === undefined || c.t !== K.Pair) return fail(cmd);
    i++;
    return [c.x, c.y];
  };
  const optPoint = (): [number, number] | null => {
    const c = d[i];
    if (c === undefined || c.t !== K.Pair) return null;
    i++;
    return [c.x, c.y];
  };
  const number = (cmd: string): number => {
    const n = num(d[i]);
    if (n === null) return fail(cmd);
    i++;
    return n;
  };
  const optNumber = (): number | null => {
    const n = num(d[i]);
    if (n !== null) i++;
    return n;
  };
  const points = (cmd: string, least: number): Array<[number, number]> => {
    const ps: Array<[number, number]> = [];
    for (let p = optPoint(); p !== null; p = optPoint()) ps.push(p);
    if (ps.length < least) fail(cmd);
    return ps;
  };
  const paint = (closed: boolean): Record<string, string | number> => ({
    fill: closed && st.fill !== null ? st.fill : 'none',
    stroke: st.pen ?? 'none',
    'stroke-width': st.width,
    'stroke-linecap': st.cap,
    'stroke-linejoin': st.join,
  });
  const pts = (ps: Array<[number, number]>): string => ps.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');

  while (i < d.length) {
    const c = d[i]!;
    const cmd = word(c);
    if (cmd === null || DRAW_COMMANDS[cmd] === undefined) {
      throw new DrawError(cmd === null ? `draw: a command was expected, not ${kindOf(c)}` : `draw: unknown command ${cmd}`);
    }
    i++;
    switch (cmd) {
      case 'pen': case 'fill-pen': {
        const w = word(d[i]);
        const color = w === null ? undefined : drawColor(w);
        if (color === undefined) {
          throw new DrawError(`draw: ${cmd} takes a role (${DRAW_ROLES.join(' ')}), a color (${Object.keys(DRAW_COLORS).join(' ')}) or off`);
        }
        i++;
        if (cmd === 'pen') st.pen = color;
        else st.fill = color;
        break;
      }
      case 'line-width': st.width = Math.max(0, number(cmd)); break;
      case 'line-cap': {
        const w = word(d[i]);
        if (w !== 'flat' && w !== 'square' && w !== 'round') fail(cmd);
        i++;
        st.cap = w === 'flat' ? 'butt' : w!;
        break;
      }
      case 'line-join': {
        const w = word(d[i]);
        if (w !== 'miter' && w !== 'round' && w !== 'bevel') fail(cmd);
        i++;
        st.join = w!;
        break;
      }
      case 'font': {
        const spec = d[i];
        if (spec === undefined || spec.t !== K.Block) fail(cmd);
        i++;
        const fd = (spec as BlockCell).s.data.slice((spec as BlockCell).i);
        for (let j = 0; j < fd.length; j++) {
          const f = fd[j]!;
          if (f.t === K.SetWord && spell((f as WordCell).sym).toLowerCase() === 'size' && num(fd[j + 1]) !== null) {
            st.size = num(fd[++j])!;
          } else if (word(f) === 'bold') st.bold = true;
          else if (word(f) === 'italic') st.italic = true;
          else if (word(f) === 'plain') st.bold = st.italic = false;
          else fail(cmd);
        }
        break;
      }
      case 'line': into.push(svgEl('polyline', { points: pts(points(cmd, 2)), ...paint(false) })); break;
      case 'triangle': {
        const ps = points(cmd, 3);
        if (ps.length !== 3) fail(cmd);
        into.push(svgEl('polygon', { points: pts(ps), ...paint(true) }));
        break;
      }
      case 'polygon': into.push(svgEl('polygon', { points: pts(points(cmd, 3)), ...paint(true) })); break;
      case 'box': {
        const [x1, y1] = point(cmd);
        const [x2, y2] = point(cmd);
        const r = optNumber();
        const a: Record<string, string | number> = {
          x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), ...paint(true),
        };
        if (r !== null) a['rx'] = r;
        into.push(svgEl('rect', a));
        break;
      }
      case 'circle': {
        const [cx, cy] = point(cmd);
        const r = number(cmd);
        const ry = optNumber();
        into.push(ry === null
          ? svgEl('circle', { cx, cy, r, ...paint(true) })
          : svgEl('ellipse', { cx, cy, rx: r, ry, ...paint(true) }));
        break;
      }
      case 'ellipse': {
        const [x, y] = point(cmd);
        const [w, h] = point(cmd);
        into.push(svgEl('ellipse', { cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2, ...paint(true) }));
        break;
      }
      case 'arc': {
        const [cx, cy] = point(cmd);
        const [rx, ry] = point(cmd);
        const begin = number(cmd);
        const sweep = number(cmd);
        const closed = word(d[i]) === 'closed';
        if (closed) i++;
        into.push(svgEl('path', { d: arcPath(cx, cy, rx, ry, begin, sweep, closed), ...paint(closed) }));
        break;
      }
      case 'curve': {
        const ps = points(cmd, 3);
        if (ps.length > 4) fail(cmd);
        const [p0, ...rest] = ps;
        const path = `M${round(p0![0])},${round(p0![1])} ${rest.length === 2 ? 'Q' : 'C'}${pts(rest)}`;
        into.push(svgEl('path', { d: path, ...paint(false) }));
        break;
      }
      case 'text': {
        const [x, y] = point(cmd);
        const s = d[i];
        if (s === undefined || s.t !== K.String) fail(cmd);
        i++;
        const a: Record<string, string | number> = {
          x, y, 'dominant-baseline': 'hanging', fill: st.pen ?? 'none', 'font-size': st.size, 'font-family': 'var(--tb-font)',
        };
        if (st.bold) a['font-weight'] = 'bold';
        if (st.italic) a['font-style'] = 'italic';
        into.push(svgEl('text', a, [], text(s as StringCell)));
        break;
      }
      case 'translate': case 'rotate': case 'scale': {
        let t: string;
        if (cmd === 'translate') {
          const [x, y] = point(cmd);
          t = `translate(${round(x)} ${round(y)})`;
        } else if (cmd === 'rotate') {
          const a = number(cmd);
          const c = optPoint();
          t = c === null ? `rotate(${round(a)})` : `rotate(${round(a)} ${round(c[0])} ${round(c[1])})`;
        } else {
          const x = number(cmd);
          const y = optNumber() ?? x;
          t = `scale(${round(x)} ${round(y)})`;
        }
        // the rest of this block is drawn inside the transform
        const g = svgEl('g', { transform: t });
        into.push(g);
        into = g.kids;
        break;
      }
      case 'push': {
        const inner = d[i];
        if (inner === undefined || inner.t !== K.Block) fail(cmd);
        i++;
        const g = svgEl('g');
        into.push(g);
        run(inner as BlockCell, { ...st }, g.kids);
        break;
      }
    }
  }
}

/** The SVG path of an arc: angles in degrees, 0 at three o'clock, going clockwise, as in Red. */
function arcPath(cx: number, cy: number, rx: number, ry: number, begin: number, sweep: number, closed: boolean): string {
  const at = (deg: number): [number, number] => {
    const r = (deg * Math.PI) / 180;
    return [cx + rx * Math.cos(r), cy + ry * Math.sin(r)];
  };
  // a full turn is two halves: one arc cannot start and end at the same point
  if (Math.abs(sweep) >= 360) {
    const [x0, y0] = at(begin);
    const [x1, y1] = at(begin + 180);
    return `M${round(x0)},${round(y0)} A${round(rx)},${round(ry)} 0 1 1 ${round(x1)},${round(y1)} A${round(rx)},${round(ry)} 0 1 1 ${round(x0)},${round(y0)}${closed ? ' Z' : ''}`;
  }
  const [x0, y0] = at(begin);
  const [x1, y1] = at(begin + sweep);
  const large = Math.abs(sweep) > 180 ? 1 : 0;
  const dir = sweep >= 0 ? 1 : 0;
  const arc = `A${round(rx)},${round(ry)} 0 ${large} ${dir} ${round(x1)},${round(y1)}`;
  return closed ? `M${round(cx)},${round(cy)} L${round(x0)},${round(y0)} ${arc} Z` : `M${round(x0)},${round(y0)} ${arc}`;
}

function kindOf(c: Cell): string {
  return c.t === K.String ? 'a string' : c.t === K.Pair ? 'a pair' : c.t === K.Integer || c.t === K.Decimal ? 'a number' : 'that';
}
