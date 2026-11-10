// The reference (docs/reference) is written by tools/reference.ts from each function's
// spec and the notes in docs/_reference. It must be what that would write now: a new
// function needs a topic, and a changed spec a new page (npm run reference).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pages, label, OUT } from '../tools/reference.ts';

test('the reference is the one its notes and the specs give', async () => {
  const want = await pages();
  assert.deepEqual(readdirSync(OUT).sort(), [...want.keys()].sort(), 'the pages differ: run npm run reference');
  for (const [file, text] of want) {
    assert.equal(readFileSync(join(OUT, file), 'utf8'), text, `${file} is not up to date: run npm run reference`);
  }
});

test('every function has a label of its own', async () => {
  const names = [...(await pages()).values()].join('\n').match(/^\(fn-[^)]*\)=$/gm) ?? [];
  assert.equal(new Set(names).size, names.length);
  assert.equal(label('empty?'), 'fn-empty-3f');
  assert.equal(label('<='), 'fn--3c-3d');
});
