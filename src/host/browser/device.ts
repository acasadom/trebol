// A device face: a screen of another size, laid out at that size and made smaller to fit its place.
// Its screen is a query container named tb-screen, so the theme's narrow rules go by its width, as
// they go by the page's; inside it, a view lays its faces out as the page's view does.

import { K, type ObjectCell } from '../../core/index.ts';
import { get, children, flag } from './faces.ts';
import { type Mounted, el, appendChildren } from './mount.ts';

export function deviceSize(face: ObjectCell): [number, number] {
  const s = get(face, 'screen');
  return s.t === K.Pair ? [Number(s.x), Number(s.y)] : [390, 844];
}

export function buildDevice(face: ObjectCell, m: Mounted): HTMLElement {
  const node = el('div', 'tb-device');
  const screen = el('div', 'tb-device-screen');
  const view = el('div', 'tb-view');
  screen.append(view);
  node.append(screen);
  m.box = view;
  if (children(face).length > 0) appendChildren(view, face, 'device');
  const fit = (): void => {
    const [w, h] = deviceSize(face);
    // fit: it takes the height left too, and the whole screen fits in it
    const tall = flag(face, 'fit');
    let k = Math.min(1, node.clientWidth / w || 1);
    if (tall && node.clientHeight > 0) k = Math.min(k, node.clientHeight / h);
    screen.style.setProperty('--tb-device-w', `${w}px`);
    screen.style.setProperty('--tb-device-h', `${h}px`);
    screen.style.setProperty('--tb-device-k', String(k));
    node.style.setProperty('--tb-device-w', `${w}px`);
    // a screen narrower than its place stands in the middle of it
    screen.style.setProperty('--tb-device-x', `${Math.max(0, (node.clientWidth - w * k) / 2)}px`);
    if (!tall) node.style.height = `${Math.round(h * k)}px`;
  };
  fit();
  fits.set(node, fit);
  new ResizeObserver(fit).observe(node);
  return node;
}

const fits = new WeakMap<HTMLElement, () => void>();

/** Code changed the face's screen: lay it out at its new size. */
export function syncDevice(node: HTMLElement): void {
  fits.get(node)?.();
}
