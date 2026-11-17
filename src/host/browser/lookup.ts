// A lookup: a field where the user types and chooses among what on-search finds, as in
// the WAI-ARIA combobox. Only one list is open at a time, in the top layer as a calendar.

import { K, NONE, string, form, type Cell, type MapCell, type ObjectCell } from '../../core/index.ts';
import { mapAt, translate } from '../index.ts';
import { linkHref } from '../markdown.ts';
import { get, str, optionValue, optionText, optionsOf, own, flag, word, icon } from './faces.ts';
import { type Mounted, host, newId, fire, el } from './mount.ts';
import { int } from './drag.ts';
import { required } from './fields.ts';
import { screenHref } from './screens.ts';

export interface OpenLookup {
  m: Mounted;
  list: HTMLUListElement;
  shown: Cell | null;   // the options on show; null until the first answer
  items: Cell[];
  active: number;
}
export let lookup: OpenLookup | null = null;
export let lookupTimer: ReturnType<typeof setTimeout> | undefined;
export const LOOKUP_WAIT_MS = 200;

export function lookupValues(f: ObjectCell): Cell[] {
  const v = get(f, 'value');
  return v.t === K.None ? [] : v.t === K.Block ? v.s.data.slice(v.i) : [v];
}

export function lookupText(f: ObjectCell, v: Cell): string {
  const known = get(f, 'known');
  const t = known.t === K.Map ? mapAt(known as MapCell, form(v)) : null;
  return t !== null ? translate(t, host.rt) : form(v);
}

/** Where a readonly lookup's value links to, from its `links` map, or null to show it as text. */
export function lookupHref(f: ObjectCell, v: Cell): string | null {
  const links = get(f, 'links');
  if (!flag(f, 'readonly') || links.t !== K.Map) return null;
  const to = mapAt(links as MapCell, form(v));
  if (to === null) return null;
  if (to.t === K.LitWord) return screenHref({ ...to, t: K.Word } as Cell);
  if (to.t === K.LitPath) return screenHref({ ...to, t: K.Path } as Cell);
  return screenHref(to) ?? (to.t === K.Url || to.t === K.File || to.t === K.String ? linkHref(form(to)) : null);
}

export function buildLookup(face: ObjectCell, m: Mounted): HTMLElement {
  const id = `tb-${newId()}`;
  const wrap = el('div', 'tb-field');
  const label = el('label', 'tb-label');
  label.htmlFor = id;
  const control = el('div', 'tb-control');
  const box = el('div', 'tb-lookup');
  const chosen = el('ul', 'tb-lookup-chosen');
  const input = el('input', 'tb-input');
  input.id = id;
  input.type = 'text';
  input.autocomplete = 'off';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  const name = word(face, 'name');
  if (name !== null) input.name = name;
  const error = el('div', 'tb-error');
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  input.setAttribute('aria-describedby', error.id);
  input.addEventListener('click', () => {
    if (lookup?.m !== m) openLookup(m, input, '');
  });
  input.addEventListener('input', () => {
    if (lookup?.m !== m) openLookup(m, input, null);
    clearTimeout(lookupTimer);
    lookupTimer = setTimeout(() => void fire('ui-lookup-search', face, string(input.value)), LOOKUP_WAIT_MS);
  });
  input.addEventListener('keydown', ev => lookupKey(m, input, ev));
  input.addEventListener('blur', () => {
    closeLookup();
    // what was typed is not a value: emptied, a lookup has none; else it goes back to what it had
    if (input.readOnly) return;
    const many = flag(face, 'multiple');
    const emptied = !many && input.value === '' && get(face, 'value').t !== K.None;
    if (emptied) void fire('ui-input', face, NONE);
    else input.value = many ? '' : lookupValues(face).map(v => lookupText(face, v)).join('');
    void fire('ui-blur', face);
  });
  box.append(chosen, input);
  control.append(box, error);
  wrap.append(label, control);
  m.input = input;
  m.label = label;
  m.error = error;
  m.box = chosen;
  return wrap;
}

export function syncLookup(m: Mounted, err: string | null): void {
  const f = m.face;
  const input = m.input as HTMLInputElement;
  const label = m.label!;
  label.textContent = str(f, 'text') ?? '';
  label.classList.toggle('tb-required', required(f));
  const many = flag(f, 'multiple');
  const readonly = flag(f, 'readonly');
  const off = flag(f, 'disabled');
  const values = lookupValues(f);
  // readonly values with a link are shown as chips, so that each one is a real link
  const chips = many || values.some(v => lookupHref(f, v) !== null);
  input.readOnly = readonly;
  input.disabled = off;
  input.hidden = chips && readonly && values.length > 0;
  input.setAttribute('aria-required', required(f) ? 'true' : 'false');
  input.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
  const hint = str(f, 'hint');
  if (hint !== null) input.placeholder = hint;
  m.error!.textContent = err ?? '';
  if (chips) {
    m.box!.replaceChildren(...values.map((v, i) => {
      const li = el('li', 'tb-lookup-chip');
      const href = lookupHref(f, v);
      const shown = el(href !== null ? 'a' : 'span', href !== null ? 'tb-link' : '');
      if (shown instanceof HTMLAnchorElement) shown.href = href!;
      shown.textContent = lookupText(f, v);
      li.append(shown);
      if (!readonly && !off) {
        const remove = el('button', 'tb-upload-remove');
        remove.type = 'button';
        remove.setAttribute('aria-label', own('remove-value', shown.textContent));
        const x = icon('close');
        if (x !== null) remove.append(x);
        remove.addEventListener('click', () => {
          input.focus();
          void fire('ui-lookup-remove', f, int(i + 1));
        });
        li.append(remove);
      }
      return li;
    }));
  } else {
    // a single value loses its chip when it stops being readonly or linked
    m.box!.replaceChildren();
    const want = values.map(v => lookupText(f, v)).join('');
    if (document.activeElement !== input && input.value !== want) input.value = want;
  }
  if (lookup?.m === m) renderLookup();
}

export function openLookup(m: Mounted, input: HTMLInputElement, query: string | null): void {
  if (input.readOnly || input.disabled) return;
  closeLookup();
  const list = el('ul', 'tb-lookup-list');
  list.id = `tb-${newId()}`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('popover', 'manual');
  // choosing with the pointer must not take the focus away from the field
  list.addEventListener('pointerdown', ev => ev.preventDefault());
  lookup = { m, list, shown: null, items: [], active: -1 };
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', list.id);
  // a modal dialog makes all outside it inert: there, a list in the body would take no clicks
  (input.closest('dialog') ?? document.body).append(list);
  list.showPopover?.();
  placeLookup();
  if (query !== null) void fire('ui-lookup-search', m.face, string(query));
}

export function placeLookup(): void {
  if (lookup === null) return;
  const { list, m } = lookup;
  const r = m.input!.getBoundingClientRect();
  list.style.width = `${r.width}px`;
  list.style.left = `${r.left}px`;
  const height = list.getBoundingClientRect().height;
  list.style.top = `${r.bottom + 4 + height > innerHeight - 8 ? Math.max(8, r.top - 4 - height) : r.bottom + 4}px`;
}

export function closeLookup(): void {
  clearTimeout(lookupTimer);
  if (lookup === null) return;
  const { list, m } = lookup;
  lookup = null;
  list.hidePopover?.();
  list.remove();
  m.input!.setAttribute('aria-expanded', 'false');
  m.input!.removeAttribute('aria-controls');
  m.input!.removeAttribute('aria-activedescendant');
}

export function renderLookup(): void {
  if (lookup === null) return;
  const open = lookup;
  const options = get(open.m.face, 'options');
  // what is on show stays until the search answers; a query still on its way shows nothing new
  if (options.t !== K.Block || options === open.shown) return;
  if (open.shown === null && get(open.m.face, 'query').t === K.None) return;
  open.shown = options;
  const taken = new Set(flag(open.m.face, 'multiple') ? lookupValues(open.m.face).map(v => form(v)) : []);
  open.items = optionsOf(open.m.face).filter(o => !taken.has(optionValue(o)));
  open.active = -1;
  open.list.replaceChildren(...open.items.map((o, i) => {
    const li = el('li', 'tb-lookup-option');
    li.id = `${open.list.id}-${i}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    li.textContent = optionText(o);
    li.addEventListener('click', () => pickLookup(o));
    return li;
  }));
  if (open.items.length === 0) {
    const none = el('li', 'tb-lookup-none');
    none.textContent = own('no-matches');
    open.list.append(none);
  }
  placeLookup();
}

export function pickLookup(option: Cell): void {
  if (lookup === null) return;
  const { m } = lookup;
  const input = m.input as HTMLInputElement;
  closeLookup();
  input.value = flag(m.face, 'multiple') ? '' : optionText(option);
  void fire('ui-lookup-pick', m.face, option);
}

export function moveLookup(by: number): void {
  if (lookup === null || lookup.items.length === 0) return;
  const { list, items, m } = lookup;
  const at = lookup.active < 0 && by < 0 ? items.length - 1 : (lookup.active + by + items.length) % items.length;
  list.children[lookup.active]?.setAttribute('aria-selected', 'false');
  lookup.active = at;
  const li = list.children[at]!;
  li.setAttribute('aria-selected', 'true');
  li.scrollIntoView({ block: 'nearest' });
  m.input!.setAttribute('aria-activedescendant', li.id);
}

export function lookupKey(m: Mounted, input: HTMLInputElement, ev: KeyboardEvent): void {
  const open = lookup?.m === m;
  const stop = (): void => { ev.preventDefault(); ev.stopPropagation(); };
  switch (ev.key) {
    case 'ArrowDown': case 'ArrowUp':
      stop();
      if (open) moveLookup(ev.key === 'ArrowDown' ? 1 : -1);
      else openLookup(m, input, '');
      break;
    case 'Enter':
      if (!open) break;
      // with its list open, Enter chooses: it never sends the form
      stop();
      if (lookup!.active >= 0) pickLookup(lookup!.items[lookup!.active]!);
      break;
    case 'Escape':
      if (open) { stop(); closeLookup(); }
      break;
    case 'Backspace':
      if (flag(m.face, 'multiple') && input.value === '' && !input.readOnly) {
        const n = lookupValues(m.face).length;
        if (n > 0) void fire('ui-lookup-remove', m.face, int(n));
      }
      break;
  }
}
