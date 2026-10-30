import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { load, mold, form, strictEqual, string, block, word, integer, NONE } from '../src/core/index.ts';

/** mold/only of loaded source. */
function remold(src: string, all = false): string {
  return mold(load(src), { only: true, all });
}

/** load(mold(x)) must give back a value strictly equal to x. */
function roundTrips(src: string): void {
  const first = load(src);
  const again = load(mold(first, { only: true, all: true }));
  assert.ok(strictEqual(first, again), `round trip changed ${JSON.stringify(src)}:\n${mold(again, { only: true, all: true })}`);
}

describe('mold', () => {
  test('scalars mold to their canonical form', () => {
    const cases: Array<[string, string]> = [
      ['42', '42'],
      ["1'000", '1000'],
      ['1.5', '1.5'],
      ['3.0', '3.0'],
      ['1e3', '1000.0'],
      ['1e21', '1.0e21'],
      ['15%', '15%'],
      ['$12.5', '$12.50'],
      ['$1.234', '$1.234'],
      ['eur$-3', '-EUR$3.00'],
      ['10x20', '10x20'],
      ['1.2.3', '1.2.3'],
      ['16:12:00', '16:12'],
      ['0:00:05.25', '0:00:05.25'],
      ['-0:30', '-0:30'],
      ['2026-10-30', '30-Oct-2026'],
      ['2026-10-30T16:12:00Z', '30-Oct-2026/16:12+0:00'],
      ['#"^(tab)"', '#"^-"'],
      ['#{deadbeef}', '#{DEADBEEF}'],
      ['64#{3q2+7w==}', '#{DEADBEEF}'],
    ];
    for (const [src, want] of cases) assert.equal(remold(src), want, src);
  });

  test('strings pick quotes or braces', () => {
    assert.equal(remold('"plain"'), '"plain"');
    assert.equal(remold('"say ^"hi^""'), '{say "hi"}');
    assert.equal(remold('{two\nlines}'), '{two\nlines}');
    assert.equal(remold('"caret ^^"'), '"caret ^^"');
    assert.equal(remold('{unbalanced ^{}'), '"unbalanced {"');
    assert.equal(remold('{both " and ^{}'), '{both " and ^{}');
  });

  test('files are percent-encoded when needed', () => {
    assert.equal(remold('%"my file.trb"'), '%my%20file.trb');
    assert.equal(remold('%dir/app.trb'), '%dir/app.trb');
    assert.equal(remold('%""'), '%""');
  });

  test('words, paths and maps', () => {
    assert.equal(remold("a b: :c 'd /e #f"), "a b: :c 'd /e #f");
    assert.equal(remold("a/b/1 a/b: :a/b 'a/b a/(1 + 2)"), "a/b/1 a/b: :a/b 'a/b a/(1 + 2)");
    assert.equal(remold('#(a: 1 "k" [2])'), '#(a: 1 "k" [2])');
  });

  test('newline markers shape the output', () => {
    const src = 'view [\n    title "Hi"\n    row [a b]\n]';
    assert.equal(remold(src), src);
    assert.equal(remold('[a\nb]'), '[a\n    b\n]');
  });

  test('none and logic need `all` to survive a round trip', () => {
    assert.equal(mold(block([NONE])), '[none]');
    assert.equal(mold(block([NONE]), { all: true }), '[#[none]]');
  });

  test('series not at their head', () => {
    const b = load('#[block! [a b c] 2]');
    assert.equal(mold(b, { only: true }), '[b c]');
    assert.equal(mold(b, { only: true, all: true }), '#[block! [a b c] 2]');
  });

  test('cycles do not loop forever', () => {
    const b = block([word('x')]);
    b.s.data.push(b);
    assert.equal(mold(b), '[x [...]]');
  });
});

describe('round trip: load(mold(x)) is x', () => {
  const samples = [
    '42 -7 9223372036854775807 -9223372036854775808 9007199254740993',
    '1.5 -0.25 1e-7 1.0e21 0.1',
    '15% 0.5% 33.3%',
    '$0 $12.50 -$3 USD$1000.25 $0.001',
    '10x20 -1.5x2.25 1.2.3 255.255.255.0',
    '0:00 16:12 23:59:59.999 -1:30 100:00',
    '1-Jan-2000 29-Feb-2024 30-Oct-2026/16:12:05.5-5:30 1-Jan-2026/0:00Z',
    '#"a" #"^/" #"^"" #"^^" #"😀" #"^@"',
    '"" "a" {multi\nline} "tab^-here" "quote ^" and brace {"',
    '%file.trb %dir/sub/ %"with space" http://x.com/?q=1&r=2 a@b.c <div id="x">',
    '#{} #{00FF} #[bitset! #{0F}] #[bitset! not #{F0}]',
    "a B: :c 'd /e #f-g + - // % %% <= <>",
    "%: %%: :% '%% :+ '< %%25 %f",
    "a/b c/1/d: :e/f 'g/h i/(1 + 2)/j",
    '[] [a [b [c]]] (x) ([y])',
    '#() #(a: 1) #(a: [1 2] "b" #(c: 3))',
    '#[none] #[true] #[false] #[unset] #[datatype! map!] #[typeset! [integer! string!]]',
    '#[object! [name: "Ana" tags: [a b] nested: #[object! [x: 1]]]]',
    '#[string! "hello" 3] #[block! [a b c] 4] #[paren! (1 2) 2]',
    'view [\n    title "Clients"\n    form [\n        field name "Name" required\n    ]\n]',
  ];
  for (const s of samples) test(s.slice(0, 40), () => roundTrips(s));
});

describe('form', () => {
  test('human-readable text', () => {
    assert.equal(form(string('hi')), 'hi');
    assert.equal(form(load('a "b" [c d] 1.5 #"x"')), 'a b c d 1.5 x');
    assert.equal(form(integer(3)), '3');
    assert.equal(form(load('a: 1').s.data[0]!), 'a');
  });
});
