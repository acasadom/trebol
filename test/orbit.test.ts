// Orbits as plain data (src/host/orbit.ts): reading the block, placing the
// bubbles on rings, the edges drawn, and what a bubble draws.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { load, NONE } from '../src/core/index.ts';
import { readOrbit, layoutOrbit, shownEdges, edgeLabel, neighbours, wrapTitle, edgePath, bubble, fitCamera, PAGE, MORE, FOCUS_R, type OrbitSpec } from '../src/host/orbit.ts';

const read = (src: string) => readOrbit(load(src).s.data[0]!);
const spec = (src: string): OrbitSpec => {
  const { spec, error } = read(src);
  assert.equal(error, null);
  return spec;
};

const TOWN = `[
  focus pleno
  nodes [
    pleno "Pleno municipal" [primary count 9]
    marta "Marta" [accent]
    concejal "Concejal" [teal many count 9]
    42 "An integer id" [dashed steps 5 at 2]
    "c-7" #(en: "A string id" es: "Uno")
    town "Town"
  ]
  edges [pleno marta "Members"  marta pleno "Holder" [dashed]  pleno concejal "is a" [faint]  marta 42 "Signs"  town pleno]
  trail [town]
]`;

describe('reading', () => {
  test('nodes take an id, a title and hints; edges two ids, a label and a look', () => {
    const s = spec(TOWN);
    assert.equal(s.focus, 'w:pleno');
    assert.deepEqual([...s.nodes.keys()], ['w:pleno', 'w:marta', 'w:concejal', 'i:42', 's:c-7', 'w:town']);
    const pleno = s.nodes.get('w:pleno')!;
    assert.deepEqual([pleno.color, pleno.count, pleno.many], ['var(--tb-primary)', 9, false]);
    const concejal = s.nodes.get('w:concejal')!;
    assert.deepEqual([concejal.color, concejal.many], ['var(--tb-c-teal)', true]);
    const n42 = s.nodes.get('i:42')!;
    assert.deepEqual([n42.dashed, n42.steps, n42.at, n42.color], [true, 5, 2, 'var(--tb-primary)']);
    assert.deepEqual(s.edges.map(e => [e.from, e.to, e.look]), [
      ['w:pleno', 'w:marta', 'solid'], ['w:marta', 'w:pleno', 'dashed'], ['w:pleno', 'w:concejal', 'faint'],
      ['w:marta', 'i:42', 'solid'], ['w:town', 'w:pleno', 'solid'],
    ]);
    assert.equal(s.edges[4]!.label, null);
    assert.deepEqual(s.trail, ['w:town']);
    assert.deepEqual(neighbours(s), ['w:marta', 'w:concejal', 'i:42', 's:c-7']);
  });

  test('a mistake is said, and what came before it is kept', () => {
    assert.equal(readOrbit(NONE).error, null);
    assert.equal(read('"x"').error, 'orbit: an orbit takes a block');
    assert.equal(read('[focus [a]]').error, 'orbit: focus takes the id of a node');
    assert.match(read('[nodes [a "A" b]]').error!, /nodes takes an id and a title/);
    assert.match(read('[nodes [a "A" [primay]]]').error!, /hints are a role or color.*not primay/);
    assert.match(read('[nodes [a "A" [steps 5 at]]]').error!, /steps 5 at 2/);
    assert.match(read('[edges [a b "L" [wavy]]]').error!, /solid, dashed or faint/);
    assert.match(read('[colour red]').error!, /an orbit takes focus/);
    const { spec: s } = read('[focus a nodes [a "A" b "B" c]]');
    assert.deepEqual([s.focus, s.nodes.size], ['w:a', 2]);
  });
});

describe('placing', () => {
  test('the focus in the middle, neighbours on a ring, the trail up and to the left', () => {
    const s = spec(TOWN);
    const lay = layoutOrbit(s);
    assert.deepEqual(lay.placed.map(p => [p.key, p.role]), [
      ['w:pleno', 'focus'], ['w:marta', 'near'], ['w:concejal', 'near'], ['i:42', 'near'], ['s:c-7', 'near'], ['w:town', 'trail'],
    ]);
    const [focus, first, , , , trail] = lay.placed;
    assert.deepEqual([focus!.x, focus!.y, focus!.r], [0, 0, FOCUS_R]);
    // the first neighbour straight up, all of them as far from the focus
    assert.ok(Math.abs(first!.x) < 1e-9 && first!.y < 0);
    const near = lay.placed.filter(p => p.role === 'near').map(p => Math.round(Math.hypot(p.x, p.y)));
    assert.equal(new Set(near).size, 1);
    assert.ok(trail!.x < 0 && trail!.y < 0 && trail!.o < 1);
    // every bubble fits inside the box
    for (const p of lay.placed) assert.ok(p.x - p.r >= lay.box.x0 && p.x + p.r <= lay.box.x1 && p.y - p.r >= lay.box.y0 && p.y + p.r <= lay.box.y1);
    assert.deepEqual([lay.left, lay.pages], [0, 1]);
  });

  test('past a page of neighbours, a bubble pages through them; more neighbours, smaller bubbles', () => {
    const ids = Array.from({ length: PAGE + 10 }, (_, i) => `n${i} "N${i}"`).join(' ');
    const s = spec(`[focus hub nodes [hub "Hub" ${ids}]]`);
    const first = layoutOrbit(s, 0);
    assert.equal(first.placed.filter(p => p.role === 'near').length, PAGE);
    assert.deepEqual([first.placed.at(-1)!.key, first.left, first.pages], [MORE, 10, 2]);
    const second = layoutOrbit(s, 1);
    assert.deepEqual(second.placed.filter(p => p.role === 'near').map(p => p.key).slice(0, 2), ['w:n30', 'w:n31']);
    assert.equal(second.left, 0);
    const few = layoutOrbit(spec('[focus a nodes [a "A" b "B"]]'));
    assert.ok(few.placed[1]!.r > first.placed[1]!.r);
    // with more than fit on one ring, a second ring further out
    const radii = new Set(first.placed.filter(p => p.role === 'near').map(p => Math.round(Math.hypot(p.x, p.y))));
    assert.ok(radii.size > 1);
  });

  test('no focus, nothing placed', () => {
    assert.deepEqual(layoutOrbit(spec('[nodes [a "A"]]')).placed, []);
  });
});

describe('edges', () => {
  test('only between bubbles on show, one per pair; between neighbours they bend; the trail is dotted', () => {
    const s = spec(TOWN);
    const edges = shownEdges(s, layoutOrbit(s).placed);
    assert.deepEqual(edges.map(e => [e.from, e.to, e.look, e.curve, e.trail]), [
      ['w:pleno', 'w:marta', 'solid', 0, false],
      ['w:pleno', 'w:concejal', 'faint', 0, false],
      ['w:marta', 'i:42', 'solid', 0.35, false],
      ['w:pleno', 'w:town', 'faint', 0, true],
    ]);
    assert.equal(edgeLabel(s, 'w:marta')!.t !== undefined, true);
    assert.equal(edgeLabel(s, 's:c-7'), null);
  });

  test('a line stops at the borders and its label never reads upside down', () => {
    const p = edgePath({ x: 0, y: 0, r: 10, o: 1 }, { x: -100, y: 0, r: 10, o: 1 }, 0);
    assert.equal(p.d, 'M-10.4,0 L-89.6,0');
    assert.equal(p.angle, 0);
    const curved = edgePath({ x: 100, y: 0, r: 10, o: 1 }, { x: 0, y: 100, r: 10, o: 1 }, 0.35);
    assert.match(curved.d, /^M[\d.,-]+ Q/);
    // bent away from the middle
    assert.ok(curved.x + curved.y > 100);
  });
});

describe('bubbles', () => {
  test('titles wrap in three lines at most', () => {
    assert.deepEqual(wrapTitle('Marta Ibáñez Roldán', 13), ['Marta Ibáñez', 'Roldán']);
    assert.deepEqual(wrapTitle('one two three four five six seven', 5), ['one', 'two', 'thre…']);
  });

  test('a bubble draws its rings, steps, moons and title', () => {
    const s = spec(TOWN);
    const look = (key: string, role: 'focus' | 'near') => bubble({ role, r: 50, scale: 1, above: false, title: 'T', color: 'red', body: 'b', halo: 'h', node: s.nodes.get(key)! });
    const classes = (els: ReturnType<typeof bubble>) => els.map(e => e.attrs['class'] ?? e.tag);
    assert.deepEqual(classes(look('w:concejal', 'near')), ['tb-orbit-halo', 'tb-orbit-body', 'tb-orbit-line', 'tb-orbit-spin tb-orbit-fast', 'tb-orbit-title', 'tb-orbit-count']);
    const steps = look('i:42', 'near').filter(e => e.attrs['class']?.startsWith('tb-orbit-step'));
    assert.deepEqual(steps.map(e => e.attrs['class']), ['tb-orbit-step', 'tb-orbit-step tb-orbit-now', 'tb-orbit-step', 'tb-orbit-step', 'tb-orbit-step']);
    assert.equal(look('i:42', 'near')[1]!.attrs['stroke-dasharray'], '4 4');
    // the focus has its two turning rings and no moons
    assert.deepEqual(classes(look('w:pleno', 'focus')).filter(c => c.includes('spin')), ['tb-orbit-spin', 'tb-orbit-spin tb-orbit-rev']);
  });

  test('the camera centres the box and fits it, within limits', () => {
    assert.deepEqual(fitCamera(800, 600, { x0: -300, y0: -200, x1: 500, y1: 400 }), { x: -100, y: -100, s: 1 });
    assert.equal(fitCamera(100, 100, { x0: 0, y0: 0, x1: 2000, y1: 2000 }).s, 0.15);
    assert.equal(fitCamera(4000, 4000, { x0: 0, y0: 0, x1: 100, y1: 100 }).s, 1.25);
  });
});
