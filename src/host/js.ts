// JavaScript modules as Trebol modules.
//
// `import %pdf-tools.js` loads a JavaScript module and gives an object with a
// function for each function it exports, named in Trebol's way (countPages is
// count-pages), and the other exports as values:
//
//   pdf: import %pdf-tools.js
//   pages: pdf/count-pages %contract.pdf
//
// Arguments and results cross as JSON, so text, numbers, blocks, maps, logic
// and none keep their shape; a promise is awaited while other tasks run, and
// a JavaScript exception is a Trebol error. A function's spec comes from its
// parameters, or from a `spec` property written as Trebol source:
//
//   export function countPages(file) { ... }
//   countPages.spec = '["The pages of a PDF." file [file! url!]]';
//
// No Trebol value holds the JavaScript function: each is a native built on one
// hidden native, carrying the function's index in a table here as its data.

import {
  K, NONE, registerNative, load, parseSpec, parseJson, toJson, context, ctxAdd, intern, makeError, value, throwError,
  type Cell, type BlockCell, type ObjectCell, type NativeDef, type Step,
} from '../core/index.ts';

type JsFunction = (...args: unknown[]) => unknown;

const functions: JsFunction[] = [];

const call = registerNative({
  name: 'js-function', hidden: true, spec: parseSpec(load('[]').s.data[0] as BlockCell) as NativeDef['spec'],
  specBlock: load('[]').s.data[0] as BlockCell,
}, (_t, f, v): Step => {
  if (f.phase === 1) return value(v!);
  const fn = functions[f.def.data!]!;
  const name = f.def.name;
  let result: unknown;
  try {
    result = fn(...f.args.map(a => JSON.parse(toJson(a)) as unknown));
  } catch (e) {
    return throwError('script', 'js-error', `${name}: ${(e as Error)?.message ?? String(e)}`);
  }
  if (!(result instanceof Promise)) return toTrebol(result, name);
  f.phase = 1;
  return {
    k: 'await',
    p: result.then(r => {
      const step = toTrebol(r, name);
      if (step.k === 'value') return step.v;
      throw (step as Extract<Step, { k: 'throw' }>).e.v;
    }, (e: unknown) => {
      throw makeError('script', 'js-error', `${name}: ${(e as Error)?.message ?? String(e)}`);
    }),
  };
}).p as NativeDef;

function toTrebol(r: unknown, name: string): Step {
  if (r === undefined) return value(NONE);
  let json: string | undefined;
  try {
    json = JSON.stringify(r);
  } catch {
    json = undefined;
  }
  if (json === undefined) return throwError('script', 'js-error', `${name} gave a value that is not JSON`);
  const v = parseJson(json);
  return typeof v === 'string' ? throwError('script', 'js-error', `${name}: ${v}`) : value(v);
}

/** countPages is count-pages, as Trebol names words. */
export function trebolName(js: string): string {
  return js.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();
}

/** The parameter names of a plain function or an arrow, or none when they cannot be read. */
function params(fn: JsFunction): string[] | null {
  const src = fn.toString();
  const m = /^\s*(?:async\s+)?([\w$]+)\s*=>/.exec(src) ?? /^[^(=]*\(([^)]*)\)/.exec(src);
  if (m === null) return null;
  const names = m[1]!.split(',').map(p => p.trim()).filter(p => p !== '');
  return names.every(p => /^[A-Za-z_$][\w$]*$/.test(p)) ? names.map(trebolName) : null;
}

function specOf(fn: JsFunction, name: string): { spec: NativeDef['spec']; specBlock: BlockCell } | string {
  const own = (fn as { spec?: unknown }).spec;
  const src = typeof own === 'string' ? own
    : `[${(params(fn) ?? Array.from({ length: fn.length }, (_, i) => `arg${i + 1}`)).join(' ')}]`;
  let specBlock: BlockCell;
  try {
    specBlock = load(src).s.data[0] as BlockCell;
  } catch (e) {
    return `${name}: bad spec: ${(e as Error).message}`;
  }
  if (specBlock?.t !== K.Block) return `${name}: its spec is not a block`;
  const spec = parseSpec(specBlock);
  return typeof spec === 'string' ? `${name}: ${spec}` : { spec, specBlock };
}

/** The object for a loaded JavaScript module, or an error message. */
export function jsModule(ns: Record<string, unknown>): ObjectCell | string {
  const ctx = context();
  ctx.self = true;
  for (const [key, x] of Object.entries(ns)) {
    if (key === 'default') continue;
    const name = trebolName(key);
    let v: Cell;
    if (typeof x === 'function') {
      const spec = specOf(x as JsFunction, name);
      if (typeof spec === 'string') return spec;
      functions.push(x as JsFunction);
      v = { t: K.Native, p: { ...call, ...spec, name, data: functions.length - 1, hidden: true } satisfies NativeDef };
    } else {
      let json: string | undefined;
      try {
        json = JSON.stringify(x);
      } catch {
        json = undefined;
      }
      if (json === undefined) continue;
      const parsed = parseJson(json);
      if (typeof parsed === 'string') continue;
      v = parsed;
    }
    ctxAdd(ctx, intern(name), v);
  }
  return { t: K.Object, ctx };
}
