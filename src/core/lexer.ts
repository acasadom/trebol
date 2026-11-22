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

import { K, kindByName, isAnyBlock, isAnyString } from './kinds.ts';
import { intern, spell as symName } from './symbols.ts';
import * as I64 from './int64.ts';
import { parseDec } from './dec.ts';
import { decodeBase } from './base.ts';
import { decodeEscape } from './escapes.ts';
import {
  NONE, UNSET, TRUE, FALSE, packPos, codePoints,
  integer, decimal, percent, money, char, pair, tuple, date, time, datatype, typeset,
  bitset, object, context,
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
    return lx.parseSeries(null);
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

function daysInMonth(y: number, m: number): number {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

// --- the lexer ---------------------------------------------------------------

class Lexer {
  private i = 0;
  private line = 1;
  private lineStart = 0;
  private readonly src: string;
  private readonly file: string | undefined;
  /** Set by loadSpans: record where each value sits. */
  track = false;
  /** loadSpans only: the spans of the series read last. */
  lastSpans: Cell[] | null = null;
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

  /** Parses values until `end` (']' or ')') or end of input when `end` is null. */
  parseSeries(end: ']' | ')' | null): Series<Cell> {
    const data: Cell[] = [];
    const nl: boolean[] = [];
    const pos: number[] = [];
    const openAt = this.i - 1;
    const spans: Cell[] | null = this.track ? [] : null;
    for (;;) {
      const sawNewline = this.skipSpace();
      const c = this.src[this.i];
      if (c === undefined) {
        if (end !== null) this.fail(`missing ${end}`, openAt);
        break;
      }
      if (c === ']' || c === ')') {
        if (c !== end) this.fail(`unexpected ${c}`);
        this.i++;
        break;
      }
      const p = packPos(this.line, this.col());
      const from = this.i;
      this.lastSpans = null;
      const v = this.parseValue();
      data.push(v);
      nl.push(sawNewline);
      pos.push(p);
      if (spans !== null) {
        const at = this.cpIndex(from);
        const span = pair(at, this.cpIndex(this.i) - at);
        const inner = (c === '[' || c === '(') && (v.t === K.Block || v.t === K.Paren) ? this.lastSpans : null;
        spans.push(inner === null ? span : { t: K.Block, s: { data: [span, ...inner] }, i: 0 });
      }
    }
    if (spans !== null) this.lastSpans = spans;
    const out: Series<Cell> = { data, nl, pos };
    if (this.file !== undefined) out.file = this.file;
    return out;
  }

  private parseValue(): Cell {
    const s = this.src;
    const c = s[this.i]!;
    switch (c) {
      case '[':
        this.i++;
        return { t: K.Block, s: this.parseSeries(']'), i: 0 };
      case '(':
        this.i++;
        return { t: K.Paren, s: this.parseSeries(')'), i: 0 };
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

  private hash(): Cell {
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
      const start = this.i - 2;
      const inner = this.parseSeries(']');
      return this.construct(inner, start);
    }
    if (next === '(') {
      this.i += 2;
      const start = this.i - 2;
      const inner = this.parseSeries(')');
      return this.mapOf(inner, start);
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

  /** #( key value ... ) — keys and values are not evaluated. */
  private mapOf(inner: Series<Cell>, start: number): Cell {
    if (inner.data.length % 2 !== 0) this.fail('a map! needs key value pairs', start);
    const data = inner.data.map((c, j) =>
      j % 2 === 0 && c.t === K.SetWord ? { t: K.Word, sym: c.sym, bind: null } as Cell : c,
    );
    return { t: K.Map, s: { data } };
  }

  /**
   * Construction syntax #[...], for values that have no literal form:
   *   #[none] #[true] #[false] #[unset]
   *   #[datatype! integer!]   #[typeset! [integer! decimal!]]
   *   #[bitset! #{...}]       #[bitset! not #{...}]
   *   #[object! [a: 1]]       #[map! [a 1]]
   *   #[string! "abc" 2]      #[block! [a b] 2]   (series with an index)
   */
  private construct(inner: Series<Cell>, start: number): Cell {
    const d = inner.data;
    const head = d[0];
    const bad = (): never => this.fail('invalid construction syntax', start);
    if (!head || head.t !== K.Word) return bad();
    const name = spellOf(head).toLowerCase();
    if (d.length === 1) {
      switch (name) {
        case 'none': case 'none!': return NONE;
        case 'unset': case 'unset!': return UNSET;
        case 'true': return TRUE;
        case 'false': return FALSE;
      }
      return bad();
    }
    const kind = kindByName(name);
    if (kind === undefined) return bad();
    const arg = d[1]!;
    switch (kind) {
      case K.Logic:
        if (d.length === 2 && arg.t === K.Word) {
          const v = spellOf(arg).toLowerCase();
          if (v === 'true') return TRUE;
          if (v === 'false') return FALSE;
        }
        return bad();
      case K.Datatype: {
        if (d.length !== 2 || arg.t !== K.Word) return bad();
        const k = kindByName(spellOf(arg));
        return k === undefined ? bad() : datatype(k);
      }
      case K.Typeset: {
        if (d.length !== 2 || arg.t !== K.Block) return bad();
        let bits = 0n;
        for (const w of arg.s.data) {
          const k = w.t === K.Word ? kindByName(spellOf(w)) : undefined;
          if (k === undefined) return bad();
          bits |= 1n << BigInt(k);
        }
        return typeset(bits);
      }
      case K.Bitset: {
        const neg = d.length === 3 && arg.t === K.Word && spellOf(arg).toLowerCase() === 'not';
        const bin = neg ? d[2]! : arg;
        if (bin.t !== K.Binary || d.length !== (neg ? 3 : 2)) return bad();
        return bitset([...bin.s.data], neg);
      }
      case K.Object: {
        if (d.length !== 2 || arg.t !== K.Block) return bad();
        const ctx = context();
        const body = arg.s.data;
        for (let j = 0; j < body.length; j += 2) {
          const key = body[j]!;
          if (key.t !== K.SetWord || j + 1 >= body.length) return bad();
          ctx.keys.push(key.sym);
          ctx.vals.push(literalValue(body[j + 1]!));
        }
        return object(ctx);
      }
      case K.Map:
        if (d.length !== 2 || arg.t !== K.Block) return bad();
        return this.mapOf(arg.s, start);
    }
    // A series at an index: #[kind! value index]
    const at = d[2];
    if (d.length === 3 && at !== undefined && at.t === K.Integer) {
      const idx = I64.toNumber(at.v) - 1;
      const ok = (isAnyString(kind) && isAnyString(arg.t)) || (isAnyBlock(kind) && isAnyBlock(arg.t));
      if (!ok || idx < 0) return bad();
      const src = arg as StringCell | BlockCell;
      if (idx > src.s.data.length) return bad();
      return { ...src, t: kind, i: idx } as Cell;
    }
    return bad();
  }

  // --- % forms -------------------------------------------------------------------

  private percentSign(): Cell {
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

  private atom(): Cell {
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
    if (a!.length >= 3) { y = Number(a); d = Number(b); } else { d = Number(a); y = Number(b); }
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

  /** Scans a path starting at the cursor: a/b, :a/b, 'a/b, a/b:, a/(x)/c. */
  private path(): Cell {
    const s = this.src;
    const start = this.i;
    let t: BlockKind = K.Path;
    if (s[this.i] === ':') { t = K.GetPath; this.i++; }
    else if (s[this.i] === "'") { t = K.LitPath; this.i++; }
    const data: Cell[] = [];
    for (;;) {
      if (s[this.i] === '(') {
        this.i++;
        data.push({ t: K.Paren, s: this.parseSeries(')'), i: 0 });
      } else {
        const segStart = this.i;
        while (!isDelimiter(s[this.i]) && s[this.i] !== '/') this.i++;
        let seg = s.slice(segStart, this.i);
        if (seg.endsWith(':') && isDelimiter(s[this.i]) && t === K.Path && data.length > 0) {
          t = K.SetPath;
          seg = seg.slice(0, -1);
        }
        data.push(this.segment(seg, segStart));
      }
      if (s[this.i] === '/') {
        this.i++;
        if (isDelimiter(s[this.i]) && s[this.i] !== '(') this.fail('path ends with /', start);
        continue;
      }
      if (!isDelimiter(s[this.i]) || s[this.i] === '(') this.fail('invalid path', start);
      break;
    }
    if (data[0]!.t !== K.Word && data[0]!.t !== K.Paren) this.fail('a path must start with a word', start);
    return { t, s: { data }, i: 0 };
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

function spellOf(c: Cell): string {
  return 'sym' in c ? symName(c.sym) : '';
}


/** In #[object! [...]] the words none, true and false stand for their values. */
function literalValue(c: Cell): Cell {
  if (c.t === K.Word) {
    switch (symName(c.sym).toLowerCase()) {
      case 'none': return NONE;
      case 'true': return TRUE;
      case 'false': return FALSE;
    }
  }
  return c;
}

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

