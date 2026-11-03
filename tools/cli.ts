#!/usr/bin/env node
// The `trebol` command.
//
//   trebol dev [folder] [--port 5173] [--api api.ts]
//
// `dev` serves the folder (default: the current one) with live reload; see
// dev.ts. An app gets the command from its dependency on the package.

import { startDev } from './dev.ts';

const USAGE = 'usage: trebol dev [folder] [--port n] [--api file]';

const [command, ...rest] = process.argv.slice(2);
if (command !== 'dev') {
  console.error(USAGE);
  process.exit(1);
}
let root: string | undefined;
let port: number | undefined;
let api: string | undefined;
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a === '--port') port = Number(rest[++i]);
  else if (a === '--api') api = rest[++i];
  else if (root === undefined && !a.startsWith('-')) root = a;
  else {
    console.error(USAGE);
    process.exit(1);
  }
}
if (port !== undefined && !Number.isInteger(port)) {
  console.error(USAGE);
  process.exit(1);
}
const dev = await startDev({ root, port, api });
console.log(`trebol dev: http://localhost:${dev.port}/`);
