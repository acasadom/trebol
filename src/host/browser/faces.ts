// --- reading faces -----------------------------------------------------------------

import { K, NONE, form, ctxFind, intern, spell, type Cell, type MapCell, type ObjectCell, type WordCell } from '../../core/index.ts';
import { mapAt, shown, translate, uiText, activeLanguage, LOCAL_KINDS } from '../index.ts';
import { iconNode } from '../icons.ts';
import { host, el } from './mount.ts';

export function get(face: ObjectCell, name: string): Cell {
  const i = ctxFind(face.ctx, intern(name));
  return i < 0 ? NONE : face.ctx.vals[i]!;
}

export function str(face: ObjectCell, name: string): string | null {
  const v = get(face, name);
  if (v.t === K.None) return null;
  // a text per language, or a word of the dictionary: in the active language
  if (v.t === K.Map || ((name === 'text' || name === 'hint' || name === 'mark-text') && v.t === K.Word)) return translate(v, host.rt);
  return form(v);
}

/** What a choice or radio option is worth: itself, or the `value` of a map #(value: .. text: ..). */
export function optionValue(o: Cell): string {
  const v = o.t === K.Map ? mapAt(o as MapCell, 'value') : null;
  return form(v ?? o);
}

/** What a choice or radio option shows, in the active language. */
export function optionText(o: Cell): string {
  const t = o.t === K.Map ? mapAt(o as MapCell, 'text') : null;
  return t !== null ? translate(t, host.rt) : optionValue(o);
}

/** A group of options: its title and its options. */
export interface OptionGroup { title: Cell; options: Cell[] }

/** The options of a choice or radio as written: options and groups, a title followed by a block. */
export function entriesOf(face: ObjectCell): (Cell | OptionGroup)[] {
  const opts = get(face, 'options');
  if (opts.t !== K.Block) return [];
  const data = opts.s.data.slice(opts.i);
  const out: (Cell | OptionGroup)[] = [];
  for (let i = 0; i < data.length; i++) {
    const next = data[i + 1];
    if (next !== undefined && next.t === K.Block && data[i]!.t !== K.Block) {
      out.push({ title: data[i]!, options: next.s.data.slice(next.i) });
      i++;
    } else if (data[i]!.t !== K.Block) out.push(data[i]!);
  }
  return out;
}

export function isGroup(e: Cell | OptionGroup): e is OptionGroup {
  return 'options' in e;
}

/** The options of a choice or radio, those of its groups included, in order. */
export function optionsOf(face: ObjectCell): Cell[] {
  return entriesOf(face).flatMap(e => isGroup(e) ? e.options : [e]);
}

/** What tells apart two sets of options: their values and where each group starts. */
export function optionsKey(face: ObjectCell): string {
  return entriesOf(face).map(e => isGroup(e) ? `\u0001${e.options.map(optionValue).join('\0')}` : optionValue(e)).join('\0');
}

/** Writes the options of a select: an empty one first, then those of the face, each group in an optgroup. */
export function fillSelect(sel: HTMLSelectElement, face: ObjectCell): void {
  const first = el('option');
  first.value = '';
  sel.replaceChildren(first);
  const option = (o: Cell): HTMLOptionElement => {
    const opt = el('option');
    opt.value = optionValue(o);
    opt.textContent = optionText(o);
    return opt;
  };
  for (const e of entriesOf(face)) {
    if (isGroup(e)) {
      const group = el('optgroup');
      group.label = translate(e.title, host.rt);
      group.append(...e.options.map(option));
      sel.append(group);
    } else sel.append(option(e));
  }
  sel.dataset.options = optionsKey(face);
}

/** One of Trebol's own texts (`i18n/ui`) in the active language. */
export function own(key: string, ...args: string[]): string {
  return uiText(host.rt, key, ...args);
}

/** Gives a node built once one of Trebol's own texts (its text or an attribute); `repaint` keeps it in the active language. */
export function keepOwn(node: HTMLElement, key: string, attr?: string): void {
  node.dataset.tbOwn = attr === undefined ? key : `${attr} ${key}`;
  showOwn(node);
}

export function showOwn(node: HTMLElement): void {
  const [a, k] = node.dataset.tbOwn!.split(' ');
  if (k === undefined) node.textContent = own(a!);
  else node.setAttribute(a!, own(k));
}

/** A value as it shows on screen: dates, numbers and money in the active language. */
export function display(v: Cell): string {
  return LOCAL_KINDS.has(v.t) ? shown(v, activeLanguage(host.rt)) : form(v);
}

export function flag(face: ObjectCell, name: string): boolean {
  const v = get(face, name);
  return !(v.t === K.None || (v.t === K.Logic && !v.v));
}

export function word(face: ObjectCell, name: string): string | null {
  const v = get(face, name);
  return v.t === K.Word || v.t === K.LitWord ? spell((v as WordCell).sym).toLowerCase() : null;
}

export function children(face: ObjectCell): ObjectCell[] {
  const c = get(face, 'pane');
  if (c.t !== K.Block) return [];
  return c.s.data.slice(c.i).filter(x => x.t === K.Object) as ObjectCell[];
}

/** The name of a face's icon (`#search` -> "search"). */
export function iconName(face: ObjectCell): string | null {
  const v = get(face, 'icon');
  return v.t === K.Issue ? spell((v as WordCell).sym).toLowerCase() : null;
}

export function icon(name: string, label: string | null = null): SVGSVGElement | null {
  const svg = iconNode(name, label);
  if (svg === null) console.warn(`Trebol: unknown icon #${name}`);
  return svg;
}

export function hasRule(face: ObjectCell, rule: string): boolean {
  const rules = get(face, 'rules');
  if (rules.t !== K.Block) return false;
  return rules.s.data.some(r => r.t === K.Block && r.s.data[0]?.t === K.Word && spell((r.s.data[0] as WordCell).sym) === rule);
}

