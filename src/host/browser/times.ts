// --- times ---------------------------------------------------------------------------
//
// The list of a time field: the times from its min to its max, step minutes apart (30 unless told), as a
// listbox. It opens on the time it holds, or the next one from now. Arrows, Home, End and the Page keys move,
// Enter or Space picks, Esc closes.

import { K, string, type Cell, type ObjectCell } from '../../core/index.ts';
import { activeLanguage, amountOf } from '../index.ts';
import { get, own } from './faces.ts';
import { host, fire, el } from './mount.ts';
import { seenKeys } from './events.ts';
import { ruleArg, closeCalendar } from './calendar.ts';

export interface Times { face: ObjectCell; opener: HTMLButtonElement; list: HTMLElement }
export let times: Times | null = null;

/** The minutes of a time! cell since midnight, or null. */
export function minutesOf(v: Cell): number | null {
  return v.t === K.Time ? Math.floor(Number(v.v) / 6e10) : null;
}

export function openTimes(face: ObjectCell, opener: HTMLButtonElement): void {
  closeTimes(false);
  closeCalendar(false);
  const step = Math.max(1, Math.round(amountOf(get(face, 'step')) ?? 30));
  const low = minutesOf(ruleArg(face, 'min')) ?? 0;
  const high = minutesOf(ruleArg(face, 'max')) ?? 24 * 60 - 1;
  const chosen = minutesOf(get(face, 'value'));
  const now = new Date();
  const aim = chosen ?? now.getHours() * 60 + now.getMinutes();
  const fmt = new Intl.DateTimeFormat(activeLanguage(host.rt), { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  const list = el('ul', 'tb-lookup-list tb-times');
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', opener.getAttribute('aria-label') ?? own('choose-time'));
  list.setAttribute('popover', 'manual');
  let first: HTMLElement | null = null;
  for (let t = low; t <= high; t += step) {
    const li = el('li', 'tb-lookup-option');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', t === chosen ? 'true' : 'false');
    li.tabIndex = -1;
    const at = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    li.textContent = fmt.format(t * 60000);
    li.addEventListener('click', () => pickTime(at));
    list.append(li);
    if (first === null && t >= aim) first = li;
  }
  first ??= list.lastElementChild as HTMLElement | null;
  if (first !== null) first.tabIndex = 0;
  times = { face, opener, list };
  opener.setAttribute('aria-expanded', 'true');
  list.addEventListener('keydown', timesKey);
  list.addEventListener('focusout', ev => {
    if (times?.list === list && !list.contains(ev.relatedTarget as Node | null) && ev.relatedTarget !== null) closeTimes(false);
  });
  document.addEventListener('pointerdown', outsideTimes, true);
  (opener.closest('dialog') ?? document.body).append(list);
  list.showPopover?.();
  const r = opener.closest('.tb-date')!.getBoundingClientRect();
  list.style.width = `${Math.min(r.width, 240)}px`;
  list.style.left = `${r.right - list.getBoundingClientRect().width}px`;
  const height = list.getBoundingClientRect().height;
  list.style.top = `${r.bottom + 4 + height > innerHeight - 8 ? Math.max(8, r.top - 4 - height) : r.bottom + 4}px`;
  first?.scrollIntoView({ block: 'center' });
  first?.focus();
}

export function closeTimes(refocus = true): void {
  if (times === null) return;
  const { list, opener } = times;
  times = null;
  list.hidePopover?.();
  list.remove();
  opener.setAttribute('aria-expanded', 'false');
  document.removeEventListener('pointerdown', outsideTimes, true);
  if (refocus) opener.focus();
}

export function outsideTimes(ev: PointerEvent): void {
  if (times !== null && !times.list.contains(ev.target as Node) && !times.opener.contains(ev.target as Node)) closeTimes(false);
}

export function pickTime(at: string): void {
  const face = times?.face;
  if (face === undefined) return;
  closeTimes();
  void fire('ui-input', face, string(at)).then(() => fire('ui-blur', face));
}

export function timesKey(ev: KeyboardEvent): void {
  if (times === null) return;
  seenKeys.add(ev);
  const items = [...times.list.children] as HTMLElement[];
  const at = items.indexOf(ev.target as HTMLElement);
  if (ev.key === 'Escape') {
    ev.preventDefault();
    ev.stopPropagation();
    closeTimes();
    return;
  }
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    (ev.target as HTMLElement).click();
    return;
  }
  const moves: Record<string, number> = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1, PageDown: at + 8, PageUp: at - 8 };
  if (!(ev.key in moves) || at < 0) return;
  ev.preventDefault();
  const to = items[Math.max(0, Math.min(items.length - 1, moves[ev.key]!))]!;
  items[at]!.tabIndex = -1;
  to.tabIndex = 0;
  to.focus();
  to.scrollIntoView({ block: 'nearest' });
}

