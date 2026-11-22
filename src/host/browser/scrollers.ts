// Keyboard users scroll a box by focusing it. A box that scrolls and holds nothing focusable (a long line
// of code, a wide table of plain cells) cannot be reached from the keyboard, so while it scrolls it takes
// tabindex 0; once it fits again, or gets something focusable inside, it gives it back. Only boxes whose
// tabindex was set here are touched. Checked once a frame after a round of changes and on resize.

/** The host's boxes that scroll their content. */
const SCROLLERS = '.tb-code, .tb-table-wrap, .tb-list-wrap, .tb-board, .tb-fit > *, .tb-dialog-body, .tb-device-screen';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), '
  + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"]), '
  + 'summary, audio[controls], video[controls], iframe';

const MARK = 'data-tb-scroller';

let pending = false;
let listening = false;

function scrolls(n: HTMLElement): boolean {
  const cs = getComputedStyle(n);
  return (/auto|scroll/.test(cs.overflowX) && n.scrollWidth > n.clientWidth)
    || (/auto|scroll/.test(cs.overflowY) && n.scrollHeight > n.clientHeight);
}

/** Gives tabindex 0 to the boxes that scroll with nothing focusable inside, and takes it back from the rest. */
export function markScrollers(root: ParentNode = document): void {
  for (const n of root.querySelectorAll<HTMLElement>(SCROLLERS)) {
    const ours = n.hasAttribute(MARK);
    if (!ours && n.hasAttribute('tabindex')) continue;   // the face set its own
    const needs = scrolls(n) && n.querySelector(FOCUSABLE) === null;
    if (needs && !ours) {
      n.setAttribute(MARK, '');
      n.tabIndex = 0;
    } else if (!needs && ours) {
      n.removeAttribute(MARK);
      n.removeAttribute('tabindex');
    }
  }
}

/** Checks the boxes in the next frame, once however many rounds ask before it. */
export function laterMarkScrollers(): void {
  if (typeof requestAnimationFrame === 'undefined' || typeof document === 'undefined') return;
  if (!listening) {
    listening = true;
    addEventListener('resize', laterMarkScrollers);
  }
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    markScrollers();
  });
}
