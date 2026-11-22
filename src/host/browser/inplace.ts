// --- what a face shows, changed in place ----------------------------------------------
//
// A face is repainted when one of its fields is set (ctxSet marks its context). A block
// or string it shows can also change in place: `append o/rows row`, `poke row 'name "x"`,
// `append f/text "!"`. So each time a face is drawn, every series and every row object
// in its fields, at any depth, is marked with the arrays the host reads after a round,
// and the face is kept as one of its owners. A change to any of them then puts it in
// those arrays, and the faces that own it are drawn again. A mark left on a series the
// face no longer shows only costs one extra drawing of that face.
//
// Plain functions over the core's values, with no DOM, so that Node can test them.

import { K, isSeries, intern, canon, type Cell, type Ctx, type Series, type Sym, type ObjectCell } from '../../core/index.ts';

/** Series shown by a face, or read by a reaction, changed since the last repaint (filled by the core). */
export const dirtySeries: Series<unknown>[] = [];

/** Fields of a face that hold no content shown: its children, handlers, rules and rows' own state. */
const SKIP = new Set<Sym>(['pane', 'action', 'events', 'reactions', 'template', 'built', 'owner', 'rules'].map(w => canon(intern(w))));

const FACE = ['style', 'pane', 'reactions'].map(w => canon(intern(w)));

/** Whether an object is a face: it has the fields every face has. */
export function isFace(ctx: Ctx): boolean {
  return FACE.every(k => ctx.keys.some(x => canon(x) === k));
}

const seriesOwners = new WeakMap<Series<unknown>, Set<object>>();
const rowOwners = new WeakMap<Ctx, Set<object>>();

/** Marks `key` as shown by `owner`; false when it already was. A face gone from the page is dropped then. */
function own<K extends object>(map: WeakMap<K, Set<object>>, key: K, owner: object, alive: (o: object) => boolean): boolean {
  let set = map.get(key);
  if (set === undefined) map.set(key, set = new Set());
  else if (set.has(owner)) return false;
  else for (const o of set) if (!live(o, alive)) set.delete(o);
  set.add(owner);
  return true;
}

/** The owner of what reactions read: marked so that a change runs them, never drawn. */
export const REACTS = {};

/**
 * Marks every series and every object inside the face's fields, deeply, so a change in
 * place reaches `dirtySeries` (series) or `dirty` (objects' contexts), with `owner` as
 * the one to draw again. Other faces met on the way are left alone: they mark their own.
 *
 * What the owner already had marked is not walked again: everything inside it was
 * marked when it was, and what changed since is walked by `watchChanged`. So drawing a
 * face again costs what changed, not all it shows.
 *
 * With REACTS as the owner, only series are marked, as version-of reads only them.
 */
export function watchShown(
  top: Ctx | Cell, dirty: Ctx[], owner: object = REACTS, alive: (o: object) => boolean = () => true,
): void {
  const todo: Cell[] = [];
  if ('keys' in top) {
    for (let i = 0; i < top.keys.length; i++) if (!SKIP.has(canon(top.keys[i]!))) todo.push(top.vals[i]!);
  } else todo.push(top);
  walk(todo, false, dirty, owner, alive);
}

/**
 * Walks again from each series and row object that changed in place, for each one that
 * shows or reads it, so that what came inside it is marked too.
 */
export function watchChanged(series: Series<unknown>[], ctxs: Ctx[], dirty: Ctx[], alive: (o: object) => boolean): void {
  for (const s of series) {
    for (const o of [...seriesOwners.get(s) ?? []]) if (live(o, alive)) walk([{ t: K.Block, s, i: 0 } as Cell], true, dirty, o, alive);
  }
  for (const ctx of ctxs) {
    for (const o of [...rowOwners.get(ctx) ?? []]) if (live(o, alive)) walk([{ t: K.Object, ctx } as Cell], true, dirty, o, alive);
  }
}

function live(o: object, alive: (o: object) => boolean): boolean {
  return o === REACTS || alive(o);
}

/** Marks what is in `todo` and inside it, for the owner; the first one is walked into even if marked when `root`. */
function walk(todo: Cell[], root: boolean, dirty: Ctx[], owner: object, alive: (o: object) => boolean): void {
  const objects = owner !== REACTS;
  const seenS = new Set<Series<unknown>>();
  const seenC = new Set<Ctx>();
  while (todo.length > 0) {
    const c = todo.pop()!;
    const first = root;
    root = false;
    if (isSeries(c.t) || c.t === K.Map) {
      const s = (c as { s: Series<unknown> }).s;
      if (seenS.has(s)) continue;
      seenS.add(s);
      s.watch = dirtySeries;
      if (!own(seriesOwners, s, owner, alive) && !first) continue;
      for (const x of s.data as Cell[]) {
        if (typeof x !== 'object' || x === null) break; // strings and binaries hold numbers
        if (isSeries(x.t) || x.t === K.Map || (objects && x.t === K.Object)) todo.push(x);
      }
    } else if (c.t === K.Object && objects) {
      const ctx = (c as ObjectCell).ctx;
      if (seenC.has(ctx)) continue;
      seenC.add(ctx);
      if (rowOwners.get(ctx)?.has(owner) === true && !first) continue;
      if (isFace(ctx)) continue;
      ctx.watch = dirty;
      own(rowOwners, ctx, owner, alive);
      for (const x of ctx.vals) if (isSeries(x.t) || x.t === K.Map || x.t === K.Object) todo.push(x);
    }
  }
}

/** The owners of what changed in place: the faces that show a dirty series or a dirty row object. */
export function ownersOf(series: Series<unknown>[], ctxs: Ctx[], into: Set<object>): void {
  for (const s of series) for (const o of seriesOwners.get(s) ?? []) if (o !== REACTS) into.add(o);
  for (const c of ctxs) for (const o of rowOwners.get(c) ?? []) into.add(o);
}
