// Every page that loads Trebol from the CDN names the minor version in package.json, so a release that bumps
// the minor fails here until README and the docs point at it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

test('CDN links name the current minor version', () => {
  const version: string = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  const minor = version.split('.').slice(0, 2).join('.');
  const files = execFileSync('git', ['ls-files', '*.md', '*.html', '*.trb'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(f => f !== '');
  const found: string[] = [];
  const wrong: string[] = [];
  for (const f of files) {
    for (const m of readFileSync(join(ROOT, f), 'utf8').matchAll(/npm\/trebol@([0-9][^/"'\s]*)/g)) {
      found.push(f);
      if (m[1] !== minor) wrong.push(`${f}: trebol@${m[1]}`);
    }
  }
  assert.ok(found.includes('README.md'), 'README.md has a CDN link');
  assert.deepEqual(wrong, [], `CDN links should be trebol@${minor}`);
});
