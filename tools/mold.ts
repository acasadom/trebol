// Loads a .trb file (or stdin) and prints it back with mold.
// Useful to check how the lexer reads something:
//
//   npm run mold -- examples/load-tour.trb
//   echo '[a: 1 b: "two"]' | npm run mold
//   npm run mold -- --all file.trb     (construction syntax for exact round trip)

import { readFileSync } from 'node:fs';
import { load, mold, LoadError } from '../src/core/index.ts';

const args = process.argv.slice(2);
const all = args.includes('--all');
const file = args.find(a => !a.startsWith('--'));
const src = readFileSync(file ?? 0, 'utf8');

try {
  const block = load(src, file ? { file } : {});
  console.log(mold(block, { only: true, all }));
} catch (e) {
  if (e instanceof LoadError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
