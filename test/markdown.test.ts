import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMd, printMd, appendText, safeHref } from '../src/host/markdown.ts';

test('markdown: what a rich text field writes reads back the same', () => {
  for (const src of [
    '',
    'plain',
    '## Title',
    '# One\n\n### Three',
    'Some **bold** and *italic* and ***both***',
    'A [link **bold**](https://example.com/a?b=1) here',
    'first line\nsecond line',
    'one\n\ntwo',
    '- a\n- *b*',
    '1. a\n2. b',
    '## T\n\ntext\n\n- a\n\n1. b',
    'stars \\* and \\[brackets\\] and \\\\',
    '\\# not a heading',
    '\\- not a list',
    '1\\. not a list',
    '**a** \\*\\*b\\*\\*',
    '[a](https://x.y/a(b).html) c',
  ]) {
    assert.equal(printMd(parseMd(src)), src);
  }
});

test('markdown: the tree', () => {
  assert.deepEqual(parseMd('## T'), [{ k: 'h', level: 2, kids: [{ k: 'text', text: 'T' }] }]);
  assert.deepEqual(parseMd('a **b**'), [{ k: 'p', kids: [{ k: 'text', text: 'a ' }, { k: 'b', kids: [{ k: 'text', text: 'b' }] }] }]);
  // what is left unclosed is text
  assert.deepEqual(parseMd('2 * 3'), [{ k: 'p', kids: [{ k: 'text', text: '2 * 3' }] }]);
  assert.deepEqual(parseMd('[a](b'), [{ k: 'p', kids: [{ k: 'text', text: '[a](b' }] }]);
  // HTML stays text
  assert.deepEqual(parseMd('<img src=x>'), [{ k: 'p', kids: [{ k: 'text', text: '<img src=x>' }] }]);
});

test('markdown: only web and mail links', () => {
  assert.equal(safeHref('https://a.b'), true);
  assert.equal(safeHref('mailto:a@b.c'), true);
  assert.equal(safeHref('javascript:alert(1)'), false);
  assert.equal(safeHref(' JaVaScRiPt:alert(1)'), false);
  assert.equal(safeHref('data:text/html,x'), false);
});

test('markdown: text added at the end', () => {
  assert.equal(appendText('', '{{name}}'), '{{name}}');
  assert.equal(appendText('Dear **Ana**', ', hi'), 'Dear **Ana**, hi');
  assert.equal(appendText('# Title', '*not bold*'), '# Title\n\n\\*not bold\\*');
  assert.equal(appendText('- one', 'after'), '- one\n\nafter');
});
