// `trebol check app.trb ...`: every problem in the layouts of the files, without running them.
//
// It lays out each block after view or layout, as the app would when it shows it, and the faces of
// every screen and row of rows, which the app lays out only when they are shown. Code of the app
// is not run: a block built by code (view compose [...]) is not checked.

import { readFile } from 'node:fs/promises';
import { K, load, LoadError, intern, bindSeries, sourceOf, text, type Cell, type BlockCell, type ObjectCell, type StringCell } from '../src/core/index.ts';
import { startHost, startUi, report } from '../src/host/index.ts';
import { spawn, taskResult } from '../src/host/scheduler.ts';

/** Checks the files; writes each problem as "file:line:col  message". True when there is none. */
export async function check(files: string[], write: (line: string) => void = console.log): Promise<boolean> {
  const host = startHost({ onError: () => {} });
  await startUi(host);
  let clean = true;
  for (const file of files) {
    let code: BlockCell;
    try {
      code = load(await readFile(file, 'utf8'), { file });
    } catch (e) {
      clean = false;
      write(e instanceof LoadError ? `${file}: ${e.message}` : `${file}: ${(e as Error).message}`);
      continue;
    }
    bindSeries(code.s, host.rt.user, true);
    const call: Cell[] = [{ t: K.Word, sym: intern('ui-check'), bind: host.rt.user }, code];
    let found: BlockCell;
    try {
      found = await taskResult(spawn(host.sch, { data: call }, 0)) as BlockCell;
    } catch (e) {
      clean = false;
      write(`${file}: ${report(e as ObjectCell)}`);
      continue;
    }
    const items = found.s.data.slice(found.i);
    const problems: Array<{ pos: number; at: string; message: string }> = [];
    for (let i = 0; i + 1 < items.length; i += 2) {
      const place = items[i] as BlockCell;
      problems.push({ pos: place.s.pos?.[place.i] ?? -1, at: sourceOf(place.s, place.i) ?? file, message: text(items[i + 1] as StringCell) });
    }
    // in the order of the file (stylize, then layouts, then screens and rows, is the order they are checked in)
    const lines = problems.sort((a, b) => a.pos - b.pos).map(p => [p.at, p.message] as const);
    const wide = Math.max(0, ...lines.map(([at]) => at.length));
    for (const [at, message] of lines) write(`${at.padEnd(wide)}  ${message}`);
    if (lines.length > 0) clean = false;
  }
  if (clean) write('No problems.');
  return clean;
}
