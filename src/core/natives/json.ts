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
  type Cell, type StringCell, type WordCell,
} from '../values.ts';
import { formatTime } from '../mold.ts';
import { native, value, fail } from './define.ts';

const KEY_WORD = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/** A JSON object key as a map key: a word when it reads as one. */
function keyCell(k: string): Cell {
  return KEY_WORD.test(k) ? { t: K.Word, sym: intern(k), bind: null } : string(k);
}

interface Open { kind: 'array' | 'object'; out: Cell[]; key: Cell | null }

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
          const m = /^-?(?:0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i, i + 400));
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

/** Serializes a value as JSON. Cycles become null. */
export function toJson(v: Cell, seen: Set<unknown> = new Set()): string {
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
        const secs = d.time / 1e9;
        const whole = Math.floor(secs % 60);
        const frac = secs % 1 === 0 ? '' : String(Number((secs % 1).toFixed(9))).slice(1);
        s += `T${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(whole)}${frac}`;
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
    case K.Map: {
      if (seen.has(v.s)) return 'null';
      seen.add(v.s);
      const parts: string[] = [];
      for (let k = 0; k + 1 < v.s.data.length; k += 2) {
        const key = v.s.data[k]!;
        const name = isAnyWord(key.t) ? spell((key as WordCell).sym) : isAnyString(key.t) ? text(key as StringCell) : toJson(key);
        parts.push(`${jsonString(name)}:${toJson(v.s.data[k + 1]!, seen)}`);
      }
      seen.delete(v.s);
      return `{${parts.join(',')}}`;
    }
    case K.Object: case K.Error: {
      if (seen.has(v.ctx)) return 'null';
      seen.add(v.ctx);
      const parts = v.ctx.keys.map((key, k) => `${jsonString(spell(key))}:${toJson(v.ctx.vals[k]!, seen)}`);
      seen.delete(v.ctx);
      return `{${parts.join(',')}}`;
    }
    case K.Block: case K.Paren: {
      if (seen.has(v.s)) return 'null';
      seen.add(v.s);
      const out = `[${v.s.data.slice(v.i).map(c => toJson(c, seen)).join(',')}]`;
      seen.delete(v.s);
      return out;
    }
  }
  if (isAnyString(v.t)) return jsonString(text(v as StringCell));
  if (isAnyWord(v.t)) return jsonString(spell((v as WordCell).sym));
  return 'null';
}

native('load-json', '[source [string! binary!]]', (_t, f) => {
  const x = f.args[0]!;
  const src = x.t === K.Binary ? new TextDecoder().decode(new Uint8Array(x.s.data.slice(x.i))) : text(x as StringCell);
  const r = parseJson(src);
  return typeof r === 'string' ? fail('syntax', 'json', r) : value(r);
});

native('to-json', '[value [any-type!]]', (_t, f) => value(string(toJson(f.args[0]!))));
