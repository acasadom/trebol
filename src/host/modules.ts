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
// `do %file` runs a script in the user context each time; `read` gives a
// file's text and `load %file` its values.
//
// Local storage keeps values molded with mold/all, so they load back exact.

import {
  K, NONE, UNSET, native, value, text, load, mold, string, context, collectSetWords, bindSeries, bindSelf,
  copyDeep, setWord, getWord, splice, currentFile, throwError, makeError, scriptStart, LoadError, T, canon, intern,
  type Cell, type BlockCell, type StringCell, type ObjectCell, type Runtime, type WordCell, type Series, type Task,
} from '../core/index.ts';

export interface Loader {
  /** Base for resolving the first file: the page URL, or the working directory as a file: URL. */
  base: string;
  /** Reads a module's source by its resolved URL. */
  read: (href: string) => Promise<string>;
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

interface ImportState { href: string; entry: ModuleEntry; ctx: ReturnType<typeof context> | null; exports: WordCell[] }

native('import', '["Runs a module and gives its exports." source [file! url! string!]]', (t, f, v) => {
  const rt = t.rt;
  const loader = loaders.get(rt);
  const mods = modules.get(rt);
  if (loader === undefined || mods === undefined) return throwError('access', 'no-loader', 'this host cannot load modules');
  if (f.phase === 0) {
    const href = hrefOf(t, loader, f.args[0]!);
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
  if (f.phase === 3) return value(v!);
  const st = f.data as ImportState;
  const failed = (e: Cell) => {
    mods.delete(st.href);
    st.entry.settle(false, e);
  };
  if (f.phase === 1) {
    let code: BlockCell;
    try {
      code = load(text(v as StringCell), { file: st.href });
    } catch (e) {
      // LoadError is the one exception on the normal path; it becomes a value here.
      if (!(e instanceof LoadError)) throw e;
      const step = throwError('syntax', 'load', e.message);
      if (step.k === 'throw') failed(step.e.v);
      return step;
    }
    const { header, start } = scriptStart(code);
    const listed = headerField(header, EXPORTS);
    if (listed !== null && listed.t === K.Block) st.exports = listed.s.data.filter(w => w.t === K.Word) as WordCell[];
    const body = copyDeep(code.s, start);
    st.exports.push(...takeExports(body));
    const ctx = context();
    ctx.self = true;
    collectSetWords(body, 0, ctx);
    bindSeries(body, rt.user, true);
    bindSeries(body, ctx);
    bindSelf(body, ctx);
    st.ctx = ctx;
    f.phase = 2;
    f.trap = 1 << T.Error;
    return { k: 'do', s: body, i: 0 };
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
