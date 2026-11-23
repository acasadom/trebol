// named: a column named by its first text, heading or title, a group to a screen reader (src/host/browser/named.ts).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { native, value, mold, form, errorField, type Cell, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { setHost } from '../src/host/browser/mount.ts';
import { markNamed } from '../src/host/browser/named.ts';

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

/** A node with attributes, an id and classes, enough for markNamed. */
interface Fake { id: string; children: Fake[]; classList: { contains(c: string): boolean }; setAttribute(k: string, v: string): void; removeAttribute(k: string): void; getAttribute(k: string): string | null }
function node(cls = '', kids: Fake[] = []): Fake {
  const at = new Map<string, string>();
  return {
    id: '', children: kids,
    classList: { contains: (c: string) => cls.split(' ').includes(c) },
    setAttribute: (k: string, v: string) => { at.set(k, v); },
    removeAttribute: (k: string) => { at.delete(k); },
    getAttribute: (k: string) => at.get(k) ?? null,
  };
}

describe('named', () => {
  test('is a flag of a column', async () => {
    const got = await run(`root: view [column named [heading "Today" text "a"]  column [text "b"]]  reduce [root/pane/1/named root/pane/2/named]`);
    assert.equal(mold(got), '[true false]');
  });

  test('makes a column a group named by its first text, and takes it away', () => {
    const mark = node('tb-column'), head = node('tb-heading tb-small'), rest = node('tb-text');
    const box = node('tb-column', [mark, head, rest]);
    markNamed(box, true);
    assert.notEqual(head.id, '');
    assert.deepEqual([box.getAttribute('role'), box.getAttribute('aria-labelledby'), rest.id], ['group', head.id, '']);
    markNamed(box, false);
    assert.deepEqual([box.getAttribute('role'), box.getAttribute('aria-labelledby')], [null, null]);
  });

  test('keeps a list a list, names it all the same, and leaves an id it finds', () => {
    const t = node('tb-text');
    t.id = 'mine';
    const box = node('tb-column', [t]);
    box.setAttribute('role', 'list');
    markNamed(box, true);
    assert.deepEqual([box.getAttribute('role'), box.getAttribute('aria-labelledby')], ['list', 'mine']);
    markNamed(box, false);
    assert.equal(box.getAttribute('role'), 'list');
    const plain = node('tb-column', [node('tb-text')]);
    plain.setAttribute('role', 'group');
    markNamed(plain, false);
    assert.equal(plain.getAttribute('role'), 'group');
  });

  test('with no text in it, a named column is a group with no name', () => {
    const box = node('tb-column', [node('tb-button')]);
    markNamed(box, true);
    assert.deepEqual([box.getAttribute('role'), box.getAttribute('aria-labelledby')], ['group', null]);
  });
});
