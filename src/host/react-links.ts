// The reactions of the faces on a page, and which feed which, for ui-react.
//
// ui-react runs at the end of every round, with every face that has reactions. Gathering
// them, and the links between them (a reaction that sets what another reads runs before
// it), are a walk over all of them: done here, and the links kept while the reactions and
// what they read and set stay the same, so a round costs what changed in it.
//
// Plain functions over the core's values, with no DOM, so that Node runs them too.

import { K, NONE, I64, native, value, blockOf, integer, mold, ctxFind, intern, type Cell, type Ctx, type Series, type BlockCell, type ObjectCell } from '../core/index.ts';

const REACTIONS = intern('reactions');
const SOURCES = intern('sources');
const TARGETS = intern('targets');

function field(ctx: Ctx, sym: ReturnType<typeof intern>): Cell {
  const i = ctxFind(ctx, sym);
  return i < 0 ? NONE : ctx.vals[i]!;
}

native('ui-reactions', '["Of faces, every reaction with its face, in order, as [faces reactions new]: new, the places of those whose sources are not found yet." faces [block!]]', (_t, f) => {
  const fs: Cell[] = [];
  const rs: Cell[] = [];
  const fresh: Cell[] = [];
  const b = f.args[0] as BlockCell;
  for (let i = b.i; i < b.s.data.length; i++) {
    const face = b.s.data[i] as Cell;
    if (face.t !== K.Object) continue;
    const list = field((face as ObjectCell).ctx, REACTIONS);
    if (list.t !== K.Block) continue;
    const l = list as BlockCell;
    for (let j = l.i; j < l.s.data.length; j++) {
      const r = l.s.data[j] as Cell;
      if (r.t !== K.Object) continue;
      fs.push(face);
      rs.push(r);
      if (field((r as ObjectCell).ctx, SOURCES).t === K.None) fresh.push(integer(I64.fromNumber(rs.length)!));
    }
  }
  return value(blockOf(K.Block, [blockOf(K.Block, fs), blockOf(K.Block, rs), blockOf(K.Block, fresh)]));
});

/** What a [face facet ...] block of a reaction is, to tell whether it changed. */
interface Pairs {
  s: Series<unknown> | null;
  ver: number;
}

function pairsOf(c: Cell): Pairs {
  return c.t === K.Block ? { s: (c as BlockCell).s, ver: (c as BlockCell).s.ver ?? 0 } : { s: null, ver: 0 };
}

/** The links last made: good while the same reactions, in the same order, read and set the same. */
let last: { rs: Ctx[]; sources: Pairs[]; targets: Pairs[]; links: Cell } | null = null;

function same(rs: Ctx[]): boolean {
  if (last === null || last.rs.length !== rs.length) return false;
  for (let i = 0; i < rs.length; i++) {
    if (last.rs[i] !== rs[i]) return false;
    const s = pairsOf(field(rs[i]!, SOURCES));
    const t = pairsOf(field(rs[i]!, TARGETS));
    const ls = last.sources[i]!;
    const lt = last.targets[i]!;
    if (s.s !== ls.s || s.ver !== ls.ver || t.s !== lt.s || t.ver !== lt.ver) return false;
  }
  return true;
}

/** Where a face's facet is kept in the index of what reads it: the object itself, then its facet. */
function keyed(index: Map<Ctx, Map<string, number[]>>, g: Cell, m: Cell, make: boolean): number[] | undefined {
  if (g.t !== K.Object) return undefined;
  const ctx = (g as ObjectCell).ctx;
  let by = index.get(ctx);
  if (by === undefined) {
    if (!make) return undefined;
    index.set(ctx, by = new Map());
  }
  const key = mold(m);
  let at = by.get(key);
  if (at === undefined && make) by.set(key, at = []);
  return at;
}

function cells(c: Cell): Cell[] {
  if (c.t !== K.Block) return [];
  const b = c as BlockCell;
  return (b.s.data as Cell[]).slice(b.i);
}

native('ui-react-links', '["Which reactions each one feeds, setting what they read, and which feed it: [feeds fed-by], a block of places for each reaction." reactions [block!]]', (_t, f) => {
  const b = f.args[0] as BlockCell;
  const rs = (b.s.data as Cell[]).slice(b.i).map(c => (c as ObjectCell).ctx);
  if (same(rs)) return value(last!.links);
  const readers = new Map<Ctx, Map<string, number[]>>();
  rs.forEach((r, i) => {
    const s = cells(field(r, SOURCES));
    for (let k = 0; k + 1 < s.length; k += 2) keyed(readers, s[k]!, s[k + 1]!, true)!.push(i);
  });
  const feeds: number[][] = rs.map(() => []);
  const fedBy: number[][] = rs.map(() => []);
  rs.forEach((r, j) => {
    const t = cells(field(r, TARGETS));
    for (let k = 0; k + 1 < t.length; k += 2) {
      for (const i of keyed(readers, t[k]!, t[k + 1]!, false) ?? []) {
        if (i !== j && !feeds[j]!.includes(i)) {
          feeds[j]!.push(i);
          fedBy[i]!.push(j);
        }
      }
    }
  });
  const places = (xs: number[][]) => blockOf(K.Block, xs.map(x => blockOf(K.Block, x.map(i => integer(I64.fromNumber(i + 1)!)))));
  const links = blockOf(K.Block, [places(feeds), places(fedBy)]);
  last = {
    rs,
    sources: rs.map(r => pairsOf(field(r, SOURCES))),
    targets: rs.map(r => pairsOf(field(r, TARGETS))),
    links,
  };
  return value(links);
});
