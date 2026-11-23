// --- calendar ------------------------------------------------------------------------
//
// The calendar of a date field: a grid of days, as in the WAI-ARIA date picker
// pattern. Arrows move by days and weeks, Page Up/Down by months, Home/End to
// the ends of the week, Enter or Space picks, Esc closes. Days are UTC dates.

import { K, NONE, string, spell, utcDayMs, type Cell, type ObjectCell, type WordCell } from '../../core/index.ts';
import { activeLanguage, weekStart } from '../index.ts';
import { get, own, display, word, icon } from './faces.ts';
import { host, newId, fire, el } from './mount.ts';
import { seenKeys } from './events.ts';

// A date-range picks two days: the first one stays marked (from) until the second closes it.
export interface Calendar { face: ObjectCell; opener: HTMLButtonElement; box: HTMLElement; month: HTMLElement; at: Date; range: HTMLElement | null; from: Date | null }
export let calendar: Calendar | null = null;

export const DAY_MS = 86400000;

/** A date! cell as a UTC date at midnight, or null. */
export function utcDate(v: Cell): Date | null {
  return v.t === K.Date ? new Date(utcDayMs(v.v.y, v.v.m, v.v.d)) : null;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The two days of a date-range's value, or null. */
export function rangeOf(v: Cell): [Date, Date] | null {
  if (v.t !== K.Block) return null;
  const a = utcDate(v.s.data[v.i] ?? NONE), b = utcDate(v.s.data[v.i + 1] ?? NONE);
  return a !== null && b !== null ? [a, b] : null;
}

/** A range of dates as it shows on screen: 3 Nov 2026 – 10 Nov 2026. */
export function rangeText(v: Cell): string {
  if (v.t !== K.Block) return display(v);
  return v.s.data.slice(v.i, v.i + 2).map(display).join(' – ');
}

/** The argument of a rule of a face, as min or max, or none. */
export function ruleArg(face: ObjectCell, rule: string): Cell {
  const rules = get(face, 'rules');
  if (rules.t !== K.Block) return NONE;
  for (const r of rules.s.data) {
    if (r.t !== K.Block || r.s.data[0]?.t !== K.Word || spell((r.s.data[0] as WordCell).sym) !== rule) continue;
    return r.s.data[1] ?? NONE;
  }
  return NONE;
}

/** The date argument of a min or max rule of a face, or null. */
export function dateRule(face: ObjectCell, rule: string): Date | null {
  return utcDate(ruleArg(face, rule));
}

export function openCalendar(face: ObjectCell, opener: HTMLButtonElement): void {
  closeCalendar(false);
  const today = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const box = el('div', 'tb-calendar');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', opener.getAttribute('aria-label') ?? own('choose-date'));
  box.setAttribute('popover', 'manual');
  const month = el('h2', 'tb-calendar-month');
  month.id = `tb-${newId()}`;
  month.setAttribute('aria-live', 'polite');
  const step = (name: string, label: string, by: number): HTMLButtonElement => {
    const b = el('button', 'tb-calendar-step');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    const svg = icon(name);
    if (svg !== null) b.append(svg);
    b.addEventListener('click', () => {
      if (calendar === null) return;
      calendar.at = addMonths(calendar.at, by);
      renderCalendar();
    });
    return b;
  };
  const head = el('div', 'tb-calendar-head');
  head.append(step('chevron-left', own('previous-month'), -1), month, step('chevron-right', own('next-month'), 1));
  box.append(head);
  const isRange = word(face, 'style') === 'date-range';
  const value = get(face, 'value');
  let range: HTMLElement | null = null;
  if (isRange) {
    range = el('p', 'tb-calendar-hint');
    range.setAttribute('aria-live', 'polite');
    range.textContent = own('pick-start');
    box.append(range);
  }
  calendar = { face, opener, box, month, at: (isRange ? rangeOf(value)?.[0] : utcDate(value)) ?? today, range, from: null };
  opener.setAttribute('aria-expanded', 'true');
  box.addEventListener('keydown', calendarKey);
  box.addEventListener('focusout', ev => {
    if (calendar?.box === box && !box.contains(ev.relatedTarget as Node | null) && ev.relatedTarget !== null) closeCalendar(false);
  });
  document.addEventListener('pointerdown', outsideCalendar, true);
  document.body.append(box);
  box.showPopover?.();
  renderCalendar();
  const r = opener.closest('.tb-date')!.getBoundingClientRect();
  const c = box.getBoundingClientRect();
  box.style.left = `${Math.max(8, Math.min(r.right - c.width, innerWidth - c.width - 8))}px`;
  box.style.top = `${r.bottom + 4 + c.height > innerHeight - 8 ? Math.max(8, r.top - 4 - c.height) : r.bottom + 4}px`;
  focusDay();
}

export function closeCalendar(refocus = true): void {
  if (calendar === null) return;
  const { box, opener } = calendar;
  calendar = null;
  box.hidePopover?.();
  box.remove();
  opener.setAttribute('aria-expanded', 'false');
  document.removeEventListener('pointerdown', outsideCalendar, true);
  if (refocus) opener.focus();
}

export function outsideCalendar(ev: PointerEvent): void {
  if (calendar !== null && !calendar.box.contains(ev.target as Node) && !calendar.opener.contains(ev.target as Node)) closeCalendar(false);
}

/** Draws the month of the focused day; the head stays. */
export function renderCalendar(): void {
  const cal = calendar!;
  const lang = activeLanguage(host.rt);
  const at = cal.at;
  const min = dateRule(cal.face, 'min');
  const max = dateRule(cal.face, 'max');
  const value = get(cal.face, 'value');
  // a range shows the days it holds; once its first day is picked, only that one until the last
  const [low, high] = cal.range === null ? [utcDate(value), utcDate(value)]
    : cal.from !== null ? [cal.from, cal.from] : rangeOf(value) ?? [null, null];
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => new Intl.DateTimeFormat(lang, { timeZone: 'UTC', ...opts });

  cal.month.textContent = fmt({ month: 'long', year: 'numeric' }).format(at);
  const grid = el('table', 'tb-calendar-grid');
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-labelledby', cal.month.id);
  const first = weekStart(lang) % 7;
  const names = el('tr');
  for (let i = 0; i < 7; i++) {
    // 4-Jan-1970 was a Sunday
    const day = new Date(Date.UTC(1970, 0, 4 + ((first + i) % 7)));
    const th = el('th');
    th.scope = 'col';
    th.abbr = fmt({ weekday: 'long' }).format(day);
    th.textContent = fmt({ weekday: 'narrow' }).format(day);
    names.append(th);
  }
  const thead = el('thead');
  thead.append(names);
  const body = el('tbody');
  const start = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1);
  let ms = start - ((new Date(start).getUTCDay() - first + 7) % 7) * DAY_MS;
  const label = fmt({ dateStyle: 'full' });
  do {
    const row = el('tr');
    for (let i = 0; i < 7; i++, ms += DAY_MS) {
      const d = new Date(ms);
      const td = el('td', 'tb-calendar-day');
      td.setAttribute('role', 'gridcell');
      td.textContent = String(d.getUTCDate());
      td.setAttribute('aria-label', label.format(d));
      td.dataset.day = isoDay(d);
      td.tabIndex = ms === at.getTime() ? 0 : -1;
      if (d.getUTCMonth() !== at.getUTCMonth()) td.classList.add('tb-calendar-other');
      if (ms === today) td.setAttribute('aria-current', 'date');
      const ends = low !== null && high !== null && (ms === low.getTime() || ms === high.getTime());
      td.setAttribute('aria-selected', ends ? 'true' : 'false');
      if (cal.range !== null && low !== null && high !== null && ms > low.getTime() && ms < high.getTime()) td.classList.add('tb-calendar-in');
      if (cal.range !== null) td.addEventListener('pointerenter', () => spanTo(d));
      if ((min !== null && d < min) || (max !== null && d > max)) td.setAttribute('aria-disabled', 'true');
      td.addEventListener('click', () => pickDay(d));
      row.append(td);
    }
    body.append(row);
  } while (new Date(ms).getUTCMonth() === at.getUTCMonth());
  grid.append(thead, body);
  cal.box.querySelector('table')?.remove();
  if (cal.range !== null) cal.box.insertBefore(grid, cal.range);
  else cal.box.append(grid);
}

/** With the first day of a range picked, marks the days between it and the one pointed or focused. */
export function spanTo(d: Date): void {
  const from = calendar?.from;
  if (from == null) return;
  const [a, b] = from <= d ? [isoDay(from), isoDay(d)] : [isoDay(d), isoDay(from)];
  calendar!.box.querySelectorAll<HTMLElement>('td[data-day]').forEach(td => {
    const day = td.dataset.day!;
    td.classList.toggle('tb-calendar-in', day > a && day < b);
  });
}

export function addMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n;
  // the same day, or the last one of a shorter month
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
}

export function focusDay(): void {
  calendar?.box.querySelector<HTMLElement>('td[tabindex="0"]')?.focus();
}

export function pickDay(d: Date): void {
  const cal = calendar;
  if (cal === null) return;
  if (cal.box.querySelector(`td[data-day="${isoDay(d)}"]`)?.getAttribute('aria-disabled') === 'true') return;
  const face = cal.face;
  if (cal.range !== null && cal.from === null) {
    cal.from = d;
    cal.range.textContent = own('pick-end');
    renderCalendar();
    focusDay();
    return;
  }
  const picked = cal.from === null ? isoDay(d) : cal.from <= d ? `${isoDay(cal.from)} ${isoDay(d)}` : `${isoDay(d)} ${isoDay(cal.from)}`;
  closeCalendar();
  void fire('ui-input', face, string(picked)).then(() => fire('ui-blur', face));
}

export function calendarKey(ev: KeyboardEvent): void {
  const cal = calendar;
  if (cal === null) return;
  seenKeys.add(ev);
  if (ev.key === 'Escape') {
    ev.preventDefault();
    ev.stopPropagation();
    closeCalendar();
    return;
  }
  if (!(ev.target instanceof HTMLTableCellElement)) return;
  const at = cal.at;
  const first = weekStart(activeLanguage(host.rt)) % 7;
  const back = (at.getUTCDay() - first + 7) % 7;
  const days: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -back, End: 6 - back };
  let to: Date | null = null;
  if (ev.key in days) to = new Date(at.getTime() + days[ev.key]! * DAY_MS);
  else if (ev.key === 'PageUp' || ev.key === 'PageDown') to = addMonths(at, (ev.key === 'PageUp' ? -1 : 1) * (ev.shiftKey ? 12 : 1));
  else if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    pickDay(at);
    return;
  }
  if (to === null) return;
  ev.preventDefault();
  cal.at = to;
  if (to.getUTCMonth() === at.getUTCMonth()) {
    cal.box.querySelectorAll<HTMLElement>('td[tabindex="0"]').forEach(td => { td.tabIndex = -1; });
    const td = cal.box.querySelector<HTMLElement>(`td[data-day="${isoDay(to)}"]`)!;
    td.tabIndex = 0;
    td.focus();
  } else {
    renderCalendar();
    focusDay();
  }
  spanTo(to);
}

