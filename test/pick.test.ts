// The point a click on an inert face with on-select lands on: a face not shown is under no point.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inside } from '../src/host/browser/pick.ts';

const box = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height });

test('a point is on a box that is shown', () => {
  assert.equal(inside(box(10, 10, 100, 50), 20, 30), true);
  assert.equal(inside(box(10, 10, 100, 50), 5, 30), false);
});

test('a hidden face, whose box is empty at the corner, is under no point, not even the corner', () => {
  assert.equal(inside(box(0, 0, 0, 0), 0, 0), false);
});
