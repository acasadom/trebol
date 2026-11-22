// One ResizeObserver for every face that redraws at its size (charts, drawings, orbits, devices,
// resizable grids). The browser does not tell an observer that a node left the page, so after each
// round of changes `sweepSizes` lets go of every node that was on the page and is no longer: a face
// taken off the page leaves nothing behind. A node watched before it is put on the page, or one kept
// aside to be shown later, is kept until it gets there.

interface Watch { fn: () => void; seen: boolean }

const watches = new Map<Element, Watch>();
let observer: ResizeObserver | null = null;

function heard(entries: ResizeObserverEntry[]): void {
  for (const e of entries) {
    const w = watches.get(e.target);
    if (w === undefined || !e.target.isConnected) continue;
    w.seen = true;
    w.fn();
  }
}

/** Calls fn each time the node changes size, while it is on the page. Without ResizeObserver, never. */
export function watchSize(node: Element, fn: () => void): void {
  if (typeof ResizeObserver === 'undefined') return;
  observer ??= new ResizeObserver(heard);
  watches.set(node, { fn, seen: node.isConnected });
  observer.observe(node);
}

/** Stops watching the node. */
export function unwatchSize(node: Element): void {
  if (!watches.delete(node)) return;
  observer?.unobserve(node);
}

/** Lets go of the nodes that were on the page and have left it; `kept` says which are only set aside. */
export function sweepSizes(kept: (node: Element) => boolean = () => false): void {
  for (const [node, w] of watches) {
    if (node.isConnected) w.seen = true;
    else if (w.seen && !kept(node)) unwatchSize(node);
  }
}

/** How many nodes are watched, for tests. */
export function watchedSizes(): number {
  return watches.size;
}
