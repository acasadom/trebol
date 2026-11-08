// The console host and the interactive console (REPL) of the `trebol` command.
//
//   >> 1 + 2
//   == 3
//   >> b: [
//   [    1 2 ]
//   == [1 2]
//
// As in Rebol: an expression's value is shown after `==` with mold, an unset
// value shows nothing, errors show as `** ...` and the session goes on. A line
// that leaves a block, paren or multi-line string open asks for more with `[`.

import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { K, LoadError, load, mold, type ObjectCell } from '../src/core/index.ts';
import { startHost, runSource, report, type Host } from '../src/host/index.ts';

/** A host for Node: console output, timers, tasks, network; `import` reads files relative to `dir`. */
export function consoleHost(dir = process.cwd()): Host {
  return startHost({
    loader: {
      base: pathToFileURL(dir + '/').href,
      read: async href => (href.startsWith('file:') ? readFile(fileURLToPath(href), 'utf8') : (await fetch(href)).text()),
    },
  });
}

/** Runs a whole script; reports a failure and returns false. */
export async function runScript(host: Host, src: string, file?: string): Promise<boolean> {
  try {
    await runSource(host, src, file);
    return true;
  } catch (e) {
    console.error(errorText(e));
    return false;
  }
}

function errorText(e: unknown): string {
  return e instanceof LoadError ? `** Syntax error: ${e.message}` : report(e as ObjectCell);
}

// Load errors that mean "the input is not finished yet", not "the input is wrong".
const UNFINISHED = /: missing ([\])]|} to close (string|binary))$/;

export const PROMPT = '>> ';
export const MORE = '[    ';

/** One console session: feed it lines, it answers with what to show and the next prompt. */
export class Repl {
  readonly host: Host;
  private pending = '';

  constructor(host: Host) {
    this.host = host;
  }

  get prompt(): string {
    return this.pending === '' ? PROMPT : MORE;
  }

  /** Forgets a half-typed expression (Ctrl+C). */
  reset(): void {
    this.pending = '';
  }

  /** Takes one line; returns the lines to show (values and errors; `print` writes on its own). */
  async feed(line: string): Promise<string[]> {
    const src = this.pending === '' ? line : this.pending + '\n' + line;
    if (src.trim() === '') {
      this.pending = '';
      return [];
    }
    try {
      load(src);
    } catch (e) {
      if (e instanceof LoadError && UNFINISHED.test(e.message)) {
        this.pending = src;
        return [];
      }
    }
    this.pending = '';
    try {
      const v = await runSource(this.host, src);
      return v.t === K.Unset ? [] : [`== ${mold(v)}`];
    } catch (e) {
      return [errorText(e)];
    }
  }
}

/** Runs the interactive console on the terminal until `q`, `quit` or Ctrl+D. */
export function startRepl(version: string): Promise<void> {
  const repl = new Repl(consoleHost());
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: PROMPT, historySize: 500 });
  console.log(`Trebol ${version}. Type q to quit.`);
  let busy = Promise.resolve();
  return new Promise(done => {
    rl.on('line', line => {
      const word = line.trim();
      if (repl.prompt === PROMPT && (word === 'q' || word === 'quit')) {
        rl.close();
        return;
      }
      rl.pause();
      busy = busy.then(async () => {
        for (const out of await repl.feed(line)) console.log(out);
        rl.setPrompt(repl.prompt);
        rl.resume();
        rl.prompt();
      });
    });
    rl.on('SIGINT', () => {
      // Ctrl+C drops the line being typed; on an empty prompt it quits.
      if (rl.line === '' && repl.prompt === PROMPT) {
        rl.close();
        return;
      }
      repl.reset();
      rl.write(null, { ctrl: true, name: 'u' });
      process.stdout.write('\n');
      rl.setPrompt(repl.prompt);
      rl.prompt();
    });
    rl.on('close', () => {
      process.stdout.write('\n');
      void busy.then(() => done());
    });
    rl.prompt();
  });
}
