// Runs a .trb file (or stdin) on Node, with the full host: console, timers,
// tasks and network.
//
//   npm run trb -- examples/hello.trb
//   echo 'print 1 + 2' | npm run trb

import { readFileSync } from 'node:fs';
import { LoadError, type ObjectCell } from '../src/core/index.ts';
import { startHost, runSource, report } from '../src/host/index.ts';

const file = process.argv.slice(2).find(a => !a.startsWith('--'));
const src = readFileSync(file ?? 0, 'utf8');

const host = startHost();
try {
  await runSource(host, src, file);
} catch (e) {
  if (e instanceof LoadError) {
    console.error(`** Syntax error: ${e.message}`);
  } else {
    console.error(report(e as ObjectCell));
  }
  process.exitCode = 1;
}
