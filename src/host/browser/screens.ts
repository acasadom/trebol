// --- screens ---------------------------------------------------------------------
//
// The page's link is `#/name/arg...`, each part URI-encoded. `go` pushes a
// history entry; back, forward and links to a screen change the hash, and the
// host passes the new route to `ui-route`.

import { logic, K, NONE, native, value, string, form, spell, text, blockOf, type Cell, type ObjectCell, type BlockCell, type WordCell, type StringCell } from '../../core/index.ts';
import { travelled } from '../motion.ts';
import { el } from './mount.ts';
import { int } from './drag.ts';

/** The screens face of the page. */
export let screensFace: ObjectCell | null = null;
export function setScreensFace(v: ObjectCell | null): void {
  screensFace = v;
}
export let comingScreen: HTMLElement | null = null;   // the screen being made, not on the page yet
export function setComingScreen(v: HTMLElement | null): void {
  comingScreen = v;
}
/** Where a change of screen is announced. */
export let screenNews: HTMLElement | null = null;

export function routeParts(): string[] {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === '') return [];
  return h.split('/').map(p => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
}

export function routeBlock(): BlockCell {
  return blockOf(K.Block, routeParts().map(p => string(p)));
}

/** `#/client/42` for the word `client` or the path `client/42`; null for anything else. */
export function screenHref(v: Cell): string | null {
  const part = (c: Cell): string => encodeURIComponent(c.t === K.String ? text(c as StringCell) : c.t === K.Word ? spell((c as WordCell).sym) : form(c));
  if (v.t === K.Word) return '#/' + part(v);
  if (v.t === K.Path) return '#/' + v.s.data.slice(v.i).map(part).join('/');
  return null;
}

native('route', '["The screen and arguments in the address bar." ]', () => value(routeBlock()));

// Where the page stands in the browser's history: how many of its screens lie behind the
// current one (depth) and how far forward it has been (top). Each entry keeps both in
// history.state, so back, forward and a reload find them again.
export let here = { depth: 0, top: 0 };
export function setHere(v: typeof here): void {
  here = v;
}

/** At start: an entry with no state is the first of the page. */
export function startHistory(): void {
  const state = history.state as { depth?: number; top?: number } | null;
  if (typeof state?.depth === 'number') here = { depth: state.depth, top: state.top ?? state.depth };
  history.replaceState({ ...here }, '');
}

/** Where the page stood before the link last changed, so route-undo can return; set while it returns. */
export let before = { depth: 0, top: 0 };
export let undoing: { depth: number; top: number } | null = null;
export function setUndoing(v: { depth: number; top: number } | null): void {
  undoing = v;
}

/** The link changed: back or forward lands on an entry the page made; a link or a typed address makes a new one, a step ahead. */
export function landHistory(): void {
  const state = history.state as { depth?: number } | null;
  before = { ...here };
  if (typeof state?.depth === 'number') here = { depth: state.depth, top: here.top };
  else here = { depth: here.depth + 1, top: here.depth + 1 };
  travelled(here.depth < before.depth ? 'back' : 'on');
  history.replaceState({ ...here }, '');
}

native('set-route', '["Puts a screen and arguments in the address bar." route [block!] replace [logic!]]', (_t, f) => {
  const href = screenHref({ ...(f.args[0] as BlockCell), t: K.Path } as Cell) ?? '#/';
  const replace = f.args[1]!.t === K.Logic && f.args[1]!.v;
  if (replace) {
    history.replaceState({ ...here }, '', href);
    return value(f.args[0]!);
  }
  // a new screen after going back drops the ones ahead, as the browser does
  here = { depth: here.depth + 1, top: here.depth + 1 };
  travelled('on');
  history.pushState({ ...here }, '', href);
  return value(f.args[0]!);
});

// A screen that does not let the page leave puts its link back: back for a new entry,
// the other way for back or forward. The link that comes back is not a change of screen.
native('route-undo', '["Puts back the link the page had before the last change." ]', () => {
  const by = before.depth - here.depth;
  if (by === 0) return value(NONE);
  undoing = before;
  history.go(by);
  return value(NONE);
});

// While the screen on show has changes not saved, the browser asks before closing or
// reloading the page, with its own words: no browser lets a page give its text.
export let unsaved = false;
native('set-unsaved', '["Whether the browser asks before closing the page." on [logic!]]', (_t, f) => {
  unsaved = f.args[0]!.t === K.Logic && f.args[0]!.v;
  return value(f.args[0]!);
});

native('route-steps', '["How many steps back and forward the history has." ]', () => value(blockOf(K.Block, [int(here.depth), int(here.top - here.depth)])));

native('route-back', '["Goes one step back in the history." ]', () => {
  if (here.depth === 0) return value(logic(false));
  history.back();
  return value(logic(true));
});

native('route-forward', '["Goes one step forward in the history." ]', () => {
  if (here.depth >= here.top) return value(logic(false));
  history.forward();
  return value(logic(true));
});

/** After code showed another screen: focus it and announce its title. */
export function enteredScreen(box: HTMLElement): void {
  const screen = box.firstElementChild as HTMLElement | null;
  if (screen === null) return;
  const heading = screen.querySelector<HTMLElement>('h1, h2');
  const target = heading ?? screen;
  if (target.tabIndex < 0) target.tabIndex = -1;
  target.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  if (screenNews === null) {
    screenNews = el('div', 'tb-sr-only');
    screenNews.setAttribute('aria-live', 'polite');
    document.body.append(screenNews);
  }
  const news = screenNews;
  news.textContent = '';
  setTimeout(() => { news.textContent = screen.getAttribute('aria-label') ?? ''; }, 50);
}

