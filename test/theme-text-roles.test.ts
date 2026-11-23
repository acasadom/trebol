// A role colours the letters of a text, heading or title (src/host/theme/layout.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT } from '../src/host/theme/layout.ts';

test('every role but muted colours a text, heading or title in its readable shade', () => {
  for (const role of ['primary', 'accent', 'success', 'warning', 'danger']) {
    const rule = new RegExp(`:is\\(\\.tb-text, \\.tb-heading, \\.tb-title\\)\\.tb-${role} \\{ color: var\\(--tb-${role}-ink\\); \\}`);
    assert.match(LAYOUT, rule);
  }
  // muted greys any face, a text too
  assert.match(LAYOUT, /\.tb-muted \{ color: var\(--tb-muted\); \}/);
});
