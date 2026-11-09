// Runs the code of the documentation, so its examples never drift from Trebol.
//
// Under docs/**/*.md (design.md aside), each page is one console session, in
// order: what one block defines, the next one sees.
//
// - ```trebol blocks are scripts: they must run without an error. A block whose
//   first line is `; docs-test: skip` is left out (an excerpt, or one that fails
//   on purpose).
// - ```trebol-console blocks are typed into the console: `>>` (and `[    ` for
//   more lines) is input, every other line is what must show, exactly. An
//   expected line ending in `...` matches any line that starts the same way.
//
// The tutorial's parts supplier (examples/supplier.ts) runs while the pages do,
// unless one already answers on its port.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import type { ObjectCell } from '../src/core/index.ts';
import { output, runSource, report } from '../src/host/index.ts';
import { Repl, consoleHost, PROMPT, MORE } from '../tools/console.ts';
import { startSupplier } from '../examples/supplier.ts';

const DOCS = fileURLToPath(new URL('../docs/', import.meta.url));

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name.startsWith('_') ? [] : pages(path);
    return e.name.endsWith('.md') && path !== join(DOCS, 'design.md') ? [path] : [];
  });
}

interface Block { lang: string; code: string; line: number }

function blocks(md: string): Block[] {
  const found: Block[] = [];
  const re = /^```(trebol|trebol-console)[ \t]*\n([\s\S]*?)^```[ \t]*$/gm;
  for (let m = re.exec(md); m; m = re.exec(md)) {
    found.push({ lang: m[1]!, code: m[2]!, line: md.slice(0, m.index).split('\n').length });
  }
  return found;
}

function matches(actual: string, expected: string): boolean {
  return expected.endsWith('...') ? actual.startsWith(expected.slice(0, -3)) : actual === expected;
}

async function typeIn(repl: Repl, code: string, where: string): Promise<void> {
  const shown: string[] = [];
  const expected: string[] = [];
  const line = output.line;
  output.line = text => shown.push(...text.split('\n'));
  try {
    for (const l of code.replace(/\n$/, '').split('\n')) {
      const input = l.startsWith(PROMPT) ? PROMPT : l.startsWith(MORE) ? MORE : null;
      if (input !== null) {
        for (const out of await repl.feed(l.slice(input.length))) shown.push(...out.split('\n'));
      } else {
        expected.push(l.trimEnd());
      }
    }
  } finally {
    output.line = line;
  }
  const actual = shown.map(s => s.trimEnd());
  const ok = actual.length === expected.length && actual.every((a, i) => matches(a, expected[i]!));
  assert.ok(ok, `${where}: the console shows\n${actual.join('\n')}\nbut the page says\n${expected.join('\n')}`);
}

let supplier: Server | null = null;
before(async () => {
  try {
    supplier = await startSupplier();
  } catch (e) {
    if ((e as { code?: string }).code !== 'EADDRINUSE') throw e;
  }
});
after(() => supplier?.close());

for (const page of pages(DOCS)) {
  const name = relative(DOCS, page);
  test(`docs: ${name}`, async () => {
    const md = readFileSync(page, 'utf8');
    const repl = new Repl(consoleHost(dirname(page)));
    for (const b of blocks(md)) {
      const where = `${name}:${b.line}`;
      const file = /^; file: (\S+)\n/.exec(b.code);
      if (b.lang === 'trebol-console') {
        await typeIn(repl, b.code, where);
      } else if (file !== null) {
        // a file the page shows: it must be the file next to the page, which the examples import
        assert.equal(readFileSync(join(dirname(page), file[1]!), 'utf8'), b.code.slice(file[0].length), `${where}: differs from ${file[1]}`);
      } else if (!b.code.startsWith('; docs-test: skip')) {
        const line = output.line;
        output.line = () => {};
        try {
          await runSource(repl.host, b.code, where);
        } catch (e) {
          assert.fail(`${where}: the script fails:\n${e instanceof Error ? e.message : report(e as ObjectCell)}`);
        } finally {
          output.line = line;
        }
      }
    }
  });
}
