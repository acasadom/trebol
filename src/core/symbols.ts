// Symbol interning.
//
// Every distinct spelling gets its own symbol id, so words keep the case the
// user wrote ("Foo" molds back as "Foo"). Each symbol also has a canonical id
// (its lowercase spelling); words compare by canonical id, which makes word
// comparison case-insensitive as in Rebol.

export type Sym = number;

const spellings: string[] = [];
const canons: Sym[] = [];
const ids = new Map<string, Sym>();

export function intern(spelling: string): Sym {
  const found = ids.get(spelling);
  if (found !== undefined) return found;
  const lower = spelling.toLowerCase();
  const id = spellings.length;
  spellings.push(spelling);
  ids.set(spelling, id);
  if (lower === spelling) {
    canons.push(id);
  } else {
    canons.push(-1); // placeholder: interning the canon may push more entries
    canons[id] = intern(lower);
  }
  return id;
}

/** The spelling a symbol was created with. */
export function spell(sym: Sym): string {
  const s = spellings[sym];
  if (s === undefined) throw new RangeError(`unknown symbol ${sym}`);
  return s;
}

/** The canonical (lowercase) symbol for comparisons. */
export function canon(sym: Sym): Sym {
  return canons[sym] ?? sym;
}

/** Case-insensitive symbol equality. */
export function sameSym(a: Sym, b: Sym): boolean {
  return a === b || canon(a) === canon(b);
}

export function symbolCount(): number {
  return spellings.length;
}
