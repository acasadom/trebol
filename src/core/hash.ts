// Checksums and hashes over bytes, written out so the core needs no host
// crypto: CRC-32, Adler-32, MD5, SHA-1 and SHA-256. Hashes give their
// digest as bytes; CRC-32 and Adler-32 give a number.

export function crc32(bytes: readonly number[]): number {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function adler32(bytes: readonly number[]): number {
  let a = 1;
  let b = 0;
  for (const x of bytes) {
    a = (a + x) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** The message padded to whole 64-byte blocks, with its bit length at the end. */
function pad(bytes: readonly number[], bigEndian: boolean): number[] {
  const m = bytes.slice();
  const bits = bytes.length * 8;
  m.push(0x80);
  while (m.length % 64 !== 56) m.push(0);
  const len: number[] = [];
  for (let k = 0; k < 8; k++) len.push(Math.floor(bits / 2 ** (8 * k)) & 255);
  m.push(...(bigEndian ? len.reverse() : len));
  return m;
}

function wordsOf(m: number[], at: number, bigEndian: boolean): number[] {
  const w: number[] = [];
  for (let k = 0; k < 16; k++) {
    const i = at + k * 4;
    w.push(bigEndian
      ? ((m[i]! << 24) | (m[i + 1]! << 16) | (m[i + 2]! << 8) | m[i + 3]!) >>> 0
      : (m[i]! | (m[i + 1]! << 8) | (m[i + 2]! << 16) | (m[i + 3]! << 24)) >>> 0);
  }
  return w;
}

function bytesOf(words: readonly number[], bigEndian: boolean): number[] {
  const out: number[] = [];
  for (const w of words) {
    const b = [(w >>> 24) & 255, (w >>> 16) & 255, (w >>> 8) & 255, w & 255];
    out.push(...(bigEndian ? b : b.reverse()));
  }
  return out;
}

const rotl = (x: number, n: number): number => ((x << n) | (x >>> (32 - n))) >>> 0;
const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

export function md5(bytes: readonly number[]): number[] {
  const m = pad(bytes, false);
  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let at = 0; at < m.length; at += 64) {
    const w = wordsOf(m, at, false);
    let [a, b, c, d] = h as [number, number, number, number];
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const t = d;
      d = c;
      c = b;
      b = (b + rotl((a + f + MD5_K[i]! + w[g]!) >>> 0, MD5_S[(i >> 4) * 4 + (i % 4)]!)) >>> 0;
      a = t;
    }
    h[0] = (h[0]! + a) >>> 0;
    h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0;
    h[3] = (h[3]! + d) >>> 0;
  }
  return bytesOf(h, false);
}

export function sha1(bytes: readonly number[]): number[] {
  const m = pad(bytes, true);
  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  for (let at = 0; at < m.length; at += 64) {
    const w = wordsOf(m, at, true);
    for (let i = 16; i < 80; i++) w.push(rotl(w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!, 1));
    let [a, b, c, d, e] = h as [number, number, number, number, number];
    for (let i = 0; i < 80; i++) {
      const [f, k] = i < 20 ? [(b & c) | (~b & d), 0x5a827999]
        : i < 40 ? [b ^ c ^ d, 0x6ed9eba1]
        : i < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc]
        : [b ^ c ^ d, 0xca62c1d6];
      const t = (rotl(a, 5) + f + e + k + w[i]!) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = t;
    }
    [a, b, c, d, e].forEach((x, i) => { h[i] = (h[i]! + x) >>> 0; });
  }
  return bytesOf(h, true);
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

export function sha256(bytes: readonly number[]): number[] {
  const m = pad(bytes, true);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  for (let at = 0; at < m.length; at += 64) {
    const w = wordsOf(m, at, true);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w.push((w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0);
    }
    let [a, b, c, d, e, f, g, hh] = h as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA256_K[i]! + w[i]!) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((x, i) => { h[i] = (h[i]! + x) >>> 0; });
  }
  return bytesOf(h, true);
}
