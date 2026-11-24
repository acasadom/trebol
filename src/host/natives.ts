// Host natives that are not about the network: console, time, tasks and
// timers. They work wherever there is a JS event loop (browser or Node).

import { devLog } from './devlog.ts';
import { after, repeat } from './timers.ts';
import {
  K, NONE, UNSET, I64, native, value, form, mold, date, word, pick, throwError, getWord, text,
  type Cell, type BlockCell, type StringCell, type ObjectCell, type Step,
} from '../core/index.ts';
import {
  schedulerOf, spawn, spawnHandler, cancelTask, taskResult, makeHandle, handleOf, dropHandle,
  type HostTask,
} from './scheduler.ts';

/**
 * Where `print` writes, and where warnings go (a state of a machine no way leads to); the browser
 * host points `line` at the page console, and the dev tools list the warnings.
 */
export const output = {
  line: (text: string) => console.log(text),
  warn: (text: string) => {
    console.warn(`Trebol: ${text}`);
    devLog.note('warning', text);
  },
};

native('host-warn', '["Says a warning where the host shows them: the console, the dev tools." text [string!]]', (_t, f) => {
  output.warn(text(f.args[0] as StringCell));
  return value(UNSET);
});

// Which task runs the code, so that what a reaction asks for is told apart from
// what another task asks for while the reaction waits.
native('host-task', '["The number of the task that runs this code."]', t => {
  const ht = schedulerOf(t).byTask.get(t);
  return value({ t: K.Integer, v: I64.fromNumber(ht === undefined ? 0 : ht.id)! });
});

// A number for an object, the same for the same object (same?), so that the reactions can keep an
// index by the faces and objects they read: objects compare by content, so a map cannot.
const objectIds = new WeakMap<object, number>();
let lastObjectId = 0;
native('ui-same-id', '["A number for an object, the same each time for the same object (same?)." value [object!]]', (_t, f) => {
  const ctx = (f.args[0] as ObjectCell).ctx;
  let id = objectIds.get(ctx);
  if (id === undefined) objectIds.set(ctx, id = ++lastObjectId);
  return value({ t: K.Integer, v: I64.fromNumber(id)! });
});

native('write-line','["Writes a value and a new line to the output." value [any-type!]]', (_t, f) => {
  output.line(form(f.args[0]!));
  return value(UNSET);
});

native('probe', '["Prints a value as mold shows it; gives the value." value [any-type!]]', (_t, f) => {
  output.line(mold(f.args[0]!));
  return value(f.args[0]!);
});

/** Milliseconds for a number of seconds or a time!. */
function millis(c: Cell): number {
  if (c.t === K.Time) return c.v / 1e6;
  if (c.t === K.Integer) return I64.toNumber(c.v) * 1000;
  return (c as { v: number }).v * 1000;
}

// As in R3: whole seconds unless /precise, and one part of the date with the
// other refinements (now/date, now/weekday, now/time...).
const NOW_PARTS = ['year', 'month', 'day', 'time', 'zone', 'date', 'weekday', 'yearday'] as const;

native('now', '["The date and time now." /year /month /day /time /zone /date /weekday /yearday /precise /utc]', (_t, f) => {
  const d = new Date();
  const on = (i: number) => f.args[i]!.t === K.Logic;
  const zone = on(9) ? 0 : -d.getTimezoneOffset();
  const local = new Date(d.getTime() + zone * 60000);
  const ns = ((local.getUTCHours() * 60 + local.getUTCMinutes()) * 60 + local.getUTCSeconds()) * 1e9 +
    (on(8) ? local.getUTCMilliseconds() * 1e6 : 0);
  const v = date({ y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate(), time: ns, zone });
  const part = NOW_PARTS.find((_p, i) => on(i));
  return value(part === undefined ? v : pick(v, word(part)) as Cell);
});

// --- tasks and timers ----------------------------------------------------------------

interface Timer { stop: () => void }

native('wait', '["Waits a number of seconds, or for tasks to finish; other tasks run meanwhile." value [number! time! handle! block!]]', (t, f, v) => {
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  const x = f.args[0]!;
  const sch = schedulerOf(t);
  const me = sch.byTask.get(t);
  if (x.t === K.Handle || x.t === K.Block) {
    // words in a block are looked up, as R3 does: wait [a b]
    const handles = x.t === K.Block ? x.s.data.slice(x.i).map(c => (c.t === K.Word ? getWord(c) ?? c : c)) : [x];
    const tasks = handles.map(h => handleOf<HostTask>(h, 'task'));
    if (tasks.some(ht => ht === null)) return throwError('script', 'bad-wait', 'wait needs tasks or a duration');
    const all = Promise.all(tasks.map(ht => taskResult(ht!)));
    return { k: 'await', p: x.t === K.Block ? all.then(vs => ({ t: K.Block, s: { data: vs }, i: 0 }) as Cell) : all.then(vs => vs[0]!) };
  }
  const ms = millis(x);
  return {
    k: 'await',
    p: new Promise<Cell>(resolve => {
      const stop = after(ms, () => resolve(NONE));
      if (me) me.abort = stop;
    }),
  };
});

native('spawn', '["Starts a task that evaluates a block on its own; gives a handle at once." body [block!]]', (t, f) => {
  const b = f.args[0] as BlockCell;
  const ht = spawn(schedulerOf(t), b.s, b.i);
  return value(makeHandle('task', ht));
});

native('delay', '["Evaluates a block once, after a while; gives a handle." time [number! time!] body [block!]]', (t, f) => {
  const sch = schedulerOf(t);
  const body = f.args[1] as BlockCell;
  const stop = after(millis(f.args[0]!), () => spawnHandler(sch, body, {}));
  return value(makeHandle('timer', { stop } satisfies Timer));
});

native('every', '["Evaluates a block again and again, every so often; gives a handle." time [number! time!] body [block!]]', (t, f) => {
  const sch = schedulerOf(t);
  const body = f.args[1] as BlockCell;
  const stop = repeat(millis(f.args[0]!), () => spawnHandler(sch, body, {}));
  return value(makeHandle('timer', { stop } satisfies Timer));
});

/** Anything cancellable registers here by handle kind. */
export const cancellers: Record<string, (obj: unknown) => void> = {
  timer: obj => (obj as Timer).stop(),
};

native('cancel', '["Stops a task, timer or request." target [handle!]]', (t, f): Step => {
  const h = f.args[0]!;
  const kind = ((h as { p: unknown }).p as { kind: string }).kind;
  if (kind === 'task') {
    const ht = handleOf<HostTask>(h, 'task');
    if (ht !== null) cancelTask(schedulerOf(t), ht);
    return value(UNSET);
  }
  const obj = handleOf<unknown>(h, kind);
  if (obj !== null) cancellers[kind]?.(obj);
  dropHandle(h);
  return value(UNSET);
});
