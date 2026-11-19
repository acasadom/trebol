// An inert face with on-select: what it shows cannot be used, but a click on it chooses the face under the
// pointer, as a designer chooses a face on its canvas. Its selected face is marked.
import { K, type ObjectCell } from '../../core/index.ts';
import { get } from './faces.ts';
import { type Mounted, byNode, byCtx, fire } from './mount.ts';
import { handlerFor } from './events.ts';

/** Inert faces with on-select now on the page. */
const picking = new Set<Mounted>();
/** The element each one marks as its selected face. */
const marked = new WeakMap<Mounted, HTMLElement>();

/** Keeps a face in the picking set while it is inert and has on-select, and marks its selected face. */
export function syncPick(m: Mounted, inert: boolean, retry = false): void {
  const on = inert && handlerFor(m.face, 'on-select');
  if (on) picking.add(m);
  else picking.delete(m);
  const s = get(m.face, 'selected');
  const now = on && s.t === K.Object ? byCtx.get((s as ObjectCell).ctx)?.el ?? null : null;
  // a face chosen in a new pane is mounted after its container: mark it once it is
  if (on && s.t === K.Object && now === null && !retry) {
    requestAnimationFrame(() => syncPick(m, m.el.inert, true));
    return;
  }
  const was = marked.get(m);
  if (was === now) return;
  was?.classList.remove('tb-picked');
  if (now) {
    now.classList.add('tb-picked');
    marked.set(m, now);
  } else marked.delete(m);
}

const inside = (r: DOMRect, x: number, y: number): boolean => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

/** A click: an inert element lets it through to the page, so the point says which picking face it was on. */
export function onPick(ev: MouseEvent): void {
  for (const m of picking) {
    if (!m.el.isConnected) { picking.delete(m); continue; }
    if (!inside(m.el.getBoundingClientRect(), ev.clientX, ev.clientY)) continue;
    // the innermost face under the pointer: the last in document order whose box holds it
    let chosen: Mounted | null = null;
    for (const e of m.el.querySelectorAll('*')) {
      const f = byNode.get(e);
      if (f && f !== m && f.el === e && inside(e.getBoundingClientRect(), ev.clientX, ev.clientY)) chosen = f;
    }
    if (chosen) void fire('ui-select', m.face, chosen.face);
    return;
  }
}
