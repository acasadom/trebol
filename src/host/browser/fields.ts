// --- fields ---------------------------------------------------------------------
//
// Text boxes, checks, sliders, radios and progress bars: building them and keeping them in step with their face.

import { K, NONE, TRUE, FALSE, string, form, spell, type Cell, type ObjectCell, type WordCell } from '../../core/index.ts';
import { translate, activeLanguage, editLocal, readLocal, readDate, readRange, readTime, amountOf } from '../index.ts';
import { inDevtools } from '../devtools.ts';
import { get, str, optionValue, optionText, entriesOf, isGroup, fillSelect, display, flag, word, iconName, icon, hasRule } from './faces.ts';
import { type Mounted, host, newId, fire, el } from './mount.ts';
import { calendar, openCalendar, closeCalendar } from './calendar.ts';
import { times, openTimes, closeTimes } from './times.ts';
import { hadCaret } from './richtext.ts';

export function buildInput(face: ObjectCell, style: string, m: Mounted): HTMLElement {
  const id = `tb-${newId()}`;
  const wrap = el('div', 'tb-field');
  const label = el('label', 'tb-label');
  label.htmlFor = id;
  const control = el('div', 'tb-control');
  let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  if (style === 'area') {
    input = el('textarea', 'tb-input');
  } else if (style === 'choice') {
    const sel = el('select', 'tb-input');
    fillSelect(sel, face);
    input = sel;
  } else {
    const i = el('input', 'tb-input');
    i.type = style === 'password' ? 'password' : hasRule(face, 'email') ? 'email' : hasRule(face, 'url') ? 'url' : 'text';
    if (style === 'number' || style === 'money' || hasRule(face, 'integer')) i.inputMode = hasRule(face, 'integer') ? 'numeric' : 'decimal';
    if (style === 'password') i.autocomplete = 'new-password';
    input = i;
  }
  input.addEventListener('focus', () => hadCaret.add(input));
  input.id = id;
  const error = el('div', 'tb-error');
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  input.setAttribute('aria-describedby', error.id);
  const name = word(face, 'name');
  if (name !== null) input.name = name;
  input.addEventListener(style === 'choice' ? 'change' : 'input', () => {
    // an amount goes to Trebol as 1234.5 and a date as 2026-11-03; what is not one goes as typed
    const lang = activeLanguage(host.rt);
    const typed = style === 'money' ? readLocal(input.value, lang) ?? input.value
      : style === 'date' ? readDate(input.value, lang) ?? input.value
      : style === 'date-range' ? readRange(input.value, lang) ?? input.value
      : style === 'time' ? readTime(input.value) ?? input.value : input.value;
    m.typing++;
    const settled = (): void => {
      m.typing--;
      m.typed = get(face, 'value');
    };
    void fire('ui-input', face, typed === '' ? NONE : string(typed)).then(settled, settled);
  });
  // an amount shows formatted, and is edited as a plain number of the active language
  if (style === 'money') input.addEventListener('focus', () => {
    if (!flag(face, 'readonly')) input.value = editLocal(get(face, 'value'), activeLanguage(host.rt));
  });
  // going to the dev tools is not leaving the field: it shows no error for it
  input.addEventListener('blur', ev => { if (!inDevtools((ev as FocusEvent).relatedTarget)) void fire('ui-blur', face); });
  const iconWord = style === 'area' || style === 'choice' ? null : iconName(face);
  const svg = iconWord !== null ? icon(iconWord) : null;
  if (style === 'date' || style === 'date-range' || style === 'time') {
    const box = el('div', 'tb-date');
    const pick = el('button', 'tb-date-button');
    pick.type = 'button';
    pick.setAttribute('aria-haspopup', style === 'time' ? 'listbox' : 'dialog');
    pick.setAttribute('aria-expanded', 'false');
    const cal = icon(style === 'time' ? 'clock' : 'calendar');
    if (cal !== null) pick.append(cal);
    if (style === 'time') pick.addEventListener('click', () => (times?.opener === pick ? closeTimes() : openTimes(face, pick)));
    else pick.addEventListener('click', () => (calendar?.opener === pick ? closeCalendar() : openCalendar(face, pick)));
    box.append(input, pick);
    control.append(box, error);
  } else if (svg !== null) {
    const box = el('div', 'tb-input-icon');
    box.append(svg, input);
    control.append(box, error);
  } else {
    control.append(input, error);
  }
  wrap.append(label, control);
  m.input = input;
  m.label = label;
  m.error = error;
  return wrap;
}

export function buildCheck(face: ObjectCell, m: Mounted, toggle: boolean): HTMLElement {
  const row = el('div', 'tb-check-row tb-control');
  const label = el('label', toggle ? 'tb-check tb-switch' : 'tb-check');
  const box = el('input');
  box.type = 'checkbox';
  if (toggle) box.setAttribute('role', 'switch');
  const caption = el('span');
  const error = el('div', 'tb-error');
  error.id = `tb-${newId()}-error`;
  error.setAttribute('aria-live', 'polite');
  box.setAttribute('aria-describedby', error.id);
  box.addEventListener('change', () => {
    void fire('ui-input', face, box.checked ? TRUE : FALSE).then(() => fire('ui-blur', face));
  });
  label.append(box, caption);
  row.append(label, error);
  m.input = box;
  m.label = caption;
  m.error = error;
  return row;
}

// A slider: the browser's range input on a track filled up to where it stands, and the number it
// stands at after it, written in the active language. Its arrows, Home, End and Page keys move it.
export function buildSlider(face: ObjectCell, m: Mounted): HTMLElement {
  const id = `tb-${newId()}`;
  const wrap = el('div', 'tb-field');
  const label = el('label', 'tb-label');
  label.htmlFor = id;
  const control = el('div', 'tb-control');
  const line = el('div', 'tb-slider');
  const input = el('input', 'tb-range');
  input.type = 'range';
  input.id = id;
  const name = word(face, 'name');
  if (name !== null) input.name = name;
  const out = el('output', 'tb-slider-value');
  out.htmlFor.add(id);
  const error = el('div', 'tb-error');
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  input.setAttribute('aria-describedby', error.id);
  input.addEventListener('input', () => {
    m.typing++;
    const settled = (): void => { m.typing--; };
    void fire('ui-input', face, string(input.value)).then(settled, settled);
  });
  // letting it go, or a key that moved it, is leaving it: its rules show
  input.addEventListener('change', () => void fire('ui-blur', face));
  line.append(input, out);
  control.append(line, error);
  wrap.append(label, control);
  m.input = input;
  m.label = label;
  m.error = error;
  m.box = out;
  return wrap;
}

export function ruleAmount(face: ObjectCell, rule: string): number | null {
  const rules = get(face, 'rules');
  if (rules.t !== K.Block) return null;
  for (const r of rules.s.data) {
    if (r.t === K.Block && r.s.data[0]?.t === K.Word && spell((r.s.data[0] as WordCell).sym) === rule) {
      const v = r.s.data[1];
      return v === undefined ? null : amountOf(v);
    }
  }
  return null;
}

export function syncSlider(m: Mounted, err: string | null): void {
  const f = m.face;
  const input = m.input as HTMLInputElement;
  m.label!.textContent = str(f, 'text') ?? '';
  m.label!.classList.toggle('tb-required', required(f));
  const low = ruleAmount(f, 'min') ?? 0;
  const high = ruleAmount(f, 'max') ?? 100;
  const step = amountOf(get(f, 'step')) ?? 1;
  input.min = String(low);
  input.max = String(high);
  input.step = String(step);
  const v = get(f, 'value');
  const at = amountOf(v) ?? low;
  // while it is dragged, the browser draws it where the pointer is
  if (m.typing === 0 && input.valueAsNumber !== at) input.value = String(at);
  const shown = v.t === K.None ? low.toLocaleString(activeLanguage(host.rt)) : display(v);
  m.box!.textContent = shown;
  input.setAttribute('aria-valuetext', shown);
  input.style.setProperty('--tb-at', `${high > low ? ((at - low) / (high - low)) * 100 : 0}%`);
  input.disabled = flag(f, 'disabled') || flag(f, 'readonly');
  input.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
  m.error!.textContent = err ?? '';
}

export function buildRadio(face: ObjectCell, m: Mounted): HTMLElement {
  const id = `tb-${newId()}`;
  const wrap = el('div', 'tb-field');
  const label = el('span', 'tb-label');
  label.id = id;
  const control = el('div', 'tb-control');
  const group = el('div', 'tb-radios');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-labelledby', id);
  const error = el('div', 'tb-error');
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  group.setAttribute('aria-describedby', error.id);
  m.radios = [];
  const radio = (o: Cell): HTMLElement => {
    const option = el('label', 'tb-check');
    const r = el('input');
    r.type = 'radio';
    r.name = id;
    r.value = optionValue(o);
    r.addEventListener('change', () => {
      if (r.checked) void fire('ui-input', face, string(r.value)).then(() => fire('ui-blur', face));
    });
    const caption = el('span');
    caption.textContent = optionText(o);
    option.append(r, caption);
    m.radios!.push(r);
    return option;
  };
  // a group of options: its title over them, the group named by it
  for (const e of entriesOf(face)) {
    if (isGroup(e)) {
      const sub = el('div', 'tb-radio-group');
      sub.setAttribute('role', 'group');
      const title = el('span', 'tb-radio-title');
      title.id = `tb-${newId()}`;
      title.textContent = translate(e.title, host.rt);
      sub.setAttribute('aria-labelledby', title.id);
      const items = el('div', 'tb-radios');
      items.append(...e.options.map(radio));
      sub.append(title, items);
      group.append(sub);
    } else group.append(radio(e));
  }
  control.append(group, error);
  wrap.append(label, control);
  m.label = label;
  m.error = error;
  return wrap;
}



export function buildProgress(m: Mounted): HTMLElement {
  const wrap = el('div', 'tb-progress-wrap');
  const label = el('span', 'tb-progress-label');
  label.id = `tb-${newId()}`;
  const track = el('div', 'tb-progress');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.append(el('div', 'tb-progress-bar'));
  wrap.append(label, track);
  m.label = label;
  m.box = track;
  return wrap;
}

/** A progress value as a fraction, or null while it is unknown. */
export function fraction(v: Cell): number | null {
  const n = v.t === K.Percent || v.t === K.Decimal ? v.v : v.t === K.Integer ? Number(v.v) : null;
  return n === null || Number.isNaN(n) ? null : Math.min(1, Math.max(0, n));
}

export function syncProgress(m: Mounted): void {
  const t = str(m.face, 'text');
  const label = m.label!;
  label.textContent = t ?? '';
  label.hidden = t === null;
  const track = m.box!;
  if (t !== null) track.setAttribute('aria-labelledby', label.id);
  else track.removeAttribute('aria-labelledby');
  const n = fraction(get(m.face, 'value'));
  track.classList.toggle('tb-indeterminate', n === null);
  const bar = track.firstChild as HTMLElement;
  if (n === null) {
    track.removeAttribute('aria-valuenow');
    bar.style.removeProperty('width');
  } else {
    track.setAttribute('aria-valuenow', String(Math.round(n * 100)));
    bar.style.width = `${n * 100}%`;
  }
}



export function syncIcon(m: Mounted): void {
  const name = iconName(m.face) ?? '';
  const label = str(m.face, 'text');
  const key = `${name} ${label ?? ''}`;
  if (m.el.dataset['icon'] === key) return;
  m.el.dataset['icon'] = key;
  const svg = name !== '' ? icon(name, label) : null;
  m.el.replaceChildren(...(svg !== null ? [svg] : []));
}

/** No rule applies to a read-only face, so it never asks for a value. */
export function required(f: ObjectCell): boolean {
  return hasRule(f, 'required') && !flag(f, 'readonly');
}

export function syncRadio(m: Mounted, err: string | null): void {
  const f = m.face;
  m.label!.textContent = str(f, 'text') ?? '';
  m.label!.classList.toggle('tb-required', required(f));
  const v = get(f, 'value');
  const want = v.t === K.None ? null : form(v);
  for (const r of m.radios!) {
    r.checked = r.value === want;
    r.disabled = flag(f, 'disabled') || flag(f, 'readonly');
  }
  const group = m.radios![0]?.closest('[role="radiogroup"]');
  group?.querySelectorAll('.tb-radio-title').forEach((t, i) => {
    const g = entriesOf(f).filter(isGroup)[i];
    if (g) t.textContent = translate(g.title, host.rt);
  });
  group?.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
  group?.setAttribute('aria-required', required(f) ? 'true' : 'false');
  m.error!.textContent = err ?? '';
}

