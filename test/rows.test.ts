// The rows of tables and lists (src/host/rows.ts): heads and feet of groups,
// and sorting that keeps them in their place.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, mold, form, intern, type Cell, type BlockCell } from '../src/core/index.ts';
import { groupRow, sortGroups } from '../src/host/rows.ts';

const rows = (src: string): Cell[] => (load(`[${src}]`).s.data[0] as BlockCell).s.data.slice();

test('a head or a foot of a group is a block of its kind, its level and its title or row', () => {
  const [head, foot, plain, other] = rows('[head 1 "Repairs"] [foot 2 #(amount: $10.00)] #(amount: $5.00) [tail 1 "x"]');
  assert.deepEqual({ ...groupRow(head!)!, value: mold(groupRow(head!)!.value) }, { kind: 'head', level: 1, value: '"Repairs"' });
  assert.equal(groupRow(foot!)!.kind, 'foot');
  assert.equal(groupRow(foot!)!.level, 2);
  assert.equal(groupRow(plain!), null);
  assert.equal(groupRow(other!), null);
  // a level beyond two is shown as two
  assert.equal(groupRow(rows('[head 3 "x"]')[0]!)!.level, 2);
});

test('sorting orders the rows inside each group; heads and feet stay where they are', () => {
  const data = rows(`
    [head 1 "Repairs"]
    #(n: 3) #(n: 1) #(n: 2)
    [foot 1 #(n: 6)]
    [head 1 "Parts"]
    #(n: 9) #(n: 7)
    [foot 1 #(n: 16)]
  `);
  const sorted = sortGroups(data, intern('n'), false, 'en', form);
  assert.equal(sorted.map(r => mold(r)).join(' '),
    '[head 1 "Repairs"] #(n: 1) #(n: 2) #(n: 3) [foot 1 #(n: 6)] [head 1 "Parts"] #(n: 7) #(n: 9) [foot 1 #(n: 16)]');
  const desc = sortGroups(data, intern('n'), true, 'en', form);
  assert.equal(desc.map(r => mold(r)).join(' '),
    '[head 1 "Repairs"] #(n: 3) #(n: 2) #(n: 1) [foot 1 #(n: 6)] [head 1 "Parts"] #(n: 9) #(n: 7) [foot 1 #(n: 16)]');
});
