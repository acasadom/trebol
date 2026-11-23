// Waits of any length. A browser or Node holds a wait of at most 2^31 - 1 milliseconds (about 24.8 days) and
// runs a longer one at once, so `every` or a `rate` of a month would fire every millisecond. A wait longer
// than that is a chain of shorter ones that ends at the right time.

/** The longest wait setTimeout and setInterval hold. */
export const LONGEST_WAIT = 2 ** 31 - 1;

/** Runs `fn` once, after `ms` milliseconds; gives what stops it. */
export function after(ms: number, fn: () => void): () => void {
  let id: ReturnType<typeof setTimeout>;
  const wait = (left: number): void => {
    id = left > LONGEST_WAIT
      ? setTimeout(() => wait(left - LONGEST_WAIT), LONGEST_WAIT)
      : setTimeout(fn, Math.max(0, left));
  };
  wait(ms);
  return () => clearTimeout(id);
}

/** Runs `fn` again and again, every `ms` milliseconds (at least one); gives what stops it. */
export function repeat(ms: number, fn: () => void): () => void {
  if (!(ms > LONGEST_WAIT)) {
    const id = setInterval(fn, Math.max(1, ms));
    return () => clearInterval(id);
  }
  let stopped = false;
  let stopWait = (): void => {};
  const next = (): void => {
    stopWait = after(ms, () => {
      if (stopped) return;
      fn();
      // fn may have stopped it: then no wait is left behind
      if (!stopped) next();
    });
  };
  next();
  return () => {
    stopped = true;
    stopWait();
  };
}
