// Series editing helpers shared by the series natives.
//
// A series cell is (series, index). Block series also carry per-element
// newline markers and source positions; every edit keeps them aligned with
// `data` so mold and error positions stay right after changes.

import { K, isAnyBlock, isAnyString, type Kind } from './kinds.ts';
import { codePoints, ownMeta, touch, type Cell, type Series, type BlockCell, type StringCell } from './values.ts';
import { form } from './mold.ts';
import { spliceAll } from './arrays.ts';

export type SeriesCell = BlockCell | StringCell;

/** Elements of a series: cells for blocks, code points for strings, bytes for binary. */
export type Item = Cell | number;

export function items(c: SeriesCell): Item[] {
  return c.s.data as Item[];
}

/** Elements from the cell's index to the tail. */
export function rest(c: SeriesCell): Item[] {
  return (c.s.data as Item[]).slice(c.i);
}

export function lengthOf(c: SeriesCell): number {
  return Math.max(0, c.s.data.length - c.i);
}

/** Index clamped to the series bounds, as Rebol does when moving past an end. */
export function clampIndex(c: SeriesCell, i: number): number {
  return Math.max(0, Math.min(c.s.data.length, i));
}

export function at(c: SeriesCell, i: number): SeriesCell {
  return { ...c, i: clampIndex(c, i) } as SeriesCell;
}

/** Removes `del` elements at `at` and inserts `add` there, keeping block metadata aligned. */
export function splice(s: Series<Item>, at: number, del: number, add: readonly Item[], nl?: readonly boolean[]): void {
  ownMeta(s);
  touch(s);
  spliceAll(s.data, at, del, add);
  if (s.nl !== undefined) spliceAll(s.nl, at, del, add.map((_, k) => nl?.[k] ?? false));
  if (s.pos !== undefined) spliceAll(s.pos, at, del, add.map(() => -1));
}

/** UTF-8 bytes of a JS string. */
export function utf8(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

/**
 * The elements `value` contributes when inserted into a series of kind
 * `target`. Blocks splice their contents unless `only`; strings take text.
 */
export function itemsFor(target: Kind, value: Cell, only: boolean): { add: Item[]; nl?: boolean[] } {
  if (isAnyBlock(target)) {
    if (!only && value.t === K.Block) {
      const b = value as BlockCell;
      return { add: b.s.data.slice(b.i), nl: b.s.nl?.slice(b.i) };
    }
    return { add: [value] };
  }
  if (target === K.Binary) {
    if (value.t === K.Binary) return { add: value.s.data.slice(value.i) };
    if (value.t === K.Integer) return { add: [Number(value.v) & 255] };
    if (value.t === K.Char) return { add: utf8(String.fromCodePoint(value.v)) };
    return { add: utf8(textOf(value)) };
  }
  if (value.t === K.Char) return { add: [value.v] };
  if (isAnyString(value.t) && (value.t !== K.Tag || target === K.Tag)) {
    const s = value as StringCell;
    return { add: s.s.data.slice(s.i) };
  }
  return { add: codePoints(textOf(value)) };
}

/** Text a value contributes to a string: blocks join their elements' forms with no spaces. */
export function textOf(value: Cell): string {
  if (value.t === K.Block) return value.s.data.slice(value.i).map(textOf).join('');
  return form(value);
}
