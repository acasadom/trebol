// `trebol test [file.test.trb|folder ...]`: the screen tests of an app, without a browser.
//
// A test file has the format of Trebol's own suites: a string names a group and
// each block after it is one test, which must give true. Each block runs on the
// app started anew (app.test.trb tests app.trb; `app: %other.trb` in the header
// names another, `app: none` none at all), after what comes before the first
// group, where serve says what the server answers. The words a test uses (click,
// type, choose, see) are in src/ui/test.trb; this file is the host they run on:
// it keeps the view, the notices, the link and the history of the page, and
// answers the app's requests from serve.

import { readFile, readdir, stat } from 'node:fs/promises';
import { STATUS_CODES } from 'node:http';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  K, NONE, TRUE, UNSET, makeError, load, LoadError, intern, ctxFind, ctxAdd, context, bindSeries, scriptStart, native, value, string, text, blockOf, form, mold, spell,
  sourceOf, type Cell, type BlockCell, type ObjectCell, type StringCell, type WordCell,
} from '../src/core/index.ts';
import { startHost, startUi, runSource, report, fileHandle, TEST_SOURCE, type Host } from '../src/host/index.ts';
import { spawn, taskResult } from '../src/host/scheduler.ts';
import { appendText } from '../src/host/markdown.ts';

/** What the page of the test running has shown and been asked. */
let page = fresh();

function fresh(host: Host | null = null, dir = '.') {
  return {
    host,
    /** The folder of the test file: where the files attach takes are. */
    dir,
    /** The view on show. */
    view: NONE as Cell,
    toasts: [] as string[],
    // the links of the page's history, and the one on show
    history: [[]] as string[][],
    at: 0,
    /** Requests serve had no answer for. */
    unanswered: [] as string[],
    /** Errors of tasks nobody waited for: a handler that failed. */
    errors: [] as string[],
    /** What the user says to the next questions of confirm, from say; yes when none is left. */
    answers: [] as boolean[],
    /** The questions confirm has asked. */
    asked: [] as string[],
  };
}

const word = (host: Host, w: string): Cell => ({ t: K.Word, sym: intern(w), bind: host.rt.lib });
const strings = (parts: string[]): Cell => blockOf(K.Block, parts.map(p => string(p)));

native('show', '["Draws a face and everything in it." face [object!]]', (_t, f) => value(page.view = f.args[0]!));
native('shown-view', '["The view on show; none before the first." ]', () => value(page.view));
native('apply-theme', '["Changes the look of the whole screen." spec [object!]]', (_t, f) => value(f.args[0]!));
// no rounds here: the tests run the reactions themselves
native('ui-watch', '["Marks an object a reaction reads, so that a change to it runs the reactions at the end of the round." object [object!]]', (_t, f) => value(f.args[0]!));
native('repaint', '["Redraws the faces that changed." ]', () => value(blockOf(K.Block, [])));
native('print-faces', '["Opens the print dialog for the page, or for one face only." face [object! none!]]', () => value(NONE));
// a test has no cursor: the text goes at the end
native('insert-at-caret', '["The value of a field, area or rich text with text put where its cursor was; the cursor goes after it." face [object!] text [string!]]', (_t, f) => {
  const face = f.args[0] as ObjectCell;
  const facet = (name: string): Cell | undefined => face.ctx.vals[ctxFind(face.ctx, intern(name))];
  const was = facet('value');
  const old = was?.t === K.String ? text(was as StringCell) : '';
  const add = text(f.args[1] as StringCell);
  const style = facet('style');
  const rich = style?.t === K.Word && spell((style as WordCell).sym) === 'rich';
  return value(string(rich ? appendText(old, add) : old + add));
});
native('show-toast', '["Shows a short message at the edge of the screen." message [string!] kind [word! none!] undo [integer! none!]]', (_t, f) => {
  page.toasts.push(text(f.args[0] as StringCell));
  return value(f.args[0]!);
});
native('hide-toast', '["Takes away a notice with an Undo button, by its id." id [integer!]]', () => value(UNSET));
native('shown-toasts', '["The notices the page has shown." ]', () => value(strings(page.toasts)));
// the user says what say told, or yes
native('show-confirm', '["Asks a question in a small dialog; true when the user says yes." question [string!] yes [string! none!] no [string! none!] kind [word! none!]]', (_t, f) => {
  page.asked.push(text(f.args[0] as StringCell));
  return value({ t: K.Logic, v: page.answers.shift() ?? true });
});
native('test-say', '["Sets what the user says to the next question of confirm." yes [logic!]]', (_t, f) => {
  page.answers.push(f.args[0]!.t === K.Logic && f.args[0]!.v);
  return value(TRUE);
});
native('shown-questions', '["The questions confirm has asked." ]', () => value(strings(page.asked)));

/** The type a browser gives a file by its extension. */
const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.avif': 'image/avif', '.pdf': 'application/pdf', '.txt': 'text/plain', '.csv': 'text/csv',
  '.json': 'application/json', '.md': 'text/markdown', '.html': 'text/html', '.zip': 'application/zip',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.doc': 'application/msword', '.xls': 'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.odt': 'application/vnd.oasis.opendocument.text', '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
};

// a file of the disk as the user would choose it: name, size, type and the handle the app reads
native('test-file', '["A file next to the test as an upload gets it: its name, size, type and file." file [file!]]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);
  const path = resolve(page.dir, text(f.args[0] as StringCell));
  const p = readFile(path).then(
    bytes => {
      const file = new File([bytes], basename(path), { type: TYPES[extname(path).toLowerCase()] ?? '' });
      return blockOf(K.Block, [string(file.name), { t: K.Integer, v: file.size } as Cell, string(file.type), fileHandle(file)]) as Cell;
    },
    () => { throw makeError('access', 'read', `attach: there is no file ${relative(process.cwd(), path) || path}`); },
  );
  f.phase = 1;
  return { k: 'await', p };
});

native('route', '["The screen and arguments in the address bar." ]', () => value(strings(page.history[page.at]!)));
native('set-route', '["Puts a screen and arguments in the address bar." route [block!] replace [logic!]]', (_t, f) => {
  const r = f.args[0] as BlockCell;
  const link = r.s.data.slice(r.i).map(c => (c.t === K.String ? text(c as StringCell) : form(c)));
  if (f.args[1]!.t === K.Logic && f.args[1]!.v) {
    page.history[page.at] = link;
  } else {
    page.history = [...page.history.slice(0, page.at + 1), link];
    page.at++;
  }
  return value(r);
});
// a screen that stays puts back the link the last step left
let stepped = 0;
native('route-undo', '["Puts back the link the page had before the last change." ]', () => {
  page.at -= stepped;
  stepped = 0;
  return value(NONE);
});
native('set-unsaved', '["Whether the browser asks before closing the page." on [logic!]]', (_t, f) => value(f.args[0]!));
native('route-steps', '["How many steps back and forward the history has." ]', () =>
  value(blockOf(K.Block, [page.at, page.history.length - 1 - page.at].map(n => ({ t: K.Integer, v: n }) as Cell))));

/** Goes by steps in the history, and waits for the screen of the link it lands on, as the browser's back does. */
function step(f: Parameters<Parameters<typeof native>[2]>[1], by: number): ReturnType<Parameters<typeof native>[2]> {
  const to = page.at + by;
  if (to < 0 || to >= page.history.length || page.host === null) return value({ t: K.Logic, v: false });
  page.at = to;
  stepped = by;
  const host = page.host;
  // the native is called again with the result once the screen is shown
  f.phase = 1;
  const t = spawn(host.sch, { data: [word(host, 'test-route'), strings(page.history[to]!)] }, 0);
  return { k: 'await', p: taskResult(t).then(() => ({ t: K.Logic, v: true }) as Cell) };
}
native('route-back', '["Goes one step back in the history." ]', (_t, f, v) => (f.phase === 1 ? value(v!) : step(f, -1)));
native('route-forward', '["Goes one step forward in the history." ]', (_t, f, v) => (f.phase === 1 ? value(v!) : step(f, 1)));

/** The app's requests, answered by test-answer from what serve was given. */
async function answer(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  const host = page.host!;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init.method ?? 'GET').toUpperCase();
  const body = typeof init.body === 'string' ? string(init.body) : init.body instanceof FormData || init.body instanceof URLSearchParams ? string(formJson(init.body)) : NONE;
  const call = [word(host, 'test-answer'), { t: K.LitWord, sym: intern(method), bind: host.rt.user } as Cell, string(url), body];
  const got = await taskResult(spawn(host.sch, { data: call }, 0));
  if (got.t !== K.Block) {
    page.unanswered.push(`${method} ${url}`);
    return new Response('', { status: 404, statusText: 'Not Found' });
  }
  const [status, json] = got.s.data.slice(got.i) as [{ v: number }, StringCell];
  // 204, 205 and 304 are answers with no body: Response refuses one
  const empty = status.v === 204 || status.v === 205 || status.v === 304;
  return new Response(empty ? null : text(json), { status: status.v, statusText: STATUS_CODES[status.v] ?? '', headers: { 'content-type': 'application/json' } });
}

/** What a form or multipart body sent, as JSON for serve: a file as its name, size and type. */
function formJson(body: FormData | URLSearchParams): string {
  const out: Record<string, unknown> = {};
  for (const [k, v] of body.entries()) {
    const one = v instanceof File ? { name: v.name, size: v.size, type: v.type } : v;
    const had = out[k];
    out[k] = had === undefined ? one : Array.isArray(had) ? [...had, one] : [had, one];
  }
  return JSON.stringify(out);
}

/** One test: where it is, its group, and how it went. */
interface Outcome { at: string; group: string; problem: string | null }

/** Runs the tests of the files; writes how each went. True when all passed. */
export async function test(files: string[], write: (line: string) => void = console.log): Promise<boolean> {
  const realFetch = globalThis.fetch;
  globalThis.fetch = answer as typeof fetch;
  let total = 0;
  let failed = 0;
  try {
    for (const file of files) {
      for await (const o of runFile(file)) {
        total++;
        if (o.problem === null) {
          write(`ok    ${o.at}  ${o.group}`);
        } else {
          failed++;
          write(`FAIL  ${o.at}  ${o.group}`);
          for (const line of o.problem.split('\n')) write(`        ${line}`);
        }
      }
    }
  } finally {
    globalThis.fetch = realFetch;
  }
  write(failed === 0 ? `${total} ${total === 1 ? 'test' : 'tests'}, all passed.` : `${total} ${total === 1 ? 'test' : 'tests'}, ${failed} failed.`);
  return failed === 0 && total > 0;
}

/** The app a test file tests: its header's app, or the file without .test. */
function appOf(file: string, header: BlockCell | null): string | null {
  const h = header === null ? [] : header.s.data.slice(header.i);
  for (let i = 0; i + 1 < h.length; i++) {
    const c = h[i]!;
    if (c.t === K.SetWord && spell((c as WordCell).sym) === 'app') {
      const v = h[i + 1]!;
      if (v.t === K.File) return resolve(dirname(file), text(v as StringCell));
      if (v.t === K.Word && spell((v as WordCell).sym) === 'none') return null;
    }
  }
  return file.replace(/\.test\.trb$/, '.trb');
}

async function* runFile(file: string): AsyncGenerator<Outcome> {
  let source: string;
  let code: BlockCell;
  try {
    source = await readFile(file, 'utf8');
    code = load(source, { file });
  } catch (e) {
    yield { at: file, group: '', problem: e instanceof LoadError ? e.message : (e as Error).message };
    return;
  }
  const { header, start } = scriptStart(code);
  const app = appOf(file, header);
  const items = code.s.data;
  const first = items.findIndex((c, i) => i >= start && c.t === K.String);
  const prelude = first < 0 ? items.length : first;
  let group = '';
  for (let i = prelude; i < items.length; i++) {
    const c = items[i]!;
    if (c.t === K.String) group = text(c as StringCell);
    else if (c.t === K.Block) yield { at: sourceOf(code.s, i) ?? file, group, problem: await runOne(file, source, start, prelude, i, app) };
    else yield { at: sourceOf(code.s, i) ?? file, group, problem: `a test is a block, not ${mold(c)}` };
  }
}

/** Runs the test at index `at` of the file on the app started anew; its problem, or null if it passed. */
async function runOne(file: string, source: string, start: number, prelude: number, at: number, app: string | null): Promise<string | null> {
  // the files of loaded blocks are named from the current folder, as check names them
  const base = pathToFileURL(process.cwd() + sep).href;
  const host = startHost({
    onError: e => page.errors.push(report(e)),
    loader: { base, read: href => readFile(fileURLToPath(href), 'utf8') },
  });
  page = fresh(host, dirname(file));
  try {
    await startUi(host);
    // the words of the tests are the ones their module's import sets: an app may have words of the same name
    const user = host.rt.user;
    const before = user.vals.slice();
    await runSource(host, `import ${TEST_SOURCE}`);
    const own = context();
    user.keys.forEach((sym, i) => { if (user.vals[i] !== before[i]) ctxAdd(own, sym, user.vals[i]!); });
    // the file anew, so nothing a test changed in it reaches the next one
    const code = load(source, { file });
    bindSeries(code.s, host.rt.user, true);
    const s = code.s;
    await taskResult(spawn(host.sch, { data: s.data.slice(start, prelude), pos: s.pos?.slice(start, prelude), file }, 0));
    if (app !== null) await runSource(host, await readFile(app, 'utf8'), relative(process.cwd(), app) || app);
    const test = s.data[at] as BlockCell;
    bindSeries(test.s, own);
    const got = await taskResult(spawn(host.sch, test.s, test.i));
    // a notice still waiting goes when the test ends: what waits for it runs, and its requests need answers too
    await taskResult(spawn(host.sch, { data: [{ t: K.Word, sym: intern('ui-toasts-done'), bind: host.rt.lib }] }, 0));
    const problems = [...unanswered(), ...page.errors, ...unasked()];
    if (got.t !== K.Logic || !got.v) problems.push(`the test gave ${mold(got)}, not true`);
    return problems.length > 0 ? problems.join('\n') : null;
  } catch (e) {
    // a request with no answer comes first: the error it caused follows from it
    const problem = e instanceof LoadError ? e.message : 'ctx' in (e as object) ? report(e as ObjectCell) : String(e);
    return [...unanswered(), problem].join('\n');
  }
}

const unanswered = (): string[] => page.unanswered.map(r => `serve has no answer for ${r}`);
const unasked = (): string[] => page.answers.map(a => `say ${a ? 'yes' : 'no'}: no question was asked`);

/** Every *.test.trb under a folder, but in node_modules and hidden folders. */
export async function findTests(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(root, { withFileTypes: true })) {
    const p = join(root, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && !e.name.startsWith('.')) out.push(...await findTests(p));
    } else if (e.name.endsWith('.test.trb')) {
      out.push(p);
    }
  }
  return out.sort();
}

/** The test files named: a file as it is, a folder as every *.test.trb under it. */
export async function testFiles(names: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const n of names) {
    const isDir = await stat(n).then(s => s.isDirectory(), () => false);
    out.push(...(isDir ? await findTests(n) : [n]));
  }
  return out;
}
