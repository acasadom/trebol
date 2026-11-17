// --- numbers that count ------------------------------------------------------------

import { K, type Cell } from '../../core/index.ts';
import { amountOf, countStep } from '../index.ts';
import { mayMove } from '../motion.ts';
import { display } from './faces.ts';
import { type Mounted } from './mount.ts';

/** A text with `count`: the number it last showed, and the run on its way to a new one. */
export const counts = new WeakMap<Mounted, { was: Cell; now: number; frame: number }>();
export const COUNT_MS = 600;

/**
 * A text with `count` whose number changed runs from the old one to the new in the kind and digits of the new,
 * easing out, formatted for the active language at each frame; true while it runs, so sync leaves the text alone.
 * The first number it shows, a change of kind or currency, or a page that may not move, shows the new one at once.
 */
export function countRun(m: Mounted, to: Cell): boolean {
  const end = amountOf(to);
  const c = counts.get(m);
  if (end === null) {
    if (c !== undefined) cancelAnimationFrame(c.frame);
    counts.delete(m);
    return false;
  }
  if (c === undefined) {
    counts.set(m, { was: to, now: end, frame: 0 });
    return false;
  }
  const running = c.frame !== 0;
  const same = c.was.t === to.t && (to.t !== K.Money || (c.was as typeof to).cur === to.cur);
  if (same && amountOf(c.was) === end) return running;
  const from = running ? c.now : amountOf(c.was)!;
  cancelAnimationFrame(c.frame);
  c.was = to;
  c.frame = 0;
  c.now = end;
  if (!same || from === end || !mayMove()) return false;
  const start = performance.now();
  const step = (t: number): void => {
    const p = Math.min(1, (t - start) / COUNT_MS);
    c.now = from + (end - from) * (1 - (1 - p) ** 3);
    m.el.textContent = display(p === 1 ? to : countStep(to, c.now));
    c.frame = p === 1 ? 0 : requestAnimationFrame(step);
  };
  c.frame = requestAnimationFrame(step);
  return true;
}
