// The host: registers console, time, task and network natives, builds a
// runtime and a scheduler, and runs programs as tasks.

import './natives.ts';
import './net.ts';
import './locale.ts';
import { setLoader, defaultLoader, type Loader } from './modules.ts';
import {
  K, makeRuntime, load, bindSeries, doSource, scriptStart, errorField, errorMessage, form, mold,
  type Cell, type ObjectCell, type Runtime,
} from '../core/index.ts';
import { makeScheduler, spawn, taskResult, type Scheduler } from './scheduler.ts';

export { output } from './natives.ts';
export { mapAt, formatLocal, activeLanguage, shown, translate, uiText, editLocal, readLocal, readDate, weekStart, LOCAL_KINDS } from './locale.ts';
export type { Loader } from './modules.ts';
export * from './scheduler.ts';

/** Host mezzanines: the Trebol side of the host natives. */
const HOST_MEZZANINES = String.raw`
print: func ["Prints a value; a block is reduced first." value [any-type!]] [
    write-line either block? :value [reduce value] [:value]
]

fetch: func [
    "Requests a URL. JSON answers come back as maps and blocks."
    url [url! string!]
    /with "method, headers, body, form, multipart, timeout, full"
        options [block! object!]
][
    http-request url either with [either block? options [make object! options] [options]] [none]
]
`;

export interface Host {
  readonly rt: Runtime;
  readonly sch: Scheduler;
}

/** Rebol-style multi-line report of an error. */
export function report(e: ObjectCell): string {
  const lines = [`** ${errorMessage(e)}`];
  const where = errorField(e, 'where');
  const near = errorField(e, 'near');
  const at = errorField(e, 'at');
  if (where.t !== K.None) lines.push(`** Where: ${form(where)}`);
  if (near.t !== K.None) lines.push(`** Near: ${mold(near)}`);
  if (at.t !== K.None) lines.push(`** At: ${form(at)}`);
  return lines.join('\n');
}

export interface HostOptions {
  /** Reports errors of tasks nobody waits for. */
  onError?: (e: ObjectCell) => void;
  /** How `import` finds files; defaults to fetch relative to the page. */
  loader?: Loader;
}

export function startHost(opts: HostOptions = {}): Host {
  const onError = opts.onError ?? (e => console.error(report(e)));
  const rt = makeRuntime();
  setLoader(rt, opts.loader ?? defaultLoader());
  const r = doSource(rt, HOST_MEZZANINES, 'host');
  // Host mezzanines failing to load is a bug in Trebol itself.
  if (r.k === 'error') throw new Error(`host mezzanines failed: ${errorMessage(r.e)}`);
  const sch = makeScheduler(rt, e => onError(e));
  return { rt, sch };
}

/** URL of the UI dialect source, next to this file. */
export const UI_SOURCE = new URL('../ui/ui.trb', import.meta.url).href;
/** URL of the languages module (i18n, tr, translated). */
export const I18N_SOURCE = new URL('../ui/i18n.trb', import.meta.url).href;

/** Loads languages and the UI dialect (view, layout, stylize, theme...) into the user context. */
export function startUi(host: Host): Promise<Cell> {
  return runSource(host, `import ${I18N_SOURCE}  import ${UI_SOURCE}`);
}

/**
 * Loads source into the user context and runs it as a task. Resolves with
 * its value; rejects with the error! if it fails. Load errors throw LoadError.
 */
export function runSource(host: Host, src: string, file?: string): Promise<Cell> {
  const code = load(src, file !== undefined ? { file } : {});
  bindSeries(code.s, host.rt.user, true);
  return taskResult(spawn(host.sch, code.s, scriptStart(code).start));
}
