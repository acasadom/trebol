// Property test: for thousands of random values, load(mold/all x) == x.
// Seeded, so failures are reproducible.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  K, load, loadSpans, mold, strictEqual, I64,
  integer, decimal, percent, money, char, pair, tuple, date, time, string, stringOf,
  binary, wordOf, blockOf, map, object, context, intern, dec, NONE, TRUE, FALSE,
  type Cell, type WordKind,
} from '../src/core/index.ts';

function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(20261030);
const int = (n: number) => Math.floor(rand() * n);
const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)]!;

function randomCodePoint(): number {
  switch (int(6)) {
    case 0: return pick([0, 9, 10, 13, 0x22, 0x5e, 0x7b, 0x7d, 0x5b, 0x5d, 0x3b, 127]);
    case 1: return 0x1f300 + int(500); // emoji
    case 2: return 0xc0 + int(0x100); // accented latin
    default: return 0x20 + int(0x5f); // printable ASCII
  }
}

function randomText(max: number): string {
  let s = '';
  for (let i = int(max); i > 0; i--) s += String.fromCodePoint(randomCodePoint());
  return s;
}

const WORD_START = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZñé!?*&|=_~';
const WORD_REST = WORD_START + '0123456789-+.';

function randomWordName(): string {
  if (rand() < 0.1) return pick(['+', '-', '*', '<', '>', '<=', '<>', '==', '//', '%', '%%', '.']);
  let s = pick([...WORD_START]);
  for (let i = int(8); i > 0; i--) s += pick([...WORD_REST]);
  return s;
}

function randomScalar(): Cell {
  switch (int(16)) {
    case 0: {
      const big = I64.fromBig(BigInt.asIntN(64, BigInt(int(2 ** 31)) * BigInt(int(2 ** 31)) * BigInt(int(8) + 1)));
      return integer(rand() < 0.5 ? int(2000) - 1000 : big ?? 0);
    }
    case 1: return decimal((rand() - 0.5) * 10 ** (int(40) - 20));
    case 2: return percent((int(20000) - 10000) / 10000);
    case 3: return money(dec(BigInt(int(1e9) - 5e8), int(5)), pick(['', 'EUR', 'USD']));
    case 4: return char(randomCodePoint());
    case 5: return pair(int(4000) - 2000, (int(400) - 200) / 4);
    case 6: return tuple(Array.from({ length: 3 + int(5) }, () => int(256)));
    case 7: {
      const y = rand() < 0.2 ? int(1000) : 1900 + int(300);
      const m = 1 + int(12);
      const withTime = rand() < 0.5;
      return date({
        y, m, d: 1 + int(28),
        time: withTime ? int(86400) * 1e9 + int(1000) * 1e6 : null,
        zone: withTime && rand() < 0.5 ? (int(27) - 13) * 30 : null,
      });
    }
    case 8: return time((int(200000) - 100000) * 1e9 + int(1000) * 1e6);
    case 9: return string(randomText(20));
    case 10: return stringOf(K.File, randomText(12));
    case 11: return binary(Array.from({ length: int(10) }, () => int(256)));
    case 12: return pick([NONE, TRUE, FALSE]);
    case 13: return stringOf(K.Url, 'https://example.com/' + randomWordName().replace(/[^A-Za-z0-9]/g, '') + '?q=' + int(100));
    case 14: return stringOf(K.Tag, 'div class="' + int(10) + '"');
    default: {
      const kinds: WordKind[] = [K.Word, K.SetWord, K.GetWord, K.LitWord, K.Refinement, K.Issue];
      const t = pick(kinds);
      let name = randomWordName();
      // "//" is a word, so /// cannot be a refinement.
      while (t !== K.Word && name.includes('/')) name = randomWordName();
      return wordOf(t, name);
    }
  }
}

function randomValue(depth: number): Cell {
  if (depth > 3 || rand() < 0.7) return randomScalar();
  switch (int(4)) {
    case 0: {
      const cells = Array.from({ length: int(6) }, () => randomValue(depth + 1));
      const b = blockOf(pick([K.Block, K.Paren]), cells);
      b.s.nl = cells.map(() => rand() < 0.3);
      return b;
    }
    case 1: {
      const pairs: Cell[] = [];
      for (let i = int(4); i > 0; i--) {
        pairs.push(rand() < 0.7 ? wordOf(K.Word, 'k' + i) : string('k' + i), randomValue(depth + 1));
      }
      return map(pairs);
    }
    case 2: {
      const ctx = context();
      for (let i = int(4); i > 0; i--) {
        ctx.keys.push(intern('field' + i));
        ctx.vals.push(randomScalar());
      }
      return object(ctx);
    }
    default:
      return blockOf(K.Path, [wordOf(K.Word, 'a' + int(9)), wordOf(K.Word, 'b'), integer(int(9))]);
  }
}

test('2000 random values survive load(mold/all)', () => {
  for (let n = 0; n < 2000; n++) {
    const v = blockOf(K.Block, [randomValue(0)]);
    const text = mold(v, { all: true });
    let back: Cell;
    try {
      back = load(text).s.data[0]!;
    } catch (e) {
      assert.fail(`case ${n}: ${(e as Error).message}\n${text}`);
    }
    // Objects mold their fields one per line; ignore newline markers when comparing.
    assert.ok(strictEqual(v, back), `case ${n} changed:\n${text}\n${mold(back, { all: true })}`);
  }
});

/** Checks that every span of `spans` cuts out of `cps` text that loads back as the matching value of `values`. */
function spansMatch(cps: string[], values: Cell[], spans: Cell[], where: string): void {
  assert.equal(spans.length, values.length, `${where}: one span per value`);
  values.forEach((v, i) => {
    const sp = spans[i]!;
    const own = (sp.t === K.Block ? sp.s.data[0]! : sp) as { t: number; x: number; y: number };
    assert.equal(own.t, K.Pair, `${where}: a pair`);
    const cut = cps.slice(own.x - 1, own.x - 1 + own.y).join('');
    assert.ok(strictEqual(load(cut).s.data[0]!, v), `${where}/${i}: ${cut}`);
    if (sp.t === K.Block) {
      assert.ok(v.t === K.Block || v.t === K.Paren, `${where}/${i}: a block span is a block or paren`);
      const b = v as { s: { data: Cell[] }; i: number };
      spansMatch(cps, b.s.data.slice(b.i), (sp.s.data as Cell[]).slice(1), `${where}/${i}`);
    }
  });
}

test('2000 random values: load-spans cuts out each value', () => {
  for (let n = 0; n < 2000; n++) {
    const v = blockOf(K.Block, [randomValue(0)]);
    const text = mold(v, { all: true, only: true }) + ' ; a comment\n';
    const b = load(text);
    spansMatch(Array.from(text), b.s.data, loadSpans(text).s.data, `case ${n}`);
  }
});
