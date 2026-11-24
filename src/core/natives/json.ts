// JSON, with our own parser so 64-bit ids survive: integers stay integer!
// (exact up to 64 bits), and only numbers with a fraction or exponent, or
// beyond 64 bits, become decimal!.
//
// Objects load as map! with word keys when the key is a plain identifier
// (so paths work: `client/name`), and string keys otherwise. Arrays load as
// block!, null as none. The parser keeps its own stack: deep JSON never
// touches the JS stack limit.

import { K, isAnyString, isAnyWord } from '../kinds.ts';
import { intern, spell } from '../symbols.ts';
import * as I64 from '../int64.ts';
import { formatDec } from '../dec.ts';
import {
  NONE, TRUE, FALSE, integer, decimal, string, text,
  type Cell, type StringCell, type WordCell, type BlockCell,
} from '../values.ts';
import { formatTime } from '../mold.ts';
import { native, value, fail } from './define.ts';

const KEY_WORD = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/** A JSON object key as a map key: a word when it reads as one. */
function keyCell(k: string): Cell {
  return KEY_WORD.test(k) ? { t: K.Word, sym: intern(k), bind: null } : string(k);
}

interface Open { kind: 'array' | 'object'; out: Cell[]; key: Cell | null }

// sticky: matches at lastIndex, over the whole text however long the number
const NUMBER = /-?(?:0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/y;

/** Parses JSON text; returns the value or an error message. */
export function parseJson(src: string): Cell | string {
  let i = 0;
  const stack: Open[] = [];
  let result: Cell | null = null;
  const ws = () => {
    while (i < src.length && ' \t\n\r'.includes(src[i]!)) i++;
  };
  const err = (what: string) => `invalid JSON at ${i + 1}: ${what}`;

  const str = (): string | null => {
    // src[i] is the opening quote
    let out = '';
    i++;
    while (i < src.length) {
      const c = src[i++]!;
      if (c === '"') return out;
      // JSON writes control characters only escaped
      if (c < ' ') return null;
      if (c !== '\\') {
        out += c;
        continue;
      }
      const e = src[i++];
      switch (e) {
        case '"': case '\\': case '/': out += e; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        case 'u': {
          const hex = src.slice(i, i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
          out += String.fromCharCode(parseInt(hex, 16)); // surrogate pairs join in the JS string
          i += 4;
          break;
        }
        default: return null;
      }
    }
    return null;
  };

  /** Delivers a finished value to the open container, or as the result. */
  const put = (v: Cell): string | null => {
    const top = stack[stack.length - 1];
    if (top === undefined) {
      result = v;
      return null;
    }
    if (top.kind === 'array') {
      top.out.push(v);
    } else {
      top.out.push(top.key!, v);
      top.key = null;
    }
    return null;
  };

  for (;;) {
    ws();
    const top = stack[stack.length - 1];
    if (top !== undefined && top.kind === 'object' && top.key === null) {
      // expecting a key or the end of the object
      if (src[i] === '}' && top.out.length === 0) {
        i++;
        stack.pop();
        put({ t: K.Map, s: { data: top.out } });
      } else {
        if (src[i] !== '"') return err('expected a key');
        const k = str();
        if (k === null) return err('bad string');
        ws();
        if (src[i] !== ':') return err('expected :');
        i++;
        top.key = keyCell(k);
        continue;
      }
    } else if (result === null || top !== undefined) {
      if (top !== undefined && top.kind === 'array' && src[i] === ']' && top.out.length === 0) {
        i++;
        stack.pop();
        put({ t: K.Block, s: { data: top.out }, i: 0 });
      } else {
        const c = src[i];
        if (c === undefined) return err('unexpected end');
        if (c === '{') {
          i++;
          stack.push({ kind: 'object', out: [], key: null });
          continue;
        }
        if (c === '[') {
          i++;
          stack.push({ kind: 'array', out: [], key: null });
          continue;
        }
        let v: Cell;
        if (c === '"') {
          const s = str();
          if (s === null) return err('bad string');
          v = string(s);
        } else if (src.startsWith('true', i)) {
          i += 4;
          v = TRUE;
        } else if (src.startsWith('false', i)) {
          i += 5;
          v = FALSE;
        } else if (src.startsWith('null', i)) {
          i += 4;
          v = NONE;
        } else {
          NUMBER.lastIndex = i;
          const m = NUMBER.exec(src);
          if (m === null) return err('unexpected character');
          i += m[0].length;
          const n = m[1] === undefined && m[2] === undefined ? I64.parse(m[0]) : null;
          v = n !== null ? integer(n) : decimal(Number(m[0]));
        }
        put(v);
      }
    }
    // after a value: a separator, a closer, or the end
    for (;;) {
      ws();
      const open = stack[stack.length - 1];
      if (open === undefined) {
        if (i < src.length) return err('extra text after the value');
        return result!;
      }
      const c = src[i];
      if (c === ',') {
        i++;
        break;
      }
      if ((open.kind === 'array' && c === ']') || (open.kind === 'object' && c === '}')) {
        i++;
        stack.pop();
        put(open.kind === 'array' ? { t: K.Block, s: { data: open.out }, i: 0 } : { t: K.Map, s: { data: open.out } });
        continue;
      }
      return err(c === undefined ? 'unexpected end' : `expected , or ${open.kind === 'array' ? ']' : '}'}`);
    }
  }
}

function jsonString(s: string): string {
  return JSON.stringify(s);
}

/** Functions have no JSON form: a field holding one is left out, as JSON.stringify does. */
const isFunc = (c: Cell): boolean => c.t === K.Function || c.t === K.Native || c.t === K.Op;

/** Pending writer work, last item first: text to write, a value to write, or the end of a container. */
type Work = { w: 0; text: string } | { w: 1; c: Cell } | { w: 2; leave: object };

/** Serializes a value as JSON. Cycles, and functions in a block, become null. The words true, false and
 *  none become the JSON values true, false and null; other words become strings. Iterative: a value
 *  nested any depth is written without recursing on the JS stack. */
export function toJson(v: Cell): string {
  let out = '';
  const seen = new Set<object>();
  const work: Work[] = [{ w: 1, c: v }];
  for (let item = work.pop(); item !== undefined; item = work.pop()) {
    if (item.w === 0) out += item.text;
    else if (item.w === 2) seen.delete(item.leave);
    else {
      const c = item.c;
      const key = c.t === K.Map || c.t === K.Block || c.t === K.Paren ? c.s : c.t === K.Object || c.t === K.Error ? c.ctx : null;
      if (key === null) { out += jsonScalar(c); continue; }
      if (seen.has(key)) { out += 'null'; continue; }
      seen.add(key);
      const parts: Work[] = [];
      const comma = () => { if (parts.length > 0) parts.push({ w: 0, text: ',' }); };
      if (c.t === K.Map) {
        for (let k = 0; k + 1 < c.s.data.length; k += 2) {
          const name = c.s.data[k]!, val = c.s.data[k + 1]!;
          if (isFunc(val)) continue;
          comma();
          const n = isAnyWord(name.t) ? spell((name as WordCell).sym) : isAnyString(name.t) ? text(name as StringCell) : toJson(name);
          parts.push({ w: 0, text: jsonString(n) + ':' }, { w: 1, c: val });
        }
      } else if (c.t === K.Object || c.t === K.Error) {
        c.ctx.keys.forEach((name, k) => {
          const val = c.ctx.vals[k]!;
          if (isFunc(val)) return;
          comma();
          parts.push({ w: 0, text: jsonString(spell(name)) + ':' }, { w: 1, c: val });
        });
      } else {
        const b = c as BlockCell;
        for (let j = b.i; j < b.s.data.length; j++) {
          comma();
          parts.push({ w: 1, c: b.s.data[j]! });
        }
      }
      const isList = c.t === K.Block || c.t === K.Paren;
      out += isList ? '[' : '{';
      work.push({ w: 2, leave: key }, { w: 0, text: isList ? ']' : '}' });
      for (let j = parts.length - 1; j >= 0; j--) work.push(parts[j]!);
    }
  }
  return out;
}

/** A value with nothing inside to walk, as JSON. */
function jsonScalar(v: Cell): string {
  switch (v.t) {
    case K.None: case K.Unset: return 'null';
    case K.Logic: return v.v ? 'true' : 'false';
    case K.Integer: return I64.toString(v.v);
    case K.Decimal: case K.Percent: return Number.isFinite(v.v) ? String(v.v) : 'null';
    case K.Money: return formatDec(v.v);
    case K.Char: return jsonString(String.fromCodePoint(v.v));
    case K.Date: {
      const d = v.v;
      const pad = (n: number, w = 2) => String(n).padStart(w, '0');
      let s = `${pad(d.y, 4)}-${pad(d.m)}-${pad(d.d)}`;
      if (d.time !== null) {
        // whole seconds and nanoseconds apart, so a fraction is always digits, never 1e-9
        const secs = Math.floor(d.time / 1e9), ns = d.time - secs * 1e9;
        const frac = ns === 0 ? '' : '.' + String(ns).padStart(9, '0').replace(/0+$/, '');
        s += `T${pad(Math.floor(secs / 3600))}:${pad(Math.floor(secs / 60) % 60)}:${pad(secs % 60)}${frac}`;
        if (d.zone !== null) {
          const z = Math.abs(d.zone);
          s += d.zone === 0 ? 'Z' : `${d.zone < 0 ? '-' : '+'}${pad(Math.floor(z / 60))}:${pad(z % 60)}`;
        }
      }
      return jsonString(s);
    }
    case K.Time: return jsonString(formatTime(v.v));
    case K.Pair: return `[${v.x},${v.y}]`;
    case K.Tuple: return `[${v.v.join(',')}]`;
  }
  if (isAnyString(v.t)) return jsonString(text(v as StringCell));
  if (isAnyWord(v.t)) {
    const name = spell((v as WordCell).sym);
    // A map literal keeps true/false/none as words (as Red): JSON means the values.
    if (v.t === K.Word && (name === 'true' || name === 'false')) return name;
    if (v.t === K.Word && name === 'none') return 'null';
    return jsonString(name);
  }
  return 'null';
}

native('load-json', '["Reads JSON text into Trebol values: objects as maps, lists as blocks." source [string! binary!]]', (_t, f) => {
  const x = f.args[0]!;
  const src = x.t === K.Binary ? new TextDecoder().decode(new Uint8Array(x.s.data.slice(x.i))) : text(x as StringCell);
  const r = parseJson(src);
  return typeof r === 'string' ? fail('syntax', 'json', r) : value(r);
});

native('to-json', '["Writes a value as JSON text." value [any-type!]]', (_t, f) => value(string(toJson(f.args[0]!))));
