// Writes the TextMate grammar that editors (VS Code) use to color Trebol:
//
//   npm run grammar
//
// The grammar follows the lexer (src/core/lexer.ts): each datatype that has a literal
// form gets a scope of its own, and a token only starts after a delimiter, as in load.
// The patterns are built here from a few named pieces so they stay readable; the JSON
// they give is in editors/vscode/syntaxes/. test/grammar.test.ts checks that file is
// the one this writes, and that the grammar colors the repository's .trb files the way
// load reads them.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const OUT = join(import.meta.dirname, '..', 'editors', 'vscode', 'syntaxes', 'trebol.tmLanguage.json');

/** Words of control flow and of making functions, colored as keywords. */
export const KEYWORDS = [
  'if', 'either', 'unless', 'case', 'switch', 'while', 'until', 'loop', 'repeat',
  'foreach', 'forall', 'forskip', 'forever', 'break', 'continue', 'return', 'exit',
  'throw', 'catch', 'try', 'attempt', 'do', 'func', 'function', 'does', 'has', 'closure',
];

/** Words whose value is a logic or none. */
export const CONSTANTS = ['true', 'false', 'none', 'yes', 'no', 'on', 'off'];

/** Words that are infix operators. */
export const OPERATORS = ['+', '-', '*', '**', '/', '//', '%', '%%', '=', '==', '<>', '!=', '<', '>', '<=', '>=', '=?', 'and', 'or', 'xor'];

const DELIMS = String.raw`\s\[\](){}";`;
/** A token starts at the beginning of a line or after a delimiter. */
const START = String.raw`(?<![^\s\[\](){}"])`;
/** A token ends before a delimiter or at the end of the line. */
const END = String.raw`(?=[${DELIMS}]|$)`;
/** The same, letting a path go on after a word. */
const END_WORD = String.raw`(?=[${DELIMS}/]|$)`;
/** Characters a word may hold (lexer: RE.wordBad). */
const WORD_CHAR = String.raw`[^\s@#$%^,:'/\\"()\[\]{};]`;
/** A word: word characters that do not start like a number. */
const WORD = String.raw`(?![+-]?\.?\d)${WORD_CHAR}+`;
/** What may follow a path's head: /segment, as many as there are. */
const SEGMENTS = String.raw`(?:/[^${DELIMS}/]+)*`;
/** A decimal number with digit groups (1'000), a comma or point and an exponent. */
const NUMBER = String.raw`[+-]?(?:\d[\d']*(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?`;
const ANY = String.raw`[^${DELIMS}]`;

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const words = (list: readonly string[]): string => list.map(escape).join('|');

/** A whole token: `body` between a delimiter and the next. */
const token = (body: string, name: string, end = END): object => ({ match: `${START}(?:${body})${end}`, name });

export function grammar(): object {
  return {
    $schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
    name: 'Trebol',
    scopeName: 'source.trebol',
    fileTypes: ['trb'],
    patterns: [{ include: '#value' }],
    repository: {
      value: {
        patterns: [
          { include: '#comment' },
          { include: '#string' },
          { include: '#braced' },
          { include: '#hash' },
          { include: '#tag' },
          { include: '#file' },
          { include: '#scalar' },
          { include: '#word' },
          { include: '#path' },
          { include: '#bracket' },
        ],
      },
      comment: { match: ';.*$', name: 'comment.line.semicolon.trebol' },
      escape: {
        match: String.raw`\^(?:\([^)]*\)|.)`,
        name: 'constant.character.escape.trebol',
      },
      string: {
        // One line only; a string left open ends at the end of its line.
        begin: '"', end: '"|$', name: 'string.quoted.double.trebol',
        patterns: [{ include: '#escape' }],
      },
      braced: {
        begin: String.raw`\{`, end: String.raw`\}`, name: 'string.quoted.other.braces.trebol',
        patterns: [{ include: '#escape' }, { include: '#braced-inner' }],
      },
      'braced-inner': {
        begin: String.raw`\{`, end: String.raw`\}`,
        patterns: [{ include: '#escape' }, { include: '#braced-inner' }],
      },
      hash: {
        patterns: [
          { match: String.raw`#"(?:\^(?:\([^)]*\)|.)|[^"])"`, name: 'constant.character.trebol' },
          {
            begin: String.raw`${START}(?:2|16|64)?#\{`, end: String.raw`\}`,
            name: 'constant.other.binary.trebol',
          },
          { match: String.raw`#[\[(]`, name: 'punctuation.definition.construction.trebol' },
          token(`#${ANY}+`, 'constant.other.issue.trebol'),
        ],
      },
      tag: {
        begin: '<(?=[A-Za-z/!?])', end: '>', name: 'entity.name.tag.trebol',
        patterns: [
          { begin: '"', end: '"' },
          { begin: "'", end: "'" },
        ],
      },
      file: {
        patterns: [
          { begin: '%"', end: '"|$', name: 'string.quoted.double.file.trebol' },
          // % and %% alone are words (remainder and modulo)
          token(`%(?!%?:?(?:[${DELIMS}]|$))${ANY}+`, 'string.unquoted.file.trebol'),
        ],
      },
      scalar: {
        patterns: [
          token(String.raw`[A-Za-z][A-Za-z0-9+.\-]*:${ANY}+`, 'markup.underline.link.url.trebol'),
          token(String.raw`[^@/${DELIMS}][^@${DELIMS}]*@[^@${DELIMS}]*`, 'string.unquoted.email.trebol'),
          token(String.raw`[+-]?(?:[A-Za-z]{3})?\$[+-]?(?:\d[\d']*(?:[.,]\d*)?|[.,]\d+)`, 'constant.numeric.money.trebol'),
          token(String.raw`\d+([-/])(?:[A-Za-z]+|\d+)\1\d+(?:[/T]${ANY}+)?`, 'constant.numeric.date.trebol'),
          token(String.raw`[+-]?\d+:\d+(?::\d+(?:[.,]\d+)?)?`, 'constant.numeric.time.trebol'),
          token(String.raw`\d+(?:\.\d+){2,11}`, 'constant.numeric.tuple.trebol'),
          token(`${NUMBER}[xX]${NUMBER}`, 'constant.numeric.pair.trebol'),
          token(`${NUMBER}%`, 'constant.numeric.percent.trebol'),
          token(String.raw`[+-]?\d[\d']*`, 'constant.numeric.integer.trebol'),
          token(NUMBER, 'constant.numeric.decimal.trebol'),
        ],
      },
      word: {
        patterns: [
          token(`${WORD}${SEGMENTS}:`, 'entity.name.variable.set-word.trebol'),
          token(`:${WORD}${SEGMENTS}`, 'variable.other.get-word.trebol'),
          token(`'${WORD}${SEGMENTS}`, 'constant.other.symbol.lit-word.trebol'),
          token(`(?:${words(OPERATORS)})`, 'keyword.operator.trebol'),
          token(`/${WORD}`, 'variable.parameter.refinement.trebol'),
          token(`${WORD}!`, 'support.type.datatype.trebol', END_WORD),
          token(`(?i:${words(CONSTANTS)})`, 'constant.language.trebol', END_WORD),
          token(`(?i:${words(KEYWORDS)})`, 'keyword.control.trebol', END_WORD),
        ],
      },
      path: {
        // The rest of a path after its head: a/b/c, x/(i)
        match: String.raw`(?<=[^${DELIMS}]|\))/`, name: 'punctuation.separator.path.trebol',
      },
      bracket: {
        patterns: [
          { match: String.raw`[\[\]]`, name: 'punctuation.section.block.trebol' },
          { match: String.raw`[()]`, name: 'punctuation.section.paren.trebol' },
        ],
      },
    },
  };
}

export function grammarText(): string {
  return JSON.stringify(grammar(), null, 2) + '\n';
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) {
  writeFileSync(OUT, grammarText());
  console.log(`wrote ${OUT}`);
}
