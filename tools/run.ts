// Runs a .trb file (or stdin) on Node, with a minimal console host.
//
//   npm run trb -- examples/hello.trb
//   echo 'print 1 + 2' | npm run trb

import { readFileSync } from 'node:fs';
import {
  native, value, makeRuntime, doSource, form, mold, errorField, errorMessage, LoadError, K,
  type ObjectCell,
} from '../src/core/index.ts';

native('write-line', '[value [any-type!]]', (_t, f) => {
  console.log(form(f.args[0]!));
  return value({ t: K.Unset });
});

native('probe', '[value [any-type!]]', (_t, f) => {
  console.log(mold(f.args[0]!));
  return value(f.args[0]!);
});

/** Rebol-style multi-line report of an error. */
export function report(e: ObjectCell): string {
  const lines = [`** ${errorMessage(e)}`];
  const where = errorField(e, 'where');
  const near = errorField(e, 'near');
  const at = errorField(e, 'at');
  if (where.t !== K.None) lines.push(`** Where: ${form(where)}`);
  if (near.t !== K.None) lines.push(`** Near: ${mold(near)}`);
  if (at.t !== K.None) lines.push(`** At: ${form(at)}`);
  return lines.join('\n');
}

const file = process.argv.slice(2).find(a => !a.startsWith('--'));
const src = readFileSync(file ?? 0, 'utf8');

try {
  const rt = makeRuntime();
  doSource(rt, 'print: func [value [any-type!]] [write-line either block? :value [reduce value] [:value]]');
  const r = doSource(rt, src, file);
  if (r.k === 'error') {
    console.error(report(r.e));
    process.exit(1);
  }
} catch (e) {
  if (e instanceof LoadError) {
    console.error(`** Syntax error: ${e.message}`);
    process.exit(1);
  }
  throw e;
}
