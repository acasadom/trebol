// Bytes as text and back, hex numbers, URL escapes and checksums, as in R3
// and Red: enbase debase to-hex dehex checksum.

import { K } from '../kinds.ts';
import { intern, canon, spell } from '../symbols.ts';
import * as I64 from '../int64.ts';
import { TRUE, integer, codePoints, text, type Cell, type StringCell, type WordCell } from '../values.ts';
import { decodeBase, encodeBase } from '../base.ts';
import { crc32, adler32, md5, sha1, sha256 } from '../hash.ts';
import { utf8 } from '../series.ts';
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

native('dehex', '["Turns %xx escapes in a string or URL back into characters." value [any-string!]]', (_t, f) => {
  const v = f.args[0] as StringCell;
  const cps = v.s.data.slice(v.i);
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
  return value({ t: v.t, s: { data: out }, i: 0 } as Cell);
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
