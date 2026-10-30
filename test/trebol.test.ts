// Runs the language test suites written in Trebol (test/trebol/*.trb).
// Each string names a group; each block is a test that must return true.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  makeRuntime, load, bindSeries, runSync, mold, form, errorField, text, K,
  type Cell, type BlockCell,
} from '../src/core/index.ts';

const dir = join(import.meta.dirname, 'trebol');

for (const file of readdirSync(dir).filter(f => f.endsWith('.trb')).sort()) {
  describe(file, () => {
    const rt = makeRuntime();
    const code = load(readFileSync(join(dir, file), 'utf8'), { file });
    const items = code.s.data;
    // Skip the `Trebol [header]`.
    let i = items[0]?.t === K.Word && items[1]?.t === K.Block ? 2 : 0;
    const groups: Array<{ name: string; tests: BlockCell[] }> = [];
    for (; i < items.length; i++) {
      const c: Cell = items[i]!;
      if (c.t === K.String) groups.push({ name: text(c), tests: [] });
      else if (c.t === K.Block && groups.length > 0) groups[groups.length - 1]!.tests.push(c);
      else assert.fail(`${file}: unexpected ${mold(c)}`);
    }
    for (const g of groups) {
      test(g.name, () => {
        const failures: string[] = [];
        for (const t of g.tests) {
          bindSeries(t.s, rt.user, true);
          const r = runSync(rt, t);
          const shown = mold(t);
          if (r.k === 'error') failures.push(`${shown}\n  raised: ${form(errorField(r.e, 'message'))}`);
          else if (r.k !== 'done' || r.v.t !== K.Logic || !r.v.v) {
            failures.push(`${shown}\n  gave: ${r.k === 'done' ? mold(r.v) : r.k}`);
          }
        }
        if (failures.length > 0) assert.fail(failures.join('\n'));
      });
    }
  });
}
