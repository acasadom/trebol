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
// - ```trebol-ui blocks are apps, shown live under their code: each runs on its
//   own, with the UI dialect loaded, and must draw its view without an error.
//   As in the browser, the workshop's pretend server answers its requests to /api/.
//
// The tutorial's parts supplier (docs/_servers/supplier.ts) runs while the pages do,
// unless one already answers on its port.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { native, value, blockOf, K, ctxFind, intern, NONE, type Cell, type ObjectCell } from '../src/core/index.ts';
import { drawSvg } from '../src/host/draw.ts';
import { output, runSource, report, startHost, startUi } from '../src/host/index.ts';
import { Repl, consoleHost, PROMPT, MORE } from '../tools/console.ts';
import { startSupplier } from '../docs/_servers/supplier.ts';
import { installWorkshop } from '../docs/_servers/workshop.ts';

const DOCS = fileURLToPath(new URL('../docs/', import.meta.url));

// what the browser host does, done here without a page: a view is drawn, nothing more
let shown = 0;
let root: ObjectCell | null = null;
native('show', '[root [object!]]', (_t, f) => { shown++; root = f.args[0] as ObjectCell; return value(root); });

const field = (face: ObjectCell, name: string): Cell => {
  const i = ctxFind(face.ctx, intern(name));
  return i < 0 ? NONE : face.ctx.vals[i]!;
};

/** What is wrong with the drawing of each canvas under a face, as the browser would warn of it. */
function drawErrors(face: ObjectCell): string[] {
  const out: string[] = [];
  const style = field(face, 'style');
  if (style.t === K.Word && style.sym === intern('canvas')) {
    const r = drawSvg(field(face, 'draw'));
    if (r.error !== null) out.push(r.error);
  }
  const pane = field(face, 'pane');
  if (pane.t === K.Block) for (const c of pane.s.data.slice(pane.i)) if (c.t === K.Object) out.push(...drawErrors(c as ObjectCell));
  return out;
}
native('apply-theme', '[spec [object!]]', (_t, f) => value(f.args[0]!));
native('route', '[]', () => value(blockOf(K.Block, [])));
native('set-route', '[route [block!] replace [logic!]]', (_t, f) => value(f.args[0]!));
native('repaint', '[]', () => value(blockOf(K.Block, [])));

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
  const re = /^```(trebol|trebol-console|trebol-ui)[ \t]*\n([\s\S]*?)^```[ \t]*$/gm;
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

async function runApp(code: string, where: string): Promise<void> {
  let failed: ObjectCell | null = null;
  // Trebol's own files only: a live example runs in a page of its own, with nothing next to it to import
  const loader = { base: 'file:///', read: (href: string) => readFile(fileURLToPath(href), 'utf8') };
  const host = startHost({ onError: e => { failed = e; }, loader });
  await startUi(host);
  const before = shown;
  const uninstall = installWorkshop(globalThis, 'http://localhost/');
  try {
    await runSource(host, code, where);
  } catch (e) {
    assert.fail(`${where}: the app fails:\n${e instanceof Error ? e.message : report(e as ObjectCell)}`);
  } finally {
    uninstall();
  }
  assert.equal(failed, null, `${where}: the app fails:\n${failed === null ? '' : report(failed)}`);
  assert.ok(shown > before, `${where}: the app shows no view`);
  assert.deepEqual(drawErrors(root!), [], `${where}: a canvas cannot draw`);
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
      if (b.lang === 'trebol-ui') {
        await runApp(b.code, where);
      } else if (b.lang === 'trebol-console') {
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
