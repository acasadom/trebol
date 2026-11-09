// Bytes as text in base 2, 16 and 64, shared by the lexer (2#{...} 16#{...}
// 64#{...}) and by enbase and debase.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** The bytes the text holds in that base (white space ignored), or null if it is not valid. */
export function decodeBase(text: string, base: number): number[] | null {
  const clean = text.replace(/\s+/g, '');
  const bytes: number[] = [];
  if (base === 16) {
    if (!/^(?:[0-9A-Fa-f]{2})*$/.test(clean)) return null;
    for (let j = 0; j < clean.length; j += 2) bytes.push(parseInt(clean.slice(j, j + 2), 16));
    return bytes;
  }
  if (base === 2) {
    if (!/^(?:[01]{8})*$/.test(clean)) return null;
    for (let j = 0; j < clean.length; j += 8) bytes.push(parseInt(clean.slice(j, j + 8), 2));
    return bytes;
  }
  if (base !== 64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1) return null;
  let buf = 0;
  let bits = 0;
  for (const ch of clean.replace(/=+$/, '')) {
    buf = (buf << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 0xff);
    }
  }
  return bytes;
}

/** The bytes written in base 2, 16 (capitals) or 64 (padded with =). */
export function encodeBase(bytes: readonly number[], base: number): string {
  if (base === 16) return bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
  if (base === 2) return bytes.map(b => b.toString(2).padStart(8, '0')).join('');
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '=';
    out += i + 2 < bytes.length ? B64[n & 63]! : '=';
  }
  return out;
}
