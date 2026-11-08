#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
// The `trebol` command.
//
//   trebol                    the interactive console (a script when stdin is not a terminal)
//   trebol file.trb           runs a script
//   trebol dev [folder] [--port 5173] [--api api.ts]
//
// `dev` serves the folder (default: the current one) with live reload; see
// dev.ts. An app gets the command from its dependency on the package.

import { readFileSync } from 'node:fs';
import { consoleHost, runScript, startRepl } from './console.ts';

const USAGE = 'usage: trebol [file.trb] | trebol dev [folder] [--port n] [--api file]';

const [command, ...rest] = process.argv.slice(2);
if (command === undefined) {
  if (process.stdin.isTTY) {
    const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    await startRepl(version);
    process.exit(0);
  }
  if (!(await runScript(consoleHost(), readFileSync(0, 'utf8')))) process.exitCode = 1;
} else if (command === 'dev') {
  await dev(rest);
} else if (rest.length === 0 && !command.startsWith('-')) {
  if (!(await runScript(consoleHost(), readFileSync(command, 'utf8'), command))) process.exitCode = 1;
} else {
  console.error(USAGE);
  process.exit(1);
}

async function dev(args: string[]): Promise<void> {
  let root: string | undefined;
  let port: number | undefined;
  let api: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--port') port = Number(args[++i]);
    else if (a === '--api') api = args[++i];
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
  const { startDev } = await import('./dev.ts');
  const server = await startDev({ root, port, api });
  console.log(`trebol dev: http://localhost:${server.port}/`);
}
