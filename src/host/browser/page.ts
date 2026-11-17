// --- page -----------------------------------------------------------------------
//
// What the page shows as a whole: its root element, the view and title on show, and the style sheets of the theme.

import type { ObjectCell } from '../../core/index.ts';
import { themeCss, type ThemeParams } from '../theme.ts';
import { themeMoved } from '../motion.ts';

export let root: HTMLElement | null = null;
export function setRoot(v: HTMLElement | null): void {
  root = v;
}
/** The view on show, whose palette Ctrl+K opens. */
export let rootFace: ObjectCell | null = null;
export function setRootFace(v: ObjectCell | null): void {
  rootFace = v;
}
/** The face whose text is the page title: the view's title, or the screen shown. */
export let titleFace: ObjectCell | null = null;
export function setTitleFace(v: ObjectCell | null): void {
  titleFace = v;
}


// The host's own CSS goes in constructed style sheets, not <style> elements: a page whose
// Content-Security-Policy says style-src 'self' drops a <style> made by script, but adopts these.
export const sheets = new Map<string, CSSStyleSheet>();

export function setSheet(id: string, css: string): void {
  let sheet = sheets.get(id);
  if (sheet === undefined) {
    sheet = new CSSStyleSheet();
    sheets.set(id, sheet);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
  sheet.replaceSync(css);
}

export function setTheme(p: ThemeParams): void {
  setSheet('theme', themeCss(p));
  themeMoved();
}

