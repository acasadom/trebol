// rate: a face that ticks. As in R2 and Red, `rate 2` is twice a second and `rate 0:00:30` once every half
// minute; each tick fires the face's on-time while its node is on the page. Changing the rate starts the
// ticks again, none stops them, and a face taken off the page stops: after each round of changes
// `sweepRates` lets go of every node that was on the page and is no longer, as sweepSizes does. A text with
// `ago` says again how long ago its date was at each tick, with no on-time.

import { K, I64, type Cell } from '../../core/index.ts';
import { get, flag } from './faces.ts';
import { type Mounted } from './mount.ts';
import { fireEvent } from './events.ts';
import { sync } from './sync.ts';
import { repeat } from '../timers.ts';

interface Ticking { ms: number; stop: () => void; m: Mounted; seen: boolean }

const ticking = new Map<Element, Ticking>();

/** The milliseconds between ticks of a rate: an integer is times a second, a time the time between; else none. */
export function rateMs(v: Cell): number | null {
  if (v.t === K.Integer) {
    const n = I64.toNumber(v.v);
    return n > 0 ? 1000 / n : null;
  }
  if (v.t === K.Time) return v.v > 0 ? v.v / 1e6 : null;
  return null;
}

/** Starts, changes or stops the ticks of a face from its rate. */
export function syncRate(m: Mounted): void {
  const ms = rateMs(get(m.face, 'rate'));
  const node = m.el;
  const now = ticking.get(node);
  if (now !== undefined && now.ms === ms) {
    now.m = m;
    return;
  }
  if (now !== undefined) stop(node);
  if (ms === null) return;
  const t: Ticking = { ms, m, seen: node.isConnected, stop: repeat(ms, () => {
    if (!node.isConnected) return;
    if (flag(t.m.face, 'ago')) sync(t.m);
    fireEvent(t.m.face, 'on-time');
  }) };
  ticking.set(node, t);
}

function stop(node: Element): void {
  const t = ticking.get(node);
  if (t === undefined) return;
  t.stop();
  ticking.delete(node);
}

/** Stops the faces that were on the page and have left it; `kept` says which are only set aside. */
export function sweepRates(kept: (node: Element) => boolean = () => false): void {
  for (const [node, t] of ticking) {
    if (node.isConnected) t.seen = true;
    else if (t.seen && !kept(node)) stop(node);
  }
}

/** How many faces tick, for tests. */
export function tickingFaces(): number {
  return ticking.size;
}
