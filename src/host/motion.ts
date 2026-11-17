// How the page moves when it changes: a screen that gives way to another, rows
// that come, go or change places, a face shown or hidden. Nothing here is asked
// for by the app; the theme's --tb-move and --tb-ease say how long and how, and a
// user who asks the system for less motion gets none.

/** The theme's time for a change of place, in ms, read from the page once. */
let moveMs = -1;

function duration(): number {
  if (moveMs < 0) {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--tb-move').trim();
    moveMs = v.endsWith('ms') ? parseFloat(v) : v.endsWith('s') ? parseFloat(v) * 1000 : 220;
    if (!Number.isFinite(moveMs)) moveMs = 220;
  }
  return moveMs;
}

/** The theme changed: read its time again. */
export function themeMoved(): void {
  moveMs = -1;
}

const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

/** Whether the page may move now: the browser can, the user has not asked for less, the page is on show. */
export function mayMove(): boolean {
  if (typeof matchMedia !== 'function' || typeof Element.prototype.animate !== 'function') return false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return document.visibilityState !== 'hidden' && duration() > 0;
}

// --- screens ---------------------------------------------------------------------

/** Which way the user went to the screen coming: on, or back to one seen before. */
let travel: 'on' | 'back' = 'on';

export function travelled(way: 'on' | 'back'): void {
  travel = way;
}

let swapping = false;

/**
 * Puts the screen coming in place of the one on show: the browser takes a picture of
 * the page, swap changes it, and the old screen slides out as the new one slides in,
 * the way the user went. Faces given the same `morph` in both become one another.
 * swap is called once, now or at the browser's next frame; it may decide not to.
 */
export function changeScreen(box: HTMLElement, coming: HTMLElement, swap: () => void): void {
  const doc = document as Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };
  // the first screen, or a page that cannot or may not move
  const way = travel;
  travel = 'on';
  if (swapping) return;
  if (box.childElementCount === 0 || typeof doc.startViewTransition !== 'function' || !mayMove()) return swap();
  swapping = true;
  const root = document.documentElement;
  root.dataset['tbTravel'] = way;
  box.style.setProperty('view-transition-name', 'tb-screen');
  // only the names in both screens: a face with no partner goes with its screen
  const both = morphsIn(coming);
  const was = nameMorphs(both);
  const t = doc.startViewTransition(() => {
    swapping = false;
    clearMorphs();
    swap();
    nameMorphs(was);
  });
  void t.finished.catch(() => {}).then(() => {
    box.style.removeProperty('view-transition-name');
    delete root.dataset['tbTravel'];
    clearMorphs();
  });
}

/** The faces given a morph name for the change of screen going on. */
let named: HTMLElement[] = [];

/**
 * Gives the browser the morph name of each face on show that has one among those
 * given, so a face of the old screen and one of the new with the same name become
 * one another; when two on show share a name, the first keeps it. Gives the names given.
 */
function nameMorphs(among: Set<string>): Set<string> {
  const seen = new Set<string>();
  for (const e of Array.from(document.querySelectorAll<HTMLElement>('[data-tb-morph]'))) {
    const name = morphIdent(e.dataset['tbMorph']!);
    if (!among.has(name) || seen.has(name) || e.getClientRects().length === 0) continue;
    seen.add(name);
    e.style.setProperty('view-transition-name', name);
    named.push(e);
  }
  return seen;
}

/** The morph names of a screen not yet on the page. */
function morphsIn(screen: HTMLElement): Set<string> {
  return new Set(Array.from(screen.querySelectorAll<HTMLElement>('[data-tb-morph]'), e => morphIdent(e.dataset['tbMorph']!)));
}

function clearMorphs(): void {
  for (const e of named) e.style.removeProperty('view-transition-name');
  named = [];
}

/** A name as the browser takes it: letters, digits, - and _, anything else spelled by its code. */
export function morphIdent(name: string): string {
  let out = 'tb-m-';
  for (const ch of name) out += /[A-Za-z0-9_-]/.test(ch) ? ch : `_${ch.codePointAt(0)!.toString(16)}_`;
  return out;
}

// --- rows --------------------------------------------------------------------------

/** Where each row stood before the rows changed. */
export function rowPlaces(rows: Iterable<HTMLElement>): Map<HTMLElement, DOMRect> {
  const at = new Map<HTMLElement, DOMRect>();
  for (const r of rows) at.set(r, r.getBoundingClientRect());
  return at;
}

/**
 * After the rows changed: those that stayed glide from where they were to where
 * they are, the new ones fade in.
 */
export function moveRows(rows: Iterable<HTMLElement>, was: Map<HTMLElement, DOMRect>): void {
  const ms = duration();
  for (const r of rows) {
    const from = was.get(r);
    if (from === undefined) {
      r.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: EASE });
      continue;
    }
    const to = r.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    r.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: ms, easing: EASE });
  }
}

/**
 * A row that went fades where it stood, out of the flow so the others close the gap:
 * its cells keep their widths, as it no longer lies in its table.
 */
export function leaveRow(r: HTMLElement, at: DOMRect): void {
  const widths = Array.from(r.children, c => c.getBoundingClientRect().width);
  Array.from(r.children as HTMLCollectionOf<HTMLElement>).forEach((c, i) => {
    c.style.width = `${widths[i]}px`;
    c.style.boxSizing = 'border-box';
  });
  r.classList.add('tb-leaving');
  r.setAttribute('aria-hidden', 'true');
  r.removeAttribute('tabindex');
  Object.assign(r.style, { position: 'fixed', top: `${at.top}px`, left: `${at.left}px`, width: `${at.width}px`, height: `${at.height}px`, margin: '0' });
  const a = r.animate([{ opacity: 1 }, { opacity: 0 }], { duration: duration() * 0.7, easing: EASE });
  a.onfinish = () => r.remove();
  a.oncancel = () => r.remove();
}

// --- shown and hidden --------------------------------------------------------------

/** The faces folding away now, so a face shown again stops folding. */
const folding = new WeakMap<HTMLElement, Animation>();

/** Whether a face is folding away now. */
export function isFolding(e: HTMLElement): boolean {
  return folding.has(e);
}

/** A face shown again unfolds: from no height, if it lies among others one above another, and from clear. */
export function unfold(e: HTMLElement): void {
  folding.get(e)?.cancel();
  const h = e.getBoundingClientRect().height;
  const stacked = stackedIn(e);
  const frames: Keyframe[] = stacked && h > 0
    ? [{ height: '0px', opacity: 0, overflow: 'hidden' }, { height: `${h}px`, opacity: 1, overflow: 'hidden' }]
    : [{ opacity: 0 }, { opacity: 1 }];
  e.animate(frames, { duration: duration(), easing: EASE });
}

/** A face hidden folds away, and then done hides it. */
export function fold(e: HTMLElement, done: () => void): void {
  const h = e.getBoundingClientRect().height;
  const stacked = stackedIn(e);
  const frames: Keyframe[] = stacked && h > 0
    ? [{ height: `${h}px`, opacity: 1, overflow: 'hidden' }, { height: '0px', opacity: 0, overflow: 'hidden', marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' }]
    : [{ opacity: 1 }, { opacity: 0 }];
  const a = e.animate(frames, { duration: duration() * 0.8, easing: EASE });
  folding.set(e, a);
  a.onfinish = () => {
    folding.delete(e);
    done();
  };
  a.oncancel = () => folding.delete(e);
}

/** Whether a face lies among others one above another, so its height can open. */
function stackedIn(e: HTMLElement): boolean {
  const p = e.parentElement;
  if (p === null) return false;
  const s = getComputedStyle(p);
  return !s.display.includes('flex') || s.flexDirection.startsWith('column');
}
