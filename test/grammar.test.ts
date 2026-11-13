// The TextMate grammar (editors/vscode) colors Trebol in editors. It must be the one
// tools/grammar.ts writes, and color every .trb file of the repository the way load
// reads it: the token at each value's position gets the scope of that value's datatype.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import vsctm from 'vscode-textmate';
import onig from 'vscode-oniguruma';
import { K, load, spell, unpackPos, type Cell, type Series } from '../src/core/index.ts';
import { grammarText, OUT, KEYWORDS, CONSTANTS } from '../tools/grammar.ts';
import { makeRuntime, doSource, mold } from '../src/core/index.ts';

const ROOT = join(import.meta.dirname, '..');

async function tokenizer() {
  const wasm = readFileSync(createRequire(import.meta.url).resolve('vscode-oniguruma/release/onig.wasm'));
  await onig.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer);
  const registry = new vsctm.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (patterns: string[]) => new onig.OnigScanner(patterns),
      createOnigString: (s: string) => new onig.OnigString(s),
    }),
    loadGrammar: async () => vsctm.parseRawGrammar(readFileSync(OUT, 'utf8'), OUT),
  });
  const grammar = (await registry.loadGrammar('source.trebol'))!;
  /** Each line of `src` as tokens: where each starts and its innermost scope. */
  return (src: string): { start: number; end: number; scope: string }[][] => {
    let stack = vsctm.INITIAL;
    return src.split('\n').map(line => {
      const r = grammar.tokenizeLine(line, stack);
      stack = r.ruleStack;
      return r.tokens.map(t => ({ start: t.startIndex, end: t.endIndex, scope: t.scopes.at(-1)! }));
    });
  };
}

const tokenize = await tokenizer();

/** The scope of the token at `col` (1-based) of `line` (1-based). */
function scopeAt(lines: ReturnType<typeof tokenize>, line: number, col: number): string {
  const tok = lines[line - 1]!.find(t => t.start <= col - 1 && col - 1 < t.end);
  return tok?.scope ?? 'none';
}

/** The scope a value's first character must have. */
function expected(c: Cell): RegExp {
  switch (c.t) {
    case K.Integer: return /^constant\.numeric\.integer/;
    case K.Decimal: return /^constant\.numeric\.decimal/;
    case K.Percent: return /^constant\.numeric\.percent/;
    case K.Money: return /^constant\.numeric\.money/;
    case K.Pair: return /^constant\.numeric\.pair/;
    case K.Tuple: return /^constant\.numeric\.tuple/;
    case K.Time: return /^constant\.numeric\.time/;
    case K.Date: return /^constant\.numeric\.date/;
    case K.Char: return /^constant\.character\.trebol/;
    case K.String: return /^string\.quoted\.(double|other\.braces)/;
    case K.File: return /^string\.(quoted|unquoted)\.(double\.)?file/;
    case K.Url: return /^markup\.underline\.link/;
    case K.Email: return /^string\.unquoted\.email/;
    case K.Tag: return /^entity\.name\.tag/;
    case K.Binary: return /^constant\.other\.binary/;
    case K.Issue: return /^constant\.other\.issue/;
    case K.SetWord: case K.SetPath: return /^entity\.name\.variable\.set-word/;
    case K.GetWord: case K.GetPath: return /^variable\.other\.get-word/;
    case K.LitWord: case K.LitPath: return /^constant\.other\.symbol/;
    case K.Refinement: return /^variable\.parameter\.refinement/;
    case K.Block: return /^punctuation\.section\.block/;
    case K.Paren: return /^punctuation\.section\.paren/;
    case K.Map: case K.Object: case K.Bitset: case K.Typeset:
    case K.Logic: case K.None: case K.Unset: case K.Datatype:
      return /^punctuation\.definition\.construction/;
    case K.Word: {
      const name = spell(c.sym).toLowerCase();
      if (name.endsWith('!')) return /^support\.type\.datatype/;
      if (CONSTANTS.includes(name)) return /^constant\.language/;
      if (KEYWORDS.includes(name)) return /^keyword\.control/;
      return /^(source|keyword\.operator)\.trebol$/;
    }
    case K.Path: {
      const head = (c as { s: Series<Cell> }).s.data[0]!;
      return head.t === K.Paren ? /^punctuation\.section\.paren/ : expected(head);
    }
  }
  return /^$/;
}

/** Checks every value of `s` (and of the blocks and parens in it) against the grammar. */
function checkSeries(file: string, s: Series<Cell>, lines: ReturnType<typeof tokenize>, bad: string[]): void {
  s.data.forEach((c, i) => {
    const p = s.pos?.[i];
    if (p === undefined) return;
    const { line, col } = unpackPos(p);
    const got = scopeAt(lines, line, col);
    if (!expected(c).test(got)) bad.push(`${file}:${line}:${col} ${got}`);
    if ((c.t === K.Block || c.t === K.Paren) && 's' in c) checkSeries(file, c.s as Series<Cell>, lines, bad);
  });
}

function trbFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter(e => e.isFile() && e.name.endsWith('.trb'))
    .map(e => join(e.parentPath, e.name));
}

test('the grammar is the one tools/grammar.ts writes', () => {
  assert.equal(readFileSync(OUT, 'utf8'), grammarText(), 'run npm run grammar');
});

test('the grammar colors each value of the repository as load reads it', () => {
  const files = ['examples', 'src/ui', 'test/trebol', 'tools'].flatMap(d => trbFiles(join(ROOT, d)));
  assert.ok(files.length > 5);
  const bad: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    checkSeries(file.slice(ROOT.length + 1), load(src).s, tokenize(src), bad);
  }
  // and the examples of the documentation
  for (const file of readdirSync(join(ROOT, 'docs'), { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.md'))) {
    if (file.startsWith('_build') || file === 'design.md') continue;
    const md = readFileSync(join(ROOT, 'docs', file), 'utf8');
    for (const [, src] of md.matchAll(/^```trebol\n([\s\S]*?)^```$/gm)) {
      checkSeries(`docs/${file}`, load(src!).s, tokenize(src!), bad);
    }
  }
  assert.deepEqual(bad.slice(0, 20), []);
});

test('each kind of literal gets its scope', () => {
  const cases: [string, string][] = [
    ['; a note', 'comment.line.semicolon.trebol'],
    ['"a^/b"', 'string.quoted.double.trebol'],
    ['{a {b} c}', 'string.quoted.other.braces.trebol'],
    ['#"a"', 'constant.character.trebol'],
    ['#{00FF}', 'constant.other.binary.trebol'],
    ['64#{AQID}', 'constant.other.binary.trebol'],
    ['#abc', 'constant.other.issue.trebol'],
    ['<b class="x">', 'entity.name.tag.trebol'],
    ['%docs/a.trb', 'string.unquoted.file.trebol'],
    ['%"my file.txt"', 'string.quoted.double.file.trebol'],
    ['https://example.com/a?b=1', 'markup.underline.link.url.trebol'],
    ['ana@example.com', 'string.unquoted.email.trebol'],
    ['$1.50', 'constant.numeric.money.trebol'],
    ['EUR$12', 'constant.numeric.money.trebol'],
    ['13-Nov-2026', 'constant.numeric.date.trebol'],
    ['2026-11-13/10:30', 'constant.numeric.date.trebol'],
    ['10:30:15', 'constant.numeric.time.trebol'],
    ['1.2.3', 'constant.numeric.tuple.trebol'],
    ['10x20', 'constant.numeric.pair.trebol'],
    ['15%', 'constant.numeric.percent.trebol'],
    ["1'000", 'constant.numeric.integer.trebol'],
    ['-1.5e3', 'constant.numeric.decimal.trebol'],
    ['name:', 'entity.name.variable.set-word.trebol'],
    ['a/b:', 'entity.name.variable.set-word.trebol'],
    [':name', 'variable.other.get-word.trebol'],
    ["'name", 'constant.other.symbol.lit-word.trebol'],
    ['/part', 'variable.parameter.refinement.trebol'],
    ['integer!', 'support.type.datatype.trebol'],
    ['none', 'constant.language.trebol'],
    ['either', 'keyword.control.trebol'],
    ['<=', 'keyword.operator.trebol'],
  ];
  for (const [src, scope] of cases) {
    const toks = tokenize(src)[0]!;
    assert.equal(toks[0]!.scope, scope, src);
    assert.equal(toks.filter(t => t.scope === scope).at(-1)!.end, src.length, `${src} is one token`);
  }
});

test('words are colored only as whole tokens', () => {
  const toks = tokenize('iffy do-it a1 copy/part x')[0]!;
  assert.deepEqual(toks.map(t => t.scope).filter(s => s !== 'source.trebol'), ['punctuation.separator.path.trebol']);
});

test('the keywords and constants of the grammar are words of the language', () => {
  const rt = makeRuntime();
  const r = doSource(rt, `collect [foreach w [${[...KEYWORDS, ...CONSTANTS].join(' ')}] [unless value? w [keep w]]]`);
  assert.equal(r.k === 'done' ? mold(r.v) : r.k, '[]');
});
