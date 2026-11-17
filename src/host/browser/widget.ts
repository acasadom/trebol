// --- widget: an element the page's JavaScript defines ----------------------------
//
// The element is made by its tag, once the page has defined it (import %geo-map.js).
// The face's value is the element's value property, both ways, as JSON; its props set
// properties. Its change event gives the value back, and any other on-xxx of the face
// listens to the element's event xxx, with the event's detail. The theme's custom
// properties (--tb-*) reach it, as they reach every element of the page.

import { K, NONE, spell, toJson, parseJson, type Cell, type ObjectCell, type WordCell } from '../../core/index.ts';
import { get, str, flag } from './faces.ts';
import { type Mounted, newId, fire, el } from './mount.ts';
import { fireEvent } from './events.ts';
import { required } from './fields.ts';

/** What was last given to or taken from each widget, as JSON, so a repaint sets only what changed. */
export const widgetSet = new WeakMap<HTMLElement, { value: string; props: string }>();

/** Events every face has, which the host listens to itself. */
export const FACE_EVENTS = new Set(['on-change', 'on-focus', 'on-unfocus', 'on-over', 'on-dbl-click', 'on-key', 'on-end',
  'on-drop', 'on-reorder', 'on-menu', 'on-select']);

/** A JavaScript value as Trebol's, as JSON carries it; none for what JSON cannot write. */
export function fromJs(x: unknown): Cell {
  let json: string | undefined;
  try {
    json = JSON.stringify(x);
  } catch {
    json = undefined;
  }
  if (json === undefined) return NONE;
  const v = parseJson(json);
  return typeof v === 'string' ? NONE : v;
}

export function buildWidget(face: ObjectCell, m: Mounted): HTMLElement {
  const id = `tb-${newId()}`;
  const wrap = el('div', 'tb-field');
  const label = el('label', 'tb-label');
  label.htmlFor = id;
  const control = el('div', 'tb-control');
  let node: HTMLElement;
  try {
    node = document.createElement(str(face, 'tag') ?? 'div');
  } catch {
    // a tag that is no element's name
    node = el('div');
  }
  node.classList.add('tb-widget');
  node.id = id;
  const error = el('div', 'tb-error');
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  node.setAttribute('aria-describedby', error.id);
  widgetSet.set(node, { value: '', props: '' });
  node.addEventListener('change', ev => {
    if (ev.target !== node) return;
    const v = fromJs((node as unknown as { value?: unknown }).value);
    widgetSet.get(node)!.value = toJson(v);
    void fire('ui-input', face, v);
  });
  const events = get(face, 'events');
  if (events.t === K.Block) {
    for (const w of events.s.data) {
      const name = w.t === K.Word ? spell((w as WordCell).sym).toLowerCase() : '';
      if (!name.startsWith('on-') || FACE_EVENTS.has(name)) continue;
      node.addEventListener(name.slice(3), ev => fireEvent(face, name, [['detail', fromJs((ev as CustomEvent).detail)]]));
    }
  }
  control.append(node, error);
  wrap.append(label, control);
  m.label = label;
  m.error = error;
  m.box = node;
  return wrap;
}

export function syncWidget(m: Mounted, err: string | null): void {
  const f = m.face;
  const t = str(f, 'text') ?? '';
  m.label!.textContent = t;
  m.label!.hidden = t === '';
  m.label!.classList.toggle('tb-required', required(f));
  const node = m.box! as HTMLElement & { value?: unknown; disabled?: boolean; readOnly?: boolean };
  const set = widgetSet.get(node)!;
  const props = get(f, 'props');
  const propsJson = props.t === K.Object || props.t === K.Map ? toJson(props) : '{}';
  if (propsJson !== set.props) {
    Object.assign(node, JSON.parse(propsJson) as object);
    set.props = propsJson;
  }
  const valueJson = toJson(get(f, 'value'));
  if (valueJson !== set.value) {
    node.value = JSON.parse(valueJson) as unknown;
    set.value = valueJson;
  }
  const disabled = flag(f, 'disabled');
  node.toggleAttribute('disabled', disabled);
  if ('disabled' in node) node.disabled = disabled;
  if ('readOnly' in node) node.readOnly = flag(f, 'readonly');
  node.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
  if (t !== '') node.setAttribute('aria-label', t);
  m.error!.textContent = err ?? '';
}
