// The icons Trebol brings are data of the dialect, so a layout knows a name that is none and a
// designer can offer them; the browser host draws the same set.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { form, mold, errorField, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource } from '../src/host/index.ts';
import { ICONS } from '../src/host/icons.ts';

async function ev(src: string): Promise<string> {
  const host = startHost({ onError: () => {}, loader: { base: 'file:///', read: href => readFile(fileURLToPath(href), 'utf8') } });
  await startUi(host);
  try {
    return mold(await runSource(host, src));
  } catch (e) {
    return `error: ${form(errorField(e as ObjectCell, 'message'))}`;
  }
}

test('the dialect knows the icons the host draws, and the reference lists them', async () => {
  assert.equal(await ev('form ui-icons'), JSON.stringify(ICONS.join(' ')));
  const doc = readFileSync('docs/_reference/18-styles.md', 'utf8');
  for (const i of ICONS) assert.ok(doc.includes(`\`#${i}\``), i);
});

test('an icon that is none is a problem of the layout, with the one it may mean', async () => {
  const p = async (b: string): Promise<string> => ev(`e: try [layout [${b}]]  either error? e [find/tail e/message "layout: "] ["ok"]`);
  assert.equal(await p('icon #hart'), '"#hart is not an icon; did you mean #heart?"');
  assert.equal(await p('button #stra "Go"'), '"#stra is not an icon; did you mean #star?"');
  assert.equal(await p('button "Go" menu [#qqq "Open" open]'), '"#qqq is not an icon"');
  assert.equal(await p('tile #folder "Files" mark #lsit "List" []'), '"#lsit is not an icon; did you mean #list?"');
  assert.equal(await p('icon #heart  button #star "Go" menu [#trash "Delete" delete]'), '"ok"');
});
