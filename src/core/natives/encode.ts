// Bytes as text and back, hex numbers, URL escapes and checksums, as in R3
// and Red: enbase debase to-hex enhex dehex checksum; and the query of a URL
// as a map and back: load-query to-query.

import { K } from '../kinds.ts';
import { intern, canon, spell } from '../symbols.ts';
import * as I64 from '../int64.ts';
import {
  TRUE, integer, codePoints, text, string, map, block, fromCodePoints, type Cell, type StringCell, type WordCell,
} from '../values.ts';
import { decodeBase, encodeBase } from '../base.ts';
import { crc32, adler32, md5, sha1, sha256 } from '../hash.ts';
import { utf8 } from '../series.ts';
import { fieldText } from './csv.ts';
import { native, value, fail } from './define.ts';

/** The bytes of a binary, or the UTF-8 bytes of a string. */
function bytesOf(v: Cell): number[] {
  if (v.t === K.Binary) return v.s.data.slice(v.i);
  return utf8(text(v as StringCell));
}

function baseOf(f: { args: Cell[] }, at: number): number | null {
  if (f.args[at] !== TRUE) return 64;
  const b = I64.toNumber((f.args[at + 1] as { v: I64.I64 }).v);
  return b === 2 || b === 16 || b === 64 ? b : null;
}

native('enbase', '["Writes bytes as text in base 64, or another base." value [binary! any-string!] /base "2, 16 or 64" base-value [integer!]]', (_t, f) => {
  const base = baseOf(f, 1);
  if (base === null) return fail('script', 'bad-base', 'the base must be 2, 16 or 64');
  return value({ t: K.String, s: { data: codePoints(encodeBase(bytesOf(f.args[0]!), base)) }, i: 0 });
});

native('debase', '["Reads bytes written as text in base 64, or another base." value [any-string! binary!] /base "2, 16 or 64" base-value [integer!]]', (_t, f) => {
  const base = baseOf(f, 1);
  if (base === null) return fail('script', 'bad-base', 'the base must be 2, 16 or 64');
  const v = f.args[0]!;
  const src = v.t === K.Binary ? new TextDecoder().decode(new Uint8Array(v.s.data.slice(v.i))) : text(v as StringCell);
  const bytes = decodeBase(src, base);
  if (bytes === null) return fail('script', 'bad-base', `the text is not valid base ${base}`);
  return value({ t: K.Binary, s: { data: bytes }, i: 0 });
});

native('to-hex', '["The value in hexadecimal, as an issue." value [integer! tuple!] /size "Use this many digits" len [integer!]]', (_t, f) => {
  const v = f.args[0]!;
  let hex: string;
  if (v.t === K.Tuple) {
    hex = v.v.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
  } else {
    hex = BigInt.asUintN(64, BigInt((v as { v: I64.I64 }).v)).toString(16).toUpperCase().padStart(16, '0');
  }
  if (f.args[1] === TRUE) {
    const n = Math.max(1, I64.toNumber((f.args[2] as { v: I64.I64 }).v));
    hex = hex.length > n ? hex.slice(hex.length - n) : hex.padStart(n, '0');
  }
  return value({ t: K.Issue, sym: intern(hex), bind: null });
});

/** Code points with %xx escapes turned back into the characters their UTF-8 bytes spell. */
function unhex(cps: readonly number[]): number[] {
  const out: number[] = [];
  let bytes: number[] = [];
  const flush = () => {
    if (bytes.length > 0) out.push(...codePoints(new TextDecoder().decode(new Uint8Array(bytes))));
    bytes = [];
  };
  for (let i = 0; i < cps.length; i++) {
    const h = i + 2 < cps.length ? String.fromCodePoint(cps[i + 1]!, cps[i + 2]!) : '';
    if (cps[i] === 0x25 && /^[0-9A-Fa-f]{2}$/.test(h)) {
      bytes.push(parseInt(h, 16));
      i += 2;
    } else {
      flush();
      out.push(cps[i]!);
    }
  }
  flush();
  return out;
}

native('dehex', '["Turns %xx escapes in a string or URL back into characters." value [any-string!]]', (_t, f) => {
  const v = f.args[0] as StringCell;
  return value({ t: v.t, s: { data: unhex(v.s.data.slice(v.i)) }, i: 0 } as Cell);
});

// What enhex leaves as it is: in a URL or file name, what may stand in one (as
// encodeURI); in other text, only what needs no escape in a part of one (as
// encodeURIComponent), as R3 does.
const COMPONENT = /^[A-Za-z0-9\-_.!~*'()]$/;
const URI = /^[A-Za-z0-9\-_.!~*'();/?:@&=+$,#]$/;

/** Code points with every one the test refuses written as %xx escapes of its UTF-8 bytes. */
function enhexed(cps: readonly number[], keep: RegExp, plus: boolean): string {
  let s = '';
  for (const cp of cps) {
    const c = String.fromCodePoint(cp);
    if (plus && cp === 0x20) s += '+';
    else if (keep.test(c)) s += c;
    else for (const b of utf8(c)) s += '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }
  return s;
}

native('enhex', '["Writes the characters a URL cannot hold as %xx escapes." value [any-string!] /uri "Write spaces as +, as forms send them"]', (_t, f) => {
  const v = f.args[0] as StringCell;
  const keep = v.t === K.Url || v.t === K.File ? URI : COMPONENT;
  return value({ t: v.t, s: { data: codePoints(enhexed(v.s.data.slice(v.i), keep, f.args[1] === TRUE)) }, i: 0 } as Cell);
});

/** The names and values of a map, an object or a block, as a query writes them; null when one is not a name. */
export function queryText(c: Cell): string | null {
  const pairs: Cell[] = [];
  if (c.t === K.Map) pairs.push(...c.s.data);
  else if (c.t === K.Block) pairs.push(...c.s.data.slice(c.i));
  else if (c.t === K.Object) c.ctx.keys.forEach((k, j) => pairs.push({ t: K.Word, sym: k, bind: null }, c.ctx.vals[j]!));
  const parts: string[] = [];
  const part = (name: string, v: Cell): void => {
    if (v.t !== K.None) parts.push(enhexed(codePoints(name), COMPONENT, false) + '=' + enhexed(codePoints(fieldText(v)), COMPONENT, false));
  };
  for (let k = 0; k + 1 < pairs.length; k += 2) {
    const key = pairs[k]!;
    if (!(key.t >= K.Word && key.t <= K.Issue) && key.t !== K.String) return null;
    const name = fieldText(key);
    const v = pairs[k + 1]!;
    if (v.t === K.Block) for (const each of v.s.data.slice(v.i)) part(name, each);
    else part(name, v);
  }
  return parts.join('&');
}

native('to-query', '["Writes names and values as the query of a URL: q=caf%C3%A9&page=2." values [map! object! block!]]', (_t, f) => {
  const s = queryText(f.args[0]!);
  return s === null ? fail('script', 'bad-query', 'a query takes words or strings as names') : value(string(s));
});

const KEY_WORD = /^[A-Za-z_][A-Za-z0-9_-]*$/;

native('load-query', '["Reads the query of a URL as a map of strings; a name given twice holds a block." source [any-string!]]', (_t, f) => {
  const v = f.args[0] as StringCell;
  let s = fromCodePoints(v.s.data, v.i);
  if (v.t === K.Url) s = s.includes('?') ? s.slice(s.indexOf('?') + 1) : '';
  if (s.includes('#')) s = s.slice(0, s.indexOf('#'));
  if (s.startsWith('?')) s = s.slice(1);
  const names: string[] = [];
  const vals: Cell[][] = [];
  for (const part of s.split('&')) {
    if (part === '') continue;
    const at = part.indexOf('=');
    const read = (t: string): string => fromCodePoints(unhex(codePoints(t.replace(/\+/g, ' '))));
    const name = read(at < 0 ? part : part.slice(0, at));
    const val = string(at < 0 ? '' : read(part.slice(at + 1)));
    const n = names.indexOf(name);
    if (n < 0) { names.push(name); vals.push([val]); } else vals[n]!.push(val);
  }
  const pairs: Cell[] = [];
  names.forEach((name, n) => {
    pairs.push(KEY_WORD.test(name) ? { t: K.Word, sym: intern(name), bind: null } : string(name));
    pairs.push(vals[n]!.length === 1 ? vals[n]![0]! : block(vals[n]!));
  });
  return value(map(pairs));
});

const HASHES: Record<string, (b: number[]) => number[]> = { md5, sha1, sha256 };

native('checksum', '["A checksum or hash of the bytes: md5 sha1 sha256 give a binary, crc32 adler32 an integer." data [binary! any-string!] method [word!]]', (_t, f) => {
  const bytes = bytesOf(f.args[0]!);
  const name = spell(canon((f.args[1] as WordCell).sym)).toLowerCase();
  if (name === 'crc32') return value(integer(crc32(bytes)));
  if (name === 'adler32') return value(integer(adler32(bytes)));
  const hash = HASHES[name];
  if (hash === undefined) return fail('script', 'bad-method', `checksum has no method ${name}: use md5 sha1 sha256 crc32 adler32`);
  return value({ t: K.Binary, s: { data: hash(bytes) }, i: 0 });
});
