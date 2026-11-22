// version-of: a number that tells whether a series, or a series inside it, changed.
//
// Every change of what a series holds gives it the next tick of one clock
// shared by all series (values.ts `touch`). The version of a value is the
// greatest tick of it and of every series inside it, through blocks and maps,
// so any change anywhere in it gives a number it never had before. Kept next to
// the series itself, it lets a reader see a change made in place, which
// comparing the series with itself never shows.

import { K, isSeries } from '../kinds.ts';
import * as I64 from '../int64.ts';
import { integer, type Cell, type Series } from '../values.ts';
import type { SeriesCell } from '../series.ts';
import { native, value } from './define.ts';

/** The greatest version of the series and of every series or map inside it, deeply. */
export function deepVersion(top: Series<unknown>): number {
  let ver = 0;
  const seen = new Set<Series<unknown>>();
  const todo: Series<unknown>[] = [top];
  while (todo.length > 0) {
    const s = todo.pop()!;
    if (seen.has(s)) continue;
    seen.add(s);
    if ((s.ver ?? 0) > ver) ver = s.ver!;
    for (const c of s.data as Cell[]) {
      if (typeof c !== 'object' || c === null) break; // strings and binaries hold numbers
      if (isSeries(c.t) || c.t === K.Map) todo.push((c as SeriesCell).s);
    }
  }
  return ver;
}

native('version-of', '["A number that changes whenever the series, or a series or map inside it, changes." series [series! map!]]', (_t, f) => {
  const s = f.args[0] as SeriesCell;
  return value(integer(I64.fromNumber(deepVersion(s.s))!));
});
