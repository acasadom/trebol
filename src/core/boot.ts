// Startup: builds lib (natives, operators, datatype words, mezzanines) and an
// empty user context that inherits from it.
//
// Hosts register their own natives (print, fetch...) before calling
// `makeRuntime`; every registered native ends up in lib.

import { K, KIND_NAMES, TYPESETS, type Kind } from './kinds.ts';
import { intern } from './symbols.ts';
import { NONE, TRUE, FALSE, datatype, typeset, context, type Cell, type BlockCell } from './values.ts';
import { ctxAdd, ctxFind, bindSeries } from './ctx.ts';
import { load } from './lexer.ts';
import { registeredNatives, newTask, run, type Runtime, type RunResult } from './eval.ts';
import { makeError, errorMessage } from './errors.ts';
import { OPS } from './natives/define.ts';
import './natives/control.ts';
import './natives/data.ts';
import './natives/math.ts';
import { MEZZANINES } from './mezz.ts';

export function makeRuntime(): Runtime {
  const lib = context();
  const set = (name: string, v: Cell) => {
    const sym = intern(name);
    const i = ctxFind(lib, sym);
    if (i >= 0) lib.vals[i] = v;
    else ctxAdd(lib, sym, v);
  };
  for (const [name, v] of [['none', NONE], ['true', TRUE], ['false', FALSE], ['on', TRUE],
    ['off', FALSE], ['yes', TRUE], ['no', FALSE]] as const) set(name, v);
  KIND_NAMES.forEach((name, k) => set(name, datatype(k as Kind)));
  for (const [name, bits] of Object.entries(TYPESETS)) set(name, typeset(bits));
  for (const def of registeredNatives()) set(def.name, { t: K.Native, p: def });
  for (const [name, fn] of OPS) {
    const i = ctxFind(lib, intern(fn));
    if (i < 0) throw new Error(`operator ${name} refers to unknown native ${fn}`);
    set(name, { t: K.Op, p: { fn: lib.vals[i]! } });
  }
  const rt: Runtime = { lib, user: context([], [], lib) };
  const code = load(MEZZANINES, { file: 'mezzanines' });
  bindSeries(code.s, lib, true);
  const r = runSync(rt, code);
  // Mezzanines failing to load is a bug in Trebol itself.
  if (r.k === 'error') throw new Error(`mezzanines failed: ${errorMessage(r.e)}`);
  return rt;
}

/** Runs a block to completion; an `await` becomes an error. */
export function runSync(rt: Runtime, code: BlockCell): RunResult {
  const r = run(newTask(rt, code.s, code.i));
  if (r.k === 'await' || r.k === 'yield') {
    return { k: 'error', e: makeError('script', 'no-await', 'cannot wait in synchronous evaluation') };
  }
  return r;
}

/** Loads source into the user context and runs it to completion. */
export function doSource(rt: Runtime, src: string, file?: string): RunResult {
  const code = load(src, file !== undefined ? { file } : {});
  bindSeries(code.s, rt.user, true);
  return runSync(rt, code);
}
