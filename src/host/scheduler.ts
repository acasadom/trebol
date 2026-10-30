// The task scheduler: runs Trebol tasks cooperatively on the JS event loop.
//
// Each task runs for a slice of steps, then the scheduler gives control back
// to the host (browser rendering, network callbacks) before continuing. A
// task that returns `await` is parked until its promise settles. Event
// handlers, `spawn` and timers all create new tasks here.
//
// Host resources (tasks, sockets, timers) are exposed to Trebol as handle!
// cells holding only a kind and a numeric id; the objects live in a table
// here, so no JS object is stored inside a Trebol value.

import {
  K, UNSET, intern, newTask, run, resume, resumeError, makeError, bindSeries, copyDeep, context,
  type Cell, type BlockCell, type ObjectCell, type Runtime, type Task, type Series,
} from '../core/index.ts';

/** Steps a task runs before the scheduler yields to the host. */
export const SLICE = 10_000;

export interface HostTask {
  readonly id: number;
  readonly task: Task;
  state: 'ready' | 'waiting' | 'done' | 'failed' | 'cancelled';
  result: Cell;
  error: ObjectCell | null;
  /** Aborts the operation the task is waiting on, if any. */
  abort: (() => void) | null;
  /** Called when the task finishes, fails or is cancelled. */
  readonly watchers: Array<(t: HostTask) => void>;
}

export interface Scheduler {
  readonly rt: Runtime;
  readonly ready: HostTask[];
  readonly byTask: WeakMap<Task, HostTask>;
  /** Reports errors of tasks nobody waits for. */
  onError: (e: ObjectCell, t: HostTask) => void;
  pumping: boolean;
  live: number;
}

let nextId = 1;
const resources = new Map<number, unknown>();

/** Stores a host object and returns a handle! cell for it. */
export function makeHandle(kind: string, obj: unknown): Cell {
  const id = nextId++;
  resources.set(id, obj);
  return { t: K.Handle, p: { kind, id } };
}

export function handleOf<T>(c: Cell, kind: string): T | null {
  if (c.t !== K.Handle) return null;
  const h = c.p as { kind: string; id: number };
  return h.kind === kind ? (resources.get(h.id) as T | undefined) ?? null : null;
}

export function dropHandle(c: Cell): void {
  if (c.t === K.Handle) resources.delete((c.p as { id: number }).id);
}

const schedulers = new WeakMap<Runtime, Scheduler>();

export function makeScheduler(rt: Runtime, onError: Scheduler['onError']): Scheduler {
  const sch: Scheduler = { rt, ready: [], byTask: new WeakMap(), onError, pumping: false, live: 0 };
  schedulers.set(rt, sch);
  return sch;
}

/** The scheduler running a task's runtime. */
export function schedulerOf(t: Task): Scheduler {
  const sch = schedulers.get(t.rt);
  // Host natives only run inside a scheduler; anything else is a host bug.
  if (sch === undefined) throw new Error('no scheduler for this runtime');
  return sch;
}

/** Starts a task for `code` (a block bound to the user context or deeper). */
export function spawn(sch: Scheduler, s: Series<Cell>, i = 0): HostTask {
  const task = newTask(sch.rt, s, i);
  const ht: HostTask = { id: nextId++, task, state: 'ready', result: UNSET, error: null, abort: null, watchers: [] };
  sch.byTask.set(task, ht);
  sch.live++;
  sch.ready.push(ht);
  schedule(sch);
  return ht;
}

/**
 * Runs a handler block as a new task with some words bound to values, e.g.
 * `value` for a message. The block is copied, so handlers never share state.
 */
export function spawnHandler(sch: Scheduler, body: BlockCell, words: Record<string, Cell>): HostTask {
  const names = Object.keys(words);
  const s = copyDeep(body.s, body.i);
  if (names.length > 0) {
    const ctx = context(names.map(n => intern(n)), names.map(n => words[n]!));
    bindSeries(s, ctx);
  }
  return spawn(sch, s, 0);
}

/**
 * Runs `fn` after the host had a chance to do its own work (render, I/O).
 * setImmediate where it exists (Node); a MessageChannel in browsers, which
 * unlike setTimeout(0) is not clamped to 4 ms.
 */
const defer: (fn: () => void) => void = (() => {
  const g = globalThis as { setImmediate?: (fn: () => void) => unknown };
  if (typeof g.setImmediate === 'function') return (fn: () => void) => void g.setImmediate!(fn);
  if (typeof MessageChannel === 'undefined') return (fn: () => void) => void setTimeout(fn, 0);
  const ch = new MessageChannel();
  const queue: Array<() => void> = [];
  (ch.port1 as unknown as { onmessage: () => void }).onmessage = () => queue.shift()?.();
  return (fn: () => void) => {
    queue.push(fn);
    ch.port2.postMessage(null);
  };
})();

function schedule(sch: Scheduler): void {
  if (sch.pumping) return;
  sch.pumping = true;
  defer(() => pump(sch));
}

function finish(sch: Scheduler, ht: HostTask, state: HostTask['state']): void {
  ht.state = state;
  ht.abort = null;
  sch.live--;
  if (state === 'failed' && ht.watchers.length === 0) sch.onError(ht.error!, ht);
  for (const w of ht.watchers.splice(0)) w(ht);
}

/** Runs ready tasks, one slice each, until none is ready; then yields. */
function pump(sch: Scheduler): void {
  sch.pumping = false;
  const batch = sch.ready.splice(0);
  for (const ht of batch) {
    if (ht.state !== 'ready') continue;
    const r = run(ht.task, SLICE);
    switch (r.k) {
      case 'done':
        ht.result = r.v;
        finish(sch, ht, 'done');
        break;
      case 'error':
        ht.error = r.e;
        finish(sch, ht, 'failed');
        break;
      case 'yield':
        sch.ready.push(ht);
        break;
      case 'await':
        ht.state = 'waiting';
        r.p.then(
          v => {
            if (ht.state !== 'waiting') return;
            ht.abort = null;
            resume(ht.task, v);
            ht.state = 'ready';
            sch.ready.push(ht);
            schedule(sch);
          },
          (e: unknown) => {
            if (ht.state !== 'waiting') return;
            ht.abort = null;
            resumeError(ht.task, asError(e));
            ht.state = 'ready';
            sch.ready.push(ht);
            schedule(sch);
          },
        );
        break;
    }
  }
  if (sch.ready.length > 0) schedule(sch);
}

/** A rejected promise's reason as a Trebol error!. */
export function asError(e: unknown): ObjectCell {
  if (typeof e === 'object' && e !== null && (e as Cell).t === K.Error) return e as ObjectCell;
  const msg = e instanceof Error ? e.message : String(e);
  return makeError('access', 'host', msg);
}

/** Cancels a task: aborts what it waits on; watchers see a `cancelled` error. */
export function cancelTask(sch: Scheduler, ht: HostTask): void {
  if (ht.state === 'done' || ht.state === 'failed' || ht.state === 'cancelled') return;
  ht.abort?.();
  ht.error = makeError('access', 'cancelled', 'the task was cancelled');
  finish(sch, ht, 'cancelled');
}

/** A promise for the task's result; rejects with its error. */
export function taskResult(ht: HostTask): Promise<Cell> {
  return new Promise((resolve, reject) => {
    const settle = (t: HostTask) => (t.state === 'done' ? resolve(t.result) : reject(t.error ?? makeError('access', 'cancelled', 'the task was cancelled')));
    if (ht.state === 'done' || ht.state === 'failed' || ht.state === 'cancelled') settle(ht);
    else ht.watchers.push(settle);
  });
}
