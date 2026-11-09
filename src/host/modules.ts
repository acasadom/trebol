// Modules and local storage.
//
// `import %clients.trb` loads a file once per runtime and evaluates it as an
// object (its top-level set-words are its fields), resolving the path
// against the file that imports it. The words listed in the module header's
// `exports:` are also set in the user context:
//
//   Trebol [exports: [load-clients]]
//
// Local storage keeps values molded with mold/all, so they load back exact.

import {
  K, NONE, UNSET, native, value, text, load, mold, string, context, collectSetWords, bindSeries, bindSelf,
  copyDeep, setWord, currentFile, throwError, makeError, scriptStart, LoadError, T, canon, intern,
  type Cell, type BlockCell, type StringCell, type ObjectCell, type Runtime, type WordCell,
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
  const g = globalThis as { location?: { href: string } };
  return {
    base: g.location?.href ?? 'file:///',
    read: async href => {
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

interface ImportState { href: string; entry: ModuleEntry; ctx: ReturnType<typeof context> | null; exports: WordCell[] }

native('import', '["Runs a module and gives its exports." source [file! url! string!]]', (t, f, v) => {
  const rt = t.rt;
  const loader = loaders.get(rt);
  const mods = modules.get(rt);
  if (loader === undefined || mods === undefined) return throwError('access', 'no-loader', 'this host cannot load modules');
  if (f.phase === 0) {
    const href = resolve(loader.base, currentFile(t), text(f.args[0] as StringCell));
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
      p: loader.read(href).then(src => string(src), (e: unknown) => {
        const err = makeError('access', 'import', `cannot import ${href}: ${(e as Error).message}`);
        mods.delete(href);
        entry.settle(false, err);
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
    if (header !== null) {
      const hd = header.s.data;
      for (let i = 0; i + 1 < hd.length; i++) {
        const c = hd[i]!;
        const next = hd[i + 1]!;
        if (c.t === K.SetWord && canon(c.sym) === EXPORTS && next.t === K.Block) {
          st.exports = next.s.data.filter(w => w.t === K.Word) as WordCell[];
        }
      }
    }
    const body = copyDeep(code.s, start);
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
