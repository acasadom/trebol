// The rows of a table or list in the order shown, with their keys, kept while they hold: a repaint
// that changes only what is chosen, or how a face looks, neither sorts the rows again nor makes their
// keys again. No DOM here, so the tests run it in Node.

import { K, form, intern, isAnyBlock, isAnyPath, isSeries, type Cell, type Sym, type Series } from '../core/index.ts';
import { rowField, groupRow, sortGroups } from './rows.ts';

/** A row as shown: the row and its key, which is what keeps its drawing from one repaint to the next. */
export interface RowItem { row: Cell; k: string }

/**
 * The rows of a face in their order, and what they were made from: the data block (its array, version
 * and position), how they were sorted and keyed, and for each row the marks that change when anything
 * the order or the key reads from it changes. `marks` is null when some value cannot be checked that way.
 */
export interface RowOrder {
  data: unknown[] | null;
  ver: number;
  at: number;
  how: string;
  marks: unknown[] | null;
  items: RowItem[];
}

const verOf = (c: Cell): number => (isSeries(c.t) ? ((c as { s: Series<unknown> }).s.ver ?? 0) : 0);

/**
 * A value whose changes its cell and its series' version both show: not a block, a path, a map or an
 * object, whose inner values may change with neither.
 */
const checkable = (c: Cell): boolean => !isAnyBlock(c.t) && !isAnyPath(c.t) && c.t !== K.Map && c.t !== K.Object;

/**
 * Per row: its own version (maps and blocks change it with any field), then the cell and version of
 * the field it is sorted by and of its key (objects have no version, so their cells tell). Null when
 * a value is not checkable.
 */
function marksOf(rows: Cell[], col: Sym | null, key: Sym): unknown[] | null {
  const out: unknown[] = [];
  for (const row of rows) {
    out.push(row, verOf(row));
    if (groupRow(row) !== null) continue;
    for (const sym of col === null ? [key] : [col, key]) {
      const v = rowField(row, sym);
      if (!checkable(v)) return null;
      out.push(v, verOf(v));
    }
  }
  return out;
}

const sameMarks = (a: unknown[], b: unknown[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * The rows of `data` in the order shown, sorted by `order` when given, with their keys from the `key`
 * field; `prev` when nothing they were made from has changed since.
 */
export function rowOrder(
  prev: RowOrder | null,
  data: Cell,
  order: { sym: Sym; desc: boolean } | null,
  language: string,
  key: Sym,
  shows: (v: Cell) => string,
): RowOrder {
  const block = data.t === K.Block ? data : null;
  let rows = block !== null ? block.s.data.slice(block.i) : [];
  const how = `${order === null ? '' : `${order.sym} ${order.desc}`}|${language}|${key}`;
  const marks = marksOf(rows, order?.sym ?? null, key);
  const here = { data: block?.s.data ?? null, ver: block?.s.ver ?? 0, at: block?.i ?? 0, how };
  if (prev !== null && marks !== null && prev.marks !== null && prev.data === here.data && prev.ver === here.ver
    && prev.at === here.at && prev.how === how && sameMarks(prev.marks, marks)) return prev;
  if (order !== null) rows = sortGroups(rows, order.sym, order.desc, language, shows);
  const seen = new Set<string>();
  const items = rows.map((row, i) => {
    const group = groupRow(row);
    let k: string;
    if (group !== null) k = `${group.kind}#${i}`;
    else {
      const id = rowField(row, key);
      k = id.t === K.None ? `#${i}` : `${id.t}:${form(id)}`;
      if (seen.has(k)) k = `${k}#${i}`;
    }
    seen.add(k);
    return { row, k };
  });
  return { ...here, marks, items };
}

/** The `id` field, the key of rows when a face names none. */
export const ID: Sym = intern('id');
