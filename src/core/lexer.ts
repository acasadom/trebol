// LOAD: source text to cells.
//
// A hand-written, single-pass lexer with no dependencies. It never evaluates
// anything: words stay words, parens stay parens. Every element of every
// block records its line and column (Series.pos) and whether a newline came
// before it (Series.nl), so mold can reproduce the layout and errors can
// point at the source.
//
// Classification of atomic tokens (numbers, dates, urls...) is done by
// ordered regular expressions on the token text, written as data so the same
// table can be ported to Zig.

import { K } from './kinds.ts';
import { intern } from './symbols.ts';
import * as I64 from './int64.ts';
import { parseDec } from './dec.ts';
import { decodeBase } from './base.ts';
import { decodeEscape } from './escapes.ts';
import { construct, mapOf } from './construct.ts';
import {
  packPos, codePoints, integer, decimal, percent, money, char, pair, tuple, date, time,
  type Cell, type Series, type BlockKind, type StringKind, type WordKind, type DateVal,
  type BlockCell, type StringCell,
} from './values.ts';

export class LoadError extends Error {
  readonly line: number;
  readonly col: number;
  readonly file: string | undefined;
  constructor(message: string, line: number, col: number, file?: string) {
    super(`${file ? file + ':' : ''}${line}:${col}: ${message}`);
    this.name = 'LoadError';
    this.line = line;
    this.col = col;
    this.file = file;
  }
}

export interface LoadOptions {
  /** File name used in error messages and kept on the loaded series. */
  file?: string;
}

/**
 * Where each value of `src` sits in the text, in the shape `load` gives it: a pair
 * `index x length` (1-based, in code points) for each value, and for a block or a paren a block
 * whose first value is its own pair and the rest its values' spans. A script header is kept.
 * Throws LoadError on malformed input, as `load`.
 */
export function loadSpans(src: string): BlockCell {
  const lx = new Lexer(src);
  lx.track = true;
  topSeries(lx);
  return { t: K.Block, s: { data: lx.lastSpans! }, i: 0 };
}

/** Loads source text into a block. Throws LoadError on malformed input. */
export function load(src: string, opts: LoadOptions = {}): BlockCell {
  const lx = new Lexer(src, opts.file);
  return { t: K.Block, s: topSeries(lx, opts.file), i: 0 };
}

/** Reads the whole text; blocks nested deeper than the stack allows are a load error, not a crash. */
function topSeries(lx: Lexer, file?: string): Series<Cell> {
  try {
    return lx.parseSeries();
  } catch (e) {
    if (e instanceof RangeError && /call stack/i.test(e.message)) throw new LoadError('blocks nested too deep', 1, 1, file);
    throw e;
  }
}

// --- token classification table --------------------------------------------

const RE = {
  integer: /^[+-]?\d[\d']*$/,
  decimal: /^[+-]?(?:\d[\d']*(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i,
  percent: /^([+-]?(?:\d[\d']*(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?)%$/i,
  pair: /^([+-]?(?:\d[\d']*(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?)x([+-]?(?:\d[\d']*(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?)$/i,
  tuple: /^\d+(?:\.\d+){2,11}$/,
  time: /^([+-]?)(\d+):(\d+)(?::(\d+(?:[.,]\d+)?))?$/,
  date: /^(\d+)([-/])([A-Za-z]+|\d+)\2(\d+)(?:[/T](.+))?$/,
  dateTime: /^(\d+):(\d+)(?::(\d+(?:[.,]\d+)?))?(Z|[+-]\d{1,2}(?::?\d{2})?)?$/i,
  money: /^([+-]?)([A-Za-z]{3})?\$([+-]?)(\d[\d']*(?:[.,]\d*)?|[.,]\d+)$/,
  url: /^[A-Za-z][A-Za-z0-9+.-]*:\S+$/,
  email: /^[^@\s]+@[^@\s]*$/,
  // Characters that may not appear anywhere in a word.
  wordBad: /[\s@#$%^,:'/\\"()[\]{};]/,
} as const;

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
];

const NS_PER_SEC = 1e9;

function isDelimiter(c: string | undefined): boolean {
  return c === undefined || c === ' ' || c === '\t' || c === '\n' || c === '\r' ||
    c === '[' || c === ']' || c === '(' || c === ')' || c === '{' || c === '}' ||
    c === '"' || c === ';' || c === '\f' || c === '\v';
}

function isWord(text: string): boolean {
  if (text === '') return false;
  if (text === '%' || text === '%%') return true; // remainder and modulo
  if (RE.wordBad.test(text)) return false;
  if (/^[+-]?\.?\d/.test(text)) return false; // 1, +1, -.5, .5 are numbers
  return true;
}

function num(text: string): number {
  return Number(text.replace(/'/g, '').replace(',', '.'));
}

/** The number in `text` times 10^shift, rounded once (15% is exactly 0.15). */
function shiftDecimal(text: string, shift: number): number {
  const clean = text.replace(/'/g, '').replace(',', '.');
  const m = /^(.*?)(?:e([+-]?\d+))?$/i.exec(clean)!;
  return Number(`${m[1]}e${Number(m[2] ?? 0) + shift}`);
}

/**
 * The year a year of one or two digits names, as R3 reads it: the one at most 50 years from now, so in 2026
 * 1-Jan-76 is 2076 and 1-Jan-77 is 1977. Three digits or more are the year as written: 1-Jan-0099 is 99.
 */
export function fullYear(n: number, thisYear = new Date().getUTCFullYear()): number {
  const last = thisYear + 50;
  const y = Math.floor(last / 100) * 100 + n;
  return y > last ? y - 100 : y;
}

function daysInMonth(y: number, m: number): number {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

// --- the lexer ---------------------------------------------------------------

type FrameKind = 'top' | 'block' | 'paren' | 'construct' | 'map' | 'pathParen';

/** A path being read: kept while one of its paren segments is a frame of its own. */
type PathState = { t: BlockKind; data: Cell[]; start: number };

/** A request from parseValue to read a nested series as a frame of its own. */
type Open = { open: FrameKind; end: ']' | ')'; start: number; path: PathState | null };

/** A series being read. nlAt, posAt and fromAt describe the value being read into it. */
type Frame = {
  kind: FrameKind;
  end: ']' | ')' | null;
  path: PathState | null;
  start: number;
  openAt: number;
  data: Cell[];
  nl: boolean[];
  pos: number[];
  spans: Cell[] | null;
  nlAt: boolean;
  posAt: number;
  fromAt: number;
};

class Lexer {
  private i = 0;
  private line = 1;
  private lineStart = 0;
  private readonly src: string;
  private readonly file: string | undefined;
  /** Set by loadSpans: record where each value sits. */
  track = false;
  /** loadSpans only: the spans of the whole text, once read. */
  lastSpans: Cell[] | null = null;
  /** loadSpans only: the spans inside the block or paren just read, for its own span. */
  private innerSpans: Cell[] | null = null;
  /** loadSpans only: code points before each UTF-16 index, when the text has surrogates. */
  private cps: number[] | null = null;
  private readonly bom: number;

  constructor(src: string, file?: string) {
    // A leading byte-order mark is not part of the source.
    this.bom = src.charCodeAt(0) === 0xfeff ? 1 : 0;
    this.src = this.bom ? src.slice(1) : src;
    this.file = file;
  }

  /** The 1-based code point index of UTF-16 index `u` in the text as given, byte-order mark included. */
  private cpIndex(u: number): number {
    if (this.cps === null && /[\uD800-\uDBFF]/.test(this.src)) {
      this.cps = [0];
      for (let j = 0; j < this.src.length; j++) {
        const c = this.src.charCodeAt(j);
        this.cps.push(this.cps[j]! + (c >= 0xdc00 && c <= 0xdfff ? 0 : 1));
      }
    }
    return (this.cps === null ? u : this.cps[u]!) + this.bom + 1;
  }

  private fail(msg: string, at = this.i): never {
    // Recompute the position of `at` from the start of its line.
    let line = 1;
    let start = 0;
    for (let j = 0; j < at && j < this.src.length; j++) {
      if (this.src[j] === '\n') { line++; start = j + 1; }
    }
    throw new LoadError(msg, line, at - start + 1, this.file);
  }

  private col(): number {
    return this.i - this.lineStart + 1;
  }

  private newline(at: number): void {
    this.line++;
    this.lineStart = at + 1;
  }

  /** Skips spaces and comments; returns true if a newline was crossed. */
  private skipSpace(): boolean {
    let sawNewline = false;
    const s = this.src;
    while (this.i < s.length) {
      const c = s[this.i]!;
      if (c === '\n') {
        this.newline(this.i);
        sawNewline = true;
        this.i++;
      } else if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') {
        this.i++;
      } else if (c === ';') {
        while (this.i < s.length && s[this.i] !== '\n') this.i++;
      } else {
        break;
      }
    }
    return sawNewline;
  }

  /**
   * Parses values until end of input. Nested blocks, parens, #[...], #(...) and the parens
   * of a path are frames on an explicit stack, never JS recursion, so nesting is bounded by
   * the heap, not the JS stack. A finished frame builds its cell and hands it to the frame
   * below, which records it with the newline, position and start it noted before the value.
   */
  parseSeries(): Series<Cell> {
    const stack: Frame[] = [this.frame('top', null, null, 0, null)];
    for (;;) {
      const f = stack[stack.length - 1]!;
      const sawNewline = this.skipSpace();
      const c = this.src[this.i];
      let v: Cell | Open;
      if (c === undefined || c === ']' || c === ')') {
        if (c === undefined) {
          if (f.end !== null) this.fail(`missing ${f.end}`, f.openAt);
        } else {
          if (c !== f.end) this.fail(`unexpected ${c}`);
          this.i++;
        }
        const out = this.close(f);
        if (stack.length === 1) {
          if (f.spans !== null) this.lastSpans = f.spans;
          return out;
        }
        stack.pop();
        v = this.finish(f, out);
      } else {
        f.nlAt = sawNewline;
        f.posAt = packPos(this.line, this.col());
        f.fromAt = this.i;
        v = this.parseValue();
      }
      if ('open' in v) {
        stack.push(this.frame(v.open, v.end, v.path, v.start, this.i - 1));
        continue;
      }
      const g = stack[stack.length - 1]!;
      g.data.push(v);
      g.nl.push(g.nlAt);
      g.pos.push(g.posAt);
      if (g.spans !== null) {
        const at = this.cpIndex(g.fromAt);
        const span = pair(at, this.cpIndex(this.i) - at);
        g.spans.push(this.innerSpans === null ? span : { t: K.Block, s: { data: [span, ...this.innerSpans] }, i: 0 });
      }
      this.innerSpans = null;
    }
  }

  private frame(kind: FrameKind, end: ']' | ')' | null, path: PathState | null, start: number, openAt: number | null): Frame {
    return {
      kind, end, path, start, openAt: openAt ?? this.i - 1,
      data: [], nl: [], pos: [], spans: this.track ? [] : null,
      nlAt: false, posAt: 0, fromAt: 0,
    };
  }

  private close(f: Frame): Series<Cell> {
    const out: Series<Cell> = { data: f.data, nl: f.nl, pos: f.pos };
    if (this.file !== undefined) out.file = this.file;
    return out;
  }

  /** The value a finished frame stands for, or the next frame its path opens. Only a block or
   * paren read as a value of its own leaves its spans for the enclosing span. */
  private finish(f: Frame, inner: Series<Cell>): Cell | Open {
    switch (f.kind) {
      case 'block':
        this.innerSpans = f.spans;
        return { t: K.Block, s: inner, i: 0 };
      case 'paren':
        this.innerSpans = f.spans;
        return { t: K.Paren, s: inner, i: 0 };
      case 'construct':
        return this.construct(inner, f.start);
      case 'map':
        return this.mapOf(inner, f.start);
      default: {
        const st = f.path!;
        st.data.push({ t: K.Paren, s: inner, i: 0 });
        return this.pathNext(st);
      }
    }
  }

  /** One value, or a request to open a nested series. */
  private parseValue(): Cell | Open {
    const s = this.src;
    const c = s[this.i]!;
    switch (c) {
      case '[':
        this.i++;
        return { open: 'block', end: ']', start: this.i - 1, path: null };
      case '(':
        this.i++;
        return { open: 'paren', end: ')', start: this.i - 1, path: null };
      case '"':
        return this.str(K.String, this.quoted());
      case '{':
        return this.str(K.String, this.braced());
      case '}':
        return this.fail('unexpected }');
      case '#':
        return this.hash();
      case '%':
        return this.percentSign();
      case '<':
        if (/[A-Za-z/!?]/.test(s[this.i + 1] ?? '')) return this.tag();
        break;
    }
    const base = /^(2|16|64)#\{/.exec(s.slice(this.i, this.i + 4));
    if (base) {
      this.i += base[1]!.length + 1;
      return this.binary(Number(base[1]));
    }
    return this.atom();
  }

  private str(t: StringKind, cps: number[]): StringCell {
    return { t, s: { data: cps }, i: 0 };
  }

  // --- strings ---------------------------------------------------------------

  /** "..." with caret escapes; may not span lines. Cursor on the opening quote. */
  private quoted(): number[] {
    const s = this.src;
    const start = this.i;
    this.i++;
    const out: number[] = [];
    for (;;) {
      const c = s[this.i];
      if (c === undefined || c === '\n') this.fail('missing " to close string', start);
      if (c === '"') { this.i++; return out; }
      if (c === '^') {
        const e = decodeEscape(s, this.i + 1);
        if (!e) this.fail('invalid escape in string');
        out.push(e.cp);
        this.i = e.next;
        continue;
      }
      const cp = s.codePointAt(this.i)!;
      out.push(cp);
      this.i += cp > 0xffff ? 2 : 1;
    }
  }

  /** {...} with nesting, raw newlines and caret escapes. Cursor on the brace. */
  private braced(): number[] {
    const s = this.src;
    const start = this.i;
    this.i++;
    const out: number[] = [];
    let depth = 1;
    for (;;) {
      const c = s[this.i];
      if (c === undefined) this.fail('missing } to close string', start);
      if (c === '^') {
        const e = decodeEscape(s, this.i + 1);
        if (!e) this.fail('invalid escape in string');
        out.push(e.cp);
        this.i = e.next;
        continue;
      }
      if (c === '{') depth++;
      if (c === '}' && --depth === 0) { this.i++; return out; }
      if (c === '\n') this.newline(this.i);
      const cp = s.codePointAt(this.i)!;
      out.push(cp);
      this.i += cp > 0xffff ? 2 : 1;
    }
  }

  private tag(): Cell {
    const s = this.src;
    const start = this.i;
    this.i++;
    let quote: string | null = null;
    while (this.i < s.length) {
      const c = s[this.i]!;
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === '>') {
        const body = s.slice(start + 1, this.i);
        this.i++;
        return this.str(K.Tag, codePoints(body));
      }
      if (c === '\n') this.newline(this.i);
      this.i++;
    }
    return this.fail('missing > to close tag', start);
  }

  // --- # forms -----------------------------------------------------------------

  private hash(): Cell | Open {
    const next = this.src[this.i + 1];
    if (next === '"') {
      this.i++;
      const start = this.i;
      const cps = this.quoted();
      if (cps.length !== 1) this.fail('a char! must hold exactly one character', start);
      return char(cps[0]!);
    }
    if (next === '{') {
      this.i++;
      return this.binary(16);
    }
    if (next === '[') {
      this.i += 2;
      return { open: 'construct', end: ']', start: this.i - 2, path: null };
    }
    if (next === '(') {
      this.i += 2;
      return { open: 'map', end: ')', start: this.i - 2, path: null };
    }
    const start = this.i;
    this.i++;
    const name = this.span();
    if (name === '') this.fail('invalid issue', start);
    return { t: K.Issue, sym: intern(name), bind: null };
  }

  /** Binary literal with the cursor on '{'. */
  private binary(base: number): Cell {
    const s = this.src;
    const start = this.i;
    const close = s.indexOf('}', this.i);
    if (close < 0) this.fail('missing } to close binary', start);
    const body = s.slice(this.i + 1, close);
    for (let j = this.i; j < close; j++) if (s[j] === '\n') this.newline(j);
    this.i = close + 1;
    const bytes = decodeBase(body, base);
    if (bytes === null) this.fail(`invalid ${base === 16 ? 'hex' : `base-${base}`} binary`, start);
    return { t: K.Binary, s: { data: bytes }, i: 0 };
  }

  private mapOf(inner: Series<Cell>, start: number): Cell {
    const v = mapOf(inner.data);
    return typeof v === 'string' ? this.fail(v, start) : v;
  }

  private construct(inner: Series<Cell>, start: number): Cell {
    const v = construct(inner.data);
    return typeof v === 'string' ? this.fail(v, start) : v;
  }

  // --- % forms -------------------------------------------------------------------

  private percentSign(): Cell | Open {
    const s = this.src;
    const next = s[this.i + 1];
    if (next === '"') {
      this.i++;
      return this.str(K.File, this.quoted());
    }
    let end = this.i;
    while (!isDelimiter(s[end])) end++;
    if (/^%%?:?$/.test(s.slice(this.i, end))) {
      return this.atom(); // the words % and %%, and their set-words
    }
    const start = this.i;
    this.i++;
    const body = this.span();
    try {
      return this.str(K.File, codePoints(decodeURIComponent(body)));
    } catch {
      return this.fail('invalid file', start);
    }
  }

  // --- atoms -----------------------------------------------------------------------

  /** Reads characters up to the next delimiter. */
  private span(): string {
    const s = this.src;
    const start = this.i;
    while (!isDelimiter(s[this.i])) this.i++;
    return s.slice(start, this.i);
  }

  private atom(): Cell | Open {
    const start = this.i;
    const text = this.span();
    // A path whose next segment is a paren: a/(...)
    if (text.endsWith('/') && this.src[this.i] === '(' && text.length > 1 && !RE.url.test(text)) {
      this.i = start;
      return this.path();
    }
    const cell = this.classify(text, start);
    if (cell === 'path') {
      this.i = start;
      return this.path();
    }
    return cell;
  }

  /** Classifies a delimited token. Returns 'path' when it must be rescanned as one. */
  private classify(text: string, start: number): Cell | 'path' {
    const c = text[0]!;

    // Prefixed words and paths
    if (c === "'" || c === ':') {
      const rest = text.slice(1);
      if (isWord(rest)) return this.wordCell(c === "'" ? K.LitWord : K.GetWord, rest);
      if (rest.includes('/') && !rest.startsWith('/')) return 'path';
      return this.fail(`invalid ${c === "'" ? 'lit-word' : 'get-word'}: ${text}`, start);
    }

    // set-word (before urls: "a:" has nothing after the colon)
    if (text.endsWith(':') && text.length > 1) {
      const name = text.slice(0, -1);
      if (isWord(name)) return this.wordCell(K.SetWord, name);
      if (name.includes('/') && !name.startsWith('/') && !/^[+-]?\d/.test(name)) return 'path';
    }

    // Numbers and number-like scalars
    if (/^[+-]?[\d.,$]/.test(text) && !isWord(text)) {
      const v = this.number(text, start);
      if (v) return v;
    }
    if (RE.money.test(text)) return this.number(text, start)!;

    if (RE.url.test(text)) return this.str(K.Url, codePoints(text));
    if (RE.email.test(text) && c !== '/') return this.str(K.Email, codePoints(text));

    if (c === '/') {
      if (text === '/' || text === '//') return this.wordCell(K.Word, text);
      const name = text.slice(1);
      if (isWord(name)) return this.wordCell(K.Refinement, name);
      return this.fail(`invalid refinement: ${text}`, start);
    }
    if (text.includes('/')) return 'path';
    if (isWord(text)) return this.wordCell(K.Word, text);
    return this.fail(`invalid value: ${text}`, start);
  }

  private wordCell(t: WordKind, name: string): Cell {
    return { t, sym: intern(name), bind: null };
  }

  /** Numbers, money, percent, pair, tuple, time and date. Null if none matches. */
  private number(text: string, start: number): Cell | null {
    let m: RegExpExecArray | null;
    if (RE.integer.test(text)) {
      const v = I64.parse(text);
      if (v === null) this.fail(`integer out of 64-bit range: ${text}`, start);
      return integer(v);
    }
    if (RE.decimal.test(text)) return decimal(num(text));
    if ((m = RE.percent.exec(text))) return percent(shiftDecimal(m[1]!, -2));
    if ((m = RE.money.exec(text))) {
      const v = parseDec(m[4]!)!;
      const negative = (m[1] === '-') !== (m[3] === '-');
      return money(negative ? { d: -v.d, e: v.e } : v, (m[2] ?? '').toUpperCase());
    }
    if ((m = RE.pair.exec(text))) return pair(num(m[1]!), num(m[2]!));
    if (RE.tuple.test(text)) {
      const parts = text.split('.').map(Number);
      if (parts.some(p => p > 255)) this.fail(`tuple values must be 0-255: ${text}`, start);
      return tuple(parts);
    }
    if ((m = RE.time.exec(text))) {
      const ns = timeNs(m[2]!, m[3]!, m[4]);
      return time(m[1] === '-' ? -ns : ns);
    }
    if ((m = RE.date.exec(text))) return this.dateCell(m, text, start);
    return null;
  }

  private dateCell(m: RegExpExecArray, text: string, start: number): Cell {
    const [, a, , monthText, b, rest] = m;
    let y: number;
    let d: number;
    if (a!.length >= 3) { y = Number(a); d = Number(b); } else { d = Number(a); y = b!.length <= 2 ? fullYear(Number(b)) : Number(b); }
    let mon: number;
    if (/^\d+$/.test(monthText!)) {
      mon = Number(monthText);
    } else {
      const lower = monthText!.toLowerCase();
      mon = lower.length >= 3 ? MONTHS.findIndex(n => n.startsWith(lower)) + 1 : 0;
    }
    if (mon < 1 || mon > 12 || d < 1 || d > daysInMonth(y, mon)) {
      this.fail(`invalid date: ${text}`, start);
    }
    const v: DateVal = { y, m: mon, d, time: null, zone: null };
    if (rest !== undefined) {
      const t = RE.dateTime.exec(rest);
      if (!t) this.fail(`invalid time in date: ${text}`, start);
      v.time = timeNs(t[1]!, t[2]!, t[3]);
      if (t[4] !== undefined) v.zone = parseZone(t[4]);
    }
    return date(v);
  }

  // --- paths -----------------------------------------------------------------------

  /** Scans a path starting at the cursor: a/b, :a/b, 'a/b, a/b:, a/(x)/c. A paren segment
   * is opened as a frame; the path goes on in pathNext once the paren is read. */
  private path(): Cell | Open {
    const s = this.src;
    const st: PathState = { t: K.Path, data: [], start: this.i };
    if (s[this.i] === ':') { st.t = K.GetPath; this.i++; }
    else if (s[this.i] === "'") { st.t = K.LitPath; this.i++; }
    return this.pathSegment(st);
  }

  /** Reads segments from the cursor until the path ends or a paren segment opens. */
  private pathSegment(st: PathState): Cell | Open {
    const s = this.src;
    for (;;) {
      if (s[this.i] === '(') {
        this.i++;
        return { open: 'pathParen', end: ')', start: st.start, path: st };
      }
      const segStart = this.i;
      while (!isDelimiter(s[this.i]) && s[this.i] !== '/') this.i++;
      let seg = s.slice(segStart, this.i);
      if (seg.endsWith(':') && isDelimiter(s[this.i]) && st.t === K.Path && st.data.length > 0) {
        st.t = K.SetPath;
        seg = seg.slice(0, -1);
      }
      st.data.push(this.segment(seg, segStart));
      if (!this.pathSlash(st)) return this.pathCell(st);
    }
  }

  /** After a paren segment: the rest of the path, or the path itself when it ends there. */
  private pathNext(st: PathState): Cell | Open {
    // a/(k): 2 sets, as a/b: 2 does (R3)
    if (this.src[this.i] === ':' && st.t === K.Path && isDelimiter(this.src[this.i + 1]) && this.src[this.i + 1] !== '(') {
      st.t = K.SetPath;
      this.i++;
    }
    return this.pathSlash(st) ? this.pathSegment(st) : this.pathCell(st);
  }

  /** After a segment: true and past the '/' when another segment follows, false at the end. */
  private pathSlash(st: PathState): boolean {
    const s = this.src;
    if (s[this.i] === '/') {
      this.i++;
      if (isDelimiter(s[this.i]) && s[this.i] !== '(') this.fail('path ends with /', st.start);
      return true;
    }
    if (!isDelimiter(s[this.i]) || s[this.i] === '(') this.fail('invalid path', st.start);
    return false;
  }

  private pathCell(st: PathState): Cell {
    if (st.data[0]!.t !== K.Word && st.data[0]!.t !== K.Paren) this.fail('a path must start with a word', st.start);
    return { t: st.t, s: { data: st.data }, i: 0 };
  }

  private segment(seg: string, at: number): Cell {
    if (seg === '') this.fail('empty path segment', at);
    if (RE.integer.test(seg)) {
      const v = I64.parse(seg);
      if (v !== null) return integer(v);
    }
    if (seg[0] === ':' && isWord(seg.slice(1))) return this.wordCell(K.GetWord, seg.slice(1));
    if (seg[0] === "'" && isWord(seg.slice(1))) return this.wordCell(K.LitWord, seg.slice(1));
    if (isWord(seg)) return this.wordCell(K.Word, seg);
    return this.fail(`invalid path segment: ${seg}`, at);
  }
}

// --- helpers -----------------------------------------------------------------------

function timeNs(h: string, m: string, sec: string | undefined): number {
  const seconds = Number(h) * 3600 + Number(m) * 60;
  const frac = sec === undefined ? 0 : num(sec);
  // Round to whole nanoseconds to keep values exact and comparable.
  return Math.round(seconds * NS_PER_SEC + frac * NS_PER_SEC);
}

function parseZone(z: string): number {
  if (z === 'Z' || z === 'z') return 0;
  const m = /^([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(z)!;
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === '-' ? -minutes : minutes;
}

