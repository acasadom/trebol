// Copies Trebol's browser runtime into a static site, as plain JavaScript:
//
//   node tools/site.ts out/_trebol
//
// src/core, src/host and src/ui land under the folder with their types
// stripped, every .ts renamed to .js and every relative import of a .ts file
// pointed at the .js one, so any static server can serve them (a .ts file is
// not served as JavaScript). The documentation's live examples load
// _trebol/host/browser.js this way, and _trebol/workshop.js, the pretend server
// of the UI tutorial (examples/workshop.ts), which answers their requests to /api/.

import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const SRC = join(import.meta.dirname, '..', 'src');
const PARTS = ['core', 'host', 'ui'];
const WORKSHOP = join(import.meta.dirname, '..', 'examples', 'workshop.ts');

/** A module's JavaScript: types stripped, relative `.ts` imports made `.js`. */
export function toJs(ts: string): string {
  return stripTypeScriptTypes(ts, { mode: 'strip' })
    .replace(/((?:from|import)\s*\(?\s*['"])(\.\.?\/[^'"]*)\.ts(['"])/g, '$1$2.js$3');
}

function copy(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const e of readdirSync(from, { withFileTypes: true })) {
    const path = join(from, e.name);
    if (e.isDirectory()) copy(path, join(to, e.name));
    else if (e.name.endsWith('.ts')) writeFileSync(join(to, e.name.slice(0, -3) + '.js'), toJs(readFileSync(path, 'utf8')));
    else cpSync(path, join(to, e.name));
  }
}

/** Writes the runtime into `out`, replacing what was there. */
export function writeRuntime(out: string): void {
  rmSync(out, { recursive: true, force: true });
  for (const part of PARTS) copy(join(SRC, part), join(out, part));
  writeFileSync(join(out, 'workshop.js'), toJs(readFileSync(WORKSHOP, 'utf8')));
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) {
  const out = process.argv[2];
  if (out === undefined) {
    console.error('usage: node tools/site.ts <folder>');
    process.exit(1);
  }
  mkdirSync(dirname(out), { recursive: true });
  writeRuntime(out);
}
