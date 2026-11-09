// Caret escapes, shared by the lexer (decoding) and mold (encoding).
//
//   ^/ line feed   ^- tab   ^@ null   ^~ delete   ^^ caret
//   ^" quote       ^{ ^}    braces    ^A..^Z control chars 1..26
//   ^(line) ^(tab) ^(null) ^(back) ^(page) ^(esc) ^(del)  named chars
//   ^(1F600)      any code point in hex

export const NAMED_CHARS: Readonly<Record<string, number>> = {
  null: 0,
  back: 8,
  tab: 9,
  line: 10,
  page: 12,
  esc: 27,
  del: 127,
};

const SINGLE: Readonly<Record<string, number>> = {
  '/': 10,
  '-': 9,
  '@': 0,
  '~': 127,
  '[': 27,
  '\\': 28,
  ']': 29,
  '_': 31,
};

/**
 * Decodes the escape that starts right after a caret at `src[i]`.
 * Returns the code point and the index after the escape, or null if malformed.
 */
export function decodeEscape(src: string, i: number): { cp: number; next: number } | null {
  const c = src[i];
  if (c === undefined) return null;
  if (c === '(') {
    const close = src.indexOf(')', i + 1);
    if (close < 0) return null;
    const body = src.slice(i + 1, close);
    const named = NAMED_CHARS[body.toLowerCase()];
    if (named !== undefined) return { cp: named, next: close + 1 };
    if (!/^[0-9A-Fa-f]{1,6}$/.test(body)) return null;
    const cp = parseInt(body, 16);
    if (cp > 0x10ffff) return null;
    return { cp, next: close + 1 };
  }
  const single = SINGLE[c];
  if (single !== undefined) return { cp: single, next: i + 1 };
  if (/[A-Za-z]/.test(c)) {
    return { cp: c.toUpperCase().charCodeAt(0) - 64, next: i + 1 };
  }
  const cp = src.codePointAt(i)!;
  return { cp, next: i + (cp > 0xffff ? 2 : 1) };
}

/**
 * Encodes a code point for use inside a quoted string or char literal.
 * `inBraces` keeps line feeds raw, as braced strings allow them.
 */
export function encodeChar(cp: number, quote: '"' | '}', inBraces = false): string {
  switch (cp) {
    case 0x5e: return '^^'; // ^
    case 10: return inBraces ? '\n' : '^/';
    case 9: return '^-';
    case 0: return '^@';
    case 127: return '^~';
  }
  if (quote === '"' && cp === 0x22) return '^"';
  // ^A..^Z, ^[ ^\ ^] ^_ as R3 and Red write them; 30 has no short form (^^ is the caret)
  if (cp >= 1 && cp <= 26) return '^' + String.fromCharCode(64 + cp);
  if (cp === 27 || cp === 28 || cp === 29 || cp === 31) return '^' + String.fromCharCode(64 + cp);
  if (cp < 32) return '^(' + cp.toString(16).toUpperCase().padStart(2, '0') + ')';
  return String.fromCodePoint(cp);
}
