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
  switch (c.t) {
    case K.Unset:
      return '';
    case K.String: case K.File: case K.Email: case K.Url:
      return fromCodePoints(c.s.data, c.i);
    case K.Char:
      return String.fromCodePoint(c.v);
    case K.Word: case K.SetWord: case K.GetWord: case K.LitWord: case K.Refinement: case K.Issue:
      return spell(c.sym);
    case K.Block: case K.Paren:
      return c.s.data.slice(c.i).map(form).join(' ');
    case K.Object:
      return c.ctx.keys.map((k, i) => `${spell(k)}: ${form(c.ctx.vals[i]!)}`).join('\n');
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

export function formatDecimal(n: number): string {
  if (Number.isNaN(n)) return '1.#NaN';
  if (!Number.isFinite(n)) return n > 0 ? '1.#INF' : '-1.#INF';
  let s = String(n);
  if (s.includes('e')) {
    s = s.replace('e+', 'e');
    const [mant, exp] = s.split('e');
    s = (mant!.includes('.') ? mant : mant + '.0') + 'e' + exp;
  } else if (!s.includes('.')) {
    s += '.0';
  }
  return s;
}

function formatPercent(v: number): string {
  // The shortest digits that load back to exactly v (0.15 * 100 is
  // 15.000000000000002, but 0.15 should mold as 15%).
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
  let out = `${v.d}-${MONTH_ABBR[v.m - 1]}-${v.y}`;
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

const INDENT = '    ';

class Molder {
  out = '';
  private readonly all: boolean;
  private readonly active = new Set<object>();

  constructor(all: boolean) {
    this.all = all;
  }

  value(c: Cell, depth: number): void {
    const all = this.all;
    switch (c.t) {
      case K.Unset: this.out += all ? '#[unset]' : ''; return;
      case K.None: this.out += all ? '#[none]' : 'none'; return;
      case K.Logic: this.out += all ? `#[${c.v}]` : String(c.v); return;
      case K.Integer: this.out += I64.toString(c.v); return;
      case K.Decimal: this.out += formatDecimal(c.v); return;
      case K.Percent: this.out += formatPercent(c.v); return;
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
      case K.String: this.indexed(c, () => moldString(c.s.data, all ? 0 : c.i)); return;
      case K.File: this.indexed(c, () => moldFile(c.s.data, all ? 0 : c.i)); return;
      case K.Email: case K.Url:
        this.indexed(c, () => fromCodePoints(c.s.data, all ? 0 : c.i));
        return;
      case K.Tag: this.indexed(c, () => '<' + fromCodePoints(c.s.data, all ? 0 : c.i) + '>'); return;
      case K.Binary: this.indexed(c, () => '#{' + hex(c.s.data, all ? 0 : c.i) + '}'); return;
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
        this.out += 'func ';
        this.blockLike(def.specBlock, '[', ']', depth);
        this.out += ' ';
        this.blockLike({ t: K.Block, s: def.body, i: 0 }, '[', ']', depth);
        return;
      }
    }
    this.out += `#[${kindName(c.t)}]`;
  }

  /** A series not at its head molds as #[kind! value index] with `all`. */
  private indexed(c: StringCell, body: () => string): void {
    if (this.all && c.i > 0) this.out += `#[${kindName(c.t)} ${body()} ${c.i + 1}]`;
    else this.out += body();
  }

  private blockLike(c: BlockCell, open: string, close: string, depth: number): void {
    if (this.all && c.i > 0) {
      this.out += `#[${kindName(c.t)} `;
      this.blockLike({ ...c, i: 0 }, open, close, depth);
      this.out += ` ${c.i + 1}]`;
      return;
    }
    if (this.active.has(c.s)) {
      this.out += open + '...' + close;
      return;
    }
    this.out += open;
    const multiline = this.contents(c.s, c.i, depth);
    if (multiline) this.out += '\n' + INDENT.repeat(depth);
    this.out += close;
  }

  /**
   * Molds series elements from `start`, honoring newline markers.
   * `depth` is the depth of the enclosing block (-1 for top-level contents).
   * Returns true if any element was placed on a new line.
   */
  contents(s: Series<Cell>, start: number, depth: number): boolean {
    this.active.add(s);
    let multiline = false;
    const indent = INDENT.repeat(depth + 1);
    for (let j = start; j < s.data.length; j++) {
      if (s.nl?.[j] && (j > start || depth >= 0)) {
        this.out += '\n' + indent;
        multiline = true;
      } else if (j > start) {
        this.out += ' ';
      }
      this.value(s.data[j]!, depth + 1);
    }
    this.active.delete(s);
    return multiline;
  }

  private path(c: BlockCell, depth: number): void {
    if (c.t === K.GetPath) this.out += ':';
    if (c.t === K.LitPath) this.out += "'";
    c.s.data.slice(c.i).forEach((seg, j) => {
      if (j > 0) this.out += '/';
      this.value(seg, depth);
    });
    if (c.t === K.SetPath) this.out += ':';
  }

  private map(s: Series<Cell>, depth: number): void {
    if (this.active.has(s)) {
      this.out += '#(...)';
      return;
    }
    this.active.add(s);
    this.out += '#(';
    for (let j = 0; j < s.data.length; j += 2) {
      if (j > 0) this.out += ' ';
      const key = s.data[j]!;
      if (key.t === K.Word) this.out += spell(key.sym) + ':';
      else this.value(key, depth + 1);
      this.out += ' ';
      this.value(s.data[j + 1]!, depth + 1);
    }
    this.out += ')';
    this.active.delete(s);
  }

  /** With `prefix` null, molds as construction syntax #[object! [...]]. */
  private object(ctx: Ctx, depth: number, prefix: string | null): void {
    if (this.active.has(ctx)) {
      this.out += prefix === null ? '#[object! [...]]' : prefix + ' [...]';
      return;
    }
    this.active.add(ctx);
    this.out += prefix === null ? '#[object! [' : prefix + ' [';
    const indent = INDENT.repeat(depth + 1);
    ctx.keys.forEach((k, i) => {
      const v = ctx.vals[i]!;
      this.out += '\n' + indent + spell(k) + ': ';
      // `make object! [...]` evaluates its block, so a word or path must be quoted to stay itself
      if (prefix !== null && (v.t === K.Word || v.t === K.Path)) this.out += "'";
      this.value(v, depth + 1);
    });
    if (ctx.keys.length > 0) this.out += '\n' + INDENT.repeat(depth);
    this.out += prefix === null ? ']]' : ']';
    this.active.delete(ctx);
  }
}

/** "file:line:col" for an element of a loaded block, for error messages. */
export function sourceOf(s: Series<Cell>, index: number): string | null {
  const p = s.pos?.[index];
  if (p === undefined || p < 0) return null; // -1: inserted at run time
  const { line, col } = unpackPos(p);
  return `${s.file ? s.file + ':' : ''}${line}:${col}`;
}
