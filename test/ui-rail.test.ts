// rail: a column whose children go down a line, a mark each (src/host/browser/rails.ts, theme/rails.ts).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, type Cell, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { setHost } from '../src/host/browser/mount.ts';
import { markRail } from '../src/host/browser/rails.ts';
import { RAILS } from '../src/host/theme/rails.ts';

native('show', '[root [object!]]', (_t, f) => value(f.args[0]!));
native('ui-watch', '[value [object! series! map!]]', (_t, f) => value(f.args[0]!));

let host: Host;
beforeEach(async () => {
  host = startHost({ onError: () => {}, loader: { base: 'file:///', read: href => readFile(fileURLToPath(href), 'utf8') } });
  await startUi(host);
  setHost(host);
});

async function run(src: string): Promise<Cell> {
  return runSource(host, src).catch((e: ObjectCell) => assert.fail(form(errorField(e, 'message'))));
}

/** A node with attributes, enough for markRail. */
interface Fake { children: Fake[]; setAttribute(k: string, v: string): void; removeAttribute(k: string): void; getAttribute(k: string): string | null }
function node(kids: Fake[] = []): Fake {
  const at = new Map<string, string>();
  return {
    children: kids,
    setAttribute: (k: string, v: string) => { at.set(k, v); },
    removeAttribute: (k: string) => { at.delete(k); },
    getAttribute: (k: string) => at.get(k) ?? null,
  };
}

describe('rail', () => {
  test('is a flag of a column', async () => {
    const got = await run(`root: view [column rail [text "a" text "b"]  column [text "c"]]  reduce [root/pane/1/rail root/pane/2/rail]`);
    assert.equal(mold(got), '[true false]');
  });

  test('makes a column a list of its children for a screen reader, and takes it away', () => {
    const a = node(), b = node();
    const box = node([a, b]);
    markRail(box, true);
    assert.deepEqual([box.getAttribute('role'), a.getAttribute('role'), b.getAttribute('role')], ['list', 'listitem', 'listitem']);
    markRail(box, false);
    assert.deepEqual([box.getAttribute('role'), a.getAttribute('role')], [null, null]);
    const plain = node([node()]);
    plain.setAttribute('role', 'group');
    markRail(plain, false);
    assert.equal(plain.getAttribute('role'), 'group');
  });

  test('draws a mark on each child, a line to the next, the mark in the role of the child', () => {
    assert.match(RAILS, /\.tb-rail > \*::after \{/);
    assert.match(RAILS, /\.tb-rail > :last-child::before \{ display: none; \}/);
    assert.match(RAILS, /\.tb-rail > \.tb-success \{ --tb-mark: var\(--tb-success\)/);
    assert.doesNotMatch(RAILS, /#[0-9a-f]{3,6}\b|rgb\(/);
  });
});
