// Runs the language test suites written in Trebol (test/trebol/*.trb).
// Each string names a group; each block is a test that must return true.
// The suites in test/trebol/host/ run on a host, so they have timers, tasks and wait.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  makeRuntime, load, bindSeries, runSync, mold, form, errorField, text, scriptStart, K,
  type Cell, type BlockCell, type ObjectCell,
} from '../src/core/index.ts';
import { startHost, spawn, taskResult } from '../src/host/index.ts';

const dir = join(import.meta.dirname, 'trebol');

type Host = ReturnType<typeof startHost>;

/** Runs a test block as a task of the host, so it may wait. */
async function runOn(h: Host, t: BlockCell): Promise<{ k: 'done'; v: Cell } | { k: 'error'; e: ObjectCell }> {
  try {
    return { k: 'done', v: await taskResult(spawn(h.sch, t.s, t.i)) };
  } catch (e) {
    return { k: 'error', e: e as ObjectCell };
  }
}

const files = [
  ...readdirSync(dir).filter(f => f.endsWith('.trb')).map(f => ({ file: f, host: false })),
  ...readdirSync(join(dir, 'host')).filter(f => f.endsWith('.trb')).map(f => ({ file: join('host', f), host: true })),
].sort((a, b) => a.file.localeCompare(b.file));

for (const { file, host } of files) {
  describe(file, () => {
    const code = load(readFileSync(join(dir, file), 'utf8'), { file });
    const items = code.s.data;
    let i = scriptStart(code).start;
    const groups: Array<{ name: string; tests: BlockCell[] }> = [];
    for (; i < items.length; i++) {
      const c: Cell = items[i]!;
      if (c.t === K.String) groups.push({ name: text(c), tests: [] });
      else if (c.t === K.Block && groups.length > 0) groups[groups.length - 1]!.tests.push(c);
      else assert.fail(`${file}: unexpected ${mold(c)}`);
    }
    for (const g of groups) {
      test(g.name, async () => {
        // each group runs in a fresh runtime, so words set by one group never leak into another
        const h = host ? startHost({ onError: () => {} }) : null;
        const rt = h !== null ? h.rt : makeRuntime();
        const failures: string[] = [];
        for (const t of g.tests) {
          bindSeries(t.s, rt.user, true);
          const r = h !== null ? await runOn(h, t) : runSync(rt, t);
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
