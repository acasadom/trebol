// --- moments a text shows ---------------------------------------------------------------
//
// A text, heading or title that shows a date! or a time of day says it in a <time> whose datetime a machine
// reads (2026-11-23T09:30); a date has its full form in the tooltip, Monday, November 23, 2026 at 9:30 AM.
// With `clock`, a date with a time shows only its time, to the minute; with `ago`, a date says how long ago it was (5 minutes
// ago); either way the whole moment is still in datetime and tooltip.

import { K, time, string, type Cell, type ObjectCell } from '../../core/index.ts';
import { activeLanguage } from '../index.ts';
import { isoOf, fullDateText, momentOf, relativeText } from '../dates.ts';
import { flag } from './faces.ts';
import { host, el } from './mount.ts';

/** What a text face shows of its value: with `ago`, how long ago a date was; with `clock`, the time of a date that has one. */
export function momentShown(f: ObjectCell, v: Cell, now = Date.now()): Cell {
  if (v.t !== K.Date) return v;
  if (flag(f, 'ago')) return string(relativeText(momentOf(v)!, now, activeLanguage(host.rt)));
  // the clock says hours and minutes, as a timetable does
  return flag(f, 'clock') && v.v.time !== null ? time(Math.floor(v.v.time / 6e10) * 6e10) : v;
}

/**
 * The node a text face writes what it shows into: inside `into`, a <time> for a date! or a time of day, with
 * its datetime and, for a date, its full form as the tooltip; `into` itself for anything else.
 */
export function momentTarget(into: HTMLElement, v: Cell): HTMLElement {
  const iso = isoOf(v);
  if (iso === null) return into;
  let node = into.firstElementChild;
  if (!(node instanceof HTMLTimeElement) || into.childNodes.length !== 1) {
    node = el('time', 'tb-moment');
    into.replaceChildren(node);
  }
  const t = node as HTMLTimeElement;
  t.dateTime = iso;
  const full = fullDateText(v, activeLanguage(host.rt));
  if (full === null) t.removeAttribute('title');
  else t.title = full;
  return t;
}
