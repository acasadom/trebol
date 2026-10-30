// Host natives that are not about the network: console, time, tasks and
// timers. They work wherever there is a JS event loop (browser or Node).

import {
  K, NONE, UNSET, I64, native, value, form, mold, date, throwError, getWord,
  type Cell, type BlockCell, type Step,
} from '../core/index.ts';
import {
  schedulerOf, spawn, spawnHandler, cancelTask, taskResult, makeHandle, handleOf, dropHandle,
  type HostTask,
} from './scheduler.ts';

/** Where `print` writes; the browser host points this at the page console. */
export const output = { line: (text: string) => console.log(text) };

native('write-line', '[value [any-type!]]', (_t, f) => {
  output.line(form(f.args[0]!));
  return value(UNSET);
});

native('probe', '[value [any-type!]]', (_t, f) => {
  output.line(mold(f.args[0]!));
  return value(f.args[0]!);
});

/** Milliseconds for a number of seconds or a time!. */
function millis(c: Cell): number {
  if (c.t === K.Time) return c.v / 1e6;
  if (c.t === K.Integer) return I64.toNumber(c.v) * 1000;
  return (c as { v: number }).v * 1000;
}

native('now', '[/utc]', (_t, f) => {
  const d = new Date();
  const utc = f.args[0]!.t === K.Logic;
  const zone = utc ? 0 : -d.getTimezoneOffset();
  const local = new Date(d.getTime() + zone * 60000);
  const ns = ((local.getUTCHours() * 60 + local.getUTCMinutes()) * 60 + local.getUTCSeconds()) * 1e9 + local.getUTCMilliseconds() * 1e6;
  return value(date({ y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate(), time: ns, zone }));
});

// --- tasks and timers ----------------------------------------------------------------

interface Timer { stop: () => void }

native('wait', '[value [number! time! handle! block!]]', (t, f, v) => {
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
      const id = setTimeout(() => resolve(NONE), ms);
      if (me) me.abort = () => clearTimeout(id);
    }),
  };
});

native('spawn', '[body [block!]]', (t, f) => {
  const b = f.args[0] as BlockCell;
  const ht = spawn(schedulerOf(t), b.s, b.i);
  return value(makeHandle('task', ht));
});

native('delay', '[time [number! time!] body [block!]]', (t, f) => {
  const sch = schedulerOf(t);
  const body = f.args[1] as BlockCell;
  const id = setTimeout(() => spawnHandler(sch, body, {}), millis(f.args[0]!));
  return value(makeHandle('timer', { stop: () => clearTimeout(id) } satisfies Timer));
});

native('every', '[time [number! time!] body [block!]]', (t, f) => {
  const sch = schedulerOf(t);
  const body = f.args[1] as BlockCell;
  const id = setInterval(() => spawnHandler(sch, body, {}), Math.max(1, millis(f.args[0]!)));
  return value(makeHandle('timer', { stop: () => clearInterval(id) } satisfies Timer));
});

/** Anything cancellable registers here by handle kind. */
export const cancellers: Record<string, (obj: unknown) => void> = {
  timer: obj => (obj as Timer).stop(),
};

native('cancel', '[target [handle!]]', (t, f): Step => {
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
