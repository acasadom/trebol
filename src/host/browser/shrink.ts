// --- texts sized to their width ------------------------------------------------------

import { el, type Mounted } from './mount.ts';

/** The characters a line is sized for at least, so a short number is not drawn huge. */
export const SHRINK_FEWEST = 4;

/** How many characters a text with `shrink` is sized for: its own, never fewer than SHRINK_FEWEST. */
export function shrinkChars(shown: string): number {
  return Math.max(SHRINK_FEWEST, [...shown].length);
}

/**
 * The element a title, heading or text writes its text into. With `shrink` that is one line inside it whose
 * letters are as large as the width of the face lets a line of that length be, never larger than the face's own
 * size (the theme does it with container units); without it, the face's element itself.
 */
export function shrinkTarget(m: Mounted, on: boolean, shown: string): HTMLElement {
  let line = m.el.firstElementChild instanceof HTMLSpanElement && m.el.firstElementChild.classList.contains('tb-shrink-line')
    ? m.el.firstElementChild
    : null;
  m.el.classList.toggle('tb-shrink', on);
  if (!on) {
    if (line !== null) line.remove();
    return m.el;
  }
  if (line === null) {
    line = el('span', 'tb-shrink-line');
    m.el.replaceChildren(line);
  }
  line.style.setProperty('--tb-shrink-chars', String(shrinkChars(shown)));
  return line;
}
