// What the reactions read, and which of them read what changed.
//
// Each time a reaction is checked it tells, through ui-reads, what it reads: the faces and
// objects down its paths and the series it holds, with every series inside them. Each is
// marked so that its first change (ctxSet or touch in the core) puts it in `changed`, and
// the reaction is kept as one of its readers. At the end of a round ui-changed gives only the
// reactions that read something in `changed`, so one change among thousands of reactions
// checks a few, not all. A reaction not given the time before (new, or its face back on the
// page, where what changed while it was away was not heard) is checked whatever changed.
//
// Plain functions over the core's values, with no DOM, so that Node runs them too.

import { K, isSeries, I64, native, value, blockOf, integer, type Cell, type Ctx, type Series, type BlockCell, type ObjectCell } from '../core/index.ts';
import type { SeriesCell } from '../core/series.ts';

type Heard = Ctx | Series<unknown>;

/** What reactions read that changed since the last ui-changed (filled by the core). */
const changed: Heard[] = [];

/** The reactions (their objects' contexts) that read each context or series. */
const readers = new WeakMap<Heard, Set<Ctx>>();

/** How many readers a set had when last pruned, so it is pruned again only once it doubles. */
const pruned = new WeakMap<Set<Ctx>, number>();

/** The reactions on the page at the last ui-changed, by their place in its block. */
let current: Map<Ctx, number> | null = null;

/** Reactions to give at the next ui-changed whatever changed: still due after they ran. */
const again = new Set<Ctx>();

function hear(x: Heard, r: Ctx): void {
  if (x.hear === undefined) (x as { hear: Heard[] }).hear = changed;
  let set = readers.get(x);
  if (set === undefined) readers.set(x, set = new Set());
  else if (set.has(r)) return;
  // readers of faces no longer on the page are dropped, now and then, so they do not pile up
  if (current !== null && set.size >= 2 * (pruned.get(set) ?? 4)) {
    for (const o of set) if (!current.has(o)) set.delete(o);
    pruned.set(set, Math.max(4, set.size));
  }
  set.add(r);
}

native('ui-reads', '["Marks a face, object, series or map a reaction reads, and every series inside it, so that a change to it makes ui-changed give the reaction." value [object! series! map!] reaction [object!]]', (_t, f) => {
  const v = f.args[0]!;
  const r = (f.args[1] as ObjectCell).ctx;
  if (v.t === K.Object) hear((v as ObjectCell).ctx, r);
  else {
    const seen = new Set<Series<unknown>>();
    const todo: Series<unknown>[] = [(v as SeriesCell).s];
    while (todo.length > 0) {
      const s = todo.pop()!;
      if (seen.has(s)) continue;
      seen.add(s);
      hear(s, r);
      for (const c of s.data as Cell[]) {
        if (typeof c !== 'object' || c === null) break; // strings and binaries hold numbers
        if (isSeries(c.t) || c.t === K.Map) todo.push((c as SeriesCell).s);
      }
    }
  }
  return value(v);
});

native('ui-changed', '["Of the reactions given, the places of those that read what changed since the last call, or not given in the last call, in order." reactions [block!]]', (_t, f) => {
  const rs = (f.args[0] as BlockCell).s.data as Cell[];
  const before = current;
  current = new Map();
  for (let i = 0; i < rs.length; i++) {
    const c = rs[i]!;
    if (c.t === K.Object) current.set((c as ObjectCell).ctx, i + 1);
  }
  const due = new Set<number>();
  for (const [r, i] of current) if (before === null || !before.has(r)) due.add(i);
  for (const r of again) {
    const i = current.get(r);
    if (i !== undefined) due.add(i);
  }
  again.clear();
  for (const x of changed.splice(0)) {
    x.heard = false;
    for (const r of readers.get(x) ?? []) {
      const i = current.get(r);
      if (i !== undefined) due.add(i);
    }
  }
  return value(blockOf(K.Block, [...due].sort((a, b) => a - b).map(i => integer(I64.fromNumber(i)!))));
});

native('ui-again', '["Makes the next ui-changed give a reaction, whatever changed: one still due after it ran (an answer came while it ran)." reaction [object!]]', (_t, f) => {
  again.add((f.args[0] as ObjectCell).ctx);
  return value(f.args[0]!);
});
