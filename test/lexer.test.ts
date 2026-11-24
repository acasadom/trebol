import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  load, LoadError, K, kindName, spell, text, unpackPos, decToNumber, date, mold,
  type Cell, type BlockCell,
} from '../src/core/index.ts';
import { fullYear } from '../src/core/lexer.ts';

/** Loads source and returns its single value. */
function one(src: string): Cell {
  const b = load(src);
  assert.equal(b.s.data.length, 1, `expected one value in ${JSON.stringify(src)}`);
  return b.s.data[0]!;
}

function kindOf(src: string): string {
  return kindName(one(src).t);
}

function fails(src: string, message: RegExp): void {
  assert.throws(() => load(src), (e: unknown) => e instanceof LoadError && message.test(e.message));
}

describe('scalars', () => {
  test('integers', () => {
    assert.deepEqual(one('42'), { t: K.Integer, v: 42 });
    assert.deepEqual(one('-3'), { t: K.Integer, v: -3 });
    assert.deepEqual(one('+7'), { t: K.Integer, v: 7 });
    assert.deepEqual(one("1'000'000"), { t: K.Integer, v: 1000000 });
    assert.deepEqual(one('9007199254740993'), { t: K.Integer, v: 9007199254740993n });
    fails('9223372036854775808', /out of 64-bit range/);
  });

  test('decimals', () => {
    assert.deepEqual(one('1.5'), { t: K.Decimal, v: 1.5 });
    assert.deepEqual(one('1,5'), { t: K.Decimal, v: 1.5 });
    assert.deepEqual(one('.5'), { t: K.Decimal, v: 0.5 });
    assert.deepEqual(one('1e3'), { t: K.Decimal, v: 1000 });
    assert.deepEqual(one('-2.5E-3'), { t: K.Decimal, v: -0.0025 });
    assert.deepEqual(one('+.5'), { t: K.Decimal, v: 0.5 });
    assert.deepEqual(one('-.5'), { t: K.Decimal, v: -0.5 });
  });

  test('percent', () => {
    assert.deepEqual(one('15%'), { t: K.Percent, v: 0.15 });
    assert.deepEqual(one('2.5%'), { t: K.Percent, v: 0.025 });
  });

  test('money is an exact decimal with an optional currency', () => {
    const m = one('$12.50');
    assert.equal(m.t, K.Money);
    if (m.t !== K.Money) return;
    assert.equal(decToNumber(m.v), 12.5);
    assert.equal(m.cur, '');
    const e = one('EUR$-3');
    assert.ok(e.t === K.Money && e.cur === 'EUR' && e.v.d === -3n);
    const n = one('-$0.10');
    assert.ok(n.t === K.Money && n.v.d === -1n && n.v.e === 1);
  });

  test('pairs and tuples', () => {
    assert.deepEqual(one('10x20'), { t: K.Pair, x: 10, y: 20 });
    assert.deepEqual(one('-1.5x2'), { t: K.Pair, x: -1.5, y: 2 });
    assert.deepEqual(one('255.255.0'), { t: K.Tuple, v: [255, 255, 0] });
    fails('1.2.300', /0-255/);
  });

  test('times in nanoseconds', () => {
    assert.deepEqual(one('16:12'), { t: K.Time, v: (16 * 3600 + 12 * 60) * 1e9 });
    assert.deepEqual(one('0:00:05.5'), { t: K.Time, v: 5.5e9 });
    assert.deepEqual(one('-0:30'), { t: K.Time, v: -30 * 60 * 1e9 });
  });

  test('dates in day-first and ISO forms', () => {
    const want = { t: K.Date, v: { y: 2026, m: 10, d: 30, time: null, zone: null } };
    assert.deepEqual(one('30-Oct-2026'), want);
    assert.deepEqual(one('30-october-2026'), want);
    assert.deepEqual(one('2026-10-30'), want);
    assert.deepEqual(one('30/10/2026'), want);
  });

  test('dates with time and zone', () => {
    const d = one('30-Oct-2026/16:12+1:00');
    assert.deepEqual(d, {
      t: K.Date,
      v: { y: 2026, m: 10, d: 30, time: (16 * 3600 + 12 * 60) * 1e9, zone: 60 },
    });
    const iso = one('2026-10-30T16:12:00Z');
    assert.ok(iso.t === K.Date && iso.v.zone === 0);
    const west = one('2026-10-30/8:00-0530');
    assert.ok(west.t === K.Date && west.v.zone === -330);
  });

  test('a year before 1000 is molded in four digits and read back as written', () => {
    for (const y of [0, 5, 98, 99, 999]) {
      const d = date({ y, m: 1, d: 1, time: null, zone: null });
      assert.equal(mold(d), `1-Jan-${String(y).padStart(4, '0')}`);
      assert.deepEqual(one(mold(d)), d);
    }
    assert.equal(mold(date({ y: 2026, m: 1, d: 1, time: null, zone: null })), '1-Jan-2026');
  });

  test('a year of one or two digits is the one at most 50 years from now, as R3 reads it', () => {
    assert.equal(fullYear(76, 2026), 2076);
    assert.equal(fullYear(77, 2026), 1977);
    assert.equal(fullYear(0, 2026), 2000);
    assert.equal(fullYear(5, 2026), 2005);
    assert.equal(fullYear(77, 2027), 2077);
    assert.equal(fullYear(30, 2090), 2130);
    const now = new Date().getUTCFullYear();
    const year = (src: string): number => { const c = one(src); assert.ok(c.t === K.Date); return c.v.y; };
    assert.equal(year('1-Jan-99'), fullYear(99, now));
    assert.equal(year('23/11/5'), fullYear(5, now));
    assert.equal(year('1-Jan-099'), 99);
    assert.equal(year('1-Jan-0099'), 99);
    assert.equal(year('1-Jan-100'), 100);
  });

  test('invalid dates are rejected', () => {
    fails('31-Feb-2026', /invalid date/);
    fails('29-Feb-2025', /invalid date/);
    assert.equal(kindOf('29-Feb-2024'), 'date!');
  });

  test('chars with escapes', () => {
    assert.deepEqual(one('#"a"'), { t: K.Char, v: 97 });
    assert.deepEqual(one('#"^/"'), { t: K.Char, v: 10 });
    assert.deepEqual(one('#"^(tab)"'), { t: K.Char, v: 9 });
    assert.deepEqual(one('#"^(1F600)"'), { t: K.Char, v: 0x1f600 });
    assert.deepEqual(one('#"😀"'), { t: K.Char, v: 0x1f600 });
    fails('#"ab"', /exactly one character/);
  });
});

describe('strings and string-like values', () => {
  function str(src: string): string {
    const c = one(src);
    assert.ok('s' in c && 'i' in c, `${src} is not a string`);
    return text(c as Parameters<typeof text>[0]);
  }

  test('quoted strings with escapes', () => {
    assert.equal(str('"hola"'), 'hola');
    assert.equal(str('"say ^"hi^""'), 'say "hi"');
    assert.equal(str('"a^/b^-c^^"'), 'a\nb\tc^');
    fails('"open', /missing "/);
    fails('"no\nnewlines"', /missing "/);
  });

  test('braced strings nest and may span lines', () => {
    assert.equal(str('{a {b} c}'), 'a {b} c');
    assert.equal(str('{line 1\nline 2}'), 'line 1\nline 2');
    assert.equal(str('{only ^} closes}'), 'only } closes');
    fails('{open', /missing }/);
  });

  test('strings are code points, not UTF-16 units', () => {
    const c = one('"a😀b"');
    assert.ok(c.t === K.String);
    if (c.t === K.String) assert.equal(c.s.data.length, 3);
  });

  test('files, urls, emails, tags', () => {
    assert.equal(kindOf('%dir/file.trb'), 'file!');
    assert.equal(str('%my%20file.txt'), 'my file.txt');
    assert.equal(str('%"my file.txt"'), 'my file.txt');
    assert.equal(kindOf('http://example.com/a?b=1'), 'url!');
    assert.equal(kindOf('wss://example.com/live'), 'url!');
    assert.equal(kindOf('mailto:a@b.c'), 'url!');
    assert.deepEqual(load('http://x.com/(a)').s.data.map(c => kindName(c.t)), ['url!', 'paren!']);
    assert.equal(kindOf('ana@example.com'), 'email!');
    assert.equal(kindOf('<div class="x">'), 'tag!');
    assert.equal(str('<div class="a>b">'), 'div class="a>b"');
  });

  test('binary in base 16, 2 and 64', () => {
    const bytes = (src: string) => {
      const c = one(src);
      assert.equal(c.t, K.Binary);
      return c.t === K.Binary ? c.s.data : [];
    };
    assert.deepEqual(bytes('#{DEADBEEF}'), [0xde, 0xad, 0xbe, 0xef]);
    assert.deepEqual(bytes('#{de ad\n be ef}'), [0xde, 0xad, 0xbe, 0xef]);
    assert.deepEqual(bytes('2#{0000000111111111}'), [1, 255]);
    assert.deepEqual(bytes('64#{3q2+7w==}'), [0xde, 0xad, 0xbe, 0xef]);
    fails('#{ABC}', /invalid hex/);
  });
});

describe('words and paths', () => {
  function word(src: string): [string, string] {
    const c = one(src);
    assert.ok('sym' in c, `${src} is not a word`);
    return [kindName(c.t), spell((c as { sym: number }).sym)];
  }

  test('the five word forms and issues', () => {
    assert.deepEqual(word('foo'), ['word!', 'foo']);
    assert.deepEqual(word('foo:'), ['set-word!', 'foo']);
    assert.deepEqual(word(':foo'), ['get-word!', 'foo']);
    assert.deepEqual(word("'foo"), ['lit-word!', 'foo']);
    assert.deepEqual(word('/only'), ['refinement!', 'only']);
    assert.deepEqual(word('#search'), ['issue!', 'search']);
  });

  test('words keep their spelling', () => {
    assert.deepEqual(word('Foo-Bar?'), ['word!', 'Foo-Bar?']);
    assert.deepEqual(word('empty?'), ['word!', 'empty?']);
    assert.deepEqual(word('make-object!'), ['word!', 'make-object!']);
  });

  test('operator words', () => {
    for (const op of ['+', '-', '*', '/', '//', '%', '%%', '<', '>', '<=', '>=', '<>', '=', '==', '**']) {
      assert.deepEqual(word(op), ['word!', op], op);
    }
  });

  test('paths', () => {
    const p = one('a/b/1') as BlockCell;
    assert.equal(p.t, K.Path);
    assert.deepEqual(p.s.data.map(c => kindName(c.t)), ['word!', 'word!', 'integer!']);
    assert.equal(kindOf('a/b:'), 'set-path!');
    assert.equal(kindOf(':a/b'), 'get-path!');
    assert.equal(kindOf("'a/b"), 'lit-path!');
    const withParen = one('a/(1 + 1)/c') as BlockCell;
    assert.deepEqual(withParen.s.data.map(c => kindName(c.t)), ['word!', 'paren!', 'word!']);
    assert.deepEqual((one('a/:b') as BlockCell).s.data.map(c => kindName(c.t)), ['word!', 'get-word!']);
    fails('a/', /ends with \//);
    fails('1/2', /must start with a word/);
  });

  test('a path that ends with a paren and a colon is a set-path (R3)', () => {
    const p = one('a/(k):') as BlockCell;
    assert.equal(p.t, K.SetPath);
    assert.deepEqual(p.s.data.map(c => kindName(c.t)), ['word!', 'paren!']);
    assert.equal(kindOf('a/(1)/(2):'), 'set-path!');
    assert.equal(mold(load('m/(k): 1')), '[m/(k): 1]');
    fails(':a/(1): 3', /invalid path/);
    fails('a/(1):x', /invalid path/);
  });
});

describe('blocks, maps and construction syntax', () => {
  test('nested blocks and parens', () => {
    const b = one('[a (b [c])]') as BlockCell;
    assert.equal(b.t, K.Block);
    const inner = b.s.data[1] as BlockCell;
    assert.equal(inner.t, K.Paren);
    assert.equal(inner.s.data[1]!.t, K.Block);
    fails('[a', /missing ]/);
    fails('a]', /unexpected ]/);
    fails('(a]', /unexpected ]/);
  });

  test('comments are skipped', () => {
    assert.equal(load('a ; comment [\nb').s.data.length, 2);
  });

  test('maps: word keys, no evaluation', () => {
    const m = one('#(name: "Ana" age: 40 "k" 1)');
    assert.equal(m.t, K.Map);
    if (m.t !== K.Map) return;
    assert.deepEqual(m.s.data.map(c => kindName(c.t)), ['word!', 'string!', 'word!', 'integer!', 'string!', 'integer!']);
    fails('#(a: 1 b:)', /key value pairs/);
  });

  test('construction syntax', () => {
    assert.equal(kindOf('#[none]'), 'none!');
    assert.deepEqual(one('#[true]'), { t: K.Logic, v: true });
    assert.deepEqual(one('#[datatype! integer!]'), { t: K.Datatype, k: K.Integer });
    const ts = one('#[typeset! [integer! decimal!]]');
    assert.ok(ts.t === K.Typeset && ts.bits === ((1n << BigInt(K.Integer)) | (1n << BigInt(K.Decimal))));
    const obj = one('#[object! [a: 1 b: none]]');
    assert.ok(obj.t === K.Object);
    if (obj.t === K.Object) {
      assert.deepEqual(obj.ctx.keys.map(spell), ['a', 'b']);
      assert.equal(obj.ctx.vals[1]!.t, K.None);
    }
    const at = one('#[block! [a b c] 2]');
    assert.ok(at.t === K.Block && at.i === 1);
    fails('#[nonsense! 1]', /construction/);
  });
});

describe('source positions and newline markers', () => {
  test('each element knows its line and column', () => {
    const b = load('a\n  b [\n    c]', { file: 'app.trb' });
    assert.deepEqual(b.s.pos!.map(unpackPos), [{ line: 1, col: 1 }, { line: 2, col: 3 }, { line: 2, col: 5 }]);
    const inner = b.s.data[2] as BlockCell;
    assert.deepEqual(unpackPos(inner.s.pos![0]!), { line: 3, col: 5 });
    assert.equal(b.s.file, 'app.trb');
  });

  test('newline markers', () => {
    const b = load('a b\nc');
    assert.deepEqual(b.s.nl, [false, false, true]);
  });

  test('errors report file, line and column', () => {
    assert.throws(
      () => load('a: 1\nb: "open\n', { file: 'app.trb' }),
      (e: unknown) => e instanceof LoadError && e.line === 2 && e.col === 4 && e.message.startsWith('app.trb:2:4:'),
    );
  });

  test('positions after multi-line strings stay correct', () => {
    const b = load('{x\ny} z');
    assert.deepEqual(unpackPos(b.s.pos![1]!), { line: 2, col: 4 });
  });

  test('every loaded block records the file, nested ones included', () => {
    const b = load('a [b (c)]', { file: 'x.trb' });
    const inner = b.s.data[1] as BlockCell;
    assert.equal(b.s.file, 'x.trb');
    assert.equal(inner.s.file, 'x.trb');
    assert.equal((inner.s.data[1] as BlockCell).s.file, 'x.trb');
    assert.equal(load('[a]').s.file, undefined);
  });
});
