// MOLD and FORM: cells to text.
//
// mold produces source text that load reads back as an equivalent value; it
// is the inverse of load and the main test of the lexer. With `all`, values
// that have no literal form (none, logic, datatypes, series at an index...)
// use construction syntax #[...] so the round trip is exact.
//
// form produces human-readable text: strings without quotes, blocks without
// brackets, an error as its report. It is what `print` shows.

import { K, kindName } from './kinds.ts';
import { spell } from './symbols.ts';
import * as I64 from './int64.ts';
import { formatDec } from './dec.ts';
import { encodeChar } from './escapes.ts';
import type { FuncDef } from './func.ts';
import { errorField, errorMessage } from './errors.ts';
import {
  fromCodePoints, unpackPos,
  type Cell, type Series, type DateVal, type StringCell, type BlockCell, type Ctx, type ObjectCell,
} from './values.ts';

export interface MoldOptions {
  /** Use construction syntax so that load(mold(x)) is exactly x. */
  all?: boolean;
  /** For a block: mold its contents without the outer brackets. */
  only?: boolean;
}

export function mold(c: Cell, opts: MoldOptions = {}): string {
  const m = new Molder(opts.all ?? false);
  if (opts.only && (c.t === K.Block || c.t === K.Paren)) {
    m.contents(c.s, c.i, -1);
  } else {
    m.value(c, 0);
  }
  return m.out;
}

export function form(c: Cell): string {
  // Iterative, as the molder: blocks nested any depth form without recursing
  // on the JS stack. A block met again inside itself forms as "...". An object
  // forms as its fields, each value molded (R3), so the molder guards its cycles.
  let out = '';
  const active = new Set<object>();
  const work: Work[] = [{ w: 1, c, depth: 0 }];
  for (let item = work.pop(); item !== undefined; item = work.pop()) {
    if (item.w === 0) { out += item.text; continue; }
    if (item.w === 2) { active.delete(item.leave); continue; }
    const v = item.c;
    if (v.t === K.Object) {
      // each field molded, as R3: a: [1 2]^/s: "x"
      const m = new Molder(false);
      m.fields(v.ctx);
      out += m.out;
      continue;
    }
    if (v.t === K.Block || v.t === K.Paren) {
      const parts: Work[] = [];
      const b = v as BlockCell;
      const key = b.s;
      for (let j = b.i; j < b.s.data.length; j++) {
        if (j > b.i) parts.push({ w: 0, text: ' ' });
        parts.push({ w: 1, c: b.s.data[j]!, depth: 0 });
      }
      if (active.has(key)) { out += '...'; continue; }
      active.add(key);
      parts.push({ w: 2, leave: key });
      for (let j = parts.length - 1; j >= 0; j--) work.push(parts[j]!);
      continue;
    }
    out += formScalar(v);
  }
  return out;
}

/** form of a value that holds no blocks or objects to walk. */
function formScalar(c: Cell): string {
  switch (c.t) {
    case K.Unset:
      return '';
    case K.String: case K.File: case K.Email: case K.Url:
      return fromCodePoints(c.s.data, c.i);
    case K.Char:
      return String.fromCodePoint(c.v);
    case K.Word: case K.SetWord: case K.GetWord: case K.LitWord: case K.Refinement: case K.Issue:
      return spell(c.sym);
    case K.Error:
      return report(c);
    default:
      return mold(c);
  }
}

// --- scalar formatting ---------------------------------------------------------

/** An error as the console shows it, as in R3 and Red: "** Math error: ...", then where, near and at. */
function report(e: ObjectCell): string {
  const lines = [`** ${errorMessage(e)}`];
  const where = errorField(e, 'where');
  const near = errorField(e, 'near');
  const at = errorField(e, 'at');
  if (where.t !== K.None) lines.push(`** Where: ${form(where)}`);
  if (near.t !== K.None) lines.push(`** Near: ${mold(near)}`);
  if (at.t !== K.None) lines.push(`** At: ${form(at)}`);
  return lines.join('\n');
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A decimal as Trebol writes it. As in R3, mold shows 15 significant digits,
 * so 0.1 + 0.2 reads 0.3; `exact` (mold/all) gives the shortest text that
 * loads back to the very same number.
 */
export function formatDecimal(n: number, exact = true): string {
  if (Number.isNaN(n)) return '1.#NaN';
  if (!Number.isFinite(n)) return n > 0 ? '1.#INF' : '-1.#INF';
  let s = String(exact ? n : Number(n.toPrecision(15)));
  if (s.includes('e')) {
    s = s.replace('e+', 'e');
    const [mant, exp] = s.split('e');
    s = (mant!.includes('.') ? mant : mant + '.0') + 'e' + exp;
  } else if (!s.includes('.')) {
    s += '.0';
  }
  return s;
}

function formatPercent(v: number, exact: boolean): string {
  // The shortest digits that load back to exactly v (0.15 * 100 is
  // 15.000000000000002, but 0.15 should mold as 15%); without `exact`, at
  // most 15 digits, as decimals.
  if (!exact) v = Number(v.toPrecision(15));
  for (let p = 1; p <= 17; p++) {
    const digits = String(Number((v * 100).toPrecision(p))).replace('e+', 'e');
    const [mant, exp] = digits.split('e');
    if (Number(`${mant}e${Number(exp ?? 0) - 2}`) === v) return digits + '%';
  }
  return String(v * 100).replace('e+', 'e') + '%';
}

function formatPairPart(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace('e+', 'e');
}

/** h:mm[:ss[.fraction]], seconds only when not zero. Sign handled by caller. */
export function formatTime(ns: number): string {
  const totalSec = Math.floor(ns / 1e9);
  const frac = ns - totalSec * 1e9;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor(totalSec / 60) % 60;
  const s = totalSec % 60;
  let out = `${h}:${String(m).padStart(2, '0')}`;
  if (s !== 0 || frac !== 0) {
    out += ':' + String(s).padStart(2, '0');
    if (frac !== 0) out += '.' + String(frac).padStart(9, '0').replace(/0+$/, '');
  }
  return out;
}

function formatZone(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const a = Math.abs(minutes);
  return `${sign}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
}

export function formatDate(v: DateVal): string {
  // the year in four digits, as R3 writes it, so the year 99 is never read as 1999
  const year = v.y >= 0 && v.y < 1000 ? String(v.y).padStart(4, '0') : String(v.y);
  let out = `${v.d}-${MONTH_ABBR[v.m - 1]}-${year}`;
  if (v.time !== null) {
    out += '/' + formatTime(v.time);
    if (v.zone !== null) out += formatZone(v.zone);
  }
  return out;
}

// --- strings ---------------------------------------------------------------------

/** Quoted "..." for short single-line text, braces {...} otherwise. */
function moldString(cps: readonly number[], start: number): string {
  let useBraces = false;
  let depth = 0;
  let balanced = true;
  for (let i = start; i < cps.length; i++) {
    const cp = cps[i]!;
    if (cp === 10 || cp === 0x22) useBraces = true;
    if (cp === 0x7b) depth++;
    if (cp === 0x7d && --depth < 0) balanced = false;
  }
  if (depth !== 0) balanced = false;
  let out = useBraces ? '{' : '"';
  for (let i = start; i < cps.length; i++) {
    const cp = cps[i]!;
    if (useBraces && !balanced && (cp === 0x7b || cp === 0x7d)) {
      out += '^' + String.fromCodePoint(cp);
    } else {
      out += encodeChar(cp, useBraces ? '}' : '"', useBraces);
    }
  }
  return out + (useBraces ? '}' : '"');
}

const FILE_SAFE = /[A-Za-z0-9._~/:+\-!*',=@&$?#\u0080-\u{10FFFF}]/u;

function moldFile(cps: readonly number[], start: number): string {
  if (cps.length === start) return '%""';
  let out = '%';
  for (let i = start; i < cps.length; i++) {
    const ch = String.fromCodePoint(cps[i]!);
    out += FILE_SAFE.test(ch)
      ? ch
      : [...new TextEncoder().encode(ch)].map(b => '%' + b.toString(16).toUpperCase().padStart(2, '0')).join('');
  }
  return out;
}

function hex(bytes: readonly number[], start = 0): string {
  let out = '';
  for (let i = start; i < bytes.length; i++) out += bytes[i]!.toString(16).toUpperCase().padStart(2, '0');
  return out;
}

// --- the molder -------------------------------------------------------------------
//
// The molder never recurses on the JS stack: a value nested 100000 blocks deep
// molds as well as a flat one. Work is a stack of explicit items, popped in
// order: text to write, a value to mold, or the end of a series or context
// (which leaves the cycle guard).

const INDENT = '    ';
/**
 * Deeper levels indent no further, so a value nested thousands of levels
 * molds to text that grows with its size, not with its depth squared.
 * Indentation is only layout: load reads the text the same.
 */
const MAX_INDENT = 32;
const indentOf = (depth: number): string => INDENT.repeat(Math.min(depth, MAX_INDENT));

type Work =
  | { w: 0; text: string }
  | { w: 1; c: Cell; depth: number }
  | { w: 2; leave: object };

class Molder {
  out = '';
  private readonly all: boolean;
  private readonly active = new Set<object>();
  /** Pending work, last item first; each step pushes its parts in reverse. */
  private readonly work: Work[] = [];

  constructor(all: boolean) {
    this.all = all;
  }

  value(c: Cell, depth: number): void {
    this.work.push({ w: 1, c, depth });
    this.run();
  }

  /**
   * Molds series elements from `start`, honoring newline markers.
   * `depth` is the depth of the enclosing block (-1 for top-level contents).
   */
  contents(s: Series<Cell>, start: number, depth: number): void {
    this.pushContents(s, start, depth);
    this.run();
  }

  private run(): void {
    const work = this.work;
    for (let item = work.pop(); item !== undefined; item = work.pop()) {
      if (item.w === 0) this.out += item.text;
      else if (item.w === 1) this.step(item.c, item.depth);
      else this.active.delete(item.leave);
    }
  }

  /** Pushes parts so that they run in the given order. */
  private later(parts: Work[]): void {
    for (let j = parts.length - 1; j >= 0; j--) this.work.push(parts[j]!);
  }

  private step(c: Cell, depth: number): void {
    const all = this.all;
    switch (c.t) {
      case K.Unset: this.out += all ? '#[unset]' : ''; return;
      case K.None: this.out += all ? '#[none]' : 'none'; return;
      case K.Logic: this.out += all ? `#[${c.v}]` : String(c.v); return;
      case K.Integer: this.out += I64.toString(c.v); return;
      case K.Decimal: this.out += formatDecimal(c.v, all); return;
      case K.Percent: this.out += formatPercent(c.v, all); return;
      case K.Money: {
        const neg = c.v.d < 0n;
        const abs = neg ? { d: -c.v.d, e: c.v.e } : c.v;
        this.out += (neg ? '-' : '') + c.cur + '$' + formatDec(abs, 2);
        return;
      }
      case K.Char: this.out += '#"' + encodeChar(c.v, '"') + '"'; return;
      case K.Pair: this.out += formatPairPart(c.x) + 'x' + formatPairPart(c.y); return;
      case K.Tuple: this.out += c.v.join('.'); return;
      case K.Date: this.out += formatDate(c.v); return;
      case K.Time: this.out += (c.v < 0 ? '-' : '') + formatTime(Math.abs(c.v)); return;
      case K.String: this.indexed(c, moldString(c.s.data, all ? 0 : c.i)); return;
      case K.File: this.indexed(c, moldFile(c.s.data, all ? 0 : c.i)); return;
      case K.Email: case K.Url:
        this.indexed(c, fromCodePoints(c.s.data, all ? 0 : c.i));
        return;
      case K.Tag: this.indexed(c, '<' + fromCodePoints(c.s.data, all ? 0 : c.i) + '>'); return;
      case K.Binary: this.indexed(c, '#{' + hex(c.s.data, all ? 0 : c.i) + '}'); return;
      case K.Bitset: {
        const body = (c.neg ? 'not ' : '') + '#{' + hex(c.s.data) + '}';
        this.out += all ? `#[bitset! ${body}]` : `make bitset! ${c.neg ? '[not bits ' : ''}#{${hex(c.s.data)}}${c.neg ? ']' : ''}`;
        return;
      }
      case K.Word: this.out += spell(c.sym); return;
      case K.SetWord: this.out += spell(c.sym) + ':'; return;
      case K.GetWord: this.out += ':' + spell(c.sym); return;
      case K.LitWord: this.out += "'" + spell(c.sym); return;
      case K.Refinement: this.out += '/' + spell(c.sym); return;
      case K.Issue: this.out += '#' + spell(c.sym); return;
      case K.Block: this.blockLike(c, '[', ']', depth); return;
      case K.Paren: this.blockLike(c, '(', ')', depth); return;
      case K.Path: case K.SetPath: case K.GetPath: case K.LitPath: this.path(c, depth); return;
      case K.Map: this.map(c.s, depth); return;
      case K.Object: this.object(c.ctx, depth, all ? null : 'make object!'); return;
      case K.Error: this.object(c.ctx, depth, 'make error!'); return;
      case K.Datatype: this.out += all ? `#[datatype! ${kindName(c.k)}]` : kindName(c.k); return;
      case K.Typeset: {
        const names: string[] = [];
        for (let k = 0; k < 64; k++) if ((c.bits >> BigInt(k)) & 1n) names.push(kindName(k as Cell['t']));
        this.out += all ? `#[typeset! [${names.join(' ')}]]` : `make typeset! [${names.join(' ')}]`;
        return;
      }
      case K.Function: {
        // as Red: the source that makes it. No construction syntax loads a
        // function back, so mold/all keeps the opaque form.
        if (all) break;
        const def = c.p as FuncDef;
        this.later([
          { w: 0, text: 'func ' },
          { w: 1, c: def.specBlock, depth },
          { w: 0, text: ' ' },
          { w: 1, c: { t: K.Block, s: def.body, i: 0 }, depth },
        ]);
        return;
      }
    }
    this.out += `#[${kindName(c.t)}]`;
  }

  /** A series not at its head molds as #[kind! value index] with `all`. */
  private indexed(c: StringCell, body: string): void {
    if (this.all && c.i > 0) this.out += `#[${kindName(c.t)} ${body} ${c.i + 1}]`;
    else this.out += body;
  }

  private blockLike(c: BlockCell, open: string, close: string, depth: number): void {
    if (this.all && c.i > 0) {
      this.out += `#[${kindName(c.t)} `;
      this.later([{ w: 1, c: { ...c, i: 0 }, depth }, { w: 0, text: ` ${c.i + 1}]` }]);
      return;
    }
    if (this.active.has(c.s)) {
      this.out += open + '...' + close;
      return;
    }
    this.out += open;
    // pushed first, so it runs after the contents
    this.work.push({ w: 0, text: multiline(c.s, c.i, depth) ? '\n' + indentOf(depth) + close : close });
    this.pushContents(c.s, c.i, depth);
  }

  private pushContents(s: Series<Cell>, start: number, depth: number): void {
    this.active.add(s);
    const parts: Work[] = [];
    const indent = indentOf(depth + 1);
    for (let j = start; j < s.data.length; j++) {
      if (s.nl?.[j] && (j > start || depth >= 0)) parts.push({ w: 0, text: '\n' + indent });
      else if (j > start) parts.push({ w: 0, text: ' ' });
      parts.push({ w: 1, c: s.data[j]!, depth: depth + 1 });
    }
    parts.push({ w: 2, leave: s });
    this.later(parts);
  }

  private path(c: BlockCell, depth: number): void {
    if (c.t === K.GetPath) this.out += ':';
    if (c.t === K.LitPath) this.out += "'";
    const parts: Work[] = [];
    for (let j = c.i; j < c.s.data.length; j++) {
      if (j > c.i) parts.push({ w: 0, text: '/' });
      parts.push({ w: 1, c: c.s.data[j]!, depth });
    }
    if (c.t === K.SetPath) parts.push({ w: 0, text: ':' });
    this.later(parts);
  }

  private map(s: Series<Cell>, depth: number): void {
    if (this.active.has(s)) {
      this.out += '#(...)';
      return;
    }
    this.active.add(s);
    this.out += '#(';
    const parts: Work[] = [];
    for (let j = 0; j < s.data.length; j += 2) {
      if (j > 0) parts.push({ w: 0, text: ' ' });
      const key = s.data[j]!;
      if (key.t === K.Word) parts.push({ w: 0, text: spell(key.sym) + ':' });
      else parts.push({ w: 1, c: key, depth: depth + 1 });
      parts.push({ w: 0, text: ' ' });
      parts.push({ w: 1, c: s.data[j + 1]!, depth: depth + 1 });
    }
    parts.push({ w: 0, text: ')' }, { w: 2, leave: s });
    this.later(parts);
  }

  /** An object's fields for form: one per line, each value molded, words as they are (R3). */
  fields(ctx: Ctx): void {
    this.active.add(ctx);
    const parts: Work[] = [];
    ctx.keys.forEach((k, i) => {
      parts.push({ w: 0, text: (i > 0 ? '\n' : '') + spell(k) + ': ' }, { w: 1, c: ctx.vals[i]!, depth: 0 });
    });
    parts.push({ w: 2, leave: ctx });
    this.later(parts);
    this.run();
  }

  /** With `prefix` null, molds as construction syntax #[object! [...]]. */
  private object(ctx: Ctx, depth: number, prefix: string | null): void {
    if (this.active.has(ctx)) {
      this.out += prefix === null ? '#[object! [...]]' : prefix + ' [...]';
      return;
    }
    this.active.add(ctx);
    this.out += prefix === null ? '#[object! [' : prefix + ' [';
    const indent = indentOf(depth + 1);
    const parts: Work[] = [];
    ctx.keys.forEach((k, i) => {
      const v = ctx.vals[i]!;
      // `make object! [...]` evaluates its block, so a word or path must be quoted to stay itself
      const quote = prefix !== null && (v.t === K.Word || v.t === K.Path) ? "'" : '';
      parts.push({ w: 0, text: '\n' + indent + spell(k) + ': ' + quote });
      parts.push({ w: 1, c: v, depth: depth + 1 });
    });
    let close = prefix === null ? ']]' : ']';
    if (ctx.keys.length > 0) close = '\n' + indentOf(depth) + close;
    parts.push({ w: 0, text: close }, { w: 2, leave: ctx });
    this.later(parts);
  }
}

/** Whether contents molded from `start` put any element on a new line. */
function multiline(s: Series<Cell>, start: number, depth: number): boolean {
  if (s.nl === undefined) return false;
  for (let j = start; j < s.data.length; j++) if (s.nl[j] && (j > start || depth >= 0)) return true;
  return false;
}

/** "file:line:col" for an element of a loaded block, for error messages. */
export function sourceOf(s: Series<Cell>, index: number): string | null {
  const p = s.pos?.[index];
  if (p === undefined || p < 0) return null; // -1: inserted at run time
  const { line, col } = unpackPos(p);
  return `${s.file ? s.file + ':' : ''}${line}:${col}`;
}
