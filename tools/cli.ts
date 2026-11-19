#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
// The `trebol` command.
//
//   trebol                    the interactive console (a script when stdin is not a terminal)
//   trebol file.trb           runs a script
//   trebol dev [folder] [--port 5173] [--api api.ts] [--host]
//   trebol check [file.trb ...]  the problems in the layouts of the files (default: app.trb), without running them
//   trebol test [file.test.trb|folder ...]  the screen tests (default: every *.test.trb under the current folder)
//   trebol build [folder] [--out dir] [--csp]  the app as one page to publish (default: folder/build); see bundle.ts
//   trebol supplier           the parts supplier of the language tutorial, on port 8089
//   trebol --version          the version of the package
//
// `dev` serves the folder (default: the current one) with live reload; see
// dev.ts. An app gets the command from its dependency on the package.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { consoleHost, runScript, startRepl } from './console.ts';

const USAGE = 'usage: trebol [file.trb] | trebol --version | trebol dev [folder] [--port n] [--api file] [--host] | trebol check [file.trb ...] | trebol test [file.test.trb|folder ...] | trebol build [folder] [--out dir] [--csp] | trebol supplier';

const [command, ...rest] = process.argv.slice(2);
const version = (): string => (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
if (command === undefined) {
  if (process.stdin.isTTY) {
    await startRepl(version());
    process.exit(0);
  }
  if (!(await runScript(consoleHost(), readFileSync(0, 'utf8')))) process.exitCode = 1;
} else if ((command === '--version' || command === '-v') && rest.length === 0) {
  console.log(`trebol ${version()}`);
} else if (command === 'dev') {
  await dev(rest);
} else if (command === 'check' && !rest.some(a => a.startsWith('-'))) {
  const { check } = await import('./check.ts');
  if (!(await check(rest.length > 0 ? rest : ['app.trb']))) process.exitCode = 1;
} else if (command === 'test' && !rest.some(a => a.startsWith('-'))) {
  const { test, testFiles } = await import('./test.ts');
  const files = await testFiles(rest.length > 0 ? rest : ['.']);
  if (files.length === 0) {
    console.error('trebol test: no *.test.trb files here');
    process.exitCode = 1;
  } else if (!(await test(files))) {
    process.exitCode = 1;
  }
} else if (command === 'build') {
  await buildCommand(rest);
} else if (command === 'supplier' && rest.length === 0) {
  const { startSupplier, SUPPLIER_PORT } = await import('../docs/_servers/supplier.ts');
  await startSupplier();
  console.log(`The supplier answers on http://localhost:${SUPPLIER_PORT}/parts (Ctrl+C to stop)`);
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
  let open = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--port') port = Number(args[++i]);
    else if (a === '--host') open = true;
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
  const server = await startDev({ root, port, api, open });
  console.log(`trebol dev: http://localhost:${server.port}/${open ? ' (open to the network)' : ''}`);
}

async function buildCommand(args: string[]): Promise<void> {
  let folder: string | undefined;
  let out: string | undefined;
  let csp = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out' && i + 1 < args.length) out = args[++i];
    else if (a === '--csp') csp = true;
    else if (folder === undefined && !a.startsWith('-')) folder = a;
    else {
      console.error(USAGE);
      process.exit(1);
    }
  }
  const { buildApp } = await import('./bundle.ts');
  try {
    const b = await buildApp(folder ?? '.', out, { csp });
    const kb = Math.round(b.size / 1024);
    const copied = b.copied.length === 0 ? '' : `, ${b.copied.length} file${b.copied.length === 1 ? '' : 's'} copied next to it`;
    const split = b.split.length === 0 ? '' : `, ${b.split.join(' and ')} next to it`;
    console.log(`trebol build: ${shortPath(b.page)} (${kb} KB, ${b.sources.length} .trb inside${split}${copied})`);
  } catch (e) {
    console.error(`trebol build: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

/** A path from the current folder when it is inside it, else the whole path. */
function shortPath(path: string): string {
  const r = relative('.', path);
  return r.startsWith('..') ? path : r;
}
