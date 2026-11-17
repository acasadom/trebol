// Modules and local storage.
//
// `import %clients.trb` loads a file once per runtime and evaluates it as an
// object (its top-level set-words are its fields), resolving the path
// against the file that imports it. The words listed in the module header's
// `exports:` are also set in the user context, and so is every top-level
// set-word marked with `export` (as R3):
//
//   Trebol [exports: [load-clients]]
//   export save-client: func [...] [...]
//
// A `.js` file is a JavaScript module instead (js.ts).
//
// `import 'trebol-es` imports a package by its name: the first node_modules/trebol-es/
// found going up from the importing file (from the page or the working directory when
// no file imports it), as Node finds packages. Its package.json says which file is the
// module, `"trebol": "es.trb"`. The same loader reads it, so this works on a disk and
// over http alike; `trebol build` puts the package's files inside the page where the
// page finds them, under node_modules/.
//
// `do %file` runs a script in the user context each time; `read` gives a
// file's text and `load %file` its values.
//
// Local storage keeps values molded with mold/all, so they load back exact.

import {
  K, NONE, UNSET, native, value, text, load, mold, string, context, collectSetWords, bindSeries, bindSelf,
  copyDeep, setWord, getWord, splice, currentFile, throwError, makeError, scriptStart, LoadError, T, canon, intern, spell, LIBRARY_FILES, blockOf,
  type Cell, type BlockCell, type StringCell, type ObjectCell, type Runtime, type WordCell, type Series, type Task, type Step, type NativeFrame,
} from '../core/index.ts';
import { jsModule } from './js.ts';

export interface Loader {
  /** Base for resolving the first file: the page URL, or the working directory as a file: URL. */
  base: string;
  /** Reads a module's source by its resolved URL. */
  read: (href: string) => Promise<string>;
  /** Loads a JavaScript module by its resolved URL; the platform's import when not given. */
  importJs?: (href: string) => Promise<Record<string, unknown>>;
}

interface ModuleEntry {
  obj: ObjectCell | null;
  done: Promise<Cell>;
  settle: (ok: boolean, v: Cell) => void;
}

const loaders = new WeakMap<Runtime, Loader>();
const modules = new WeakMap<Runtime, Map<string, ModuleEntry>>();

export function setLoader(rt: Runtime, loader: Loader): void {
  loaders.set(rt, loader);
  modules.set(rt, new Map());
}

export function defaultLoader(): Loader {
  type ReadFile = (path: URL, encoding: 'utf8') => Promise<string>;
  const g = globalThis as {
    location?: { href: string };
    process?: { getBuiltinModule?: (name: string) => { readFile: ReadFile } | undefined };
  };
  return {
    base: g.location?.href ?? 'file:///',
    read: async href => {
      // in Node, fetch opens no file: URL; asking Node for its module keeps a browser bundle free of it
      const fs = href.startsWith('file:') ? g.process?.getBuiltinModule?.('node:fs/promises') : undefined;
      if (fs !== undefined) return fs.readFile(new URL(href), 'utf8');
      const res = await fetch(href);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
  };
}

function resolve(base: string, from: string | null, path: string): string {
  const fromHref = from === null ? base : new URL(from, base).href;
  return new URL(path, fromHref).href;
}

const EXPORTS = canon(intern('exports'));
const EXPORT = canon(intern('export'));
const TYPE = canon(intern('type'));
const MODULE = canon(intern('module'));
const PARTS = canon(intern('parts'));

/** The value after `name:` in a script header, or null. */
function headerField(header: BlockCell | null, name: number): Cell | null {
  if (header === null) return null;
  const hd = header.s.data;
  for (let i = header.i; i + 1 < hd.length; i++) {
    const c = hd[i]!;
    if (c.t === K.SetWord && canon(c.sym) === name) return hd[i + 1]!;
  }
  return null;
}

/** Takes the `export` marks out of a module body, giving the words they export. */
function takeExports(body: Series<Cell>): WordCell[] {
  const out: WordCell[] = [];
  const d = body.data;
  for (let i = 0; i < d.length; i++) {
    const c = d[i]!;
    if (c.t !== K.Word || canon(c.sym) !== EXPORT) continue;
    const next = d[i + 1];
    if (next?.t === K.SetWord) {
      out.push({ t: K.Word, sym: next.sym, bind: null });
      splice(body, i, 1, []);
      i--;
    } else if (next?.t === K.Block) {
      for (const w of next.s.data) if (w.t === K.Word) out.push(w);
      splice(body, i, 2, []);
      i--;
    }
  }
  return out;
}

function hrefOf(t: Task, loader: Loader, path: Cell): string {
  return resolve(loader.base, currentFile(t), text(path as StringCell));
}

/** Sources built into a bundle (dist/), by URL: they are read without asking the loader. */
const builtIn = new Map<string, string>();

export function addBuiltIn(href: string, src: string): void {
  builtIn.set(href, src);
}

/** The source built in under a URL, or undefined. */
export function builtInText(href: string): string | undefined {
  return builtIn.get(href);
}

function readText(loader: Loader, href: string, path: Cell): Promise<Cell> {
  const src = builtIn.get(href);
  if (src !== undefined) return Promise.resolve(string(src));
  return loader.read(href).then(src => string(src), (e: unknown) => {
    throw makeError('access', 'cannot-open', `cannot open ${mold(path)}: ${(e as Error).message}`);
  });
}

native('read', '["The text of a file or a web address." source [file! url!]]', (t, f, v) => {
  if (f.phase === 1) return value(v!);
  const loader = loaders.get(t.rt);
  if (loader === undefined) return throwError('access', 'no-loader', 'this host cannot read files');
  f.phase = 1;
  return { k: 'await', p: readText(loader, hrefOf(t, loader, f.args[0]!), f.args[0]!) };
});

interface DoFileState { href: string }

native('do-file', '["Runs the script in a file, as do does; a module is imported." file [file! url!]]', (t, f, v) => {
  if (f.phase === 2) return value(v!);
  const loader = loaders.get(t.rt);
  if (loader === undefined) return throwError('access', 'no-loader', 'this host cannot read files');
  if (f.phase === 0) {
    const href = hrefOf(t, loader, f.args[0]!);
    f.data = { href } satisfies DoFileState;
    f.phase = 1;
    return { k: 'await', p: readText(loader, href, f.args[0]!) };
  }
  const { href } = f.data as DoFileState;
  let code: BlockCell;
  try {
    code = load(text(v as StringCell), { file: href });
  } catch (e) {
    // LoadError is the one exception on the normal path; it becomes a value here.
    if (!(e instanceof LoadError)) throw e;
    return throwError('syntax', 'load', e.message);
  }
  const { header, start } = scriptStart(code);
  f.phase = 2;
  const type = headerField(header, TYPE);
  if (type !== null && type.t === K.Word && canon(type.sym) === MODULE) {
    return { k: 'call', fn: getWord({ t: K.Word, sym: intern('import'), bind: t.rt.lib })!, args: [f.args[0]!] };
  }
  bindSeries(code.s, t.rt.user, true);
  return { k: 'do', s: code.s, i: start };
});

interface ImportState {
  href: string; entry: ModuleEntry; ctx: ReturnType<typeof context> | null; exports: WordCell[]; lib?: boolean;
  /** The module's code, kept while its parts are read. */
  code?: BlockCell; start?: number; parts?: string[];
  /** What runs, each part and then the module's own body, and which of them runs now. */
  bodies?: Series<Cell>[]; at?: number;
}

/** Package names as npm takes them, without a scope (a scope does not fit in a word). */
const PACKAGE_NAME = /^[a-z0-9][a-z0-9._-]*$/;

/** The href of a package's module: the "trebol" file of the first node_modules/<name>/ going up from `from`. */
async function packageModule(loader: Loader, from: string, name: string): Promise<Cell> {
  let dir = new URL('./', from);
  for (;;) {
    const at = new URL(`node_modules/${name}/`, dir).href;
    const json = builtIn.get(`${at}package.json`) ?? await loader.read(`${at}package.json`).catch(() => null);
    if (json !== null) {
      let main: unknown;
      try {
        main = (JSON.parse(json) as { trebol?: unknown }).trebol;
      } catch {
        throw makeError('access', 'cannot-open', `the package.json of ${name} is not JSON`);
      }
      if (typeof main !== 'string') throw makeError('access', 'cannot-open', `${name} is not a Trebol package: its package.json has no "trebol" file`);
      return string(new URL(main, at).href);
    }
    if (dir.pathname === '/' || dir.protocol !== 'file:' && dir.protocol !== 'http:' && dir.protocol !== 'https:') break;
    dir = new URL('../', dir);
  }
  throw makeError('access', 'cannot-open', `cannot find the package ${name}: no node_modules/${name}/package.json`);
}

/** Binds the bodies of a module (its parts, then its own code) to one context and runs the first. */
function startModule(rt: Runtime, f: NativeFrame, st: ImportState, bodies: Series<Cell>[]): Step {
  for (const b of bodies) st.exports.push(...takeExports(b));
  const ctx = context();
  ctx.self = true;
  for (const b of bodies) collectSetWords(b, 0, ctx);
  // Trebol's own modules (the UI dialect) see lib, as R3's modules do, so a word a program sets,
  // form: or can?, never takes the place of one they use; their exports go to lib too
  for (const b of bodies) {
    bindSeries(b, st.lib ? rt.lib : rt.user, true);
    bindSeries(b, ctx);
    bindSelf(b, ctx);
  }
  st.ctx = ctx;
  st.bodies = bodies;
  st.at = 0;
  f.phase = 2;
  f.trap = 1 << T.Error;
  return { k: 'do', s: bodies[0]!, i: 0 };
}

native('import', '["Runs a module and gives its exports; a word is a package by its name, from node_modules." source [file! url! string! word!]]', (t, f, v) => {
  const rt = t.rt;
  const loader = loaders.get(rt);
  const mods = modules.get(rt);
  if (loader === undefined || mods === undefined) return throwError('access', 'no-loader', 'this host cannot load modules');
  // a package: where its module is comes first, then it is imported as a file is
  if (f.phase === 0 && f.args[0]!.t === K.Word) {
    const name = spell((f.args[0] as WordCell).sym);
    if (!PACKAGE_NAME.test(name)) return throwError('script', 'bad-module', `${name} is not the name of a package`);
    f.phase = 5;
    return { k: 'await', p: packageModule(loader, resolve(loader.base, currentFile(t), './'), name) };
  }
  if (f.phase === 0 || f.phase === 5) {
    const href = f.phase === 5 ? text(v as StringCell) : hrefOf(t, loader, f.args[0]!);
    const known = mods.get(href);
    if (known !== undefined) {
      if (known.obj !== null) return value(known.obj);
      f.phase = 3;
      return { k: 'await', p: known.done };
    }
    let settle: ModuleEntry['settle'] = () => {};
    const done = new Promise<Cell>((ok, fail) => {
      settle = (good, x) => (good ? ok(x) : fail(x));
    });
    done.catch(() => {}); // a failed import is reported to the importer, not as unhandled
    const entry: ModuleEntry = { obj: null, done, settle };
    mods.set(href, entry);
    f.data = { href, entry, ctx: null, exports: [] } satisfies ImportState;
    if (/\.m?js$/i.test(new URL(href).pathname)) {
      f.phase = 4;
      const load = loader.importJs ?? ((h: string) => import(/* @vite-ignore */ h) as Promise<Record<string, unknown>>);
      return {
        k: 'await',
        p: load(href).then(ns => {
          const obj = jsModule(ns);
          if (typeof obj === 'string') throw makeError('script', 'bad-module', obj);
          return obj;
        }, (e: unknown) => {
          throw makeError('access', 'cannot-open', `cannot open ${mold(f.args[0]!)}: ${(e as Error)?.message ?? String(e)}`);
        }).then(obj => {
          entry.obj = obj;
          entry.settle(true, obj);
          return obj;
        }, (err: unknown) => {
          mods.delete(href);
          entry.settle(false, err as Cell);
          throw err;
        }),
      };
    }
    f.phase = 1;
    return {
      k: 'await',
      p: readText(loader, href, f.args[0]!).catch((err: unknown) => {
        mods.delete(href);
        entry.settle(false, err as Cell);
        throw err;
      }),
    };
  }
  if (f.phase === 3 || f.phase === 4) return value(v!);
  const st = f.data as ImportState;
  const failed = (e: Cell) => {
    mods.delete(st.href);
    st.entry.settle(false, e);
  };
  const loadIt = (src: Cell, file: string): BlockCell | Step => {
    try {
      return load(text(src as StringCell), { file });
    } catch (e) {
      // LoadError is the one exception on the normal path; it becomes a value here.
      if (!(e instanceof LoadError)) throw e;
      const step = throwError('syntax', 'load', e.message);
      if (step.k === 'throw') failed(step.e.v);
      return step;
    }
  };
  if (f.phase === 1) {
    const code = loadIt(v!, st.href);
    if ('k' in code) return code;
    const { header, start } = scriptStart(code);
    const listed = headerField(header, EXPORTS);
    if (listed !== null && listed.t === K.Block) st.exports = listed.s.data.filter(w => w.t === K.Word) as WordCell[];
    st.lib = LIBRARY_FILES.has(st.href);
    // parts: [%a.trb %b.trb] are files of the same module, read before it runs
    const parts = headerField(header, PARTS);
    if (parts !== null) {
      const files = parts.t === K.Block ? parts.s.data.slice(parts.i) : [];
      if (files.length === 0 || files.some(x => x.t !== K.File)) {
        const step = throwError('script', 'bad-module', 'parts: takes a block of files');
        if (step.k === 'throw') failed(step.e.v);
        return step;
      }
      st.code = code;
      st.start = start;
      st.parts = files.map(x => new URL(text(x as StringCell), st.href).href);
      // the parts of Trebol's own modules are Trebol's own code too
      if (st.lib) for (const h of st.parts) LIBRARY_FILES.add(h);
      f.phase = 6;
      const loader = loaders.get(rt)!;
      return { k: 'await', p: Promise.all(st.parts.map((h, i) => readText(loader, h, files[i]!))).then(texts => blockOf(K.Block, texts)) };
    }
    return startModule(rt, f, st, [copyDeep(code.s, start)]);
  }
  if (f.phase === 6) {
    const bodies: Series<Cell>[] = [];
    const texts = (v as BlockCell).s.data;
    for (let i = 0; i < texts.length; i++) {
      const part = loadIt(texts[i]!, st.parts![i]!);
      if ('k' in part) return part;
      bodies.push(copyDeep(part.s, scriptStart(part).start));
    }
    bodies.push(copyDeep(st.code!.s, st.start!));
    st.code = undefined;
    return startModule(rt, f, st, bodies);
  }
  // a part ran: the next one, or the module's own body
  if (f.phase === 2 && f.thrown === null && st.at! + 1 < st.bodies!.length) {
    st.at!++;
    return { k: 'do', s: st.bodies![st.at!]!, i: 0 };
  }
  // phase 2: the module body ran
  if (f.thrown !== null) {
    const th = f.thrown;
    f.thrown = null;
    failed(th.v);
    return { k: 'throw', e: th };
  }
  const obj: ObjectCell = { t: K.Object, ctx: st.ctx! };
  for (const w of st.exports) {
    const i = st.ctx!.keys.findIndex(k => canon(k) === canon(w.sym));
    if (i < 0) {
      const step = throwError('script', 'bad-export', `${mold(w)} is exported but not defined`);
      if (step.k === 'throw') failed(step.e.v);
      return step;
    }
    if (st.lib) setWord({ t: K.Word, sym: w.sym, bind: rt.lib }, st.ctx!.vals[i]!);
    setWord({ t: K.Word, sym: w.sym, bind: rt.user }, st.ctx!.vals[i]!);
  }
  st.entry.obj = obj;
  st.entry.settle(true, obj);
  return value(obj);
});

// --- local storage -------------------------------------------------------------

interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const memory = new Map<string, string>();
const store: Store = (globalThis as { localStorage?: Store }).localStorage ?? {
  getItem: k => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: k => void memory.delete(k),
};

const PREFIX = 'trebol:';
const keyOf = (c: Cell): string => PREFIX + (c.t === K.Word || c.t === K.LitWord ? mold({ ...c, t: K.Word }) : text(c as StringCell));

native('save-local', '["Keeps a value in the browser, under a key." key [string! word!] value [any-value!]]', (_t, f) => {
  store.setItem(keyOf(f.args[0]!), mold(f.args[1]!, { all: true }));
  return value(f.args[1]!);
});

native('load-local', '["The value kept in the browser under a key, or none." key [string! word!]]', (_t, f) => {
  const saved = store.getItem(keyOf(f.args[0]!));
  if (saved === null) return value(NONE);
  try {
    return value(load(saved).s.data[0] ?? NONE);
  } catch (e) {
    // a value that no longer loads is treated as missing
    if (e instanceof LoadError) return value(NONE);
    throw e;
  }
});

native('remove-local', '["Forgets the value kept in the browser under a key." key [string! word!]]', (_t, f) => {
  store.removeItem(keyOf(f.args[0]!));
  return value(UNSET);
});
