// Network natives: HTTP with JSON built in; WebSocket and server-sent events are in net/streams.ts.
//
// All of them are asynchronous by default: they return `await` and the task
// continues with the result, so from Trebol `data: fetch url` just reads.
// Failures (network, timeout, HTTP status >= 400) are access errors that
// `try` can catch. `cancel` on the task aborts the request in flight.

import {
  K, NONE, I64, native, value, string, stringOf, text, binary, makeError, throwError, form, spell, ctxFind, intern,
  parseJson, toJson, queryText,
  type Cell, type BlockCell, type StringCell, type ObjectCell, type WordCell, type Task,
} from '../core/index.ts';
import { schedulerOf, spawn, spawnHandler, makeHandle, handleOf } from './scheduler.ts';
import { devLog } from './devlog.ts';
import { after } from './timers.ts';

// --- files -----------------------------------------------------------------------
//
// A file the user chose (an upload field) is a handle of kind 'file' over a
// Blob: Trebol never holds its bytes until it asks with read-file.

/** A handle for a file the user chose. */
export function fileHandle(file: Blob): Cell {
  return makeHandle('file', file);
}

native('read-file', '["The bytes of a file the user chose." file [handle!]]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  const file = handleOf<Blob>(f.args[0]!, 'file');
  if (file === null) return throwError('script', 'bad-handle', 'read-file needs a file from an upload field');
  const p = file.arrayBuffer().then(
    buf => binary([...new Uint8Array(buf)]) as Cell,
    (e: Error) => { throw makeError('access', 'read', `cannot read ${file instanceof File ? file.name : 'the file'}: ${e.message}`); },
  );
  return { k: 'await', p };
});

// The other way, `download` gives the user a file made by the program: the
// browser saves it with its usual dialog or into Downloads.

const TYPES: Record<string, string> = {
  csv: 'text/csv', txt: 'text/plain', json: 'application/json', xml: 'application/xml', html: 'text/html',
  trb: 'text/plain', md: 'text/markdown', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg',
  pdf: 'application/pdf', zip: 'application/zip',
};

/** Where `download` hands a file; false when this host has no browser. Tests point it elsewhere. */
export const saver = {
  save: (name: string, blob: Blob): boolean => {
    const doc = (globalThis as { document?: Document }).document;
    if (doc === undefined) return false;
    const url = URL.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    doc.body.append(a);
    a.click();
    a.remove();
    // the browser reads the blob after the click returns
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  },
};

/**
 * The file name a server gives in content-disposition: filename*=UTF-8''... (which
 * carries accents) wins over filename=...; '' when there is none.
 */
export function dispositionName(header: string): string {
  const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (star !== null) {
    try {
      const raw = star[2]!.trim();
      if (/^utf-8$/i.test(star[1]!.trim())) return decodeURIComponent(raw);
      // ISO-8859-1: each escaped byte is its own character
      return raw.replace(/%([0-9a-f]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
    } catch { /* a bad escape: try the plain name */ }
  }
  const plain = /filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]+))/i.exec(header);
  if (plain === null) return '';
  return plain[1] !== undefined ? plain[1].replace(/\\(.)/g, '$1') : plain[2]!.trim();
}

/** The field of an answer of fetch/with [full: true]; undefined when it has none. */
function answerField(o: ObjectCell, name: string): Cell | undefined {
  const i = ctxFind(o.ctx, intern(name));
  return i < 0 ? undefined : o.ctx.vals[i];
}

/** A header of an answer, by its name in lowercase as fetch gives them. */
function answerHeader(headers: Cell | undefined, name: string): string {
  if (headers === undefined || headers.t !== K.Map) return '';
  const d = headers.s.data;
  for (let i = 0; i + 1 < d.length; i += 2) {
    if (d[i]!.t === K.String && text(d[i] as StringCell).toLowerCase() === name) return form(d[i + 1]!);
  }
  return '';
}

native('download', '["Gives the user a file to save: text (as UTF-8), bytes, or the answer of fetch/with [full: true], under the name the server gives." name [file! string!] data [string! binary! object!]]', (_t, f) => {
  let name = text(f.args[0] as StringCell).split('/').pop() ?? '';
  let data = f.args[1]!;
  let given = '';
  let renamed = false;
  if (data.t === K.Object) {
    const status = answerField(data, 'status');
    const headers = answerField(data, 'headers');
    const body = answerField(data, 'body');
    if (status === undefined || status.t !== K.Integer || body === undefined) {
      return throwError('script', 'bad-answer', 'download needs an answer of fetch/with [full: true]');
    }
    const code = I64.toNumber(status.v);
    if (code >= 400) return throwError('access', 'http', `HTTP ${code}: no file to save`);
    const server = dispositionName(answerHeader(headers, 'content-disposition')).split(/[/\\]/).pop() ?? '';
    if (server !== '') {
      name = server;
      renamed = true;
    }
    given = answerHeader(headers, 'content-type');
    data = body.t === K.Binary || body.t === K.String ? body : string(toJson(body));
  }
  if (name === '') return throwError('script', 'bad-file', 'download needs a file name');
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  const type = TYPES[ext] ?? 'application/octet-stream';
  // a byte order mark lets spreadsheets read a CSV's accents as UTF-8
  const body = data.t === K.Binary
    ? new Uint8Array(data.s.data.slice(data.i))
    : (ext === 'csv' ? '\ufeff' : '') + text(data as StringCell);
  const blob = new Blob([body], { type: given !== '' ? given : data.t === K.Binary ? type : `${type};charset=utf-8` });
  if (!saver.save(name, blob)) return throwError('access', 'no-download', 'this host cannot give the user files');
  // the name it was saved under, when the server gave one
  return value(renamed ? stringOf(f.args[0]!.t === K.File ? K.File : K.String, name) : f.args[0]!);
});

// --- HTTP ------------------------------------------------------------------------

export function field(opts: ObjectCell | null, name: string): Cell | null {
  if (opts === null) return null;
  const i = ctxFind(opts.ctx, intern(name));
  const v = i < 0 ? undefined : opts.ctx.vals[i];
  return v === undefined || v.t === K.None ? null : v;
}

/** A yes-or-no option: on unless it is missing, none or false. */
export const isOn = (v: Cell | null): boolean => v !== null && !(v.t === K.Logic && !v.v);

/** Pairs from a block [name value ...], a map or an object, as strings. */
export function pairs(c: Cell): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const name = (k: Cell) => (k.t >= K.Word && k.t <= K.Issue ? spell((k as WordCell).sym) : form(k));
  if (c.t === K.Block || c.t === K.Map) {
    const d = c.s.data.slice(c.t === K.Block ? c.i : 0);
    for (let i = 0; i + 1 < d.length; i += 2) out.push([name(d[i]!), form(d[i + 1]!)]);
  } else if (c.t === K.Object) {
    c.ctx.keys.forEach((k, i) => out.push([spell(k), form(c.ctx.vals[i]!)]));
  }
  return out;
}

/** Turns a decoded body into a value: JSON when the server says so, text, or binary. */
function decodeBody(type: string, bytes: Uint8Array): Cell {
  if (/json/i.test(type)) {
    const r = parseJson(new TextDecoder().decode(bytes));
    return typeof r === 'string' ? string(new TextDecoder().decode(bytes)) : r;
  }
  // xml only as the subtype or its +xml suffix: the type of an Excel file (…openxmlformats…) is binary
  if (/^text\/|^[^;]*\/(?:xml|[^;]*\+xml)\s*(?:;|$)|javascript|x-www-form-urlencoded/i.test(type) || type === '') {
    return string(new TextDecoder().decode(bytes));
  }
  return { t: K.Binary, s: { data: [...bytes] }, i: 0 };
}

function toSeconds(c: Cell): number {
  if (c.t === K.Time) return c.v / 1e9;
  if (c.t === K.Integer) return I64.toNumber(c.v);
  return (c as { v: number }).v;
}

/**
 * http-request url options: options is none or an object with any of
 * method, headers, body, json, form, multipart, timeout, full.
 */
/** An answer of the server, however it was asked. */
interface Answer { status: number; statusText: string; ok: boolean; headers: Array<[string, string]>; bytes: Uint8Array }

/** How far a request went: bytes done, and the total when the server or the body says it. */
type Progress = (done: number, total: number | null) => void;

/**
 * Sends a request with fetch. With progress, the body of the answer is read
 * as it comes, so the bytes received can be told.
 */
async function sendFetch(url: string, init: RequestInit, progress: Progress | null): Promise<Answer> {
  const res = await fetch(url, init);
  const headers: Array<[string, string]> = [];
  res.headers.forEach((val, k) => headers.push([k, val]));
  let bytes: Uint8Array;
  if (progress === null || res.body === null) {
    bytes = new Uint8Array(await res.arrayBuffer());
  } else {
    const size = Number(res.headers.get('content-length') ?? NaN);
    const total = Number.isFinite(size) && res.headers.get('content-encoding') === null ? size : null;
    const parts: Uint8Array[] = [];
    let done = 0;
    progress(0, total);
    for (const reader = res.body.getReader(); ;) {
      const { value: part, done: end } = await reader.read();
      if (end) break;
      parts.push(part);
      done += part.length;
      progress(done, total);
    }
    // at the end the total is known: what came
    if (total === null) progress(done, done);
    bytes = new Uint8Array(done);
    let at = 0;
    for (const part of parts) { bytes.set(part, at); at += part.length; }
  }
  return { status: res.status, statusText: res.statusText, ok: res.ok, headers, bytes };
}

/**
 * Sends a request with XMLHttpRequest, the one way a browser tells how much
 * of the body went up: first the bytes sent, then the bytes received.
 */
function sendXhr(url: string, init: RequestInit, progress: Progress): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method ?? 'GET', url);
    (init.headers as Headers).forEach((val, k) => xhr.setRequestHeader(k, val));
    xhr.withCredentials = init.credentials === 'include';
    xhr.responseType = 'arraybuffer';
    const tell = (e: ProgressEvent): void => progress(e.loaded, e.lengthComputable ? e.total : null);
    if (init.body !== undefined) xhr.upload.onprogress = tell;
    xhr.onprogress = tell;
    xhr.onload = () => {
      const headers = xhr.getAllResponseHeaders().trim().split(/[\r\n]+/).filter(l => l.includes(':'))
        .map(l => [l.slice(0, l.indexOf(':')).trim().toLowerCase(), l.slice(l.indexOf(':') + 1).trim()] as [string, string]);
      const ok = xhr.status >= 200 && xhr.status < 300;
      const got = (xhr.response as ArrayBuffer).byteLength;
      progress(got, got);
      resolve({ status: xhr.status, statusText: xhr.statusText, ok, headers, bytes: new Uint8Array(xhr.response as ArrayBuffer) });
    };
    xhr.onerror = () => reject(new Error('network error'));
    xhr.onabort = () => reject(new Error('aborted'));
    init.signal?.addEventListener('abort', () => xhr.abort());
    xhr.send((init.body ?? null) as XMLHttpRequestBodyInit | null);
  });
}

/**
 * What runs as a request goes: a block, with done and total set, or a face,
 * through the host's show-progress. Calls come at most every tenth of a
 * second, and always at the end; `end` says the request is over.
 */
function progressOf(t: Task, target: Cell): { tell: Progress; end: () => void } {
  const sch = schedulerOf(t);
  let last = 0;
  const run = (done: Cell, total: Cell): void => {
    if (target.t === K.Block) {
      spawnHandler(sch, target as BlockCell, { done, total });
      return;
    }
    // a host mezzanine: in user, where the host's Trebol code is loaded
    const i = ctxFind(t.rt.lib, intern('show-progress'));
    const fn = i < 0 ? undefined : t.rt.lib.vals[i];
    if (fn !== undefined) spawn(sch, { data: [fn, target, done, total] }, 0);
  };
  const count = (n: number): Cell => ({ t: K.Integer, v: n });
  return {
    tell: (done, total) => {
      const now = Date.now();
      if (now - last < 100 && done !== total) return;
      last = now;
      run(count(done), total === null ? NONE : count(total));
    },
    end: () => { if (target.t !== K.Block) run(NONE, NONE); },
  };
}

native('http-request', '["Sends an HTTP request; used by fetch." url [url! string!] options [object! none!]]', (t, f, v) => {
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  const opts = f.args[1]!.t === K.Object ? f.args[1] as ObjectCell : null;
  let url = text(f.args[0] as StringCell);
  const q = field(opts, 'query');
  if (q !== null) {
    const qs = queryText(q);
    if (qs === null) return throwError('script', 'bad-query', 'a query takes words or strings as names');
    const hash = url.includes('#') ? url.slice(url.indexOf('#')) : '';
    const base = url.slice(0, url.length - hash.length);
    if (qs !== '') url = base + (base.includes('?') ? '&' : '?') + qs + hash;
  }
  const method = field(opts, 'method');
  const headers = new Headers();
  const h = field(opts, 'headers');
  if (h !== null) for (const [k, val] of pairs(h)) headers.set(k, val);
  let body: BodyInit | undefined;
  const b = field(opts, 'body');
  const formFields = field(opts, 'form');
  const multipart = field(opts, 'multipart');
  if (formFields !== null) {
    body = new URLSearchParams(pairs(formFields));
  } else if (multipart !== null) {
    const fd = new FormData();
    const d = multipart.t === K.Block ? multipart.s.data.slice(multipart.i) : [];
    for (let i = 0; i + 1 < d.length; i += 2) {
      const k = d[i]!;
      const val = d[i + 1]!;
      const key = k.t >= K.Word && k.t <= K.Issue ? spell((k as WordCell).sym) : form(k);
      const file = handleOf<Blob>(val, 'file');
      if (val.t === K.Binary) fd.append(key, new Blob([new Uint8Array(val.s.data.slice(val.i))]), key);
      else if (file !== null) fd.append(key, file, file instanceof File ? file.name : key);
      else fd.append(key, form(val));
    }
    body = fd;
  } else if (b !== null) {
    if (b.t === K.String) {
      body = text(b);
    } else if (b.t === K.Binary) {
      body = new Uint8Array(b.s.data.slice(b.i)) as unknown as BodyInit;
    } else {
      body = toJson(b);
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    }
  }
  if (!headers.has('accept')) headers.set('accept', 'application/json, text/*;q=0.9, */*;q=0.8');
  const timeout = field(opts, 'timeout');
  const full = isOn(field(opts, 'full'));
  // without cookies the browser's own rule: sent to the page's own server only
  const cookies = field(opts, 'cookies');
  const credentials: RequestCredentials = cookies === null ? 'same-origin' : isOn(cookies) ? 'include' : 'omit';
  const ctl = new AbortController();
  let timedOut = false;
  const stopTimer = timeout !== null ? after(toSeconds(timeout) * 1000, () => { timedOut = true; ctl.abort(); }) : null;
  const me = schedulerOf(t).byTask.get(t);
  if (me) me.abort = () => ctl.abort();
  const verb = method === null ? (body === undefined ? 'GET' : 'POST') : form(method).toUpperCase();
  const watch = field(opts, 'progress');
  const shown = watch === null ? null : progressOf(t, watch);
  const p = (async (): Promise<Cell> => {
    const started = Date.now();
    let status: number | null = null;
    let problem: string | null = null;
    try {
      const init: RequestInit = { method: verb, headers, body, credentials, signal: ctl.signal };
      // a page being hidden may close: a small request still goes (an Undo notice ending sends its delete)
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && (body === undefined || (typeof body === 'string' && body.length < 60000))) init.keepalive = true;
      const res = shown !== null && typeof XMLHttpRequest !== 'undefined'
        ? await sendXhr(url, init, shown.tell)
        : await sendFetch(url, init, shown === null ? null : shown.tell);
      status = res.status;
      const type = res.headers.find(([k]) => k === 'content-type')?.[1] ?? '';
      const data = decodeBody(type, res.bytes);
      if (full) {
        const hs: Cell[] = [];
        for (const [k, val] of res.headers) hs.push(string(k), string(val));
        return {
          t: K.Object,
          ctx: {
            keys: ['status', 'headers', 'body'].map(n => intern(n)),
            vals: [{ t: K.Integer, v: res.status }, { t: K.Map, s: { data: hs } }, data],
            parent: null,
          },
        };
      }
      if (!res.ok) throw makeError('access', 'http', `HTTP ${res.status} ${res.statusText} for ${url}`);
      return data;
    } catch (e) {
      if ((e as Cell).t === K.Error) throw e;
      problem = timedOut ? 'timed out' : ctl.signal.aborted ? 'cancelled' : (e as Error).message;
      if (timedOut) throw makeError('access', 'timeout', `request to ${url} timed out`);
      if (ctl.signal.aborted) throw makeError('access', 'cancelled', `request to ${url} was cancelled`);
      throw makeError('access', 'network', `cannot reach ${url}: ${(e as Error).message}`);
    } finally {
      stopTimer?.();
      shown?.end();
      devLog.request(verb, url, status, Date.now() - started, problem);
    }
  })();
  return { k: 'await', p };
});
