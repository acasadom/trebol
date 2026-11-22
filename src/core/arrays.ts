// Array edits that take any number of items. `a.push(...items)` and `a.splice(i, n, ...items)` pass
// every item as an argument on the JS stack, so a few hundred thousand of them (a big string, a long
// block) overflow it. These do the same in chunks.

const CHUNK = 8192;

/** Appends every item to `out`. */
export function pushAll<T>(out: T[], items: readonly T[]): void {
  if (items.length <= CHUNK) {
    out.push(...items);
    return;
  }
  for (let i = 0; i < items.length; i += CHUNK) out.push(...items.slice(i, i + CHUNK));
}

/** Removes `del` items at `at` and puts `add` there, as `a.splice(at, del, ...add)`. */
export function spliceAll<T>(a: T[], at: number, del: number, add: readonly T[]): void {
  at = Math.min(at, a.length);
  if (add.length <= CHUNK) {
    a.splice(at, del, ...add);
    return;
  }
  const tail = a.slice(at + del);
  a.length = at;
  pushAll(a, add);
  pushAll(a, tail);
}

/** The least and greatest of the numbers, or Infinity and -Infinity for none. */
export function extent(xs: readonly number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of xs) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  return [lo, hi];
}
