// The rows of a table or list: their fields, the heads and feet of groups
// among them, and the order a sortable table puts them in. No DOM here, so
// the tests run it in Node.

import {
  K, NONE, ctxFind, canon, intern, spell, text, compare,
  type Cell, type Sym, type WordCell, type StringCell,
} from '../core/index.ts';

/** A field of a map! or object! row; map keys may be words or strings. */
export function rowField(row: Cell, sym: Sym): Cell {
  if (row.t === K.Object) {
    const i = ctxFind(row.ctx, sym);
    return i < 0 ? NONE : row.ctx.vals[i]!;
  }
  if (row.t === K.Map) {
    const d = row.s.data;
    const c = canon(sym);
    for (let i = 0; i + 1 < d.length; i += 2) {
      const k = d[i]!;
      if (k.t === K.Word || k.t === K.SetWord || k.t === K.LitWord) {
        if (canon((k as WordCell).sym) === c) return d[i + 1]!;
      } else if (k.t === K.String && canon(intern(text(k as StringCell))) === c) {
        return d[i + 1]!;
      }
    }
  }
  return NONE;
}

/**
 * A row of data that heads or closes a group: [head 1 "Title"], whose title may
 * be a text per language, or [foot 1 #(amount: ...)], whose row is shown as the
 * totals are. The level is 1 or 2; 2 is indented.
 */
export function groupRow(c: Cell): { kind: 'head' | 'foot'; level: 1 | 2; value: Cell } | null {
  if (c.t !== K.Block) return null;
  const [w, n, v] = c.s.data.slice(c.i);
  if (w === undefined || n === undefined || v === undefined || w.t !== K.Word || n.t !== K.Integer) return null;
  const kind = spell((w as WordCell).sym).toLowerCase();
  if (kind !== 'head' && kind !== 'foot') return null;
  return { kind, level: Number(n.v) >= 2 ? 2 : 1, value: v };
}

/** Sorts the rows between the heads and feet of groups, each run on its own; those stay where they are. */
export function sortGroups(rows: Cell[], col: Sym, desc: boolean, language: string, shows: (v: Cell) => string): Cell[] {
  const out: Cell[] = [];
  let run: Cell[] = [];
  for (const r of rows) {
    if (groupRow(r) === null) {
      run.push(r);
      continue;
    }
    out.push(...sortRows(run, col, desc, language, shows), r);
    run = [];
  }
  return out.concat(sortRows(run, col, desc, language, shows));
}

/**
 * Rows by the native value of a column: numbers, amounts and dates by value, texts as
 * the language orders them; empty cells go last either way. Ties keep their order.
 */
function sortRows(rows: Cell[], col: Sym, desc: boolean, language: string, shows: (v: Cell) => string): Cell[] {
  const collator = new Intl.Collator(language, { numeric: true });
  const blank = (v: Cell): boolean => v.t === K.None || (v.t === K.String && text(v as StringCell) === '');
  const order = (a: Cell, b: Cell): number => {
    if (a.t === K.String && b.t === K.String) return collator.compare(text(a as StringCell), text(b as StringCell));
    // values that cannot be ordered together (a text and a number) go by what they show
    return compare(a, b) ?? collator.compare(shows(a), shows(b));
  };
  return rows
    .map(row => ({ row, v: rowField(row, col) }))
    .sort((a, b) => {
      const ea = blank(a.v);
      const eb = blank(b.v);
      if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
      return desc ? order(b.v, a.v) : order(a.v, b.v);
    })
    .map(x => x.row);
}

// --- drawing only the rows near the screen ---------------------------------------------

/** From this many rows on, a table or list draws only the ones near the screen. */
export const DRAW_ALL_UP_TO = 200;
/** Rows drawn beyond each edge of the screen, so a short scroll needs no new rows. */
const BEYOND = 30;
/** Rows drawn at least, even when the rows are all out of sight. */
const AT_LEAST = 60;

/**
 * The rows to draw, [first, end), of `count` rows each about `height` pixels tall,
 * when the screen shows from `top` to `top + seen` pixels measured from the first
 * row's top. The rows drawn now, `now`, are kept while they cover what is seen.
 */
export function rowWindow(count: number, height: number, top: number, seen: number, now?: { first: number; end: number }): { first: number; end: number } {
  const h = Math.max(1, height);
  const clamp = (n: number): number => Math.min(count, Math.max(0, n));
  const from = clamp(Math.floor(top / h));
  const to = clamp(Math.ceil((top + seen) / h));
  if (now !== undefined && now.end <= count && now.end - now.first >= Math.min(count, AT_LEAST) &&
      now.first <= from && to <= now.end) return now;
  let first = clamp(from - BEYOND);
  let end = clamp(to + BEYOND);
  if (end - first < AT_LEAST) {
    if (first === 0 || end < count) end = clamp(first + AT_LEAST);
    first = clamp(end - AT_LEAST);
  }
  return { first, end };
}
