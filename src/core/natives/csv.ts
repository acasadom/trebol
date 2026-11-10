// CSV, as Red's codec: load-csv and to-csv.
//
// Every field loads as a string!, as in Red: "01001" stays a postal code and
// the program converts what it means as numbers. Rows end at CRLF, LF or CR;
// a field in quotes may hold delimiters, quotes (doubled) and line breaks.
// Empty lines and a byte order mark at the start are skipped.
//
// With a header (or /as-columns) columns are named by the first line, or A,
// B ... Z, AA ... as in a spreadsheet; names are string keys, as in Red. The
// parser walks the code points once with no recursion.

import { K, isAnyString, isAnyWord } from '../kinds.ts';
import { canon, intern, spell } from '../symbols.ts';
import * as I64 from '../int64.ts';
import { form } from '../mold.ts';
import {
  NONE, TRUE, string, block, map, fromCodePoints, codePoints,
  type Cell, type BlockCell, type StringCell, type WordCell,
} from '../values.ts';
import { native, value, fail } from './define.ts';

const used = (c: Cell): boolean => c === TRUE;
const CR = 13;
const LF = 10;
const QUOTE = 34;
const BOM = 0xfeff;

interface CsvOpts { delim: number[]; quote: number; trim: boolean }

/** The delimiter as code points: a char or a string, a comma when not given. */
function delimOf(c: Cell): number[] | null {
  if (c.t === K.Char) return [c.v];
  if (c.t === K.String) {
    const d = c.s.data.slice(c.i);
    return d.length === 0 ? null : d;
  }
  return [44];
}

const isSpace = (cp: number | undefined): boolean => cp === 32 || cp === 9;

/** Parses CSV text into rows of fields; returns an error message when a quote never closes. */
export function parseCsv(src: readonly number[], o: CsvOpts): string[][] | string {
  const rows: string[][] = [];
  const n = src.length;
  const d = o.delim;
  const atDelim = (i: number): boolean => {
    for (let k = 0; k < d.length; k++) if (src[i + k] !== d[k]) return false;
    return true;
  };
  const atEol = (i: number): boolean => src[i] === CR || src[i] === LF;
  let i = src[0] === BOM ? 1 : 0;
  let line = 1;
  let row: string[] = [];
  while (i < n) {
    // an empty line is no row
    if (row.length === 0 && atEol(i)) {
      i += src[i] === CR && src[i + 1] === LF ? 2 : 1;
      line++;
      continue;
    }
    const field: number[] = [];
    if (o.trim) while (isSpace(src[i])) i++;
    const quoted = src[i] === o.quote;
    if (quoted) {
      const start = line;
      i++;
      for (;;) {
        if (i >= n) return `a quoted field on line ${start} has no closing quote`;
        const c = src[i]!;
        if (c === o.quote) {
          if (src[i + 1] === o.quote) {
            field.push(c);
            i += 2;
            continue;
          }
          i++;
          break;
        }
        if (c === LF || (c === CR && src[i + 1] !== LF)) line++;
        field.push(c);
        i++;
      }
      if (o.trim) while (isSpace(src[i])) i++;
    }
    // unquoted text, or what follows a closing quote, runs to the delimiter
    while (i < n && !atEol(i) && !atDelim(i)) field.push(src[i++]!);
    if (o.trim && !quoted) while (isSpace(field[field.length - 1])) field.pop();
    row.push(fromCodePoints(field));
    if (i < n && atDelim(i)) {
      i += d.length;
      // a delimiter at the end of the line leaves an empty last field
      if (i >= n || atEol(i)) row.push('');
      else continue;
    }
    rows.push(row);
    row = [];
    if (i < n) {
      i += src[i] === CR && src[i + 1] === LF ? 2 : 1;
      line++;
    }
  }
  return rows;
}

/** A spreadsheet's name for a column: A ... Z, AA, AB ... */
function letters(k: number): string {
  let s = '';
  for (let x = k + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

/** Column names: the header's, then letters for columns past it; a repeated name gets " 2", " 3" ... */
function columnNames(header: string[] | null, count: number): string[] {
  const names: string[] = [];
  const seen = new Set<number>();
  for (let k = 0; k < count; k++) {
    const base = header !== null && k < header.length ? header[k]! : letters(k);
    let name = base;
    for (let m = 2; seen.has(canon(intern(name))); m++) name = `${base} ${m}`;
    seen.add(canon(intern(name)));
    names.push(name);
  }
  return names;
}

const field = (row: string[], k: number): Cell => (k < row.length ? string(row[k]!) : NONE);

native('load-csv', '["Reads CSV text into a block of rows, each a block of strings." data [string! binary!] /with "Another delimiter than a comma" delimiter [char! string!] /header "The first line names the columns; gives columns unless /as-records" /as-columns "A map of columns: name and block of values" /as-records "A block of maps, one per row; implies /header" /flat "One block with every field" /trim "Leave out spaces around fields" /quote "Another quote character than a double quote" qt-char [char!]]', (_t, f) => {
  const a = f.args;
  const x = a[0]!;
  const src = x.t === K.Binary
    ? codePoints(new TextDecoder().decode(new Uint8Array(x.s.data.slice(x.i))))
    : (x as StringCell).s.data.slice((x as StringCell).i);
  const delim = used(a[1]!) ? delimOf(a[2]!) : [44];
  if (delim === null) return fail('script', 'bad-delimiter', 'load-csv needs a delimiter that is not empty');
  const header = used(a[3]!);
  const columns = used(a[4]!);
  const records = used(a[5]!);
  const flat = used(a[6]!);
  if (flat && (header || columns || records)) return fail('script', 'bad-refines', 'load-csv/flat cannot have a header, columns or records');
  if (columns && records) return fail('script', 'bad-refines', 'load-csv gives columns or records, not both');
  const r = parseCsv(src, { delim, quote: used(a[8]!) ? (a[9] as { v: number }).v : QUOTE, trim: used(a[7]!) });
  if (typeof r === 'string') return fail('syntax', 'csv', r);
  if (flat) return value(block(r.flat().map(s => string(s))));
  if (!header && !columns && !records) return value(block(r.map(row => block(row.map(s => string(s))))));
  const named = header || records;
  const head = named ? r[0] ?? [] : null;
  const body = named ? r.slice(1) : r;
  const names = columnNames(head, body.reduce((m, row) => Math.max(m, row.length), head?.length ?? 0));
  if (records) {
    return value(block(body.map(row => map(names.flatMap((name, k) => [string(name), field(row, k)])))));
  }
  return value(map(names.flatMap((name, k) => [string(name), block(body.map(row => field(row, k)))])));
});

/** A value as the text of a field: none is empty, strings and words as they are, the rest formed. */
function fieldText(c: Cell): string {
  if (c.t === K.None || c.t === K.Unset) return '';
  if (isAnyString(c.t) && c.t !== K.Binary) return fromCodePoints((c as StringCell).s.data, (c as StringCell).i);
  if (isAnyWord(c.t)) return spell((c as WordCell).sym);
  return form(c);
}

/** A field written for CSV: in quotes when it holds the delimiter, a quote, a line break or edge spaces. */
function quoteField(s: string, delim: string, q: string): string {
  const needs = s.includes(delim) || s.includes(q) || s.includes('\n') || s.includes('\r')
    || (s.length > 0 && (s[0] === ' ' || s[s.length - 1] === ' '));
  return needs ? q + s.split(q).join(q + q) + q : s;
}

/** The keys of a record (map or object) and its value for a key. */
function recordKeys(c: Cell): Cell[] {
  if (c.t === K.Map) return c.s.data.filter((_, k) => k % 2 === 0);
  if (c.t === K.Object) return c.ctx.keys.map(sym => ({ t: K.Word, sym, bind: null }) as Cell);
  return [];
}

const keyCanon = (k: Cell): number => canon(intern(fieldText(k)));

function recordGet(c: Cell, key: number): Cell {
  if (c.t === K.Map) {
    const d = c.s.data;
    for (let k = 0; k + 1 < d.length; k += 2) if (keyCanon(d[k]!) === key) return d[k + 1]!;
    return NONE;
  }
  if (c.t === K.Object) {
    const k = c.ctx.keys.findIndex(sym => canon(sym) === key);
    return k < 0 ? NONE : c.ctx.vals[k]!;
  }
  return NONE;
}

/** Rows of a header and records: the header is every key in the order first seen. */
function recordRows(recs: Cell[]): Cell[][] {
  const keys: Cell[] = [];
  const seen = new Set<number>();
  for (const r of recs) {
    for (const k of recordKeys(r)) {
      const c = keyCanon(k);
      if (!seen.has(c)) {
        seen.add(c);
        keys.push(k);
      }
    }
  }
  return [keys, ...recs.map(r => keys.map(k => recordGet(r, keyCanon(k))))];
}

const isRecord = (c: Cell): boolean => c.t === K.Map || c.t === K.Object;
const itemsOf = (c: Cell): Cell[] => (c.t === K.Block ? c.s.data.slice(c.i) : [c]);

native('to-csv', '["Writes CSV text from rows: a block of blocks, of maps or objects (a header from their keys), a flat block with /skip, or a map of columns." data [block! map! object!] /with "Another delimiter than a comma" delimiter [char! string!] /skip "A flat block, so many fields to a row" size [integer!] /quote "Another quote character than a double quote" qt-char [char!]]', (_t, f) => {
  const a = f.args;
  const data = a[0]!;
  const d = used(a[1]!) ? delimOf(a[2]!) : [44];
  if (d === null) return fail('script', 'bad-delimiter', 'to-csv needs a delimiter that is not empty');
  const delim = fromCodePoints(d);
  const q = used(a[5]!) ? String.fromCodePoint((a[6] as { v: number }).v) : '"';
  let rows: Cell[][];
  if (isRecord(data)) {
    // a map or object of columns: its keys are the header
    const keys = recordKeys(data);
    const cols = keys.map(k => itemsOf(recordGet(data, keyCanon(k))));
    const count = cols.reduce((m, c) => Math.max(m, c.length), 0);
    rows = [keys];
    for (let k = 0; k < count; k++) rows.push(cols.map(c => c[k] ?? NONE));
  } else {
    const items = (data as BlockCell).s.data.slice((data as BlockCell).i);
    if (used(a[3]!)) {
      const size = I64.toNumber((a[4] as { v: I64.I64 }).v);
      if (size < 1) return fail('script', 'bad-skip', 'to-csv/skip needs a size of 1 or more');
      rows = [];
      for (let k = 0; k < items.length; k += size) rows.push(items.slice(k, k + size));
    } else if (items.length > 0 && items.every(isRecord)) {
      rows = recordRows(items);
    } else if (items.length > 0 && items[0]!.t === K.Block) {
      if (!items.every(c => c.t === K.Block)) return fail('script', 'bad-rows', 'to-csv needs every row to be a block');
      rows = items.map(c => (c as BlockCell).s.data.slice((c as BlockCell).i));
    } else if (items.some(c => c.t === K.Block || isRecord(c))) {
      return fail('script', 'bad-rows', 'to-csv needs rows all of one kind: blocks, maps or objects');
    } else {
      // a block of plain values is one row
      rows = items.length === 0 ? [] : [items];
    }
  }
  return value(string(rows.map(row => row.map(c => quoteField(fieldText(c), delim, q)).join(delim) + '\n').join('')));
});
