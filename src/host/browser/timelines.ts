// --- a timeline: what happened, and when ------------------------------------------------
// Its rows under the day they happened, each with a mark on a line that runs down the days, what happened,
// a quieter line beneath and the time. With `relative` the time says how long ago it was; the headings and those
// times are said again every half minute, so Today becomes Yesterday after midnight.

import { K } from '../../core/index.ts';
import { activeLanguage } from '../index.ts';
import { rowField } from '../rows.ts';
import { timelineDays, dayLabel, timeText, type Moment } from '../dates.ts';
import { get, str, own, word, flag } from './faces.ts';
import { type Mounted, host, rowOf, el, newId } from './mount.ts';
import { columns, cellText } from './tables.ts';
import { roleField, roleOf, paintRole } from './row-roles.ts';

/** How often the headings and the times that say how long ago are said again. */
export const RETELL_MS = 30000;

/** The moment of each shown time and heading, to say them again as time goes by. */
const moments = new WeakMap<Element, Moment>();
let retelling = 0;

export function buildTimeline(m: Mounted): HTMLElement {
  const wrap = el('div', 'tb-timeline');
  const box = el('div', 'tb-timeline-days');
  const empty = el('p', 'tb-empty');
  wrap.append(box, empty);
  m.box = box;
  m.empty = empty;
  return wrap;
}

export function syncTimeline(m: Mounted): void {
  const f = m.face;
  const data = get(f, 'data');
  const rows = data.t === K.Block ? data.s.data.slice(data.i) : [];
  const cols = columns(f);
  const lang = activeLanguage(host.rt);
  const now = Date.now();
  const relative = flag(f, 'relative');
  const roles = roleField(f);
  const days = cols.length < 2 ? [] : timelineDays(rows, cols[0]!.sym, word(f, 'order') !== 'oldest');
  const out: HTMLElement[] = [];
  for (const d of days) {
    const section = el('section', 'tb-timeline-day');
    if (d.day !== 0) {
      const head = el('h3', 'tb-timeline-date');
      head.id = `tb-${newId()}`;
      moments.set(head, { ms: d.ms, allDay: true });
      head.textContent = dayLabel(d.ms, now, lang);
      section.setAttribute('aria-labelledby', head.id);
      section.append(head);
    }
    const list = el('ol', 'tb-timeline-items');
    for (const r of d.rows) {
      const li = el('li', 'tb-timeline-item');
      rowOf.set(li, r.row);
      paintRole(li, roleOf(r.row, roles));
      li.append(el('span', 'tb-timeline-mark'));
      const body = el('div', 'tb-timeline-body');
      const what = el('span', 'tb-timeline-text');
      what.textContent = cellText(rowField(r.row, cols[1]!.sym));
      body.append(what);
      const said = r.at === null ? null : timeText(r.at, now, lang, relative);
      if (r.at !== null && said !== null) {
        const time = el('time', 'tb-timeline-time');
        time.dateTime = new Date(r.at.ms).toISOString();
        time.title = new Date(r.at.ms).toLocaleString(lang);
        moments.set(time, r.at);
        if (relative) time.dataset['tbRelative'] = '';
        time.textContent = said;
        body.append(time);
      }
      const rest = cols.slice(2).map(c => cellText(rowField(r.row, c.sym))).filter(t => t !== '');
      if (rest.length > 0) {
        const note = el('span', 'tb-timeline-note');
        note.textContent = rest.join(' · ');
        body.append(note);
      }
      li.append(body);
      list.append(li);
    }
    section.append(list);
    out.push(section);
  }
  m.box!.replaceChildren(...out);
  m.empty!.textContent = str(f, 'text') ?? own('empty');
  m.empty!.hidden = rows.length > 0;
  if (retelling === 0 && out.length > 0) retelling = window.setInterval(retell, RETELL_MS);
}

/** Says the headings and the relative times of every timeline on the page again; stops when there is none. */
function retell(): void {
  const shown = document.querySelectorAll<HTMLElement>('.tb-timeline-date, .tb-timeline-time[data-tb-relative]');
  if (shown.length === 0) {
    window.clearInterval(retelling);
    retelling = 0;
    return;
  }
  const lang = activeLanguage(host.rt);
  const now = Date.now();
  for (const e of shown) {
    const at = moments.get(e);
    if (at === undefined) continue;
    const said = e.tagName === 'H3' ? dayLabel(at.ms, now, lang) : timeText(at, now, lang, true);
    if (e.textContent !== said) e.textContent = said;
  }
}
